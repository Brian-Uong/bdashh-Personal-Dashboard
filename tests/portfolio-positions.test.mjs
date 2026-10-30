import {test} from 'node:test';
import assert from 'node:assert/strict';
import {positionCards,priceGeometry,pacificTime} from '../public/dashboard/portfolio-positions.mjs';
const data={holdings:[{ticker:'KO',shares:2,avgCost:10},{ticker:'AMZN',shares:1,avgCost:5}],quotes:{KO:{price:12,company:'Coca-Cola <safe>',asOf:'2026-10-28T20:00:00Z'},AMZN:{price:30,company:'Amazon'}}};
test('position cards show correct metrics, escaping, searching and independent sorting',()=>{
 const html=positionCards(data);assert.ok(html.indexOf('data-stock-open="AMZN"')<html.indexOf('data-stock-open="KO"'));
 assert.match(html,/Coca-Cola &lt;safe&gt;/);assert.match(html,/\+\$4.00/);assert.match(html,/\+20.00%/);assert.match(html,/44.4%/);
 const filtered=positionCards(data,'coca');assert.match(filtered,/data-stock-open="KO"/);assert.ok(!filtered.includes('data-stock-open="AMZN"'));
 assert.match(positionCards(data,'not found'),/No holdings match/);
 assert.deepEqual(data.holdings.map(h=>h.ticker),['KO','AMZN']);
 const partial=positionCards({...data,quotes:{KO:data.quotes.KO}});assert.ok(!partial.includes('NaN'));assert.ok(!partial.includes('Infinity'));assert.match(partial,/No saved quote/);
});
test('chart geometry handles constant prices and never fabricates an out-of-range cost line',()=>{
 const points=[{time:100,close:10},{time:200,close:10},{time:300,close:10}];
 for(const width of [290,800]){
  const geometry=priceGeometry(points,width,260,10);assert.ok(Number.isFinite(geometry.averageY));
  assert.equal(geometry.coords[0][0],geometry.left);assert.equal(geometry.coords.at(-1)[0],width-geometry.right);
  assert.ok(!geometry.line.includes('NaN'));assert.equal(geometry.coords[0][1],geometry.coords[2][1]);
  assert.equal(priceGeometry(points,width,260,99).averageY,null);
 }
 assert.match(pacificTime(Date.parse('2026-10-28T20:00:00Z')),/1:00 PM PT/);assert.equal(pacificTime(null),'Time unavailable');
 assert.equal(pacificTime('2026-10-28'),'Oct 28, 2026 (date only)');
});
