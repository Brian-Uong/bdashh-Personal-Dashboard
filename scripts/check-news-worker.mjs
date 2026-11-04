// Actual workerd regression: Node's Request accepts redirect:'error', Workers
// does not. The fake source constructs a real Workers Request before returning
// fixture RSS. All storage is ephemeral; this makes no external provider calls.
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'..');
const require=createRequire(process.argv[2]||import.meta.resolve('wrangler/package.json'));
const {Miniflare}=require('miniflare');
const files=['lib/news-refresh.mjs','lib/news.mjs','public/dashboard/news-data.mjs'];
const modules=await Promise.all(files.map(async file=>({type:'ESModule',path:path.join(root,file),contents:await readFile(path.join(root,file),'utf8')})));
modules.unshift({type:'ESModule',path:path.join(root,'news-runtime-check.mjs'),contents:`
 import {refreshNews} from './lib/news-refresh.mjs';
 export default {async fetch(request,env){
  const now=Date.parse('2026-11-03T16:00:00Z');let calls=0;
  const fetcher=async (url,options)=>{
   const checked=new Request(url,options);calls++;
   if(checked.redirect!=='manual')throw Error('Redirect policy must be manual.');
   if(new URL(url).hostname==='news.google.com')return new Response('Unavailable',{status:503});
   const xml='<rss><channel><item><title>Runtime fixture</title><link>http://www.bing.com/news/apiclick.aspx?url=https%3A%2F%2Fpublisher.example%2Ffixture</link><News:Source>Fixture</News:Source><pubDate>Tue, 03 Nov 2026 15:00:00 GMT</pubDate></item></channel></rss>';
   return new Response(xml,{headers:{'Content-Type':'application/rss+xml'}});
  };
  const result=await refreshNews(env.BUCKET,{action:'refresh',baseTopicsVersion:0,topicIds:['nba']},{fetcher,now});
  const cached=await refreshNews(env.BUCKET,{action:'refresh',baseTopicsVersion:0,topicIds:['nba']},{fetcher,now:now+1000});
  return Response.json({status:result.refresh.status,added:result.refresh.added,items:result.briefings.nba.items.length,cached:cached.refresh.status,calls});
 }};
`});
const runtime=new Miniflare({modules,modulesRoot:root,r2Buckets:['BUCKET'],compatibilityDate:'2026-05-15'});
try{
 const result=await (await runtime.dispatchFetch('http://localhost/')).json();
 assert.deepEqual(result,{status:'ready',added:1,items:1,cached:'cached',calls:2});
 console.log('Workers runtime news fallback, durable readback and cooldown passed.');
}finally{await runtime.dispose();}
