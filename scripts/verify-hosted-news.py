# Supply fresh Sites get_site current_live_url and service credential through hidden stdin.
# Default is read-only; --refresh also verifies an authorized public-feed refresh.
import urllib.request,urllib.error,json,getpass,sys
context=json.loads(getpass.getpass('Site access JSON (hidden): '))
base=context['url'].rstrip('/')
key=context['token']
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args,**kwargs):return None
opener=urllib.request.build_opener(NoRedirect)
def call(path,body=None,origin=None):
 headers={'Accept':'application/json','OAI-Sites-Authorization':'Bearer '+key,'X-Dashboard-Service-Authorization':'Bearer '+key}
 if body is not None:headers['Content-Type']='application/json'
 if origin:headers['Origin']=origin
 req=urllib.request.Request(base+path,headers=headers,data=None if body is None else json.dumps(body).encode())
 try:r=opener.open(req,timeout=45)
 except urllib.error.HTTPError as e:r=e
 raw=r.read(2000000);kind=r.headers.get('Content-Type','')
 try:data=json.loads(raw)
 except Exception:data={'nonJsonResponse':raw[:180].decode(errors='replace')}
 if r.status!=200:
  print(json.dumps({'path':path,'status':r.status,'contentType':kind,'response':data}));sys.exit(2)
 return data
ai=call('/api/ai/status')
if ai.get('configured') is not False:print(json.dumps({'stage':'AI status','response':ai}));sys.exit(2)
before=call('/api/news');dashboard=call('/api/sync')
if '--refresh' not in sys.argv:
 print(json.dumps({'verifiedOrigin':base,'authenticatedReads':True,'newsRevision':before['revision'],'paidAIConfigured':False}));sys.exit(0)
patch={'action':'refresh','baseTopicsVersion':before['topicsVersion']}
result=call('/api/news',patch)
if result.get('refresh',{}).get('status')=='failed':print(json.dumps({'stage':'feed check','response':result['refresh']}));sys.exit(3)
readback=call('/api/news');unchanged=call('/api/sync')
assert readback['topics']==before['topics'] and readback['topicsVersion']==before['topicsVersion']
assert readback['revision']==result['revision']
assert unchanged==dashboard,'Unrelated dashboard content changed'
cached=call('/api/news',patch)
report={'verifiedOrigin':base,'refresh':result['refresh'],'revision':readback['revision'],'topics':[{ 'topic':t['label'],'status':readback['briefings'].get(t['id'],{}).get('status'),'articles':len(readback['briefings'].get(t['id'],{}).get('items',[]))} for t in readback['topics']],'paidAIConfigured':False,'holdingsAndDashboardUnchanged':True,'repeat':cached['refresh']}
print(json.dumps(report,indent=2))
