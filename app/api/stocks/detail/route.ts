import {env} from 'cloudflare:workers';
import {validStockTicker,STOCK_RANGES,cachedStockHistory} from '../../../../lib/stock-history.mjs';
export const dynamic='force-dynamic';
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(request:Request){
  const url=new URL(request.url),ticker=(url.searchParams.get('ticker')||'').toUpperCase(),range=url.searchParams.get('range')||'1mo';
  if(!validStockTicker(ticker)||!Object.hasOwn(STOCK_RANGES,range))return json({error:'Invalid ticker or chart range'},400);
  const bucket=env.BUCKET;if(!bucket)return json({error:'Stock details are temporarily unavailable'},503);
  const object=await bucket.get('dashboard.json');const state:any=object?await object.json():null;
  if(!state?.holdings?.some((holding:any)=>holding.ticker===ticker))return json({error:'Add this ticker to your holdings to open its details'},404);
  try{return json(await cachedStockHistory(bucket,ticker,range));}
  catch(error){return json({error:error instanceof Error?error.message:'Stock history unavailable'},503);}
}
