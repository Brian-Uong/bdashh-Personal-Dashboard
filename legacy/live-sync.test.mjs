import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync('dist/app.js','utf8');
const fn=source.slice(source.indexOf('async function refreshLive('),source.indexOf("$('refreshBtn').onclick"));
function fixture(){
 const nodes=new Map();const candidate={SheetNames:['Networking Tracker'],Sheets:{'Networking Tracker':{}}};
 let calls=0;const ctx={sheetUrl:"https://docs.google.com/spreadsheets/d/example-sheet-id/export?format=xlsx",sourceGeneration:0,liveBusy:false,liveMode:true,lastLiveCheck:0,drafts:0,workbook:{old:true},sheets:{old:true},active:'overview',filename:'',document:{hidden:false},geo:{nopeBusy:false},sections:[{}, {key:'Networking Tracker'}],personalSections:[],extraTabs:{},renderPersonal:()=>'',window:{XLSX:{read:()=>candidate,utils:{sheet_to_json:()=>[['Name'],['Demo User']]}}},$:id=>{if(!nodes.has(id))nodes.set(id,{open:false});return nodes.get(id)},fetch:async()=>{calls++;return {ok:true,arrayBuffer:async()=>new ArrayBuffer(8)}},AbortController,setTimeout,clearTimeout,Date,Intl,feedback:()=>{},overview:()=>{}};
 vm.createContext(ctx);vm.runInContext(fn,ctx);return {ctx,nodes,calls:()=>calls};
}
test('live refresh replaces the workbook only after successful parsing',async()=>{const f=fixture();await f.ctx.refreshLive(true);assert.equal(f.calls(),1);assert.equal(f.ctx.workbook.SheetNames[0],'Networking Tracker');assert.match(f.nodes.get('connectionTitle').textContent,/connected/);assert.equal(f.ctx.liveBusy,false)});
test('unsaved drafts and open edit forms block refresh',async()=>{const f=fixture();f.ctx.drafts=1;await f.ctx.refreshLive(true);assert.equal(f.calls(),0);f.ctx.drafts=0;f.ctx.$('detail').open=true;await f.ctx.refreshLive(true);assert.equal(f.calls(),0)});
test('failed refresh retains last successful data and clears loading state',async()=>{const f=fixture();f.ctx.fetch=async()=>{throw Error('Offline')};await f.ctx.refreshLive(true);assert.equal(f.ctx.sheets.old,true);assert.match(f.nodes.get('connectionText').textContent,/stale/);assert.equal(f.nodes.get('refreshBtn').disabled,false)});
test('drafts created during download prevent replacement',async()=>{const f=fixture();f.ctx.fetch=async()=>{f.ctx.drafts=1;return {ok:true,arrayBuffer:async()=>new ArrayBuffer(8)}};await f.ctx.refreshLive(true);assert.equal(f.ctx.sheets.old,true);assert.match(f.nodes.get('connectionTitle').textContent,/paused/)});

test('no spreadsheet configured means no automatic network request',async()=>{const f=fixture();f.ctx.sheetUrl='';await f.ctx.refreshLive();assert.equal(f.calls(),0);assert.equal(f.ctx.sheets.old,true)});
test('disconnect during an in-flight refresh prevents old data from replacing state',async()=>{const f=fixture();f.ctx.fetch=async()=>{f.ctx.sourceGeneration++;f.ctx.sheetUrl='';return {ok:true,arrayBuffer:async()=>new ArrayBuffer(8)}};await f.ctx.refreshLive(true);assert.equal(f.ctx.sheets.old,true);assert.equal(f.ctx.liveBusy,false)});
