import {test} from 'node:test';
import assert from 'node:assert/strict';
const mod=await import('./dist/source-config.mjs').catch(()=>({}));
test('blank input never creates a spreadsheet connection',()=>assert.equal(mod.sheetExportUrl?.(''),null));
test('spreadsheet URL accepts only HTTPS Google Sheets document URLs',()=>{assert.equal(typeof mod.sheetExportUrl,'function');for(const url of ['https://evil.example/spreadsheets/d/example','http://docs.google.com/spreadsheets/d/example','https://docs.google.com.evil.example/spreadsheets/d/example','https://user:password@docs.google.com/spreadsheets/d/example','javascript:alert(1)'])assert.throws(()=>mod.sheetExportUrl(url));});
test('export URL removes all supplied query parameters and fragments',()=>{assert.equal(mod.sheetExportUrl?.('https://docs.google.com/spreadsheets/d/example-sheet-id/edit?secret=discard#gid=0'),'https://docs.google.com/spreadsheets/d/example-sheet-id/export?format=xlsx');});
