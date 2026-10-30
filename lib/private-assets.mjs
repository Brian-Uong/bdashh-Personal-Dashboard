import currentManifest from '../worker/assets-manifest.mjs';
// Called only after the router authorizes a public read or verifies the owner.
// The manifest is an allowlist; arbitrary bucket keys are never accepted.
export async function serveR2Asset(request,bucket,manifest=currentManifest){
 if(!bucket)return new Response('Website storage is unavailable.',{status:503});
 const url=new URL(request.url),pathname=url.pathname;
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
 let assetPath=pathname;
 if(pathname.endsWith('/'))assetPath+='index.html';
 else if(!Object.hasOwn(manifest.files,pathname)&&Object.hasOwn(manifest.files,pathname+'/index.html')){
  url.pathname=pathname+'/';return Response.redirect(url.href,302);
 }
 if(!Object.hasOwn(manifest.files,assetPath))return new Response('Not found',{status:404});
 const asset=manifest.files[assetPath],object=await bucket.get(asset.key);
 if(!object||object.etag!==asset.etag||object.size!==asset.size)return new Response('Website update is incomplete. Please try again later.',{status:503});
 return new Response(request.method==='HEAD'?null:object.body,{headers:{'Content-Type':asset.type,'Content-Length':String(asset.size),'ETag':object.httpEtag||'"'+asset.etag+'"','Cache-Control':'private, no-store'}});
}
