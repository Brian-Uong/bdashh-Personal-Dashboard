import {nasdaqTradingDay,nasdaqCalendarCoverage,nasdaqCalendarState} from './nasdaq-calendar.mjs';
const validTicker=t=>/^[A-Z][A-Z0-9.\-]{0,9}$/.test(t);
function validate(q,now){if(!Number.isFinite(q.price)||q.price<=0||!Number.isFinite(Date.parse(q.asOf))||Date.parse(q.asOf)>now+300000)throw Error('Invalid price or quote time');return q;}
function identity(ticker,name){if(ticker==='SPCX'&&!/spacex|space exploration/i.test(name||''))throw Error('SPCX company identity could not be verified');}
const easternParts=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value));
const easternDay=value=>{const p=Object.fromEntries(easternParts(value).map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}`;};
const dateOnly=q=>/^\d{4}-\d{2}-\d{2}$/.test(q?.asOf||'');
const activeQuoteMaxAgeMs=20*60*1000;
function activeNasdaqSession(status,time){
 // Calendar gates an active provider status; it never overrides Closed/Unknown.
 if(!/^(?:open|pre[ -]?market|after[ -]?hours)$/i.test(String(status||'').trim()))return false;
 const p=Object.fromEntries(easternParts(time).map(x=>[x.type,x.value]));
 const minutes=Number(p.hour)*60+Number(p.minute);
 const tradingDay=nasdaqTradingDay(`${p.year}-${p.month}-${p.day}`);
 if(tradingDay){
  if(tradingDay.kind==='closed')return false;
  const session=String(status).trim();
  if(/^open$/i.test(session))return minutes>=tradingDay.regularOpen&&minutes<tradingDay.regularClose;
  if(/^pre/i.test(session))return minutes>=tradingDay.preOpen&&minutes<tradingDay.regularOpen;
  return minutes>=tradingDay.regularClose&&minutes<tradingDay.postClose;
 }
 // Missing/expired coverage cannot establish an active exchange session.
 // Existing invalid, missing, date-only and older-than-saved fallbacks remain.
 return false;
}
function sessionRank(q){
 if(/after|post/i.test(q.session||''))return 2;
 if(/pre.?market/i.test(q.session||''))return 0;
 if(dateOnly(q)||/regular/i.test(q.session||''))return 1;
 const p=Object.fromEntries(easternParts(q.asOf).map(x=>[x.type,x.value]));
 const minutes=Number(p.hour)*60+Number(p.minute),close=nasdaqTradingDay(easternDay(q.asOf))?.regularClose??960;
 return minutes<570?0:minutes>close?2:1;
}
// Date-only closing quotes represent a session, not midnight UTC. Keep their
// published precision while ordering them against actual intraday trade times.
export function compareQuotes(next,previous){
 if(!previous||!Number.isFinite(Date.parse(previous.asOf)))return 1;
 if(!next||!Number.isFinite(Date.parse(next.asOf)))return -1;
 if(!dateOnly(next)&&!dateOnly(previous))return Math.sign(Date.parse(next.asOf)-Date.parse(previous.asOf));
 const nextDay=dateOnly(next)?next.asOf:easternDay(next.asOf),oldDay=dateOnly(previous)?previous.asOf:easternDay(previous.asOf);
 if(nextDay!==oldDay)return nextDay>oldDay?1:-1;
 const rank=sessionRank(next)-sessionRank(previous);if(rank)return Math.sign(rank);
 if(dateOnly(next)&&dateOnly(previous))return 0;
 // A dated regular close supersedes an intraday regular/pre-market observation.
 // A precise closing timestamp is more informative than the date-only equivalent.
 if(dateOnly(next))return /regular close/i.test(previous.session||'')?-1:1;
 return /regular close/i.test(next.session||'')?1:-1;
}
function yahooSession(time){
 const p=Object.fromEntries(easternParts(time).map(x=>[x.type,x.value]));
 const minutes=Number(p.hour)*60+Number(p.minute);
 const tradingDay=nasdaqTradingDay(`${p.year}-${p.month}-${p.day}`);
 if(tradingDay){
  if(tradingDay.kind==='closed'||minutes<tradingDay.preOpen||minutes>=tradingDay.postClose)return 'Extended hours';
  return minutes<tradingDay.regularOpen?'Pre-Market':minutes>=tradingDay.regularClose?'After-Hours':'Regular session';
 }
 return minutes<240||minutes>=1200?'Extended hours':minutes<570?'Pre-Market':minutes>=960?'After-Hours':'Regular session';
}
export function parseQuote(payload,ticker,now=Date.now()){
 const result=payload?.chart?.result?.[0],m=result?.meta;
 if(!m||m.symbol?.toUpperCase()!==ticker.replaceAll('.','-')||m.currency!=='USD')throw Error('Invalid quote identity or currency');
 identity(ticker,m.longName||m.shortName);
 let best=validate({price:m.regularMarketPrice,asOf:new Date(m.regularMarketTime*1000).toISOString(),source:'Yahoo Finance',currency:'USD',company:m.longName||m.shortName||ticker,session:'Regular session',previousClose:m.chartPreviousClose??m.previousClose??null},now);
 const consider=(price,time,session,precision='second')=>{
  if(!Number.isFinite(price)||price<=0||!Number.isFinite(time)||time<=0||time*1000>now+300000)return;
  const candidate={...best,price,asOf:new Date(time*1000).toISOString(),session,timePrecision:precision};
  if(compareQuotes(candidate,best)>0)best=candidate;
 };
 consider(m.preMarketPrice,m.preMarketTime,'Pre-Market');
 consider(m.postMarketPrice,m.postMarketTime,'After-Hours');
 const timestamps=result.timestamp,prices=result.indicators?.quote?.[0]?.close;
 if(Array.isArray(timestamps)&&Array.isArray(prices))for(let i=0;i<Math.min(timestamps.length,prices.length);i++){
  const time=timestamps[i];if(Number.isFinite(time)&&time>0&&time*1000<=now+300000)consider(prices[i],time,yahooSession(time*1000),'minute');
 }
 return best;
}
const money=v=>typeof v==='string'&&/^[-+]?\$?[\d,.]+$/.test(v.trim())?Number(v.replace(/[$,]/g,'')):NaN;
export function easternTimestamp(value){
 const m=String(value).match(/([A-Za-z]{3})\s+(\d{1,2}),\s+(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)\s+ET/i);
 if(!m)throw Error('Quote timestamp missing');
 const month=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(m[1].toLowerCase());if(month<0)throw Error('Invalid month');
 const rawHour=Number(m[4]),minute=Number(m[5]),second=Number(m[6]||0);
 const calendar=new Date(Date.UTC(+m[3],month,+m[2]));
 if(rawHour<1||rawHour>12||minute>59||second>59||calendar.getUTCMonth()!==month||calendar.getUTCDate()!==+m[2])throw Error('Invalid quote timestamp');
 const hour=rawHour%12+(m[7].toUpperCase()==='PM'?12:0);
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
// The extended endpoint has no symbol field. Always pair it with the identity-
// validated /info response requested for exactly the same symbol.
export function parseNasdaqExtended(payload,ticker,info,marketType='post',now=Date.now()){
 const base=parseNasdaq(info,ticker,now),data=payload?.data;
 if(!['post','pre'].includes(marketType))throw Error('Invalid extended session');
 const heading=String(data?.tradeDetailTable?.headers?.time||'');
 if(!(marketType==='post'?/after.?hours/i:/pre.?market/i).test(heading))throw Error('Extended session could not be verified');
 const updated=(Array.isArray(data.lastUpdateInfo)?data.lastUpdateInfo:[]).find(x=>/^Data last updated\b/i.test(String(x)));
 const date=String(updated||'').match(/([A-Za-z]{3}\s+\d{1,2},\s+\d{4})/);
 if(!date)throw Error('Extended trading date unavailable');
 const updatedAt=Date.parse(easternTimestamp(updated));if(updatedAt>now+300000)throw Error('Invalid extended update time');
 // Use the trade-feed date, never the refresh date: a holiday refresh can
 // legitimately retrieve the preceding session's last valid trade.
 const tradingDay=nasdaqTradingDay(easternDay(updatedAt));
 if(tradingDay?.kind==='closed')throw Error('Extended feed date is an exchange closure');
 const start=marketType==='post'?(tradingDay?.regularClose??960):(tradingDay?.preOpen??240);
 const end=marketType==='post'?(tradingDay?.postClose??1200):(tradingDay?.regularOpen??570);
 let best=null;
 for(const row of (data.tradeDetailTable.rows||[]).slice(0,100)){
  const time=String(row.time||'').match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if(!time||+time[1]>23||+time[2]>59||+(time[3]||0)>59)continue;
  const hour=+time[1],seconds=hour*3600+ +time[2]*60+ +(time[3]||0);
  if(seconds<start*60||(marketType==='post'?seconds>end*60:seconds>=end*60))continue;
  const asOf=easternTimestamp(`${date[1]} ${hour%12||12}:${time[2]}:${time[3]||'00'} ${hour>=12?'PM':'AM'} ET`),price=money(row.price);
  if(!Number.isFinite(price)||price<=0||Date.parse(asOf)>Math.min(now+300000,updatedAt+60000))continue;
  const q={...base,price,asOf,timePrecision:time[3]?'second':'minute',session:marketType==='post'?'After-Hours':'Pre-Market'};
  if(!best||compareQuotes(q,best)>0)best=q;
 }
 if(!best)throw Error('No timestamped extended-hours trades available');
 return validate(best,now);
}
export async function fetchQuote(ticker,{fetcher=fetch,cooldowns={},now=()=>Date.now(),previous=null,deadline=Infinity}={}){
 if(!validTicker(ticker))throw Error('Invalid ticker');
 const errors=[];let best=null,marketStatus=null;
 const consider=q=>{if(!best||compareQuotes(q,best)>0)best=q;};
 async function request(name,url){
  if(Date.parse(cooldowns[name]||'')>now())throw Error('cooling down after rate limit');
  const remaining=Math.min(8000,deadline-now());if(remaining<=0)throw Error('refresh time budget reached');
  const r=await fetcher(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(Math.ceil(remaining)),cache:'no-store'});
  if(!r.ok){if(r.status===429){const seconds=Number(r.headers.get('retry-after'));const until=Number.isFinite(seconds)&&seconds>0?now()+seconds*1000:Date.parse(r.headers.get('retry-after')||'');cooldowns[name]=new Date(Math.max(now()+900000,Number.isFinite(until)?until:0)).toISOString();}throw Error(`HTTP ${r.status}`);}
  return r.json();
 }
 const failure=(name,e)=>errors.push(`${name}: ${e.name==='TimeoutError'?'request timed out':e.message}`);
 try{
  const info=await request('Nasdaq',`https://api.nasdaq.com/api/quote/${encodeURIComponent(ticker)}/info?assetclass=stocks`);
  consider(parseNasdaq(info,ticker,now()));
  marketStatus=info.data.marketStatus;
  if(/closed/i.test(info.data.marketStatus||'')){
   try{consider(parseNasdaqExtended(await request('Nasdaq',`https://api.nasdaq.com/api/quote/${encodeURIComponent(ticker)}/extended-trading?assetclass=stocks&markettype=post`),ticker,info,'post',now()));}
   catch(e){failure('Nasdaq extended hours',e);}
  }
 }catch(e){failure('Nasdaq',e);}
 // A precise trade can still be old during an active session, even when it
 // matches the saved observation. One bounded fallback may improve it; never
 // relabel the trade time or discard a valid quote if that fallback fails.
 const checkedAt=now();
 if(!nasdaqTradingDay(easternDay(checkedAt)))errors.push(`Nasdaq calendar: outside verified ${nasdaqCalendarCoverage.start} to ${nasdaqCalendarCoverage.end}; session freshness unverified; age-only fallback disabled`);
 const staleActive=best&&!dateOnly(best)&&activeNasdaqSession(marketStatus,checkedAt)&&checkedAt-Date.parse(best.asOf)>activeQuoteMaxAgeMs;
 if(staleActive)errors.push('Nasdaq: last trade exceeds 20 minutes during an active session');
 if(!best||dateOnly(best)||staleActive||(previous&&compareQuotes(best,previous)<0)){
  try{consider(parseQuote(await request('Yahoo Finance',`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker.replaceAll('.','-'))}?interval=1m&range=1d&includePrePost=true`),ticker,now()));}
  catch(e){failure('Yahoo Finance',e);}
 }
 if(!best)throw Error(errors.join('; '));
 return {...best,calendar:nasdaqCalendarState(now()),checkedAt:new Date(now()).toISOString(),...(errors.length?{providerNotes:errors.join('; ')}:{})};
}
