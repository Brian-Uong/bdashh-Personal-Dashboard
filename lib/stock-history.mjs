import {easternTimestamp} from './market-quotes.mjs';
export const STOCK_RANGES = Object.freeze({
  '1d': {range:'1d',interval:'5m'}, '1mo': {range:'1mo',interval:'1d'},
  '3mo': {range:'3mo',interval:'1d'}, '1y': {range:'1y',interval:'1d'},
  '5y': {range:'5y',interval:'1wk'}
});
export const validStockTicker = ticker => typeof ticker==='string' && /^[A-Z][A-Z0-9.\-]{0,9}$/.test(ticker);
const positive = n => Number.isFinite(n) && n>0 ? n : null;
const nonnegative = n => Number.isFinite(n) && n>=0 ? n : null;
export function parseStockHistory(payload,ticker,range,now=Date.now()) {
  if(!validStockTicker(ticker)||!Object.hasOwn(STOCK_RANGES,range))throw Error('Invalid chart request');
  const result=payload?.chart?.result?.[0],meta=result?.meta;
  const symbol=ticker.replaceAll('.','-');
  if(!meta||meta.symbol?.toUpperCase()!==symbol||meta.currency!=='USD')throw Error('Stock identity or currency could not be verified');
  const company=String(meta.longName||meta.shortName||ticker).slice(0,180);
  // Retain the existing portfolio's identity safeguard for this ambiguous symbol.
  if(ticker==='SPCX'&&!/spacex|space exploration/i.test(company))throw Error('SPCX company identity could not be verified');
  const quote=result.indicators?.quote?.[0],timestamps=result.timestamp;
  if(!Array.isArray(timestamps)||!Array.isArray(quote?.close))throw Error('Price history unavailable');
  const unique=new Map();
  timestamps.forEach((time,i)=>{
    const close=positive(quote.close[i]);
    if(!Number.isFinite(time)||time<=0||time*1000>now+300000||close===null)return;
    unique.set(time,{time,close,volume:nonnegative(quote.volume?.[i])});
  });
  const points=[...unique.values()].sort((a,b)=>a.time-b.time).slice(-1600);
  if(points.length<2)throw Error('Not enough price history for this range');
  const quoteTime=Number.isFinite(meta.regularMarketTime)&&meta.regularMarketTime>0&&meta.regularMarketTime*1000<=now+300000?new Date(meta.regularMarketTime*1000).toISOString():null;
  return {
    ticker,symbol,range,interval:STOCK_RANGES[range].interval,company,
    exchange:String(meta.fullExchangeName||meta.exchangeName||'').slice(0,100),
    currency:'USD',instrumentType:String(meta.instrumentType||'').slice(0,40),
    price:quoteTime?positive(meta.regularMarketPrice):null,asOf:quoteTime,
    dayHigh:positive(meta.regularMarketDayHigh),dayLow:positive(meta.regularMarketDayLow),
    yearHigh:positive(meta.fiftyTwoWeekHigh),yearLow:positive(meta.fiftyTwoWeekLow),
    volume:nonnegative(meta.regularMarketVolume),points,
    source:'Yahoo Finance',sourceUrl:`https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}/`,
    fetchedAt:new Date(now).toISOString()
  };
}
export async function fetchStockHistory(ticker,range,{fetcher=fetch,now=()=>Date.now()}={}) {
  if(!validStockTicker(ticker)||!Object.hasOwn(STOCK_RANGES,range))throw Error('Invalid chart request');
  const params=new URLSearchParams({...STOCK_RANGES[range],includePrePost:'false',events:'div,splits'});
  const response=await fetcher(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker.replaceAll('.','-'))}?${params}`,{
    headers:{Accept:'application/json'},signal:AbortSignal.timeout(10000),cache:'no-store'
  });
  if(!response.ok){
    const error=new Error(response.status===429?'Market data is temporarily rate limited. Please try later.':'Price history is unavailable from the provider.');
    if(response.status===429){
      const retry=response.headers.get('retry-after'),seconds=Number(retry);
      const date=Number.isFinite(seconds)&&seconds>0?now()+seconds*1000:Date.parse(retry||'');
      error.retryAt=Math.max(now()+900000,Number.isFinite(date)?date:0);
    }
    throw error;
  }
  return parseStockHistory(await response.json(),ticker,range,now());
}

// Separate public-data cache. This never changes dashboard.json or its holdings.
export function parseNasdaqHistory(payload,ticker,range,now=Date.now()){
  if(!validStockTicker(ticker)||!Object.hasOwn(STOCK_RANGES,range)||range==='1d')throw Error('Invalid daily history request');
  const data=payload?.data;
  if(data?.symbol?.toUpperCase()!==ticker||ticker==='SPCX')throw Error('Stock identity could not be verified');
  if(!Array.isArray(data.tradesTable?.rows))throw Error('Daily history unavailable');
  const points=new Map();
  for(const row of data.tradesTable.rows){
    const match=String(row.date).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if(!match||!/^\$[\d,.]+$/.test(row.close||''))continue;
    const day=`${match[3]}-${match[1]}-${match[2]}`,stamp=Date.parse(day+'T12:00:00Z');
    const close=Number(row.close.replace(/[$,]/g,''));
    if(!Number.isFinite(stamp)||new Date(stamp).toISOString().slice(0,10)!==day||stamp>now+300000||!positive(close))continue;
    points.set(stamp,{time:stamp/1000,close,volume:nonnegative(Number(String(row.volume).replaceAll(',','')))});
  }
  const sorted=[...points.values()].sort((a,b)=>a.time-b.time).slice(-1600);
  if(sorted.length<2)throw Error('Not enough daily price history');
  return {ticker,symbol:ticker,range,interval:'1d',company:ticker,currency:'USD',price:sorted.at(-1).close,asOf:new Date(sorted.at(-1).time*1000).toISOString().slice(0,10),timePrecision:'day',points:sorted,source:'Nasdaq',sourceUrl:`https://www.nasdaq.com/market-activity/stocks/${ticker.toLowerCase()}/historical`,fetchedAt:new Date(now).toISOString(),notice:'Daily closing prices. Prices are not adjusted for splits or dividends; intraday movements are not shown.'};
}
export function parseNasdaqIntraday(payload,ticker,now=Date.now()){
  const data=payload?.data;
  if(!validStockTicker(ticker)||data?.symbol?.toUpperCase()!==ticker||ticker==='SPCX'||!/^\$[\d,.]+$/.test(data.lastSalePrice||''))throw Error('Stock identity or currency could not be verified');
  if(!Array.isArray(data.chart))throw Error('Intraday history unavailable');
  const unique=new Map(),offsets=new Map();
  for(const p of data.chart){
    if(!Number.isFinite(p.x)||p.x<=now-7*86400000||!positive(p.y))continue;
    // Nasdaq encodes Eastern wall-clock values in x, not actual UTC instants.
    // Verify the displayed ET label before resolving that date's DST offset.
    const wall=new Date(p.x),label=String(p.z?.dateTime||'').match(/^(\d{1,2}):(\d{2})\s*(AM|PM)\s+ET$/i);
    if(!label||wall.getUTCHours()!==Number(label[1])%12+(label[3].toUpperCase()==='PM'?12:0)||wall.getUTCMinutes()!==Number(label[2]))continue;
    const day=wall.toISOString().slice(0,10);
    if(!offsets.has(day)){
      const date=wall.toLocaleDateString('en-US',{timeZone:'UTC',month:'short',day:'numeric',year:'numeric'});
      offsets.set(day,Date.parse(easternTimestamp(date+' 12:00 PM ET'))-Date.parse(day+'T12:00:00Z'));
    }
    const stamp=p.x+offsets.get(day);if(stamp<=now+300000)unique.set(stamp,{time:stamp/1000,close:p.y,volume:null});
  }
  const points=[...unique.values()].sort((a,b)=>a.time-b.time).slice(-1600);
  if(points.length<2)throw Error('Not enough recent intraday history');
  return {ticker,symbol:ticker,range:'1d',interval:'1m',company:String(data.company||ticker).slice(0,180),currency:'USD',points,price:points.at(-1).close,asOf:new Date(points.at(-1).time*1000).toISOString(),source:'Nasdaq',sourceUrl:`https://www.nasdaq.com/market-activity/stocks/${ticker.toLowerCase()}`,fetchedAt:new Date(now).toISOString(),notice:'Latest available trading session, including extended hours. Prices may be delayed.'};
}
export async function fetchNasdaqHistory(ticker,range,{fetcher=fetch,now=()=>Date.now()}={}){
  if(!validStockTicker(ticker)||!Object.hasOwn(STOCK_RANGES,range)||ticker==='SPCX')throw Error('History is unavailable for this request');
  const end=new Date(now()),start=new Date(now());
  if(range==='1mo'||range==='3mo')start.setUTCMonth(start.getUTCMonth()-(range==='1mo'?1:3));
  else start.setUTCFullYear(start.getUTCFullYear()-(range==='5y'?5:1));
  const query=new URLSearchParams({assetclass:'stocks',limit:'1600',fromdate:start.toISOString().slice(0,10),todate:end.toISOString().slice(0,10)});
  const response=await fetcher(`https://api.nasdaq.com/api/quote/${encodeURIComponent(ticker)}/${range==='1d'?'chart?assetclass=stocks':'historical?'+query}`,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(10000),cache:'no-store'});
  if(!response.ok){const error=Error(response.status===429?'Market data is temporarily rate limited. Please try later.':'Nasdaq daily history unavailable.');if(response.status===429){const value=response.headers.get('retry-after'),seconds=Number(value);error.retryAt=Math.max(now()+900000,Number.isFinite(seconds)&&seconds>0?now()+seconds*1000:Date.parse(value||'')||0);}throw error;}
  const payload=await response.json();
  return range==='1d'?parseNasdaqIntraday(payload,ticker,now()):parseNasdaqHistory(payload,ticker,range,now());
}
const pending=new Map();
export async function cachedStockHistory(bucket,ticker,range,{now=()=>Date.now(),fetcher=fetch}={}) {
  if(!validStockTicker(ticker)||!Object.hasOwn(STOCK_RANGES,range))throw Error('Invalid chart request');
  const key=`stock-history/v2/${ticker}-${range}.json`,clock=now();
  const object=await bucket.get(key);const cached=object?await object.json():null;
  const age=cached?clock-Date.parse(cached.fetchedAt):Infinity;
  if(cached&&age>=0&&age<300000)return {...cached,cached:true,stale:false};
  const stale=()=>cached&&age>=0&&age<7*86400000?{...cached,cached:true,stale:true,notice:[cached.notice,'Showing cached history; the latest provider request could not complete.'].filter(Boolean).join(' ')}:null;
  if(pending.has(key))return pending.get(key);
  const request=(async()=>{
    const providers=[['stock-history/provider-cooldown.json',fetchStockHistory],...(ticker==='SPCX'?[]:[['stock-history/nasdaq-cooldown.json',fetchNasdaqHistory]])];
    let lastError=Error('Market data is temporarily rate limited. Please try later.');
    for(const [cooldownKey,provider] of providers){
      const cooldown=await bucket.get(cooldownKey);
      if(cooldown&&(await cooldown.json()).until>clock)continue;
      try{
        const value=await provider(ticker,range,{fetcher,now});
        await bucket.put(key,JSON.stringify(value),{httpMetadata:{contentType:'application/json'}});
        return {...value,cached:false,stale:false};
      }catch(error){
        lastError=error;
        if(error.retryAt)await bucket.put(cooldownKey,JSON.stringify({until:error.retryAt}));
      }
    }
    const fallback=stale();if(fallback)return fallback;throw lastError;
  })();
  pending.set(key,request);
  try{return await request;}finally{pending.delete(key);}
}
