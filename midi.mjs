export function parseMidi(buffer){
  const d=new DataView(buffer);let p=0;
  function requireBytes(n){if(p+n>d.byteLength)throw Error('Truncated MIDI file.');}
  function byte(){requireBytes(1);return d.getUint8(p++)}
  function u16(){requireBytes(2);const v=d.getUint16(p);p+=2;return v}
  function u32(){requireBytes(4);const v=d.getUint32(p);p+=4;return v}
  function ascii(n){let s='';while(n--)s+=String.fromCharCode(byte());return s}
  function variable(){let v=0;for(let i=0;i<4;i++){const b=byte();v=v*128+(b&127);if(!(b&128))return v}throw Error('Invalid MIDI variable-length value.');}
  if(ascii(4)!=='MThd')throw Error('This file is not a standard MIDI file.');
  const len=u32(),headerEnd=p+len;if(len<6)throw Error('Invalid MIDI header.');
  const format=u16(),tracks=u16(),division=u16();p=headerEnd;
  if(format>1)throw Error('Use a format 0 or 1 MIDI file (one synchronized performance).');
  if(!division)throw Error('Invalid MIDI time division.');
  const raw=[],tempos=[{tick:0,tempo:500000}];
  for(let tr=0;tr<tracks;tr++){
    if(ascii(4)!=='MTrk')throw Error('Missing MIDI track.');const size=u32(),end=p+size;requireBytes(size);
    let tick=0,running=0;const active=new Map();
    while(p<end){
      tick+=variable();let status=byte();if(status<128){if(!running)throw Error('Invalid MIDI running status.');p--;status=running}else if(status<240)running=status;
      if(status===255){running=0;const type=byte(),n=variable();requireBytes(n);if(type===81&&n===3){const tempo=byte()*65536+byte()*256+byte();if(tempo>0)tempos.push({tick,tempo})}else p+=n;continue}
      if(status===240||status===247){running=0;const n=variable();requireBytes(n);p+=n;continue}
      if(status>=240)throw Error('Unsupported MIDI system event.');
      const kind=status&240,channel=status&15,a=byte(),b=(kind===192||kind===208)?0:byte();if(a>127||b>127)throw Error('Invalid MIDI event data.');
      const id=channel+':'+a;
      if(kind===144&&b>0){if(!active.has(id))active.set(id,[]);active.get(id).push({tick,velocity:b,midi:a,channel,track:tr})}
      else if(kind===128||(kind===144&&b===0)){const q=active.get(id);if(q?.length){const on=q.shift();if(channel!==9&&tick>on.tick)raw.push({...on,endTick:tick})}}
    }
    if(p!==end)throw Error('Invalid MIDI track length.');
    for(const q of active.values())for(const on of q)if(on.channel!==9&&tick>on.tick)raw.push({...on,endTick:tick});
  }
  let seconds;
  if(division&32768){const code=256-(division>>8),fps=code===29?29.97:code,tpf=division&255;if(![24,25,29,30].includes(code)||!tpf)throw Error('Invalid SMPTE time division.');seconds=tick=>tick/(fps*tpf)}
  else{
    tempos.sort((a,b)=>a.tick-b.tick);let time=0,lastTick=0,tempo=500000;const map=[];
    for(const e of tempos){time+=(e.tick-lastTick)*tempo/1e6/division;lastTick=e.tick;tempo=e.tempo;map.push({...e,time})}
    seconds=tick=>{let low=0,high=map.length;while(low<high){const mid=(low+high)>>1;if(map[mid].tick<=tick)low=mid+1;else high=mid}const e=map[Math.max(0,low-1)];return e.time+(tick-e.tick)*e.tempo/1e6/division};
  }
  return raw.map(e=>({midi:e.midi,start:seconds(e.tick),end:seconds(e.endTick),velocity:e.velocity,channel:e.channel,track:e.track})).sort((a,b)=>a.start-b.start);
}
