import {LofiPlayer} from './lofi-engine.mjs';
import {setupRadioDisclosure} from './radio-disclosure.mjs';
const storageKey='brians-dash-radio-v1',names={rain:'Neon rain',night:'After hours'};
let preference={mix:'rain',volume:22};
try{const saved=JSON.parse(localStorage.getItem(storageKey)||'null');if(saved&&Object.hasOwn(names,saved.mix))preference.mix=saved.mix;if(Number.isFinite(saved?.volume))preference.volume=Math.max(0,Math.min(100,saved.volume));}catch{/* Preferences are optional. */}
const persist=()=>{try{localStorage.setItem(storageKey,JSON.stringify(preference));}catch{}};
const playIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 11 7-11 7Z" fill="currentColor"/></svg>';
const pauseIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zm7 0h4v14h-4z" fill="currentColor"/></svg>';
const radio=document.createElement('section');radio.className='district-radio';radio.setAttribute('aria-label','Background music');
radio.innerHTML=`<button id="radioTab" class="radio-tab" type="button" aria-label="Open music player" aria-expanded="false" aria-controls="radioPanel"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V6l11-2v12M9 9l11-2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><ellipse cx="6" cy="18" rx="3" ry="2.5" fill="currentColor"/><ellipse cx="17" cy="16" rx="3" ry="2.5" fill="currentColor"/></svg><span>Music</span><i class="radio-tab-dot" aria-hidden="true"></i></button><div id="radioPanel" class="radio-panel" aria-label="District Radio controls" aria-hidden="true" inert><div id="radioSettings" class="radio-settings"><label for="radioMix">Lo-fi mix<select id="radioMix"><option value="rain">Neon rain · mellow keys</option><option value="night">After hours · slow groove</option></select></label><div class="radio-volume"><label for="radioVolume">Volume</label><output id="radioVolumeValue" for="radioVolume"></output><input id="radioVolume" type="range" min="0" max="100" step="1" aria-describedby="radioVolumeValue"></div><p>Original instrumental loops, made for your dashboard.</p></div><div class="radio-controls"><button id="radioPlay" class="radio-play" type="button" aria-label="Play background music">${playIcon}</button><div class="radio-title"><span>DISTRICT RADIO</span><strong id="radioTrack"></strong><small id="radioStatus" role="status" aria-live="polite">Lo-fi · press play</small></div><div class="radio-bars" aria-hidden="true"><i></i><i></i><i></i></div><button id="radioCollapse" class="radio-settings-toggle" type="button" aria-label="Close music player"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div></div>`;
document.body.append(radio);document.body.classList.add('has-district-radio');
const select=radio.querySelector('#radioMix'),volume=radio.querySelector('#radioVolume'),value=radio.querySelector('#radioVolumeValue'),button=radio.querySelector('#radioPlay'),status=radio.querySelector('#radioStatus'),title=radio.querySelector('#radioTrack');
select.value=preference.mix;volume.value=preference.volume;value.textContent=preference.volume+'%';title.textContent=names[preference.mix];
let player=null,state='paused',desired=false;
function paint(next,message){
 const began=next==='playing'&&state!=='playing';
 state=next;const active=next==='playing',waiting=next==='loading';radio.classList.toggle('is-playing',active);radio.classList.toggle('is-muted',preference.volume===0);
 button.innerHTML=active||waiting?pauseIcon:playIcon;button.setAttribute('aria-label',active?'Pause background music':waiting?'Cancel starting music':'Play background music');button.setAttribute('aria-busy',String(waiting));
 status.textContent=message||(waiting?'Preparing your mix…':active?(preference.volume===0?'Playing · volume muted':'Lo-fi · playing'):next==='interrupted'?'Tap play to resume':'Lo-fi · paused');
 if('mediaSession' in navigator)navigator.mediaSession.playbackState=active?'playing':'paused';
 if(next==='error'||next==='interrupted')desired=false;
 if(next==='playing')desired=true;
 if(began)channel?.postMessage('playing');
}
function metadata(){
 if('mediaSession' in navigator&&'MediaMetadata' in window)navigator.mediaSession.metadata=new MediaMetadata({title:names[preference.mix],artist:'Brian’s Dash',album:'District Radio'});
}
async function start(){
 desired=true;paint('loading');
 try{
  player||=new LofiPlayer(paint);player.setVolume(preference.volume/100);metadata();await player.play(preference.mix);
 }catch{desired=false;paint('error','Music could not start. Press play to retry.');}
}
function pause(){desired=false;player?.pause();paint('paused');}
button.addEventListener('click',()=>{if(desired)pause();else start();});
select.addEventListener('change',()=>{preference.mix=select.value;title.textContent=names[preference.mix];persist();if(desired)start();});
volume.addEventListener('input',()=>{preference.volume=Number(volume.value);value.textContent=preference.volume+'%';player?.setVolume(preference.volume/100);persist();paint(state);});
setupRadioDisclosure(radio);
if('mediaSession' in navigator){for(const [action,handler] of [['play',start],['pause',pause],['stop',pause]])try{navigator.mediaSession.setActionHandler(action,handler);}catch{}}
// Avoid overlapping audio when another dashboard tab starts its player.
let channel;try{channel=new BroadcastChannel('brians-dash-radio');channel.onmessage=event=>{if(event.data==='playing'&&desired){pause();status.textContent='Playing in another dashboard tab';}};}catch{}
window.addEventListener('pagehide',()=>{pause();});
