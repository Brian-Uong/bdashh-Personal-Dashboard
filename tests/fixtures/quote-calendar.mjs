import {observe} from './quote-freshness.mjs';
export {observe};
const primary=['Nasdaq'],fallback=['Nasdaq','Yahoo Finance'];
const scenario=(name,at,status,active,extra={})=>({name,config:{time:Date.parse(at),status,...extra},source:active?'Yahoo Finance':'Nasdaq',calls:active?fallback:primary});
export const calendarCases=[
 scenario('normal day: stale regular quote uses newer fallback','2026-11-25T18:00:00Z','Open',true),
 scenario('normal day: fresh quote makes no extra request','2026-11-25T18:00:00Z','Open',false,{age:19}),
 scenario('normal day: pre-market remains eligible','2026-11-25T13:00:00Z','Pre-Market',true),
 scenario('normal day: after-hours remains eligible','2026-11-25T23:00:00Z','After-Hours',true),
 scenario('Eastern date before Thanksgiving remains active after UTC midnight','2026-11-26T00:30:00Z','After-Hours',true),
 scenario('normal day: Closed status still prevents age fallback','2026-11-25T18:00:00Z','Closed',false),
 scenario('full closure: stale Open status cannot trigger age fallback','2026-11-26T18:00:00Z','Open',false,{age:1500,fallbackAge:1442}),
 scenario('full closure: stale Pre-Market status is blocked','2026-11-26T13:00:00Z','Pre-Market',false,{age:1200}),
 scenario('full closure: stale After-Hours status is blocked','2026-11-26T23:00:00Z','After-Hours',false,{age:1800}),
 scenario('early close: 12:59:59 ET regular session is eligible','2026-11-27T17:59:59Z','Open',true),
 scenario('early close: 13:00 ET ends regular eligibility','2026-11-27T18:00:00Z','Open',false),
 scenario('early close: 13:00 ET begins post-market eligibility','2026-11-27T18:00:00Z','After-Hours',true,{fallbackAge:0}),
 scenario('early close: stale Open at 14:00 ET is blocked','2026-11-27T19:00:00Z','Open',false),
 scenario('early close: post-market remains eligible at 14:00 ET','2026-11-27T19:00:00Z','After-Hours',true),
 scenario('early close: 16:59:59 ET still eligible','2026-11-27T21:59:59Z','After-Hours',true),
 scenario('early close: 17:00 ET ends post-market eligibility','2026-11-27T22:00:00Z','After-Hours',false),
 scenario('early close: 18:00 ET stale status is blocked','2026-11-27T23:00:00Z','After-Hours',false),
 scenario('Eastern early-close date still applies after UTC midnight','2026-11-28T00:30:00Z','After-Hours',false),
 scenario('early close: unknown provider status stays blocked','2026-11-27T19:00:00Z','Unknown',false),
 scenario('early close: fallback cooldown still suppresses request','2026-11-27T19:00:00Z','After-Hours',false,{cooldowns:{'Yahoo Finance':'2026-11-27T19:20:00Z'}}),
 scenario('weekend after early close remains closed','2026-11-28T18:00:00Z','Open',false,{age:1200}),
 scenario('coverage last day retains normal fallback','2026-11-30T18:00:00Z','Open',true),
 scenario('outside coverage disables age-only fallback without claiming calendar coverage','2026-12-01T18:00:00Z','Open',false)
];
// Closed still checks the prior session's genuine extended quote as before.
calendarCases.find(c=>c.config.status==='Closed').calls=['Nasdaq','Nasdaq extended'];
