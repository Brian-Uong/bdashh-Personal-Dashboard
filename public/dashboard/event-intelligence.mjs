const text=v=>v==null?'':String(v).trim();
const esc=v=>text(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function eventIntelligenceMarkup(cells,headers=[]){
 const find=(names,fallback)=>{const i=headers.findIndex(h=>names.includes(text(h).toLowerCase()));return text(cells[i<0?fallback:i]);};
 const summary=find(['event summary'],28),benefit=find(['how it helps you (suggested)','how it helps you'],29);
 if(!summary&&!benefit)return '<div class="event-intelligence event-intelligence-missing"><p>Load a fresh spreadsheet export to see the event summary and how it helps you.</p></div>';
 return '<div class="event-intelligence">'+(summary?'<div><strong>What it’s for</strong><p>'+esc(summary)+'</p></div>':'')+(benefit?'<div class="event-benefit"><strong>How it helps you</strong><p>'+esc(benefit)+'</p></div>':'')+'</div>';
}
