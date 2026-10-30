import {requireDashboardWrite} from '../../../../lib/dashboard-access.mjs';
import {env} from 'cloudflare:workers';
import {readPortfolioHistory,recordPortfolioStates,portfolioSnapshot} from '../../../../lib/portfolio-history.mjs';
export const dynamic='force-dynamic';
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store'}});
async function respond(capture=false){
 const bucket=env.BUCKET;if(!bucket)return json({error:'Portfolio history storage unavailable'},503);
 try{
  const object=await bucket.get('dashboard.json'),state:any=object?await object.json():{};
  const current=await portfolioSnapshot(state);
  const history=capture?await recordPortfolioStates(bucket,[state]):await readPortfolioHistory(bucket);
  return json({...history,currentAvailable:!!current,notice:current?null:'A complete set of saved quotes is needed to record a portfolio value.'});
 }catch{return json({error:'Portfolio history could not load. Please try again.'},503);}
}
export async function GET(){return respond();}
export async function POST(request:Request){
 const denied=requireDashboardWrite(request,env);if(denied)return denied;
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return json({error:'Origin rejected'},403);
 // Capture only the server's saved state; clients cannot submit invented balances.
 return respond(true);
}
