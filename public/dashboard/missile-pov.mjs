// Original forward-facing cloud-flight insert. Screen-space VFX only.
export const POV_START=5000,POV_END=8500;
const seed=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
export function createMissilePov(){
 const cloud=document.createElement('canvas');cloud.width=384;cloud.height=192;const c=cloud.getContext('2d');
 if(c){
  // Layered, shaded billows, cached once rather than rebuilt each frame.
  for(let layer=0;layer<3;layer++)for(let i=0;i<26;i++){
   const x=38+seed(i*3+layer)*300,y=95+seed(i*7+layer)*35-layer*19,r=22+seed(i*11+layer)*40;
   const g=c.createRadialGradient(x-r*.18,y-r*.4,0,x,y,r);
   g.addColorStop(0,layer===0?'rgba(102,133,166,.5)':layer===1?'rgba(207,224,236,.8)':'rgba(255,255,255,.96)');
   g.addColorStop(.55,layer===0?'rgba(117,147,176,.4)':layer===1?'rgba(215,232,244,.65)':'rgba(245,251,255,.84)');g.addColorStop(1,'rgba(226,243,255,0)');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);
  }
 }
 return (ctx,w,h,milliseconds)=>{
  const time=(milliseconds-POV_START)/1000,progress=time/3.5,horizon=h*.46;
  ctx.save();ctx.translate(w*.5,h*.5);ctx.rotate(Math.sin(time*1.3)*.012);ctx.translate(-w*.5,-h*.5);
  const sky=ctx.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#174875');sky.addColorStop(.35,'#4b94c7');sky.addColorStop(.5,'#c7e5ef');sky.addColorStop(.64,'#dfeaf1');sky.addColorStop(1,'#829eb8');ctx.fillStyle=sky;ctx.fillRect(-w*.1,-h*.1,w*1.2,h*1.2);
  const sun=ctx.createRadialGradient(w*.82,h*.13,0,w*.82,h*.13,w*.4);sun.addColorStop(0,'#fff7d655');sun.addColorStop(1,'#fff7d600');ctx.fillStyle=sun;ctx.fillRect(0,0,w,h);
  if(c){
   // A continuous distant cloud deck, then billows spreading out in perspective.
   for(let row=0;row<4;row++)for(let i=0;i<16;i++){const size=w*(.1+row*.055),x=(i/15)*w+Math.sin(i+time*.1)*8,y=horizon+row*h*.055+seed(i+row*24)*h*.035;ctx.globalAlpha=.65+row*.1;ctx.drawImage(cloud,x-size*.5,y-size*.13,size,size*.5);}
   ctx.globalAlpha=1;
   const clouds=Array.from({length:62},(_,i)=>({i,z:(seed(i+9)+1-time*.18%1)%1})).sort((a,b)=>b.z-a.z);
   for(const {i,z} of clouds){const side=i%2?1:-1,offset=(.1+seed(i*5)*.5)*side,size=w*(.075+seed(i*3)*.045)/(z+.13),x=w*.5+offset*w/(z+.28),y=horizon+h*.1/(z+.11);ctx.globalAlpha=Math.min(1,z*7,.95);ctx.drawImage(cloud,x-size*.5,y-size*.18,size,size*.5);}
   ctx.globalAlpha=1;
  }
  // Peripheral streaks and a slight bank suggest speed without obscuring the view.
  ctx.lineWidth=1;for(let i=0;i<24;i++){const a=seed(i*13)*Math.PI*2,r=.55+((seed(i*17)+time*.8)%1)*.45,x=w*.5+Math.cos(a)*w*r,y=horizon+Math.sin(a)*h*r;ctx.strokeStyle=`rgba(228,246,255,${.06+r*.09})`;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(w*.5+(x-w*.5)*1.12,horizon+(y-horizon)*1.12);ctx.stroke();}
  ctx.restore();
  // A sliver of the upper fuselage anchors the camera to the missile.
  const metal=ctx.createLinearGradient(w*.45,0,w*.55,0);metal.addColorStop(0,'#293b49');metal.addColorStop(.35,'#9eb3be');metal.addColorStop(.53,'#e5edf0');metal.addColorStop(1,'#3b5261');ctx.fillStyle=metal;ctx.beginPath();ctx.moveTo(w*.455,h);ctx.quadraticCurveTo(w*.476,h*.88,w*.5,h*.84);ctx.quadraticCurveTo(w*.524,h*.88,w*.545,h);ctx.closePath();ctx.fill();ctx.strokeStyle='#ffffff55';ctx.beginPath();ctx.moveTo(w*.5,h*.86);ctx.lineTo(w*.5,h);ctx.stroke();
  const vignette=ctx.createRadialGradient(w*.5,h*.48,h*.2,w*.5,h*.48,w*.7);vignette.addColorStop(0,'#02142000');vignette.addColorStop(1,'#02142066');ctx.fillStyle=vignette;ctx.fillRect(0,0,w,h);
  ctx.save();ctx.strokeStyle='#e5faff99';ctx.fillStyle='#e5faff';ctx.font='9px monospace';ctx.textAlign='left';ctx.fillText('FORWARD CAMERA / FIRST PERSON',22,31);ctx.font='8px monospace';ctx.fillText('LIVE CINEMATIC FEED',22,47);ctx.textAlign='right';ctx.fillText('MAP RETURN IN '+Math.max(0,(POV_END-milliseconds)/1000).toFixed(1)+'s',w-22,31);
  const cx=w*.5,cy=h*.44;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(cx-25,cy);ctx.lineTo(cx-10,cy);ctx.moveTo(cx+10,cy);ctx.lineTo(cx+25,cy);ctx.moveTo(cx,cy-16);ctx.lineTo(cx,cy-6);ctx.moveTo(cx,cy+6);ctx.lineTo(cx,cy+16);ctx.stroke();ctx.strokeRect(20,h-28,(w-40)*Math.min(1,progress),2);ctx.restore();
 };
}
