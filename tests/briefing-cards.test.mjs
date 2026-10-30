import {test} from 'node:test';
import assert from 'node:assert/strict';
import {briefingItems,renderBriefing} from '../public/dashboard/briefing-cards.mjs';
const brief={asOf:'2026-10-28T21:45:00Z',text:'Complete saved report with additional coverage.',sources:[{title:'Original source',url:'https://example.com/story'}]};
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
