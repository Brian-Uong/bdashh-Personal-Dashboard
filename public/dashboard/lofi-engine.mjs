// Original instrumental loops, synthesized locally. No audio downloads or timers
// on the playback path: one stereo buffer loops on the browser's audio thread.
export const mixes={
 rain:{name:'Neon rain',bpm:76,chords:[[48,55,59,62,64],[45,52,55,59,60],[41,48,52,55,57],[43,50,53,57,59]],seed:83},
 night:{name:'After hours',bpm:68,chords:[[50,57,60,64,65],[43,50,53,57,59],[48,55,59,62,64],[45,52,55,59,60]],seed:211}
};
const frequency=note=>440*2**((note-69)/12);
function random(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}

export async function renderMix(key,sampleRate=32000){
 const mix=mixes[key]||mixes.rain,beat=60/mix.bpm,bar=4*beat,duration=bar*8;
 const Offline=globalThis.OfflineAudioContext||globalThis.webkitOfflineAudioContext;
 if(!Offline)throw Error('Audio is unavailable in this browser.');
 // Render two cycles and retain the second, including the first cycle's tails.
 const frames=Math.round(duration*sampleRate),ctx=new Offline(2,frames*2,sampleRate),rng=random(mix.seed);
 const master=ctx.createGain();master.gain.value=.7;master.connect(ctx.destination);
 const lowpass=ctx.createBiquadFilter();lowpass.type='lowpass';lowpass.frequency.value=3800;lowpass.Q.value=.45;lowpass.connect(master);
 const delay=ctx.createDelay(1);delay.delayTime.value=beat*.75;
 const wet=ctx.createGain();wet.gain.value=.16;delay.connect(wet);wet.connect(lowpass);
 const feedback=ctx.createGain();feedback.gain.value=.23;delay.connect(feedback);feedback.connect(delay);
 const noise=ctx.createBuffer(1,sampleRate,sampleRate),samples=noise.getChannelData(0);
 for(let i=0;i<samples.length;i++)samples[i]=rng()*2-1;
 const connect=(node,pan=0,echo=false)=>{const p=ctx.createStereoPanner();p.pan.value=pan;node.connect(p);p.connect(lowpass);if(echo)p.connect(delay);};
 const tone=(note,time,length,level,pan=0,bass=false)=>{
  const gain=ctx.createGain(),osc=ctx.createOscillator(),harmonic=ctx.createOscillator(),overtone=ctx.createGain();
  const f=frequency(note);osc.type='sine';osc.frequency.setValueAtTime(f,time);osc.frequency.linearRampToValueAtTime(f*.9992,time+length);
  harmonic.type='sine';harmonic.frequency.value=f*(bass?2:3);overtone.gain.value=bass?.12:.10;
  gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(level,time+.016);gain.gain.exponentialRampToValueAtTime(Math.max(level*.2,.0001),time+length*.55);gain.gain.exponentialRampToValueAtTime(.0001,time+length);
  osc.connect(gain);harmonic.connect(overtone);overtone.connect(gain);connect(gain,pan,!bass);
  osc.start(time);harmonic.start(time);osc.stop(time+length+.02);harmonic.stop(time+length+.02);
 };
 const kick=time=>{
  const osc=ctx.createOscillator(),gain=ctx.createGain();osc.frequency.setValueAtTime(115,time);osc.frequency.exponentialRampToValueAtTime(43,time+.16);
  gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(.32,time+.005);gain.gain.exponentialRampToValueAtTime(.0001,time+.32);
  osc.connect(gain);gain.connect(master);osc.start(time);osc.stop(time+.34);
 };
 const brush=(time,hat=false,level=1)=>{
  const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();source.buffer=noise;
  filter.type='bandpass';filter.frequency.value=hat?6500:1700;filter.Q.value=hat?.7:.5;
  const length=hat?.055:.16;gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime((hat?.026:.07)*level,time+.003);gain.gain.exponentialRampToValueAtTime(.0001,time+length);
  source.connect(filter);filter.connect(gain);connect(gain,hat?.3:-.12);source.start(time,(time*.17)%(.8));source.stop(time+length+.01);
 };
 for(let cycle=0;cycle<2;cycle++)for(let b=0;b<8;b++){
  const start=cycle*duration+b*bar,chord=mix.chords[Math.floor(b/2)];
  for(const [hit,velocity] of [[0,1],[2.65,.65]])chord.slice(1).forEach((note,i)=>tone(note+12,start+hit*beat+i*.012,beat*(hit===0?2.7:1.3),.075*velocity,(i-1.5)*.2));
  tone(chord[0]-12,start+.008,beat*1.5,.20,0,true);tone(chord[0]-12,start+beat*2.5,beat*.95,.14,0,true);
  kick(start);kick(start+beat*(b%2?2.5:2));if(b%4===3)kick(start+beat*3.5);
  brush(start+beat+.025);brush(start+beat*3+.025);
  for(let h=0;h<8;h++)brush(start+(h*.5+(h%2?.065:0))*beat,true,h%2?.65:1);
  // Sparse pentatonic phrases leave room for concentration.
  if(b%2){const notes=[chord[3]+12,chord[4]+12,chord[2]+12];notes.forEach((note,i)=>tone(note,start+beat*(.75+i*.75),beat*.9,.039,[-.22,.2,-.1][i]));}
 }
 const rendered=await ctx.startRendering(),buffer=ctx.createBuffer(2,frames,sampleRate);
 let peak=0;for(let channel=0;channel<2;channel++){const out=buffer.getChannelData(channel);out.set(rendered.getChannelData(channel).subarray(frames,frames*2));for(const v of out)peak=Math.max(peak,Math.abs(v));}
 const scale=peak>0?.74/peak:1;
 for(let channel=0;channel<2;channel++){
  const out=buffer.getChannelData(channel);for(let i=0;i<frames;i++)out[i]=Math.tanh(out[i]*scale);
  // A short boundary blend removes sub-sample seams without fading each loop.
  const tail=out[frames-1],n=128;for(let i=0;i<n;i++)out[i]=tail*(1-i/n)+out[i]*(i/n);
 }
 return buffer;
}

export class LofiPlayer{
 constructor(onState=()=>{}){this.onState=onState;this.context=null;this.output=null;this.source=null;this.buffers=new Map();this.key='rain';this.volume=.22;this.wanted=false;this.revision=0;this.offset=0;this.startedAt=0;}
 async play(key=this.key){
  const revision=++this.revision;this.wanted=true;
  try{
   const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Audio)throw Error('Audio is unavailable in this browser.');
   if(!this.context){this.context=new Audio();this.output=this.context.createGain();this.output.gain.value=0;this.output.connect(this.context.destination);this.context.onstatechange=()=>{if(this.wanted)this.onState(this.context.state==='running'&&this.source?'playing':this.context.state==='running'?'loading':'interrupted');};}
   // Resume synchronously from the user's gesture, before any rendering awaits.
   const resumed=this.context.resume();this.onState('loading');
   if(!this.buffers.has(key)){const rendered=renderMix(key).catch(error=>{this.buffers.delete(key);throw error;});this.buffers.set(key,rendered);}
   const [,buffer]=await Promise.all([resumed,this.buffers.get(key)]);
   if(revision!==this.revision||!this.wanted)return;
   if(this.context.state!=='running')throw Error('Playback is paused by your browser. Press Play to resume.');
   const time=this.context.currentTime,old=this.source;
   this.output.gain.cancelScheduledValues(time);this.output.gain.setValueAtTime(this.output.gain.value,time);this.output.gain.linearRampToValueAtTime(0,time+.09);
   if(old)old.stop(time+.10);
   const source=this.context.createBufferSource();source.buffer=buffer;source.loop=true;source.connect(this.output);
   if(this.key!==key)this.offset=0;this.key=key;this.startedAt=time+.11;source.start(this.startedAt,this.offset%buffer.duration);this.source=source;
   source.onended=()=>{source.disconnect();if(!this.wanted&&!this.source&&this.context.state==='running')this.context.suspend().catch(()=>{});};this.output.gain.linearRampToValueAtTime(this.volume,time+.55);this.onState('playing');
  }catch(error){if(revision!==this.revision)return;this.wanted=false;this.onState('error',error.message);this.pause(false);}
 }
 pause(notify=true){
  this.wanted=false;this.revision++;const ctx=this.context,source=this.source;this.source=null;
  if(ctx&&source){const time=ctx.currentTime;this.offset=(this.offset+Math.max(0,time-this.startedAt))%source.buffer.duration;this.output.gain.cancelScheduledValues(time);this.output.gain.setValueAtTime(this.output.gain.value,time);this.output.gain.linearRampToValueAtTime(0,time+.12);try{source.stop(time+.14);}catch{} }
  else if(ctx&&ctx.state!=='closed')ctx.suspend().catch(()=>{});
  if(notify)this.onState('paused');
 }
 setVolume(value){this.volume=Math.max(0,Math.min(1,Number(value)||0));if(this.output&&this.wanted){const t=this.context.currentTime;this.output.gain.cancelScheduledValues(t);this.output.gain.setTargetAtTime(this.volume,t,.04);}}
 async close(){this.pause();await this.context?.close();}
}
