import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {companyMark,companyIdentity,companyLogoUrl,markCompanyLogoFailed} from '../public/dashboard/company-brand.mjs';
import {companyIdentities} from '../public/dashboard/company-identities.mjs';
test('known company marks prefer bundled assets and malformed tickers use safe fallbacks',()=>{
 assert.equal(companyIdentity('GOOG'),companyIdentity('GOOGL'));assert.equal(companyIdentity('__proto__'),null);
 assert.match(companyMark('BN'),/company-logos\/BN.png/);assert.match(companyMark('BN'),/alt="".*width="64" height="64" loading="lazy"/);
 const unknown=companyMark('<X>');assert.match(unknown,/&lt;X&gt;/);assert.doesNotMatch(unknown,/<img|<X>|https?:/);
});
test('new tickers get automatic logos without keys; failures stay safe across redraws',()=>{
 assert.equal(companyIdentity(' goog '),companyIdentity('GOOGL'));
 assert.equal(companyLogoUrl(' msft '),'https://images.financialmodelingprep.com/symbol/MSFT.png');
 assert.match(companyMark('MSFT'),/referrerpolicy="no-referrer"/);
 for(const symbol of ['../secret','AAPL?key=x','A/B','',null,'<img>'])assert.equal(companyLogoUrl(symbol),'');
 markCompanyLogoFailed('BADLOGO');assert.doesNotMatch(companyMark('BADLOGO'),/<img/);assert.match(companyMark('BADLOGO'),/BAD/);
 assert.match(companyMark('MSFT'),/<img/);assert.match(companyMark('KO'),/company-logos\/KO.svg/);
});
test('every company asset has matching provenance and contains passive image bytes',async()=>{
 const base=new URL('../public/dashboard/company-logos/',import.meta.url),manifest=JSON.parse(await readFile(new URL('sources.json',base),'utf8'));
 for(const [ticker,identity] of Object.entries(companyIdentities)){
  const source=manifest.assets.find(a=>a.ticker===ticker);assert.ok(source);assert.equal(identity.file,source.packagedFile);
  const bytes=await readFile(new URL(identity.file,base));assert.equal(createHash('sha256').update(bytes).digest('hex'),source.sha256);
  if(identity.file.endsWith('.png'))assert.equal(bytes.subarray(1,4).toString(),'PNG');
  else assert.doesNotMatch(bytes.toString(),/<script|<foreignObject|\son\w+=|(?:href|src)\s*=\s*["']https?:/i);
 }
});
