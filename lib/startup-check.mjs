import {runResearch,pacificDate} from './ai-research.mjs';

// Only a Cloudflare administrator can configure this one-time scheduled check.
// There is no HTTP endpoint or authentication exception for it.
export async function runStartupCheck(env,{runner=runResearch,now=Date.now()}={}){
  const id=env.STARTUP_CHECK_ID;
  if(!id)return null;
  if(!/^[a-z0-9-]{8,80}$/.test(id)||!env.BUCKET)throw Error('Invalid startup check configuration');
  const key='operations/startup-'+id+'.json',bucket=env.BUCKET;
  const previous=await bucket.get(key);
  if(previous)return previous.json();
  const report={id,status:'running',startedAt:new Date(now).toISOString(),storage:false,tasks:{}};
  const claim=await bucket.put(key,JSON.stringify(report),{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/json'}});
  if(!claim)return null;
  const readback=await bucket.get(key);
  report.storage=(await readback?.json())?.id===id;
  for(const kind of ['briefing','career']){
    if(kind==='career'&&['insufficient_quota','credit_balance_exhausted','organization_usage_limit_exceeded','organization_spend_limit_exceeded','project_spend_limit_exceeded'].includes(report.tasks.briefing?.providerCode)){
      report.tasks[kind]={status:'skipped',reason:'PROVIDER_BILLING_BLOCKED'};continue;
    }
    try{
      const prior=await bucket.get('ai-runs/'+pacificDate(now)+'-'+kind+'.json');
      const run=prior?await prior.json():null;
      if(run?.status==='completed')report.tasks[kind]={status:'completed',reusedExistingRun:true};
      else report.tasks[kind]=await runner(env,kind,{now});
    }catch(error){
      const message=String(error?.message||'');
      const http=/AI provider request failed \((\d{3})\)/.exec(message);
      report.tasks[kind]={status:'failed',reason:http?'PROVIDER_HTTP_'+http[1]:/provider limit/.test(message)?'PROVIDER_LIMIT':/configured/.test(message)?'NOT_CONFIGURED':/already running/.test(message)?'ALREADY_RUNNING':/Daily research limit/.test(message)?'DAILY_LIMIT':'RESEARCH_FAILED'};
      if(['insufficient_quota','credit_balance_exhausted','organization_usage_limit_exceeded','organization_spend_limit_exceeded','project_spend_limit_exceeded','rate_limit_exceeded','slow_down'].includes(error?.providerCode))report.tasks[kind].providerCode=error.providerCode;
    }
  }
  report.status=report.storage&&Object.values(report.tasks).every(task=>task.status==='completed')?'completed':'failed';
  report.finishedAt=new Date().toISOString();
  await bucket.put(key,JSON.stringify(report),{onlyIf:{etagMatches:claim.etag},httpMetadata:{contentType:'application/json'}});
  return report;
}
