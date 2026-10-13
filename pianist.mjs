import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {bindHumanPianist} from './human-rig.mjs';
import {sampleHand} from './motion.mjs';
export function createPianist(scene,keyX,keyByMidi){
 const pianist={loaded:false,rig:null,update(t,plans){return this.rig?this.rig.update(t,plans):plans.map((p,h)=>sampleHand(p,t,keyX,h))}};
 pianist.ready=new GLTFLoader().loadAsync(new URL('./assets/harper.glb',import.meta.url).href).then(gltf=>{
  pianist.rig=bindHumanPianist(gltf.scene,scene,keyX,keyByMidi);pianist.loaded=true;return pianist;
 });
 return pianist;
}
