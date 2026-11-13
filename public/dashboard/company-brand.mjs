import {companyIdentities} from './company-identities.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const symbol=value=>typeof value==='string'?value.trim().toUpperCase():'';
const failedLogos=new Set();
export function companyIdentity(ticker){const normalized=symbol(ticker),key=normalized==='GOOG'?'GOOGL':normalized;return Object.hasOwn(companyIdentities,key)?companyIdentities[key]:null;}
export function companyLogoUrl(ticker){
 const key=symbol(ticker);if(!/^[A-Z][A-Z0-9.-]{0,9}$/.test(key))return '';
 const asset=companyIdentity(key)?.file;
 return asset&&/^[A-Z0-9.-]+\.(svg|png|webp)$/.test(asset)?`company-logos/${asset}`:`https://images.financialmodelingprep.com/symbol/${encodeURIComponent(key)}.png`;
}
// Failed logos remain initials for this page session, including after redraws.
export function markCompanyLogoFailed(ticker){failedLogos.add(symbol(ticker));}
export const externalArrow='<svg class="investment-external-arrow" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 12 12 4M4 4h8v8"/></svg>';
export function companyMark(ticker,size='medium'){
 const key=symbol(ticker),variant=['small','medium','large'].includes(size)?size:'medium',src=failedLogos.has(key)?'':companyLogoUrl(key);
 return `<span class="company-mark company-mark--${variant}" aria-hidden="true"><span class="company-initials">${esc((key||'?').slice(0,3))}</span>${src?`<img src="${esc(src)}" alt="" width="64" height="64" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-company-logo="${esc(key)}">`:''}</span>`;
}
