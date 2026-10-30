import {createMissilePov,POV_START,POV_END} from './missile-pov.mjs';
import {orbitalPoint,drawOrbitalBackdrop,drawOrbitalTrack} from './orbital-scene.mjs';
export function setSkipped(state,id,skip,at=Date.now()){const next={...state};if(skip)next[id]=at;else delete next[id];return next;}
export function screenArc(a,b,value){const t=Math.max(0,Math.min(1,value)),rise=Math.max(12,Math.min(150,Math.hypot(b.x-a.x,b.y-a.y)*.32,Math.min(a.y,b.y)-25));return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t-4*t*(1-t)*rise};}

export const CINEMATIC_ORIGIN=[103.8198,1.3521];
export const CINEMATIC_DURATION=8000;
// Keep every storyboard beat in sync while playing the full sequence in eight seconds.
export const CINEMATIC_RATE=15000/CINEMATIC_DURATION;
const clamp=n=>Math.max(0,Math.min(1,n));
const smooth=n=>{const t=clamp(n);return t*t*(3-2*t)};
const mix=(a,b,t)=>a+(b-a)*t;
// A hand-authored map-camera storyboard, not a real-world flight model.
export function cinematicFrame(milliseconds,destination){
 const elapsed=Math.max(0,Math.min(CINEMATIC_DURATION,milliseconds)),ms=elapsed*CINEMATIC_RATE,end=[destination[0]<CINEMATIC_ORIGIN[0]?destination[0]+360:destination[0],destination[1]],travel=smooth((ms-2200)/6300),approach=smooth((ms-8500)/3500);
 const position=ms<8500?[mix(CINEMATIC_ORIGIN[0],end[0],travel),mix(CINEMATIC_ORIGIN[1],end[1],travel)+Math.sin(travel*Math.PI)*23]:end;
 const phase=ms>=15000?'complete':ms>=12000?'impact':ms>=8500?'approach':ms>=2200?'transit':'launch';
 let center,zoom;
 if(ms<2200){center=[171,21];zoom=1.4;}
 else if(ms<8500){const follow=smooth((ms-2200)/1700);center=[mix(171,position[0],follow),mix(21,position[1],follow)];zoom=mix(1.4,3,travel);}
 else{center=end;zoom=mix(3,15,approach);}
 const lift=ms<2200?mix(0,100,smooth(ms/2200)):ms<8500?100:mix(100,0,approach);
 return {phase,position,camera:{center,zoom},lift,size:ms<2200?mix(1.3,1,smooth(ms/2200)):ms<8500?1:mix(1,.55,approach),remaining:Math.max(0,(CINEMATIC_DURATION-elapsed)/1000),elapsed,storyElapsed:ms,progress:elapsed/CINEMATIC_DURATION};
}
function drawMissile(ctx,p,angle,scale,clock){
 ctx.save();ctx.translate(p.x,p.y);ctx.rotate(angle);ctx.scale(scale,scale);
 const exhaust=ctx.createLinearGradient(-42,0,-118,0);exhaust.addColorStop(0,'#fff7d1');exhaust.addColorStop(.2,'#ffd56b');exhaust.addColorStop(.55,'rgba(255,107,18,.9)');exhaust.addColorStop(1,'rgba(140,30,6,0)');ctx.fillStyle=exhaust;ctx.shadowBlur=15;ctx.shadowColor='#f6b249';ctx.beginPath();ctx.moveTo(-41,-6);ctx.bezierCurveTo(-67,-14,-88,-4,-122-Math.sin(clock/34)*8,0);ctx.bezierCurveTo(-86,4,-66,14,-41,6);ctx.fill();ctx.shadowBlur=0;
 const body=ctx.createLinearGradient(0,-9,0,9);body.addColorStop(0,'#303a3b');body.addColorStop(.15,'#87928a');body.addColorStop(.4,'#e4e5d6');body.addColorStop(.6,'#b3b9ac');body.addColorStop(.86,'#515d55');body.addColorStop(1,'#242e2b');ctx.fillStyle=body;ctx.fillRect(-40,-8,69,16);
 ctx.fillStyle='#48534b';ctx.fillRect(-40,-8,9,16);ctx.fillStyle='#1b2321';ctx.fillRect(-43,-6,4,12);ctx.fillStyle='#b8c0b3';ctx.fillRect(-30,-8,2,16);ctx.fillRect(13,-8,2,16);
 const nose=ctx.createLinearGradient(25,-8,46,6);nose.addColorStop(0,'#d9dbcd');nose.addColorStop(.45,'#f0ecdc');nose.addColorStop(1,'#66746c');ctx.fillStyle=nose;ctx.beginPath();ctx.moveTo(28,-8);ctx.bezierCurveTo(35,-7,42,-3,49,0);ctx.bezierCurveTo(42,3,35,7,28,8);ctx.closePath();ctx.fill();
 ctx.strokeStyle='rgba(27,38,34,.6)';ctx.lineWidth=.6;[-21,-3,19].forEach(x=>{ctx.beginPath();ctx.moveTo(x,-8);ctx.lineTo(x,8);ctx.stroke()});ctx.strokeStyle='#f1efde99';ctx.beginPath();ctx.moveTo(-27,-4);ctx.lineTo(24,-4);ctx.stroke();
 ctx.fillStyle='#3c4741';ctx.font='bold 5px monospace';ctx.textAlign='center';ctx.fillText('RS-28',-7,2);ctx.fillStyle='#914b35';ctx.fillRect(18,-7,6,1.5);ctx.fillStyle='#252e2b';ctx.fillRect(-39,-9,7,2);ctx.fillRect(-39,7,7,2);
 ctx.restore();
}
export function playNopeEffect(stage,destination,{reduced=false,signal,onImpact=()=>{},onFrame=()=>{},project,camera}={}){
 return new Promise(resolve=>{
  const canvas=document.createElement('canvas');canvas.className='nope-fx-canvas';canvas.setAttribute('aria-hidden','true');stage.append(canvas);const width=stage.clientWidth,height=stage.clientHeight,dpr=Math.min(devicePixelRatio||1,2);canvas.width=width*dpr;canvas.height=height*dpr;const ctx=canvas.getContext('2d');
  if(!ctx){canvas.remove();resolve({impacted:false,unavailable:true});return;}
  ctx.scale(dpr,dpr);const drawPov=createMissilePov();const orbital=document.createElement('canvas');orbital.width=width*dpr;orbital.height=height*dpr;const orbitCtx=orbital.getContext('2d');if(orbitCtx){orbitCtx.scale(dpr,dpr);drawOrbitalBackdrop(orbitCtx,width,height);}let raf=0,impacted=false,done=false,begin,previous,flames=[],smoke=[],sparks=[],lastCamera=-Infinity;const flight=12000,tail=3000;
  const finish=()=>{if(done)return;done=true;cancelAnimationFrame(raf);canvas.remove();stage.classList.remove('nope-impact');signal?.removeEventListener('abort',finish);resolve({impacted,duration:begin?performance.now()-begin:0});};signal?.addEventListener('abort',finish,{once:true});if(signal?.aborted){finish();return;}
  const glow=(x,y,r,colours,alpha=1)=>{if(r<=0)return;ctx.globalAlpha=alpha;const g=ctx.createRadialGradient(x,y,0,x,y,r);colours.forEach(([stop,colour])=>g.addColorStop(stop,colour));ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;};const rand=(low,high)=>low+Math.random()*(high-low);
  const mapPositionAt=ms=>{const frame=cinematicFrame(ms/CINEMATIC_RATE,destination),p=project(frame.position);return {x:p.x,y:p.y-frame.lift};};
  const positionAt=ms=>{const mapPoint=mapPositionAt(ms);if(reduced||ms>=9400)return mapPoint;const orbit=orbitalPoint(ms,width,height),blend=smooth((ms-8500)/900);return {x:mix(orbit.x,mapPoint.x,blend),y:mix(orbit.y,mapPoint.y,blend)};};
  function blast(b){impacted=true;onImpact();if(!reduced)stage.classList.add('nope-impact');for(let i=0;i<(reduced?6:74);i++){const angle=rand(0,Math.PI*2),speed=rand(12,110);flames.push({x:b.x,y:b.y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed-25,r:rand(10,35),life:rand(.7,1.8)});}for(let i=0;i<(reduced?3:36);i++)smoke.push({x:b.x+rand(-20,20),y:b.y+rand(-15,15),vx:rand(-18,18),vy:rand(-50,-15),r:rand(13,30),life:rand(2,3.5)});for(let i=0;i<(reduced?0:64);i++){const angle=rand(-Math.PI,0),speed=rand(40,210);sparks.push({x:b.x,y:b.y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,life:rand(.6,1.7)});}}
  const draw=stamp=>{
   if(done)return;begin??=stamp;previous??=stamp;const actualElapsed=Math.min(CINEMATIC_DURATION,stamp-begin),elapsed=actualElapsed*CINEMATIC_RATE,dt=Math.min((stamp-previous)/1000*CINEMATIC_RATE,.05),story=cinematicFrame(actualElapsed,destination);previous=stamp;
   if(elapsed-lastCamera>=50||elapsed>=flight&&lastCamera<flight){camera(story.camera,{reduced,phase:story.phase});lastCamera=elapsed;}onFrame(story);ctx.clearRect(0,0,width,height);
   if(!reduced&&elapsed<POV_START){ctx.save();ctx.globalAlpha=1-smooth((elapsed-8500)/900);ctx.drawImage(orbital,0,0,width,height);drawOrbitalTrack(ctx,elapsed,width,height);ctx.restore();}
   if(elapsed<flight){const origin=project(CINEMATIC_ORIGIN),target=project([destination[0]<103.8198?destination[0]+360:destination[0],destination[1]]);
    if(reduced||elapsed>=8500){ctx.save();ctx.globalAlpha=reduced?1:smooth((elapsed-8500)/900);ctx.lineCap='round';ctx.setLineDash([1,8]);ctx.lineWidth=2;ctx.strokeStyle='rgba(231,191,109,.72)';ctx.beginPath();for(let ms=0;ms<=flight;ms+=100){const p=mapPositionAt(ms);if(ms===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);}ctx.stroke();ctx.strokeStyle='rgba(143,224,218,.95)';ctx.lineWidth=2.2;ctx.beginPath();for(let ms=0;ms<=elapsed;ms+=75){const p=mapPositionAt(ms);if(ms===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);}const tip=mapPositionAt(elapsed);ctx.lineTo(tip.x,tip.y);ctx.stroke();ctx.restore();}
    if((reduced||elapsed>=9400)&&origin.x>-80&&origin.x<width+80&&origin.y>-80&&origin.y<height+80){ctx.strokeStyle='#d2b169';ctx.lineWidth=1;ctx.beginPath();ctx.arc(origin.x,origin.y,8,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#dec185';ctx.font='9px monospace';ctx.textAlign='center';ctx.fillText('DEMO LAUNCH',origin.x,origin.y+24);}
    if((reduced||elapsed>=9400)&&target.x>-100&&target.x<width+100&&target.y>-100&&target.y<height+100){ctx.strokeStyle='#b6d2cb';ctx.lineWidth=1;ctx.beginPath();ctx.arc(target.x,target.y,9,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#b6d2cb';ctx.font='8px monospace';ctx.fillText('EVENT',target.x,target.y+23);}
    if(!reduced){for(let k=20;k>=1;k--){const old=elapsed-k*45;if(old<0)continue;const p=positionAt(old);glow(p.x,p.y,3+k*.4,[[0,'rgba(207,215,208,.3)'],[1,'rgba(130,144,140,0)']],1-k/23);}const p=positionAt(elapsed),next=positionAt(Math.min(flight,elapsed+35));let angle=Math.atan2(next.y-p.y,next.x-p.x);if(elapsed<8500)angle=orbitalPoint(elapsed,width,height).angle;drawMissile(ctx,p,angle,story.size,elapsed);if(elapsed<2200){const launch=positionAt(0);glow(launch.x,launch.y,35,[[0,'rgba(255,197,91,.5)'],[1,'rgba(175,68,12,0)']],1-elapsed/2200);}}
   }else{
    const b=project([destination[0]<103.8198?destination[0]+360:destination[0],destination[1]]);if(!impacted)blast(b);const age=(elapsed-flight)/1000,fade=Math.max(0,1-age/3);
    if(!reduced&&age<.7){ctx.save();ctx.translate(b.x,b.y);ctx.scale(1,.42);ctx.strokeStyle=`rgba(255,204,125,${Math.max(0,.8-age)})`;ctx.lineWidth=5*(1-age/.7);ctx.beginPath();ctx.arc(0,0,25+age*220,0,Math.PI*2);ctx.stroke();ctx.restore();}
    if(age<.26)glow(b.x,b.y,45+age*140,[[0,'rgba(255,251,226,.9)'],[.3,'rgba(255,201,93,.65)'],[1,'rgba(255,85,5,0)']],(1-age/.26)*(reduced?.15:1));
    for(const f of flames){f.x+=f.vx*dt;f.y+=f.vy*dt;f.vx*=.98;f.r+=dt*15;const life=Math.max(0,1-age/f.life);if(life)glow(f.x,f.y,f.r,[[0,age<.35?'#fff0bd':'#ffc855'],[.3,age<.7?'#ffad29':'#d24b0d'],[.65,'rgba(167,41,6,.7)'],[1,'rgba(65,22,9,0)']],life*.85);}
    for(const s of smoke){s.x+=s.vx*dt;s.y+=s.vy*dt;s.r+=dt*15;const life=Math.max(0,1-age/s.life),alpha=Math.min(.55,age*.9)*life;glow(s.x,s.y,s.r,[[0,'rgba(39,38,32,.95)'],[.6,'rgba(64,63,54,.8)'],[1,'rgba(76,75,66,0)']],alpha);}
    for(const s of sparks){s.x+=s.vx*dt;s.y+=s.vy*dt;s.vy+=dt*110;const life=Math.max(0,1-age/s.life);if(life){ctx.globalAlpha=life;ctx.strokeStyle='#ffd582';ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(s.x,s.y);ctx.lineTo(s.x-s.vx*.035,s.y-s.vy*.035);ctx.stroke();ctx.globalAlpha=1;}}
    glow(b.x,b.y,22,[[0,'rgba(255,119,15,.6)'],[1,'rgba(180,55,4,0)']],Math.max(0,1-age/2));if(!reduced&&age<.8){ctx.globalAlpha=.05*fade;ctx.fillStyle='#e7ad65';ctx.fillRect(0,0,width,height);ctx.globalAlpha=1;}
   }
   if(!reduced&&elapsed>=POV_START&&elapsed<POV_END){drawPov(ctx,width,height,elapsed);}
   if(actualElapsed>=CINEMATIC_DURATION){finish();return;}raf=requestAnimationFrame(draw);
  };raf=requestAnimationFrame(draw);
 });
}
