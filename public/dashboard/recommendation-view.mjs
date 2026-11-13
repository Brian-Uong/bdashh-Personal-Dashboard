const rendered=new WeakMap();
export function updateRecommendationView(el,html,openDetails=new Set(),doc=document){
 if(rendered.get(el)===html)return false;
 for(const detail of el.querySelectorAll('details[data-rec-detail]')){
  const key=detail.dataset.recDetail;if(detail.open)openDetails.add(key);else openDetails.delete(key);
 }
 const active=doc.activeElement,focused=el.contains(active)?{id:active.id,start:active.selectionStart,end:active.selectionEnd}:null;
 el.innerHTML=html;rendered.set(el,html);
 for(const detail of el.querySelectorAll('details[data-rec-detail]'))detail.open=openDetails.has(detail.dataset.recDetail);
 if(focused?.id){const input=doc.getElementById(focused.id);if(el.contains(input)){input.focus({preventScroll:true});if(typeof input.setSelectionRange==='function'&&Number.isInteger(focused.start))input.setSelectionRange(focused.start,focused.end);}}
 return true;
}
