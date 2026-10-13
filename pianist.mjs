import * as THREE from 'three';
import {sampleHand,solveElbow} from './motion.mjs';
export function createPianist(scene,keyX,keyByMidi){
  const group=new THREE.Group();scene.add(group);
  const material=(color,roughness=.68)=>new THREE.MeshStandardMaterial({color,roughness});
  const skin=material('#d6af92'),cloth=material('#46657b'),pants=material('#263647'),hair=material('#39302c'),shoe=material('#222a31');
  const sphere=new THREE.SphereGeometry(1,20,14),cylinder=new THREE.CylinderGeometry(1,1,1,12);
  function ellipsoid(scale,pos,mat,parent=group){const m=new THREE.Mesh(sphere,mat);m.scale.set(...scale);m.position.set(...pos);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
  function segment(mat,r1,r2,parent=group){const m=new THREE.Mesh(cylinder,mat);m.userData={r1,r2};m.castShadow=true;parent.add(m);return m}
  const axis=new THREE.Vector3(0,1,0),a=new THREE.Vector3(),b=new THREE.Vector3();
  function link(m,p,q){a.set(...p);b.set(...q);m.position.copy(a).add(b).multiplyScalar(.5);const delta=b.sub(a);m.quaternion.setFromUnitVectors(axis,delta.clone().normalize());m.scale.set(m.userData.r1,delta.length(),m.userData.r2)}
  ellipsoid([1.05,.72,.63],[0,-1.5,3.65],pants);
  const torso=ellipsoid([1.75,1.75,.65],[0,.65,3.55],cloth);
  const neck=ellipsoid([.32,.48,.33],[0,2.57,3.4],skin);
  const head=new THREE.Group();head.position.set(0,3.48,3.26);group.add(head);
  ellipsoid([.64,.87,.64],[0,0,0],skin,head);
  ellipsoid([.66,.47,.62],[0,.52,.10],hair,head);
  ellipsoid([.13,.18,.17],[0,-.06,-.60],skin,head);
  for(const sign of [-1,1]){ellipsoid([.09,.055,.035],[sign*.23,.13,-.59],shoe,head);ellipsoid([.13,.22,.12],[sign*.62,0,0],skin,head);}
  head.rotation.x=.14;
  for(const sign of [-1,1]){
    const hip=[sign*.63,-1.7,3.6],knee=[sign*.77,-2.9,1.72],ankle=[sign*.72,-5.35,2.0];
    link(segment(pants,.40,.40),hip,knee);link(segment(pants,.29,.29),knee,ankle);
    ellipsoid([.38,.24,.7],[sign*.72,-5.65,1.57],shoe);
  }
  const hands=[];
  for(let h=0;h<2;h++){
    const sign=h===0?-1:1;
    const upper=segment(cloth,.33,.33),forearm=segment(cloth,.25,.25),elbow=ellipsoid([.28,.28,.28],[0,0,0],cloth);
    const wrist=ellipsoid([.20,.17,.24],[0,0,0],skin);
    const palm=ellipsoid([.59,.18,.40],[0,0,0],skin);
    const fingers=Array.from({length:5},(_,f)=>{
      const thumb=f===(h===0?4:0),radius=thumb?.10:.075;
      return {thumb,segments:[segment(skin,radius,radius),segment(skin,radius*.87,radius*.87),segment(skin,radius*.75,radius*.75)],joints:[ellipsoid([radius,radius,radius],[0,0,0],skin),ellipsoid([radius*.85,radius*.85,radius*.85],[0,0,0],skin)],tip:ellipsoid([radius*.78,radius*.65,radius*.82],[0,0,0],skin)};
    });
    hands.push({sign,upper,forearm,elbow,wrist,palm,fingers});
  }
  let previousTime=null;
  function update(t,plans){
    const delta=previousTime===null?1:Math.max(0,t-previousTime),reset=previousTime===null||t<previousTime||delta>.3;previousTime=t;
    const states=plans.map((p,h)=>sampleHand(p,t,keyX,h));
    const lean=THREE.MathUtils.clamp((states[0].x+states[1].x)*.12,-.65,.65);
    torso.position.x=lean*.45;neck.position.x=lean*.45;head.position.x=lean*.45;torso.rotation.z=-lean*.07;
    hands.forEach((hand,h)=>{
      const state=states[h];hand.x=reset?state.x:(hand.x??state.x)+(state.x-(hand.x??state.x))*(1-Math.exp(-delta*18));const x=hand.x,palmY=.49,palmZ=1.14,wrist=[x,palmY+.015,1.47];
      hand.palm.position.set(x,palmY,palmZ);hand.wrist.position.set(...wrist);
      const shoulder=[hand.sign*1.55+lean*.45,2.0,3.52],e=solveElbow(shoulder,wrist,3.10,2.90,hand.sign);
      link(hand.upper,shoulder,e);link(hand.forearm,e,wrist);hand.elbow.position.set(...e);
      hand.fingers.forEach((finger,f)=>{
        const pose=state.fingers[f],restX=x+(f-2)*.26;
        const base=[restX,palmY+.015,palmZ-.25];
        const key=pose.note?keyByMidi.get(pose.note.midi):null;
        const tx=pose.note?keyX.get(pose.note.midi):restX;
        const isBlack=key&&!key.userData.white;
        const restZ=finger.thumb?.64:.28;
        const tip=[restX+(tx-restX)*pose.weight,
          pose.pressed?key.position.y+(isBlack?.11:.08)+.052:.25+(1-pose.weight)*.08,
          restZ+((isBlack?-.10:.28)-restZ)*pose.weight];
        // Curved phalanges with independently moving knuckles and a stable contact point.
        const spread=tip[0]-base[0],reach=tip[2]-base[2];
        const knuckle=[base[0]+spread*.27,palmY+.18,base[2]+reach*.30];
        const distal=[base[0]+spread*.72,Math.max(tip[1]+.16,palmY-.01),base[2]+reach*.72];
        link(finger.segments[0],base,knuckle);link(finger.segments[1],knuckle,distal);link(finger.segments[2],distal,tip);
        finger.joints[0].position.set(...knuckle);finger.joints[1].position.set(...distal);finger.tip.position.set(...tip);
      });
    });
    return states;
  }
  return {group,hands,update};
}
