import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {bindHumanPianist,fingerChain} from '../human-rig.mjs';
import {planFingering} from '../motion.mjs';
// Numeric skin/skeleton checks do not need a GPU or decoded texture pixels.
globalThis.self=globalThis;
globalThis.createImageBitmap=async()=>({width:1,height:1});
async function makeRig(){
 const bytes=fs.readFileSync(new URL('../assets/harper.glb',import.meta.url));
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const scene=new THREE.Scene(),keyX=new Map(),keys=new Map();let white=0;
 for(let m=21;m<=108;m++){const isWhite=[0,2,4,5,7,9,11].includes(m%12);keyX.set(m,-6.45+12.9/52*(white+(isWhite?.5:0)));if(isWhite)white++;keys.set(m,{position:{y:isWhite?-.075:.03},userData:{white:isWhite,baseY:isWhite?-.075:.03}})}
 return {rig:bindHumanPianist(gltf.scene,scene,keyX,keys),scene,keyX,keys};
}
test('three-link IK preserves lengths and reaches a valid key target',()=>{
 const base=new THREE.Vector3(0,.45,.8),target=new THREE.Vector3(.1,.035,.29),lengths=[.26,.22,.19];const result=fingerChain(base,target,lengths);
 assert.ok(result.points[3].distanceTo(target)<.002);for(let i=0;i<3;i++)assert.ok(Math.abs(result.points[i].distanceTo(result.points[i+1])-lengths[i])<1e-9);
});
test('packaged Harper has a complete human/finger rig and textured skinned meshes',async()=>{
 const {rig}=await makeRig();assert.equal(rig.bones.size,56);assert.equal(rig.hands.flatMap(h=>h.fingers).length,10);assert.ok(rig.meshes.some(m=>m.material.map));assert.ok(rig.meshes.some(m=>m.geometry.attributes.skinWeight));
});
test('MIDI drives the real skin rig without stretching bones or drifting while paused',async()=>{
 const {rig,keyX,keys}=await makeRig();const events=[{midi:48,start:0,end:1,velocity:90},{midi:60,start:0,end:1,velocity:90},{midi:64,start:0,end:1,velocity:90},{midi:67,start:0,end:1,velocity:90},{midi:72,start:0,end:.45,velocity:90},{midi:76,start:.5,end:.9,velocity:90}];
 const {plans}=planFingering(events,keyX);const restLengths=new Map([...rig.bones].map(([name,b])=>[name,b.position.length()]));
 for(let t=0;t<1;t+=1/30){for(const [m,key] of keys)key.position.y=key.userData.baseY+(events.some(e=>e.midi===m&&t>=e.start&&t<e.end)?-.12:0);const states=rig.update(t,plans);
  for(const bone of rig.bones.values())for(const v of [...bone.quaternion.toArray(),...bone.position.toArray()])assert.ok(Number.isFinite(v));
  for(let h=0;h<2;h++)for(let f=0;f<5;f++){const finger=rig.hands[h].fingers[f];if(states[h].fingers[f].pressed)assert.ok(finger.error<.07,`finger misses key at ${t}, hand ${h}, finger ${f}, note ${states[h].fingers[f].note.midi}, error ${finger.error}, reachable ${finger.reachable}`);for(const bone of finger.bones)assert.ok(Math.abs(bone.position.length()-restLengths.get(bone.name))<1e-9)}
 }
 rig.update(.7,plans);const before=rig.hands[1].fingers[2].tip.clone();rig.update(.7,plans);assert.ok(before.distanceTo(rig.hands[1].fingers[2].tip)<1e-7);
 const head=rig.bones.get('head').getWorldPosition(new THREE.Vector3());assert.ok(head.y>4&&head.y<5.5);for(const suffix of ['l','r'])assert.ok(rig.bones.get('foot_'+suffix).getWorldPosition(new THREE.Vector3()).y>-6.3);
});
