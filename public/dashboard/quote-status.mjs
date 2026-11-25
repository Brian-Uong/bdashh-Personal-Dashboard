import {nasdaqCalendarState} from './market-calendar.mjs';
import {pacificTime} from './quote-time.mjs';
export function calendarWarning(now=Date.now()){
 const c=nasdaqCalendarState(now);
 return c.status==='covered'?'':c.status==='expired'?`Calendar expired after ${c.end} ET — session freshness unverified.`:'Calendar unverified for this date — session freshness unverified.';
}
export function quoteFreshness(quote,now=Date.now()){
 const warning=calendarWarning(now),c=nasdaqCalendarState(now);
 if(!quote)return ['No saved quote.',warning].filter(Boolean).join(' ');
 if(quote.timePrecision==='day'||/^\d{4}-\d{2}-\d{2}$/.test(quote.asOf??''))return ['Date-only quote — intraday freshness unavailable.',warning].filter(Boolean).join(' ');
 const trade=Date.parse(quote.asOf),elapsed=now-trade;
 if(!Number.isFinite(trade)||!Number.isFinite(elapsed))return ['Quote time unavailable.',warning].filter(Boolean).join(' ');
 if(elapsed<0)return ['Provider timestamp is ahead of this clock; freshness unverified.',warning].filter(Boolean).join(' ');
 const age=Math.floor(elapsed/60000),ageText=age<1?'Last trade less than 1 min ago':`Last trade ${age} min ago`;
 if(warning)return `${ageText}. ${warning}`;
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:c.timeZone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(now)).map(p=>[p.type,p.value]));
 const minutes=Number(parts.hour)*60+Number(parts.minute),d=c.tradingDay;
 if(d.kind==='closed'||minutes<d.preOpen||minutes>=d.postClose)return `${ageText}. Outside scheduled trading hours; saved quote.`;
 return `${ageText}${elapsed>20*60000?' — older than 20 minutes.':'.'} Quotes may be delayed.`;
}
export function quoteRefreshStatus(ticker,data,now=Date.now()){
 const r=data.quoteRefresh,q=data.quotes?.[ticker];
 let operation='Saved snapshot. Reload prices to check for updates.';
 if(!q)operation='No saved quote. Reload prices to check availability.';
 else if(r?.failed?.includes(ticker))operation='Last refresh failed; saved quote retained.';
 else if(r?.retained?.includes(ticker))operation='Checked; no newer quote available. Your newer saved price is retained.';
 else if(r?.updated?.includes(ticker))operation='Updated on last price check.';
 else if(r?.unchanged?.includes(ticker))operation='Provider returned the same price and trade time.';
 return `${operation} ${quoteFreshness(q,now)}`;
}
export function quoteRefreshSummary(data,now=Date.now()){
 const r=data.quoteRefresh,warning=calendarWarning(now);
 if(!r)return ['Fetch the latest available quotes for your saved holdings.',warning].filter(Boolean).join(' ');
 return (data.refreshNotice?data.refreshNotice+' ':'')+`Last checked ${pacificTime(r.checkedAt)} · ${(r.updated||[]).length} updated · ${(r.unchanged||[]).length} unchanged`+
 ((r.retained||[]).length?` · ${r.retained.length} checked; newer saved quotes retained`:'')+
 ((r.failed||[]).length?` · ${r.failed.length} could not refresh; saved prices retained.`:' · All holdings checked.')+' A completed check does not mean a recent trade.'+(warning?' '+warning:'');
}
// Re-evaluate displayed age/expiry without requesting prices or waiting for reload.
export function refreshQuoteStatusLabels(data,root=document,now=Date.now()){
 for(const node of root.querySelectorAll('[data-quote-freshness]'))node.textContent=quoteFreshness(data.quotes?.[node.dataset.quoteFreshness],now);
 for(const node of root.querySelectorAll('[data-quote-refresh-status]'))node.textContent=quoteRefreshStatus(node.dataset.quoteRefreshStatus,data,now);
 const summary=root.querySelector('#quoteRefreshStatus');if(summary)summary.textContent=summary.dataset?.refreshError?`Refresh failed. Your saved prices are unchanged. ${summary.dataset.refreshError} ${calendarWarning(now)}`.trim():quoteRefreshSummary(data,now);
}
