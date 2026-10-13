import * as THREE from 'three';
import {sampleHand,solveElbow,clamp} from './motion.mjs';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const position=bone=>bone.getWorldPosition(V());
function setWorldQuaternion(bone,world){
 const parent=bone.parent.getWorldQuaternion(new THREE.Quaternion());
 bone.quaternion.copy(parent.invert().multiply(world));bone.updateWorldMatrix(false,true);
}
function aim(bone,child,target){
 const origin=position(bone),current=child instanceof THREE.Vector3?child.clone():position(child);
 const from=current.sub(origin).normalize(),to=target.clone().sub(origin).normalize();
 if(!from.lengthSq()||!to.lengthSq())return;
 const delta=new THREE.Quaternion().setFromUnitVectors(from,to);
 setWorldQuaternion(bone,delta.multiply(bone.getWorldQuaternion(new THREE.Quaternion())));
}
// Three-link FABRIK preserves the model's bone lengths and skin weights.
export function fingerChain(base,target,lengths){
 const distance=base.distanceTo(target),total=lengths.reduce((a,b)=>a+b,0),end=target.clone();
 if(distance>total-.001)end.copy(base).add(target.clone().sub(base).normalize().multiplyScalar(total-.001));
 const p=[base.clone()];
 for(let i=0;i<3;i++)p.push(p[i].clone().add(V(0,[.45,-.15,-.65][i],-.85).normalize().multiplyScalar(lengths[i])));
 for(let iteration=0;iteration<32;iteration++){
  p[3].copy(end);
  for(let i=2;i>=0;i--){const direction=p[i].clone().sub(p[i+1]).normalize();p[i].copy(p[i+1]).add(direction.multiplyScalar(lengths[i]));}
  p[0].copy(base);
  for(let i=0;i<3;i++){const direction=p[i+1].clone().sub(p[i]).normalize();p[i+1].copy(p[i]).add(direction.multiplyScalar(lengths[i]));}
  if(p[3].distanceTo(end)<.0005)break;
 }
 return {points:p,reachable:distance<=total,requested:target};
}
export function bindHumanPianist(model,scene,keyX,keyByMidi){
 const group=new THREE.Group();group.name='Harper pianist';group.add(model);scene.add(group);
 const meshes=[],bones=new Map();
 model.traverse(o=>{if(o.isSkinnedMesh){meshes.push(o);o.skeleton.pose();o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;}if(o.isBone)bones.set(o.name,o);if(/briefcase/i.test(o.name))o.visible=false;});
 const required=['pelvis','spine_01','spine_02','head'];
 for(const suffix of ['l','r']){required.push('upperarm_'+suffix,'lowerarm_'+suffix,'hand_'+suffix,'thigh_'+suffix,'calf_'+suffix,'foot_'+suffix);for(const finger of ['thumb','index','middle','ring','pinky'])for(let i=1;i<=3;i++)required.push(finger+'_0'+i+'_'+suffix)}
 for(const name of required)if(!bones.has(name))throw Error('Character is missing required joint: '+name);
 model.updateMatrixWorld(true);group.scale.setScalar(9.2);group.rotation.y=Math.PI;group.updateMatrixWorld(true);
 group.position.copy(V(0,-1.92,3.7).sub(position(bones.get('pelvis'))));group.updateMatrixWorld(true);
 const rest=new Map([...bones].map(([name,b])=>[name,b.quaternion.clone()]));
 const restPositions=new Map([...bones].map(([name,b])=>[name,b.position.clone()]));
 const pelvis=bones.get('pelvis'),pelvisRest=pelvis.position.clone();
 const hands=['l','r'].map((suffix,h)=>{
  const upper=bones.get('upperarm_'+suffix),lower=bones.get('lowerarm_'+suffix),wrist=bones.get('hand_'+suffix);
  const upperLength=position(upper).distanceTo(position(lower)),lowerLength=position(lower).distanceTo(position(wrist));
  const fingers=(h===0?['pinky','ring','middle','index','thumb']:['thumb','index','middle','ring','pinky']).map(name=>{
   const chain=[1,2,3].map(i=>bones.get(name+'_0'+i+'_'+suffix));
   const lastLocal=V(0,clamp(chain[2].position.length()*.85,.012,.028),0);
   const lengths=[position(chain[0]).distanceTo(position(chain[1])),position(chain[1]).distanceTo(position(chain[2])),lastLocal.length()*chain[2].getWorldScale(V()).x];
   return {name,bones:chain,lastLocal,lengths,tip:V(),target:V(),error:0,reachable:true};
  });
  const orientation=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(V(0,h===0?-1:1,0),V(0,0,-1),V(h===0?1:-1,0,0)));
  orientation.premultiply(new THREE.Quaternion().setFromAxisAngle(V(0,0,1),h===0?-.8:.8));
  for(const finger of fingers)finger.baseOffset=finger.bones[0].position.clone().multiplyScalar(wrist.getWorldScale(V()).x).applyQuaternion(orientation);
  return {h,suffix,upper,lower,wrist,upperLength,lowerLength,fingers,orientation,x:null};
 });
 function fitWrist(hand,state,preferred){
  const held=state.fingers.map((p,f)=>({pose:p,finger:hand.fingers[f]})).filter(x=>x.pose.pressed);
  if(!held.length)return preferred;
  let best={cost:Infinity,point:preferred};
  for(let y=.22;y<=.52;y+=.025)for(let z=.85;z<=1.55;z+=.05){
   let lo=-Infinity,hi=Infinity,centers=[];
   for(const {pose,finger} of held){
    const key=keyByMidi.get(pose.note.midi),black=!key.userData.white;
    const target=V(keyX.get(pose.note.midi),key.position.y+(black?.11:.08)+.035,black?-.08:finger.name==='thumb'?.67:.29);
    const offset=finger.baseOffset,length=finger.lengths.reduce((a,b)=>a+b,0)*.985;
    const remaining=length*length-(target.y-y-offset.y)**2-(target.z-z-offset.z)**2;
    const center=target.x-offset.x,reach=Math.sqrt(Math.max(0,remaining));lo=Math.max(lo,center-reach);hi=Math.min(hi,center+reach);centers.push(center);
   }
   const average=centers.reduce((a,b)=>a+b,0)/centers.length,x=lo<=hi?clamp(average,lo,hi):(lo+hi)/2;
   const point=V(x,y,z);let cost=(x-preferred.x)**2*.008+(y-.38)**2*.02+(z-1.2)**2*.02;
   for(const {pose,finger} of held){const key=keyByMidi.get(pose.note.midi),black=!key.userData.white;const target=V(keyX.get(pose.note.midi),key.position.y+(black?.11:.08)+.035,black?-.08:finger.name==='thumb'?.67:.29);const excess=point.clone().add(finger.baseOffset).distanceTo(target)-finger.lengths.reduce((a,b)=>a+b,0)*.985;cost+=Math.max(0,excess)**2*100;}
   if(cost<best.cost)best={cost,point};
  }
  return best.point;
 }
 function seatLegs(){
  for(const [h,suffix] of ['l','r'].entries()){
   const thigh=bones.get('thigh_'+suffix),calf=bones.get('calf_'+suffix),foot=bones.get('foot_'+suffix),hip=position(thigh);
   const a=hip.distanceTo(position(calf)),b=position(calf).distanceTo(position(foot));
   const knee=hip.clone().add(V(0,-.20,-Math.sqrt(Math.max(0,a*a-.04))));aim(thigh,calf,knee);
   const actualKnee=position(calf),dy=Math.max(-b*.995,-6.12-actualKnee.y),dz=Math.sqrt(Math.max(0,b*b-dy*dy)),ankle=actualKnee.clone().add(V(0,dy,dz));const virtualEnd=calf.localToWorld(V(0,b/calf.getWorldScale(V()).x,0));aim(calf,virtualEnd,ankle);foot.position.copy(foot.parent.worldToLocal(ankle));foot.updateWorldMatrix(false,true);

  }
 }
 let previousTime=null;
 function update(t,plans){
  const delta=previousTime===null?1:Math.max(0,t-previousTime),reset=previousTime===null||t<previousTime||delta>.3;previousTime=t;
  for(const [name,b] of bones){b.quaternion.copy(rest.get(name));b.position.copy(restPositions.get(name));}pelvis.position.copy(pelvisRest);
  const states=plans.map((p,h)=>sampleHand(p,t,keyX,h));
  const lean=clamp((states[0].x+states[1].x)*.055,-.28,.28);pelvis.position.x-=lean/9.2;
  bones.get('spine_01').quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(V(1,0,0),-.055));
  group.updateMatrixWorld(true);seatLegs();
  hands.forEach((hand,h)=>{
   const state=states[h];hand.x=reset?state.x:(hand.x??state.x)+(state.x-(hand.x??state.x))*(1-Math.exp(-delta*18));
   const blackCount=state.active.filter(e=>!keyByMidi.get(e.midi)?.userData.white).length;
   const z=1.38-(state.active.length?blackCount/state.active.length*.28:0),desired=fitWrist(hand,state,V(hand.x,.35,z));
   const shoulder=position(hand.upper),direction=desired.clone().sub(shoulder),limit=hand.upperLength+hand.lowerLength-.01;
   if(direction.length()>limit)desired.copy(shoulder).add(direction.setLength(limit));
   const elbow=V(...solveElbow(shoulder.toArray(),desired.toArray(),hand.upperLength,hand.lowerLength,h===0?-1:1));
   aim(hand.upper,hand.lower,elbow);aim(hand.lower,hand.wrist,desired);setWorldQuaternion(hand.wrist,hand.orientation);
   hand.fingers.forEach((finger,f)=>{
    const pose=state.fingers[f],chain=finger.bones,base=position(chain[0]);
    const key=pose.note?keyByMidi.get(pose.note.midi):null,isBlack=key&&!key.userData.white;
    const surface=key?key.position.y+(isBlack?.11:.08):.04;
    const restTip=base.clone().add(V(0,-.19,-finger.lengths.reduce((a,b)=>a+b,0)*.62));
    const desiredTip=key?V(keyX.get(pose.note.midi),surface+.035+(pose.pressed?0:.13*(1-pose.weight)),isBlack?-.08:finger.name==='thumb'?.67:.29):restTip;
    const target=restTip.clone().lerp(desiredTip,pose.weight),solved=fingerChain(base,target,finger.lengths);
    for(let i=0;i<3;i++){const end=i<2?chain[i+1]:chain[2].localToWorld(finger.lastLocal.clone());aim(chain[i],end,solved.points[i+1])}
    finger.tip.copy(chain[2].localToWorld(finger.lastLocal.clone()));finger.target.copy(target);finger.error=finger.tip.distanceTo(target);finger.reachable=solved.reachable;if(pose.pressed&&finger.error>.07)state.reachLimited=true;
   });
  });
  group.updateMatrixWorld(true);for(const mesh of meshes)mesh.skeleton.update();return states;
 }
 update(0,[[],[]]);return {group,model,meshes,bones,hands,update};
}
