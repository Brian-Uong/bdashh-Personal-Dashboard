import {test} from 'node:test';
import assert from 'node:assert/strict';
import {briefingItems,renderBriefing} from '../public/dashboard/briefing-cards.mjs';
import {newsBriefingText} from '../public/dashboard/briefing-content.mjs';
const brief={asOf:'2026-10-28T21:45:00Z',text:'Complete saved report with additional coverage.',sources:[{title:'Original source',url:'https://example.com/story'}]};
test('briefings omit journal picks before selecting highlights and preserve the saved report',()=>{
 const item=(headline,kind='Holdings')=>({headline,kind,summary:'A verified company update.',source:'Company IR',url:'https://example.com/'+encodeURIComponent(headline),tickers:['KO']});
 const pick=item('Stock Pick of the Day — AMAT','Pick');
 const data={...brief,text:'PORTFOLIO SNAPSHOT\nSaved values.\n\nSTOCK PICK OF THE DAY — AMAT\nThe original stock thesis.\n\nMARKET BACKDROP\nA verified market update.\n\nHOLDINGS NEWS\nKO: A company announcement.',items:[pick,...Array.from({length:6},(_,i)=>item('News '+i))],sources:[{title:'Pick source',url:pick.url},{title:'Market source',url:'https://example.com/market'}]};
 const original=JSON.stringify(data),compact=renderBriefing(data,{compact:true}),full=renderBriefing(data);
 assert.equal(briefingItems(data).length,5);assert.match(compact,/News 0/);assert.doesNotMatch(compact,/Stock Pick|AMAT/);
 assert.doesNotMatch(full,/Stock Pick|STOCK PICK|original stock thesis|Pick source/);assert.match(full,/A verified market update/);assert.match(full,/KO: A company announcement/);
 assert.equal(JSON.stringify(data),original);
});
test('legacy and pick-only briefs do not reintroduce recommendations through fallback text',()=>{
 const text='**Daily recommendations:** BN, CSCO, NU.\n\nMARKET NEWS\nA fresh market event.';
 assert.equal(newsBriefingText(text),'MARKET NEWS\nA fresh market event.');
 assert.equal(newsBriefingText('DAILY STOCK PICKS\nAMAT: A stock thesis.\nBN: Another thesis.\n\nMARKET NEWS\nA fresh market event.'),'MARKET NEWS\nA fresh market event.');
 assert.doesNotMatch(renderBriefing({...brief,text},{compact:true}),/BN|CSCO|NU/);
 const html=renderBriefing({...brief,text:'STOCK PICK OF THE DAY\nA saved thesis.',items:[{kind:'Pick',headline:'My pick',summary:'A saved thesis.'}]},{compact:true});
 assert.doesNotMatch(html,/<article|saved thesis/);assert.match(html,/No market or holdings news/);
 assert.match(renderBriefing({...brief,items:[{kind:'Holdings',headline:'Analysts update their stock recommendations',summary:'A reported news event.'}]}),/Analysts update/);
});
test('linked recommendation headings are removed while subsequent linked news remains',()=>{
 const text='Portfolio snapshot — saved values.\n\n[Stock Pick of the Day — TEST](https://example.com/pick)\nResearch judgment: an original pick thesis.\n\n[Fresh company announcement](https://example.com/news)\nA material company development.';
 const result=newsBriefingText(text);assert.doesNotMatch(result,/Stock Pick|original pick thesis|example.com\/pick/);
 assert.match(result,/Portfolio snapshot/);assert.match(result,/Fresh company announcement/);assert.match(result,/material company development/);
});
test('compact headlines are bounded and the complete report starts collapsed',()=>{
 const data={...brief,items:Array.from({length:8},(_,i)=>({headline:`Headline ${i}`,summary:'A useful detail. '.repeat(60),source:'Company IR',url:'https://example.com/release',tickers:['KO'],publishedAt:'2026-10-28'}))};
 assert.equal(briefingItems(data).length,5);
 assert.ok(briefingItems(data).every(i=>i.summary.length<=281&&i.summary.split(' ').length<=40));
 const full=renderBriefing(data),compact=renderBriefing(data,{compact:true});
 assert.equal((full.match(/<article /g)||[]).length,5);assert.equal((compact.match(/<article /g)||[]).length,1);
 assert.match(full,/<details[^>]+>.*Complete saved report/s);assert.doesNotMatch(full,/<details[^>]+ open/);
 assert.match(renderBriefing(data,{expanded:true}),/<details[^>]+ open/);
 assert.ok(full.includes('Oct 28, 2026'));assert.ok(!full.includes('Oct 27'));
 assert.ok(!compact.includes(brief.text));
});
test('untrusted saved news cannot inject markup or unsafe links',()=>{
 const html=renderBriefing({...brief,items:[{headline:'<img src=x onerror=alert(1)>',summary:'<script>alert(1)</script>',source:'<svg>',url:'javascript:alert(1)',tickers:['<x>'],publishedAt:'bad'}],sources:[null,{title:'Unsafe',url:'https://user:pass@example.com/'},{title:'Safe',url:'https://example.com/?q="'}]});
 assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img'));assert.ok(!html.includes('<script>'));
 assert.ok(!html.includes('javascript:'));assert.ok(!html.includes('user:pass'));assert.ok(!html.includes('Invalid Date'));
 assert.ok(html.includes('rel="noopener noreferrer"'));
});
test('legacy and malformed briefings retain readable highlights without guessing a source',()=>{
 const data={...brief,items:[null,{},'bad'],text:'Wednesday catch-up\n\nMARKET BACKDROP\nThe policy rate remained unchanged. Inflation remains a risk.\n\nKO: Company results were released. The report discusses costs.\n\nPORTFOLIO CONTEXT\nPreviously saved valuation.'};
 const items=briefingItems(data);assert.equal(items.length,2);assert.equal(items[0].url,'');assert.equal(items[0].source,'Saved briefing');
 assert.deepEqual(items[1].tickers,['KO']);assert.ok(renderBriefing(data).includes('Previously saved valuation.'));
 assert.ok(renderBriefing(null).includes('First briefing pending'));assert.ok(!renderBriefing(null).includes('<details'));
});

test('briefing freshness uses Pacific dates and never treats future or unknown dates as current',async()=>{
 const {briefingFreshness}=await import('../public/dashboard/briefing-cards.mjs');
 const now=new Date('2026-11-09T03:00:00Z'); // November 8 in California.
 assert.equal(briefingFreshness('2026-11-08',now).state,'current');
 assert.equal(briefingFreshness('2026-11-09T01:00:00Z',now).state,'current');
 assert.equal(briefingFreshness('2026-11-07T15:00:00Z',now).state,'previous');
 assert.equal(briefingFreshness('2026-11-09',now).state,'unknown');
 assert.equal(briefingFreshness('2026-11-09T06:00:00Z',now).state,'unknown');
 assert.equal(briefingFreshness('bad',now).state,'unknown');
 assert.match(renderBriefing(brief,{now}),/Previous briefing · Awaiting today’s update/);
 assert.ok(renderBriefing(brief,{now}).includes(brief.text));
});
