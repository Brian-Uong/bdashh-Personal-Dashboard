import test from 'node:test';
import assert from 'node:assert/strict';
import {quoteChange,positionView,setPositionView} from '../public/dashboard/investment-view.mjs';
import {positionCards,renderPositions} from '../public/dashboard/portfolio-positions.mjs';
import {updateRecommendationView} from '../public/dashboard/recommendation-view.mjs';
const data={holdings:[{ticker:'AAA',shares:2,avgCost:50},{ticker:'BBB',shares:1,avgCost:120}],quotes:{AAA:{price:90,previousClose:100,asOf:'2026-11-13T20:00:00Z'},BBB:{price:100,previousClose:80,asOf:'2026-11-13T20:00:00Z'}}};
test('prior-close performance stays distinct from position gains and missing values are not fabricated',()=>{
 assert.deepEqual(quoteChange(data.quotes.BBB),{dollars:20,percent:25});
 for(const q of [{price:10},{price:10,previousClose:0},{price:NaN,previousClose:10},{price:0,previousClose:10}])assert.equal(quoteChange(q),null);
 const html=positionCards(data,'','daily');assert.ok(html.indexOf('data-stock-open="BBB"')<html.indexOf('data-stock-open="AAA"'));
 assert.match(html,/\+25.00%/);assert.match(html,/-16.67% since purchase/);assert.match(html,/vs. prior close/);assert.match(html,/Nov 13, 2026/);
});
test('holding query and sort survive a complete portfolio redraw without mutating data',()=>{
 const original=JSON.stringify(data);setPositionView({query:'BBB',sort:'daily'});const html=renderPositions(data);
 assert.match(html,/value="BBB"/);assert.match(html,/value="daily" selected/);assert.doesNotMatch(html,/data-stock-open="AAA"/);
 setPositionView({sort:'invalid'});assert.equal(positionView().sort,'daily');assert.equal(JSON.stringify(data),original);setPositionView({query:'',sort:'value'});
});
test('unchanged recommendation views skip DOM work; changed prices preserve focus, caret and disclosures',()=>{
 let writes=0,focus=0,selection,details=[{dataset:{recDetail:'card:AAA'},open:true}],active={id:'recSearch',selectionStart:2,selectionEnd:3};
 const input={focus(){focus++;},setSelectionRange(...v){selection=v;}};
 const root={querySelectorAll:()=>details,contains:el=>el===active||el===input,set innerHTML(v){writes++;details=[{dataset:{recDetail:'card:AAA'},open:false}];}};
 const doc={activeElement:active,getElementById:()=>input},open=new Set();
 assert.equal(updateRecommendationView(root,'first',open,doc),true);assert.equal(details[0].open,true);assert.deepEqual(selection,[2,3]);
 assert.equal(updateRecommendationView(root,'first',open,doc),false);assert.equal(writes,1);
 doc.activeElement={id:'outside'};assert.equal(updateRecommendationView(root,'new price',open,doc),true);assert.equal(details[0].open,true);assert.equal(focus,1);
});
