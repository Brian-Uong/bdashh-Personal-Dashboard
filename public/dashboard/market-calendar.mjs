// Pinned, offline calendar for a deliberately bounded representative period.
// Never extrapolate these exceptions into another month/year. See source notes.
export const nasdaqCalendarCoverage=Object.freeze({
 version:'nasdaq-2026-11-r1',start:'2026-11-01',end:'2026-11-30',verifiedOn:'2026-11-19',timeZone:'America/New_York',
 sources:Object.freeze([
  'https://www.nasdaqtrader.com/Trader.aspx?id=Calendar',
  'https://www.nasdaqtrader.com/TraderNews.aspx?id=ETA2026-69',
  'https://www.nasdaqtrader.com/TraderNews.aspx?id=UTP2026-34'
 ])
});
const normal=Object.freeze({kind:'normal',preOpen:240,regularOpen:570,regularClose:960,postClose:1200});
const early=Object.freeze({kind:'early-close',preOpen:240,regularOpen:570,regularClose:780,postClose:1020});
const holiday=Object.freeze({kind:'closed',reason:'Thanksgiving'});
const weekend=Object.freeze({kind:'closed',reason:'Weekend'});

// Input is an Eastern ISO date, not a UTC trade date. null means unverified,
// distinct from a verified closure. Session bounds are minutes after ET midnight.
export function nasdaqTradingDay(day){
 if(typeof day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day)||day<nasdaqCalendarCoverage.start||day>nasdaqCalendarCoverage.end)return null;
 const date=new Date(`${day}T12:00:00Z`);
 if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==day)return null;
 if([0,6].includes(date.getUTCDay()))return weekend;
 if(day==='2026-11-26')return holiday;
 return day==='2026-11-27'?early:normal;
}

// Coverage is evaluated from the current Eastern date, independently of quotes
// and their checkedAt timestamps. Refreshing quotes never renews this calendar.
export function nasdaqCalendarState(at=Date.now()){
 const time=new Date(at);
 let date=null;
 if(Number.isFinite(time.getTime())){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:nasdaqCalendarCoverage.timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(time).map(p=>[p.type,p.value]));
  date=`${parts.year}-${parts.month}-${parts.day}`;
 }
 const tradingDay=date?nasdaqTradingDay(date):null;
 return {version:nasdaqCalendarCoverage.version,start:nasdaqCalendarCoverage.start,end:nasdaqCalendarCoverage.end,verifiedOn:nasdaqCalendarCoverage.verifiedOn,timeZone:nasdaqCalendarCoverage.timeZone,date,
  status:tradingDay?'covered':date>nasdaqCalendarCoverage.end?'expired':date?'not-covered':'invalid',tradingDay};
}
