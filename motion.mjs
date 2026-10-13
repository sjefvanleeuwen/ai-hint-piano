// Spatially ordered fingers: LH little→thumb; RH thumb→little.
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x)};
function combinations(n,k,start=0,prefix=[],out=[]){if(!k){out.push(prefix);return out}for(let i=start;i<=n-k;i++)combinations(n,k-1,i+1,[...prefix,i],out);return out}
export function planFingering(events,keyX){
  const plans=[[],[]];let overflow=0;
  for(let h=0;h<2;h++){
    const notes=events.map((e,index)=>({...e,index})).filter(e=>(e.midi<66?0:1)===h).sort((a,b)=>a.start-b.start);
    const previous=Array(5).fill(null);
    for(let at=0;at<notes.length;){
      const onset=notes[at].start,group=[];
      while(at<notes.length&&notes[at].start<onset+.025)group.push(notes[at++]);
      const held=previous.filter(e=>e&&e.end>onset+.005);
      const pitches=[...new Set([...held,...group].map(e=>e.midi))].sort((a,b)=>a-b);
      if(pitches.length>5){overflow+=pitches.length-5;}
      const selected=pitches.slice(0,5);let best=null;
      const horizon=Math.min(onset+1.2,Math.max(...group.map(e=>e.end),onset));
      const futurePitches=[...new Set([...selected,...notes.slice(at).filter(e=>e.start<horizon).map(e=>e.midi)])].sort((a,b)=>a-b);
      for(const slots of combinations(5,selected.length)){
        let cost=0;const pairs=selected.map((m,i)=>({m,f:slots[i]}));
        for(const {m,f} of pairs){
          const prev=previous[f],x=keyX.get(m);
          if(prev&&prev.end>onset+.005&&prev.midi!==m)cost+=10000;
          const same=previous.findIndex(e=>e&&e.midi===m&&e.end>onset-.3);
          if(same>=0&&same!==f)cost+=3;
          if(prev)cost+=Math.abs(x-keyX.get(prev.midi))*.8;
          // Prefer the index/middle fingers for isolated notes; thumbs on white keys.
          cost+=Math.abs(f-2)*.3;
          if(futurePitches.length<=5&&futurePitches.length>selected.length){const rank=futurePitches.indexOf(m),preferred=Math.round(rank*4/(futurePitches.length-1));cost+=Math.abs(f-preferred)*8;}
          if(![0,2,4,5,7,9,11].includes(m%12)&&f===(h===0?4:0))cost+=.65;
        }
        for(let i=1;i<pairs.length;i++){
          const a=pairs[i-1],b=pairs[i],span=keyX.get(b.m)-keyX.get(a.m),gap=b.f-a.f;
          cost+=Math.pow(Math.max(0,span-gap*.42),2)*4;
        }
        if(!best||cost<best.cost)best={cost,pairs};
      }
      for(const e of group){const pair=best?.pairs.find(p=>p.m===e.midi);if(!pair)continue;
        const occupied=previous[pair.f];
        if(occupied&&occupied.end>onset+.005&&occupied.midi!==e.midi){overflow++;continue}
        const item={...e,finger:pair.f,hand:h};plans[h].push(item);
        previous[pair.f]=occupied?.midi===e.midi&&occupied.end>e.end?occupied:item;
      }
    }
    plans[h].sort((a,b)=>a.start-b.start);
  }
  return {plans,overflow};
}
export function sampleHand(plan,t,keyX,hand){
  const active=plan.filter(e=>e.start<=t&&t<e.end);
  const last=plan.filter(e=>e.start<=t).at(-1);
  const next=plan.find(e=>e.start>t);
  let notes=active.length?active:last?[last]:next?[next]:[];
  let x=notes.length?notes.reduce((s,e)=>s+keyX.get(e.midi)-(e.finger-2)*.26,0)/notes.length:hand===0?-1.7:1.7;
  if(!active.length&&last&&next){const mix=smooth((t-Math.max(last.end,next.start-.22))/(next.start-Math.max(last.end,next.start-.22)));x=(keyX.get(last.midi)-(last.finger-2)*.26)*(1-mix)+(keyX.get(next.midi)-(next.finger-2)*.26)*mix;}
  const fingers=Array.from({length:5},(_,f)=>{
    const held=active.filter(e=>e.finger===f).at(-1);
    const prior=plan.filter(e=>e.finger===f&&e.start<=t).at(-1);
    const upcoming=plan.find(e=>e.finger===f&&e.start>t&&e.start-t<.20);
    const e=held||upcoming||(prior&&t-prior.end<.14?prior:null);
    let weight=0;
    if(held)weight=1;else if(upcoming)weight=smooth(1-(upcoming.start-t)/.20);else if(e)weight=1-smooth((t-e.end)/.14);
    return {note:e,pressed:!!held,weight};
  });
  return {x:clamp(x,-6,6),fingers,active};
}
export function solveElbow(shoulder,wrist,upper=2.25,lower=2.15,side=1){
  const v=wrist.map((x,i)=>x-shoulder[i]),raw=Math.hypot(...v),d=clamp(raw,.001,upper+lower-.001),axis=v.map(x=>x/(raw||1));
  const along=(upper*upper-lower*lower+d*d)/(2*d),height=Math.sqrt(Math.max(0,upper*upper-along*along));
  const hint=[side,-.7,.15],dot=hint.reduce((s,x,i)=>s+x*axis[i],0),perp=hint.map((x,i)=>x-dot*axis[i]),len=Math.hypot(...perp)||1;
  return shoulder.map((x,i)=>x+axis[i]*along+perp[i]/len*height);
}
