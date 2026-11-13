// Presentation-only separation. Original saved research and journal records stay intact.
const unstyle=value=>String(value||'').trim().replace(/^#{1,6}\s*/, '').replace(/\*\*|__/g,'').replace(/^[-•]\s*/,'').replace(/^\[([^\]]+)\]\(https?:\/\/[^)]+\)/,'$1');
export function recommendationHeading(value){
 return /^(?:(?:today[’']?s|daily|three daily|top)\s+)?(?:stock\s+)?(?:picks?|recommendations?)(?:\s+(?:of|for)\s+(?:the\s+)?day)?(?=$|[\s:—–-])/i.test(unstyle(value))||/^(?:best (?:stock|idea|pick) of the day|recommended stocks?|top idea)(?=$|[\s:—–-])/i.test(unstyle(value));
}
export const recommendationItem=item=>!!item&&(/^(?:stock )?idea$/i.test(String(item.kind||'').trim())||recommendationHeading(item.kind)||recommendationHeading(item.headline));
const sectionHeading=line=>/^#{1,6}\s/.test(line.trim())||/^\[[^\]]+\]\(https:\/\//.test(line.trim())||/^[A-Z][A-Z /&—–-]{4,}:?$/.test(unstyle(line))||/^(?:market (?:backdrop|news|context|overview)|holdings(?: news| updates)?|portfolio (?:snapshot|context)|sources)(?:\s*[:—–-].*)?$/i.test(unstyle(line));
export function newsBriefingText(value){
 const blocks=String(value||'').split(/\n\s*\n/),kept=[];let inPickSection=false;
 for(const block of blocks){
  const lines=block.split('\n'),out=[];
  for(const line of lines){
   if(recommendationHeading(line)){inPickSection=true;continue;}
   if(inPickSection&&sectionHeading(line))inPickSection=false;
   if(!inPickSection)out.push(line);
  }
  if(out.join('\n').trim())kept.push(out.join('\n').trim());
 }
 return kept.join('\n\n');
}
