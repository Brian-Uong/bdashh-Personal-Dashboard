// Original, decorative space-view artwork for the event-skip cinematic.
const clamp=t=>Math.max(0,Math.min(1,t));
export function orbitalPoint(milliseconds,width,height){
 const t=clamp(milliseconds/10000),u=1-t;
 const x=u*u*u*.12+3*u*u*t*.29+3*u*t*t*.72+t*t*t*.89;
 const y=u*u*u*.86+3*u*u*t*(-.12)+3*u*t*t*(-.12)+t*t*t*.83;
 const dx=3*u*u*(.29-.12)+6*u*t*(.72-.29)+3*t*t*(.89-.72);
 const dy=3*u*u*(-.12-.86)+6*u*t*(-.12+.12)+3*t*t*(.83+.12);
 return {x:x*width,y:y*height,angle:Math.atan2(dy*height,dx*width)};
}
export function drawOrbitalBackdrop(ctx,w,h){
 const sky=ctx.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#020714');sky.addColorStop(.5,'#061a30');sky.addColorStop(1,'#123c50');ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
 for(let i=0;i<125;i++){const x=((i*719+17)%997)/997*w,y=((i*353+31)%991)/991*h*.63;ctx.fillStyle=`rgba(191,220,237,${.15+(i%5)*.12})`;ctx.fillRect(x,y,i%11===0?2:1,i%11===0?2:1);}
 const earth=()=>{ctx.beginPath();ctx.ellipse(w*.5,h*1.72,w*1.02,h*1.14,0,0,Math.PI*2);};
 ctx.save();ctx.shadowColor='#64d4ff';ctx.shadowBlur=28;earth();ctx.fillStyle='#2b87aa';ctx.fill();ctx.shadowBlur=0;ctx.restore();
 ctx.save();earth();ctx.clip();const ocean=ctx.createLinearGradient(0,h*.57,0,h);ocean.addColorStop(0,'#397f94');ocean.addColorStop(.12,'#174f68');ocean.addColorStop(1,'#081c35');ctx.fillStyle=ocean;ctx.fillRect(0,0,w,h);
 // Abstract continental silhouettes, deliberately stylised rather than a map.
 ctx.fillStyle='#315b55';ctx.strokeStyle='#6e9680';ctx.lineWidth=.6;
 const land=points=>{ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x*w,y*h):ctx.moveTo(x*w,y*h));ctx.closePath();ctx.fill();ctx.stroke();};
 land([[0,.72],[.06,.65],[.13,.66],[.18,.72],[.15,.76],[.2,.8],[.19,.85],[.14,.83],[.1,.88],[.06,.82],[0,.85]]);
 land([[.1,.9],[.14,.91],[.18,.95],[.21,.94],[.26,1],[.17,1],[.12,.97]]);
 land([[.77,.67],[.83,.65],[.9,.69],[.98,.77],[1,.87],[.95,.89],[.91,.86],[.88,.92],[.84,.87],[.86,.81],[.8,.76]]);
 land([[.9,.94],[.93,.97],[.98,1],[.92,1],[.88,.98]]);
 ctx.strokeStyle='#87c5ca22';ctx.lineWidth=1;for(let i=0;i<8;i++){ctx.beginPath();ctx.ellipse(w*.5,h*1.72,w*(.16+i*.12),h*1.14,0,Math.PI,Math.PI*2);ctx.stroke();}for(let i=0;i<5;i++){ctx.beginPath();ctx.ellipse(w*.5,h*(.79+i*.13),w*.93,h*.2,0,Math.PI,Math.PI*2);ctx.stroke();}
 for(let i=0;i<16;i++){ctx.save();ctx.translate(w*((i*.173)%1),h*(.68+(i%5)*.071));ctx.scale(w/1000,h/600);ctx.rotate(-.12);ctx.fillStyle='#d1e9e812';ctx.beginPath();ctx.ellipse(0,0,30+i%4*10,3+i%3,0,0,Math.PI*2);ctx.fill();ctx.restore();}
 const shade=ctx.createLinearGradient(0,h*.62,0,h);shade.addColorStop(0,'#67d3f022');shade.addColorStop(.18,'#00000000');shade.addColorStop(1,'#00081688');ctx.fillStyle=shade;ctx.fillRect(0,0,w,h);ctx.restore();
 ctx.strokeStyle='#78d9f3aa';ctx.lineWidth=1.3;ctx.beginPath();ctx.ellipse(w*.5,h*1.72,w*1.02,h*1.14,0,Math.PI,Math.PI*2);ctx.stroke();
 ctx.fillStyle='#b1d3d9';ctx.font='10px monospace';ctx.textAlign='left';ctx.fillText('ORBITAL VIEW / PACIFIC CROSSING',22,31);ctx.fillStyle='#648e9d';ctx.font='8px monospace';ctx.fillText('COMMAND COMMAND  ·  CINEMATIC TRACK',22,47);
 ctx.textAlign='right';ctx.fillStyle='#c5af71';ctx.fillText('SGP → EVENT REGION',w-22,31);ctx.textAlign='center';ctx.fillStyle='#86afbf88';ctx.font='9px monospace';ctx.fillText('P A C I F I C   O C E A N',w*.5,h*.91);
}
export function drawOrbitalTrack(ctx,elapsed,w,h){
 const curve=(until)=>{ctx.beginPath();for(let ms=0;ms<=until;ms+=50){const p=orbitalPoint(ms,w,h);if(ms===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);}const p=orbitalPoint(until,w,h);ctx.lineTo(p.x,p.y);};
 ctx.save();ctx.lineCap='round';ctx.setLineDash([1,8]);ctx.lineWidth=2;ctx.strokeStyle='#dbb96db3';curve(10000);ctx.stroke();ctx.strokeStyle='#9ce9e8';ctx.shadowBlur=8;ctx.shadowColor='#78dce2';curve(Math.min(elapsed,10000));ctx.stroke();ctx.shadowBlur=0;ctx.setLineDash([]);
 for(const [clock,text] of [[0,'DEMO LAUNCH'],[10000,'EVENT REGION']]){const p=orbitalPoint(clock,w,h);ctx.strokeStyle='#c6d7bf';ctx.beginPath();ctx.ellipse(p.x,p.y,12,5,0,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#dfd5a9';ctx.font='9px monospace';ctx.textAlign='center';ctx.fillText(text,p.x,p.y+23);}
 if(w>600){ctx.font='8px monospace';ctx.fillStyle='#9cbdcb';ctx.textAlign='center';for(const [ms,text] of [[1600,'01 / ASCENT'],[5000,'02 / HIGH ARC'],[8400,'03 / DESCENT']]){const p=orbitalPoint(ms,w,h);ctx.fillText(text,p.x,p.y-26);}}
 const p=orbitalPoint(elapsed,w,h);ctx.strokeStyle='#b6f2ed';ctx.lineWidth=1;const r=26;ctx.beginPath();ctx.arc(p.x,p.y,r,-.5,.5);ctx.arc(p.x,p.y,r,Math.PI-.5,Math.PI+.5);ctx.stroke();ctx.restore();
}
