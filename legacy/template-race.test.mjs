import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const app=readFileSync('dist/app.js','utf8'),source=app.slice(app.indexOf('async function useTemplate('),app.indexOf("$('setupBtn').onclick"));
function fixture(){let resolve,applied=0;const pending=new Promise(r=>resolve=r),ctx={liveBusy:false,drafts:0,sourceGeneration:0,window:{XLSX:{}},confirm:()=>true,feedback:()=>{},$:()=>({open:false,close:()=>{}}),getTemplate:()=>pending,personalTemplate:()=>({}),setWorkbook:()=>applied++};vm.createContext(ctx);vm.runInContext(source,ctx);return {ctx,resolve,applied:()=>applied};}
test('slow demo cannot replace a newly connected or imported source',async()=>{const f=fixture(),job=f.ctx.useTemplate();f.ctx.sourceGeneration++;f.resolve({});await job;assert.equal(f.applied(),0);});
test('edits made while a demo template loads are retained',async()=>{const f=fixture(),job=f.ctx.useTemplate();f.ctx.drafts=1;f.resolve({});await job;assert.equal(f.applied(),0);});
test('a record form opened while a demo template loads is protected',async()=>{const f=fixture(),job=f.ctx.useTemplate();f.ctx.$=()=>({open:true});f.resolve({});await job;assert.equal(f.applied(),0);});
test('unchanged source accepts a completed demo template',async()=>{const f=fixture(),job=f.ctx.useTemplate();f.resolve({});await job;assert.equal(f.applied(),1);});
const importSource=app.slice(app.indexOf('async function loadFile('),app.indexOf("$('loadBtn').onclick"));
function importFixture(){let resolve,reads=0;const pending=new Promise(r=>resolve=r),ctx={liveBusy:false,drafts:0,sourceGeneration:0,workbook:{old:true},sheets:{old:true},confirm:()=>true,feedback:()=>{},$:()=>({open:false,value:''}),window:{XLSX:{read:()=>{reads++;return {SheetNames:['Networking Tracker'],Sheets:{'Networking Tracker':{}}}},utils:{sheet_to_json:()=>[]}}},sections:[{},{key:'Networking Tracker'}],extraTabs:{},personalSections:[],updateSourceLinks:()=>{},overview:()=>{},active:'overview',Date,Intl};vm.createContext(ctx);vm.runInContext(importSource,ctx);return {ctx,resolve,file:{name:'demo.xlsx',size:10,arrayBuffer:()=>pending}};}
test('a pending file import cannot overwrite later drafts',async()=>{const f=importFixture(),job=f.ctx.loadFile(f.file);f.ctx.drafts=1;f.resolve(new ArrayBuffer(8));await job;assert.equal(f.ctx.workbook.old,true);});
test('a pending file import cannot replace a newer selected source',async()=>{const f=importFixture(),job=f.ctx.loadFile(f.file);f.ctx.sourceGeneration++;f.resolve(new ArrayBuffer(8));await job;assert.equal(f.ctx.workbook.old,true);});
