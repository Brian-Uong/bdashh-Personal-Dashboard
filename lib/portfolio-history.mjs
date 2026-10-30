const KEY='portfolio-history-v1.json';
const DAY=86400000;
const hash=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),n=>n.toString(16).padStart(2,'0')).join('');
const cents=value=>Math.round((value+Number.EPSILON)*100)/100;
export async function portfolioSnapshot(state,now=Date.now()){
 if(!Array.isArray(state?.holdings))return null;
 const holdings=state.holdings.filter(h=>h.shares!==0).slice().sort((a,b)=>a.ticker.localeCompare(b.ticker));
 if(!holdings.length&&!Number.isFinite(Date.parse(state.updatedAt)))return null;
 let value=0,cost=0;const quotes=[];
 for(const h of holdings){
  const q=state.quotes?.[h.ticker],time=Date.parse(q?.asOf);
  if(!Number.isFinite(h.shares)||h.shares<0||!Number.isFinite(h.avgCost)||h.avgCost<0||!Number.isFinite(q?.price)||q.price<=0||!Number.isFinite(time)||time>now+300000||(q.currency&&q.currency!=='USD'))return null;
  value+=h.shares*q.price;cost+=h.shares*h.avgCost;quotes.push([h.ticker,q.price,time,q.asOf]);
 }
 if(!Number.isFinite(value)||!Number.isFinite(cost))return null;
 const saved=Date.parse(state.updatedAt),recorded=Number.isFinite(saved)&&saved<=now+300000?saved:now;
 const positions=holdings.map(h=>[h.ticker,h.shares,h.avgCost]);
 return {time:Math.floor(recorded/1000),value:cents(value),cost:cents(cost),count:holdings.length,
  holdingsKey:await hash(JSON.stringify(positions)),valuationKey:await hash(JSON.stringify([positions,quotes.map(q=>q.slice(0,3))])),
  quoteOldest:quotes.length?quotes.reduce((a,b)=>a[2]<b[2]?a:b)[3]:null,quoteNewest:quotes.length?quotes.reduce((a,b)=>a[2]>b[2]?a:b)[3]:null};
}

export function mergeSnapshots(existing,candidates){
 const points=[...existing,...candidates.filter(Boolean)].sort((a,b)=>a.time-b.time);
 const byTime=new Map();for(const point of points)byTime.set(point.time,point);
 const result=[];
 for(const point of byTime.values())if(result.at(-1)?.valuationKey!==point.valuationKey)result.push(point);
 return result;
}

// Keep every sample for 30 days, then the final observation per Pacific day.
// Holding changes remain explicit so changes in quantities are not called returns.
export function compactSnapshots(points,now=Date.now()){
 const keep=new Set();const daily=new Map();
 points.forEach((p,i)=>{
  if(p.time*1000>=now-30*DAY||i===0||i===points.length-1||p.holdingsKey!==points[i-1]?.holdingsKey||p.holdingsKey!==points[i+1]?.holdingsKey)keep.add(i);
  else daily.set(new Date(p.time*1000).toLocaleDateString('en-CA',{timeZone:'America/Los_Angeles'}),i);
 });
 for(const i of daily.values())keep.add(i);
 return points.filter((_,i)=>keep.has(i));
}

export async function readPortfolioHistory(bucket){
 const object=await bucket.get(KEY);return object?await object.json():{version:1,points:[],startedAt:null};
}
export async function recordPortfolioStates(bucket,states,{now=()=>Date.now()}={}){
 const clock=now(),candidates=(await Promise.all(states.map(s=>portfolioSnapshot(s,clock)))).filter(Boolean);
 for(let attempt=0;attempt<4;attempt++){
  const object=await bucket.get(KEY),history=object?await object.json():{version:1,points:[],startedAt:null};
  const points=compactSnapshots(mergeSnapshots(history.points||[],candidates),clock);
  if(JSON.stringify(points)===JSON.stringify(history.points||[]))return history;
  const next={version:1,points,startedAt:history.startedAt||new Date(clock).toISOString(),updatedAt:new Date(clock).toISOString()};
  const saved=await bucket.put(KEY,JSON.stringify(next),{httpMetadata:{contentType:'application/json'},onlyIf:object?{etagMatches:object.etag}:{etagDoesNotMatch:'*'}});
  if(saved)return next;
 }
 throw Error('Portfolio history changed elsewhere. Please retry.');
}
export async function capturePortfolioHistory(bucket,states){
 try{await recordPortfolioStates(bucket,states);return null;}
 catch{return 'Portfolio values saved, but the history snapshot could not be recorded. Reopen Investments to retry.';}
}
