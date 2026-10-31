import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {newsState} from '../lib/news.mjs';
import {controlsPreview} from './controls-preview.mjs';
const publicRoot=path.resolve(import.meta.dirname,'../public');
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json=(value,status=200)=>Response.json(value,{status,headers});
const banner='<aside style="position:relative;z-index:9999;padding:12px 20px;background:#24203c;color:#eee;font:14px system-ui;text-align:center">WORKSPACE PREVIEW · Empty preview data · Live saves and AI are disabled. <a style="color:#b8efff;text-decoration:underline" href="/owner/settings">Website controls</a></aside>';
export async function workspaceResponse(request){
 const url=new URL(request.url);
 if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname))return new Response('Local workspace only',{status:403,headers});
 if(!['GET','HEAD'].includes(request.method))return json({error:'Workspace preview: live saves, switches and provider calls are disabled.',code:'WORKSPACE_ONLY'},409);
 if(url.pathname==='/api/access')return json({canEdit:true,canManageWorkbook:false,preview:true});
 if(url.pathname==='/api/sync'){
  const sheets=JSON.parse(await readFile(path.join(publicRoot,'dashboard/blank-workbook.json'),'utf8'));
  return json({holdings:[],quotes:{},sheets:sheets.sheets||sheets,briefing:null,updatedAt:null,preview:true});
 }
 if(url.pathname==='/api/news')return json({...newsState(null),schedule:{enabled:false},preview:true});
 if(url.pathname==='/api/ai/status')return json({configured:false,dailyBriefing:false,dailyCareer:false,preview:true});
 if(url.pathname.startsWith('/api/'))return json({error:'This tool needs the online runtime. Workspace preview does not access live data.',code:'WORKSPACE_ONLY'},503);
 if(url.pathname==='/'||url.pathname==='/owner')return Response.redirect(url.origin+'/dashboard/',302);
 if(['/owner/settings','/owner/settings/'].includes(url.pathname))return new Response(request.method==='HEAD'?null:controlsPreview(),{headers:{...headers,'Content-Type':'text/html; charset=utf-8'}});
 let name;
 try{name=decodeURIComponent(url.pathname);}catch{return new Response('Invalid path',{status:400,headers});}
 if(name.split('/').some(part=>part==='..'||part.startsWith('.'))||name.includes('\\'))return new Response('Not found',{status:404,headers});
 if(name.endsWith('/'))name+='index.html';
 const file=path.resolve(publicRoot,'.'+name);
 if(!file.startsWith(publicRoot+path.sep))return new Response('Not found',{status:404,headers});
 try{
  let bytes=await readFile(file);
  const type={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'}[path.extname(file)]||'application/octet-stream';
  if(name==='/dashboard/index.html')bytes=Buffer.from(bytes.toString().replace('<body class="nd-flow">','<body class="nd-flow">'+banner).replace('href="/owner"','href="/owner/settings"').replace('<div class="owner-tools-panel">','<div class="owner-tools-panel"><a class="button subtle" href="/owner/settings">Website controls</a>'));
  return new Response(request.method==='HEAD'?null:bytes,{headers:{...headers,'Content-Type':type+'; charset=utf-8'}});
 }catch{return new Response('Not found',{status:404,headers});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const port=Number(process.env.PORT)||4173;
 createServer(async(req,res)=>{
  try{const request=new Request('http://'+(req.headers.host||'localhost')+(req.url||'/'),{method:req.method});const reply=await workspaceResponse(request);res.writeHead(reply.status,Object.fromEntries(reply.headers));res.end(Buffer.from(await reply.arrayBuffer()));}
  catch{res.writeHead(500);res.end('Workspace preview could not load.');}
 }).listen(port,'127.0.0.1',()=>console.log('Workspace preview listening on http://127.0.0.1:'+port));
}
