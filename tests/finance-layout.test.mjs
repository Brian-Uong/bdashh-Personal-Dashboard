import {test} from 'node:test';
import assert from 'node:assert/strict';
// The renderer's chart-mode listener is the only browser dependency at import.
globalThis.document={addEventListener(){}};
const {acceptData,finance,briefingSummary}=await import('../public/dashboard/synced.mjs');
acceptData({holdings:[{ticker:'TEST',shares:2,avgCost:10}],quotes:{TEST:{price:12,asOf:'2026-10-28T20:00:00Z',source:'Test fixture'}},briefing:{asOf:'2026-10-28T21:00:00Z',text:'Test market brief <safe>',sources:[]}});
test('investment view leads with the briefing and retains portfolio actions and charts',()=>{
 const html=finance();
 assert.ok(html.indexOf('pd-daily-briefing')<html.indexOf('SAVED PORTFOLIO'));
 for(const id of ['syncReload','portfolioVisuals','portfolioHistory'])assert.ok(html.includes(`id="${id}"`));
 assert.ok(!html.includes('editHoldings'));assert.ok(html.includes('data-edit-stock="TEST"'));assert.ok(html.includes('data-remove-stock="TEST"'));assert.ok(html.includes('$24.00'));assert.ok(html.includes('Test market brief &lt;safe&gt;'));
});
test('overview retains compact portfolio-first summary without full portfolio controls',()=>{
 const html=finance(true);
 assert.ok(html.indexOf('SAVED PORTFOLIO')<html.indexOf('pd-daily-briefing'));
 assert.ok(html.includes('Open portfolio &amp;')||html.includes('Open portfolio & briefing'));
 assert.ok(!html.includes('id="syncReload"'));
 assert.ok(!html.includes('id="portfolioHistory"'));
});
test('long briefing preview is bounded while Investments retains the full briefing and sources',()=>{
 const text='Wednesday update\n\nMARKET BACKDROP\n\n'+('A verified market development with context and risks. ').repeat(20)+'\n\nDetailed holdings coverage at the end.';
 acceptData({holdings:[],quotes:{},briefing:{asOf:'2026-10-28T21:00:00Z',text,sources:[{title:'Source',url:'https://example.com/release'}]}});
 assert.ok(briefingSummary(text).length<=360);
 assert.ok(!briefingSummary(text).startsWith('Wednesday'));
 const overview=finance(true),full=finance();
 assert.ok(overview.includes('Read more ↗'));assert.ok(overview.includes('data-section="investments"'));
 assert.ok(!overview.includes('Detailed holdings coverage at the end.'));
 assert.ok(!overview.includes('https://example.com/release'));
 assert.ok(full.includes('Detailed holdings coverage at the end.'));assert.ok(full.includes('https://example.com/release'));
 assert.equal(briefingSummary('Short briefing.'),'Short briefing.');
 assert.equal(briefingSummary(''),'');
});
test('a date-only quote remains on the correct calendar day in overview and investment charts',()=>{
 acceptData({holdings:[{ticker:'MSFT',shares:1,avgCost:400}],quotes:{MSFT:{price:531.01,asOf:'2026-10-28',source:'Nasdaq',timePrecision:'day'}},briefing:null});
 for(const html of [finance(),finance(true)]){assert.ok(html.includes('Oct 28, 2026 (date only)'));assert.ok(!html.includes('Oct 27'));assert.ok(!html.includes('Invalid Date'));}
 assert.ok(finance().includes('data-add-stock'));assert.ok(!finance(true).includes('data-add-stock'));
});

test('a delayed sync response cannot roll back a newer position edit',()=>{
 const edited={holdings:[{ticker:'KO',shares:4,avgCost:80}],quotes:{KO:{price:90,asOf:'2026-10-28'}},updatedAt:'2026-10-29T03:00:00Z'};
 acceptData(edited);const accepted=acceptData({...edited,holdings:[],updatedAt:'2026-10-29T02:59:59Z'});
 assert.deepEqual(accepted,edited);assert.ok(finance().includes('$360.00'));
});
