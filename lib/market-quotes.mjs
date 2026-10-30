const validTicker=t=>/^[A-Z][A-Z0-9.\-]{0,9}$/.test(t);
function validate(q,now){if(!Number.isFinite(q.price)||q.price<=0||!Number.isFinite(Date.parse(q.asOf))||Date.parse(q.asOf)>now+300000)throw Error('Invalid price or quote time');return q;}
function identity(ticker,name){if(ticker==='SPCX'&&!/spacex|space exploration/i.test(name||''))throw Error('SPCX company identity could not be verified');}
export function parseQuote(payload,ticker,now=Date.now()){
 const m=payload?.chart?.result?.[0]?.meta;
 if(!m||m.symbol?.toUpperCase()!==ticker||m.currency!=='USD')throw Error('Invalid quote identity or currency');
 identity(ticker,m.longName||m.shortName);
 return validate({price:m.regularMarketPrice,asOf:new Date(m.regularMarketTime*1000).toISOString(),source:'Yahoo Finance',currency:'USD',session:'Regular session',previousClose:m.chartPreviousClose??m.previousClose??null},now);
}
const money=v=>typeof v==='string'&&/^[-+]?\$?[\d,.]+$/.test(v.trim())?Number(v.replace(/[$,]/g,'')):NaN;
export function easternTimestamp(value){
 const m=String(value).match(/([A-Za-z]{3})\s+(\d{1,2}),\s+(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)\s+ET/i);
 if(!m)throw Error('Quote timestamp missing');
 const month=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(m[1].toLowerCase());if(month<0)throw Error('Invalid month');
 const hour=Number(m[4])%12+(m[7].toUpperCase()==='PM'?12:0);
 const wall=Date.UTC(+m[3],month,+m[2],hour,+m[5],+(m[6]||0));
 // Resolve Eastern offset at this date, including daylight saving time.
 const tz=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',timeZoneName:'shortOffset'}).formatToParts(new Date(wall+5*3600000)).find(p=>p.type==='timeZoneName').value;
 const offset=Number(tz.replace('GMT',''));return new Date(wall-offset*3600000).toISOString();
}
export function parseNasdaq(payload,ticker,now=Date.now()){
 const d=payload?.data,p=d?.primaryData;
 if(d?.symbol?.toUpperCase()!==ticker||d?.assetClass?.toUpperCase()!=='STOCKS'||!p?.lastSalePrice?.startsWith('$'))throw Error('Invalid Nasdaq quote identity or currency');
 identity(ticker,d.companyName);
 const extended=/after|pre-market/i.test(d.marketStatus||'');const close=extended?d.secondaryData:p;
 const previous=money(close?.lastSalePrice)-money(close?.netChange);
 const dateOnly=/^([A-Za-z]{3})\s+(\d{1,2}),\s+(\d{4})$/.exec(String(p.lastTradeTimestamp).trim());
 let asOf,timePrecision='minute';
 if(dateOnly&&/^closed$/i.test(d.marketStatus||'')){
  const month=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(dateOnly[1].toLowerCase());
  const year=Number(dateOnly[3]),day=Number(dateOnly[2]),date=new Date(Date.UTC(year,month,day));
  if(month<0||date.getUTCMonth()!==month||date.getUTCDate()!==day)throw Error('Invalid quote date');
  // Preserve the provider's precision. Never invent a closing time.
  asOf=date.toISOString().slice(0,10);timePrecision='day';
 }else asOf=easternTimestamp(p.lastTradeTimestamp);
 return validate({price:money(p.lastSalePrice),asOf,timePrecision,source:'Nasdaq',currency:'USD',company:d.companyName,session:extended?d.marketStatus:/closed/i.test(d.marketStatus||'')?'Regular close':'Regular session',previousClose:Number.isFinite(previous)&&previous>0?previous:null},now);
}
export async function fetchQuote(ticker,{fetcher=fetch,cooldowns={},now=()=>Date.now()}={}){
 if(!validTicker(ticker))throw Error('Invalid ticker');
 const providers=[['Nasdaq',`https://api.nasdaq.com/api/quote/${encodeURIComponent(ticker)}/info?assetclass=stocks`,parseNasdaq],['Yahoo Finance',`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`,parseQuote]];
 const errors=[];
 for(const [name,url,parse] of providers){
  if(Date.parse(cooldowns[name]||'')>now()){errors.push(`${name}: cooling down after rate limit`);continue;}
  try{const r=await fetcher(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(8000),cache:'no-store'});
   if(!r.ok){if(r.status===429){const seconds=Number(r.headers.get('retry-after'));const until=Number.isFinite(seconds)&&seconds>0?now()+seconds*1000:Date.parse(r.headers.get('retry-after')||'');cooldowns[name]=new Date(Math.max(now()+900000,Number.isFinite(until)?until:0)).toISOString();}throw Error(`HTTP ${r.status}`);}
   return {...parse(await r.json(),ticker,now()),checkedAt:new Date(now()).toISOString()};
  }catch(e){errors.push(`${name}: ${e.name==='TimeoutError'?'request timed out':e.message}`);}
 }
 throw Error(errors.join('; '));
}
