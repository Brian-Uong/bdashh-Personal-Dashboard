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
const pending=new Map();
export async function cachedStockHistory(bucket,ticker,range,{now=()=>Date.now(),fetcher=fetch}={}) {
  const key=`stock-history/v1/${ticker}-${range}.json`,clock=now();
  const object=await bucket.get(key);const cached=object?await object.json():null;
  const age=cached?clock-Date.parse(cached.fetchedAt):Infinity;
  if(cached&&age>=0&&age<300000)return {...cached,cached:true,stale:false};
  const stale=()=>cached&&age>=0&&age<7*86400000?{...cached,cached:true,stale:true,notice:'Showing cached history; the latest provider request could not complete.'}:null;
  const cooldown=await bucket.get('stock-history/provider-cooldown.json');
  if(cooldown&&(await cooldown.json()).until>clock){const fallback=stale();if(fallback)return fallback;throw Error('Market data is temporarily rate limited. Please try later.');}
  if(pending.has(key))return pending.get(key);
  const request=(async()=>{
    try{
      const value=await fetchStockHistory(ticker,range,{fetcher,now});
      await bucket.put(key,JSON.stringify(value),{httpMetadata:{contentType:'application/json'}});
      return {...value,cached:false,stale:false};
    }catch(error){
      if(error.retryAt)await bucket.put('stock-history/provider-cooldown.json',JSON.stringify({until:error.retryAt}));
      const fallback=stale();if(fallback)return fallback;throw error;
    }
  })();
  pending.set(key,request);
  try{return await request;}finally{pending.delete(key);}
}
