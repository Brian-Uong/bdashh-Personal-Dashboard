import {test} from 'node:test';
import assert from 'node:assert/strict';
import {eventCategories} from './dist/categories.mjs';
import {filterEvents} from './dist/core.mjs';
const event=(title,topic,type)=>{const cells=Array(28).fill('');cells[0]=title;cells[4]=topic;cells[5]=type;return {cells}};
test('finance AI workshops receive multiple categories',()=>{assert.deepEqual(eventCategories(event('Smarter Spreadsheets','Finance / accounting / AI / Excel','Hands-on workshop').cells).map(x=>x.id),['finance','ai','tutorial'])});
test('classification uses title topic and format rather than unrelated notes',()=>{const e=event('Local gathering','General business','Meetup');e.cells[18]='The organiser used to work at a financial services company doing AI';assert.deepEqual(eventCategories(e.cells).map(x=>x.id),['networking'])});
test('AI word boundary does not classify unrelated words',()=>{assert.equal(eventCategories(event('Retail career fair','Marketing','Networking').cells).some(x=>x.id==='ai'),false)});
test('category filter combines with admission and beginner filters',()=>{const a=event('AI workshop','Finance / AI','Workshop'),b=event('Networking evening','Finance','Networking');a.cells[7]='Yes';a.cells[26]='Yes';b.cells[7]='Yes';b.cells[26]='Yes';assert.equal(filterEvents([a,b],{category:'tutorial',free:'Yes',beginner:'Yes'}).length,1)});
