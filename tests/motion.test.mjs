import test from 'node:test';
import assert from 'node:assert/strict';
import {planFingering,sampleHand,solveElbow} from '../motion.mjs';
import {parseMidi} from '../midi.mjs';
const keyX=new Map();let white=0;for(let m=21;m<=108;m++){if([0,2,4,5,7,9,11].includes(m%12))keyX.set(m,-6.45+12.9/52*(white+++.5));else keyX.set(m,-6.45+12.9/52*white)}
const note=(m,start,end)=>({midi:m,start,end,velocity:90});
test('chords preserve independent held fingers and note contact',()=>{
 const events=[note(72,0,2),note(76,0,2),note(79,0,2),note(74,.5,.8),note(77,1,1.3)];
 const {plans}=planFingering(events,keyX);
 for(let t=0;t<2;t+=.01){const s=sampleHand(plans[1],t,keyX,1);const fingers=new Map();for(const e of s.active){assert.ok(!fingers.has(e.finger)||fingers.get(e.finger)===e.midi,'held notes collide');fingers.set(e.finger,e.midi);assert.equal(s.fingers[e.finger].pressed,true)}assert.ok(Number.isFinite(s.x))}
});
test('hand path stays finite across pauses, resets, repeated notes and keyboard extremes',()=>{
 const events=[note(21,0,.2),note(60,1,1.1),note(60,1.04,1.3),note(108,4,4.1)];const {plans}=planFingering(events,keyX);
 for(let t=0;t<6;t+=.005)for(let h=0;h<2;h++){const s=sampleHand(plans[h],t,keyX,h);assert.ok(Number.isFinite(s.x));for(const f of s.fingers)assert.ok(Number.isFinite(f.weight))}
});
test('arm IK obeys both segment lengths for reachable wrists',()=>{
 const shoulder=[-1.55,2,3.52];for(const x of [-6,-4,-2,0,1]){const wrist=[x,.505,1.47],elbow=solveElbow(shoulder,wrist,3.1,2.9,-1);assert.ok(Math.abs(Math.hypot(...elbow.map((v,i)=>v-shoulder[i]))-3.1)<1e-6);assert.ok(Math.abs(Math.hypot(...elbow.map((v,i)=>v-wrist[i]))-2.9)<1e-6)}
});
function midi(tracks){const tag=x=>[...x].map(c=>c.charCodeAt(0));const n32=n=>[n>>>24,(n>>>16)&255,(n>>>8)&255,n&255];const bytes=[...tag('MThd'),0,0,0,6,0,1,0,tracks.length,1,224];for(const t of tracks)bytes.push(...tag('MTrk'),...n32(t.length),...t);return new Uint8Array(bytes).buffer}
test('tempo changes in a separate track apply globally to note starts and durations',()=>{
 const tempo=[0,255,81,3,7,161,32,131,96,255,81,3,15,66,64,0,255,47,0];
 const notes=[0,144,60,90,135,64,128,60,0,0,144,64,90,131,96,128,64,0,0,255,47,0];
 const result=parseMidi(midi([tempo,notes]));assert.equal(result[0].start,0);assert.equal(result[0].end,1.5);assert.equal(result[1].start,1.5);assert.equal(result[1].end,2.5);
});
test('overlapping same pitches use FIFO releases and percussion is excluded',()=>{
 const t=[0,144,60,90,10,60,80,10,128,60,0,10,60,0,0,153,36,90,10,137,36,0,0,255,47,0];const result=parseMidi(midi([t]));assert.equal(result.length,2);assert.ok(result[1].start>result[0].start);assert.ok(result[1].end>result[0].end);
});
test('malformed MIDI gives a useful error',()=>assert.throws(()=>parseMidi(new Uint8Array([77,84,104,100]).buffer),/Truncated/));
