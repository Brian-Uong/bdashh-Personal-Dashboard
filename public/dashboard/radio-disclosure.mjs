// The drawer changes only visibility. Collapsing never changes audio playback.
export function setupRadioDisclosure(root){
 const tab=root.querySelector('#radioTab'),panel=root.querySelector('#radioPanel'),select=root.querySelector('#radioMix');
 let open=false,hovered=false,keyboard=false,dragging=false,choosing=false,closing=false,touchInteraction=false,timer;
 const cancel=()=>clearTimeout(timer);
 function show(value,returnFocus=false){
  cancel();open=value;
  if(!value){
   choosing=false;closing=true;
   if(returnFocus||panel.contains(document.activeElement))tab.focus({preventScroll:true});
   closing=false;
  }
  root.classList.toggle('is-expanded',value);tab.setAttribute('aria-expanded',String(value));
  tab.setAttribute('aria-label',value?'Close music player':'Open music player');
  panel.inert=!value;panel.setAttribute('aria-hidden',String(!value));
 }
 function closeSoon(){
  cancel();if(touchInteraction)return;timer=setTimeout(()=>{
   // Native selects may close without emitting change (same option or Escape).
   if(choosing)try{choosing=select.matches(':open');}catch{/* Keep older native menus open until blur. */}
   if(!hovered&&!dragging&&!choosing&&!(keyboard&&root.contains(document.activeElement)))show(false);
  },400);
 }
 root.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse'||event.pointerType==='pen'){touchInteraction=false;hovered=true;show(true);}});
 root.addEventListener('pointerleave',event=>{if(event.pointerType==='mouse'||event.pointerType==='pen'){hovered=false;closeSoon();}});
 root.addEventListener('focusin',()=>{if(keyboard&&!closing)show(true);});
 root.addEventListener('focusout',()=>{queueMicrotask(()=>{if(!root.contains(document.activeElement)){choosing=false;closeSoon();}});});
 root.addEventListener('pointerdown',()=>{dragging=true;cancel();});
 document.addEventListener('pointerup',event=>{dragging=false;if(open&&!hovered&&event.pointerType!=='touch')closeSoon();});
 document.addEventListener('pointercancel',event=>{dragging=false;if(open&&!hovered&&event.pointerType!=='touch')closeSoon();});
 // Keep native select menus usable even when their popup extends past the drawer.
 select.addEventListener('pointerdown',()=>{choosing=true;});
 select.addEventListener('change',()=>{choosing=false;if(!hovered)closeSoon();});
 document.addEventListener('keydown',event=>{if(event.key==='Tab'){keyboard=true;touchInteraction=false;}},true);
 document.addEventListener('pointerdown',event=>{keyboard=false;touchInteraction=event.pointerType==='touch';if(open&&!root.contains(event.target))show(false);},true);
 tab.addEventListener('click',event=>{show(event.pointerType==='mouse'&&hovered?true:!open);});
 root.querySelector('#radioCollapse').addEventListener('click',()=>show(false,true));
 root.addEventListener('keydown',event=>{if(event.key==='Escape'&&open){event.stopPropagation();show(false,true);}});
}
