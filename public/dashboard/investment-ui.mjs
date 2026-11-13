import {markCompanyLogoFailed} from './company-brand.mjs';
const targets=new Set(['recommendationTracker','investmentBriefing','portfolioSummary','positionDetails']);
document.addEventListener('error',event=>{const img=event.target;if(img?.matches?.('img[data-company-logo]')){markCompanyLogoFailed(img.dataset.companyLogo);img.hidden=true;img.parentElement?.classList.add('company-mark--fallback');}},true);
document.addEventListener('click',event=>{
 const button=event.target.closest('[data-investment-jump]'),id=button?.dataset.investmentJump;
 if(!targets.has(id))return;
 const target=document.getElementById(id);if(!target)return;
 target.tabIndex=-1;target.focus({preventScroll:true});target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
});
