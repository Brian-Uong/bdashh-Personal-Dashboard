import {fetchQuote} from './market-quotes.mjs';
import {materialize} from './workbook.mjs';
import {capturePortfolioHistory} from './portfolio-history.mjs';
const failure=(message,status=400)=>Object.assign(new Error(message),{status});
export function validateHolding(input,{allowZeroShares=false}={}){
 if(!input||typeof input!=='object')throw failure('Enter valid stock details.');
 const ticker=typeof input?.ticker==='string'?input.ticker.trim().toUpperCase():'';
 if(!/^[A-Z][A-Z0-9.\-]{0,9}$/.test(ticker))throw failure('Enter a valid stock ticker, such as MSFT or BRK.B.');
 if(!Number.isFinite(input.shares)||input.shares<0||(!allowZeroShares&&input.shares===0))throw failure('Shares must be greater than zero. Fractional shares are supported.');
 if(!Number.isFinite(input.avgCost)||input.avgCost<0||!Number.isFinite(input.shares*input.avgCost))throw failure('Enter a valid average purchase price of zero or more.');
 if(typeof input.requestId!=='string'||!/^[a-zA-Z0-9-]{10,80}$/.test(input.requestId))throw failure('Missing save request ID. Reopen the form and try again.');
 return {ticker,shares:input.shares,avgCost:input.avgCost,requestId:input.requestId};
}
export function mergeCooldowns(...values){
 const result={};for(const value of values)for(const [key,until] of Object.entries(value||{}))if(Number.isFinite(Date.parse(until))&&(!result[key]||Date.parse(until)>Date.parse(result[key])))result[key]=until;
 return result;
}
function checkState(state,input){
 const prior=(state.holdingRequests||[]).find(r=>r.id===input.requestId);
 if(prior){if(prior.action||prior.ticker!==input.ticker||prior.shares!==input.shares||prior.avgCost!==input.avgCost)throw failure('This save request was already used for different details. Reopen the form.',409);return true;}
 if((state.holdings||[]).some(h=>h.ticker===input.ticker))throw failure(input.ticker+' is already in your holdings. Use Edit on its stock card to update it or add shares.',409);
 if((state.holdings||[]).length>=100)throw failure('Your portfolio supports up to 100 holdings.',400);
 return false;
}

export function validateHoldingChange(raw){
 if(!['update','add_shares','remove'].includes(raw?.action))throw failure('Unknown holding action.');
 // Reuse the same numeric and ticker rules for the saved base position.
 const base=validateHolding({...raw?.base,ticker:raw?.ticker,requestId:raw?.requestId},{allowZeroShares:true});
 const input={action:raw.action,ticker:base.ticker,base:{shares:base.shares,avgCost:base.avgCost},requestId:base.requestId};
 if(input.action!=='remove'){
  const values=validateHolding({...raw,ticker:base.ticker});
  input.shares=values.shares;input.avgCost=values.avgCost;
 }
 return input;
}

export async function changeSavedHolding(bucket,raw,{now=()=>Date.now()}={}){
 const input=validateHoldingChange(raw),fingerprint=JSON.stringify(input);
 for(let attempt=0;attempt<4;attempt++){
  const object=await bucket.get('dashboard.json'),state=object?await object.json():{holdings:[],quotes:{}};
  const prior=(state.holdingRequests||[]).find(r=>r.id===input.requestId);
  if(prior){
   if(prior.fingerprint!==fingerprint)throw failure('This save request was already used for different details. Reopen the form.',409);
   return {state,changed:{ticker:input.ticker,action:input.action,replayed:true}};
  }
  const holding=state.holdings.find(h=>h.ticker===input.ticker);
  if(!holding)throw failure(input.ticker+' is no longer in your portfolio. Close this form and reload the page.',409);
  if(holding.shares!==input.base.shares||holding.avgCost!==input.base.avgCost)throw failure(input.ticker+' changed elsewhere. Close this form and reload the page before trying again.',409);
  const before=structuredClone(state);
  if(input.action==='remove')state.holdings=state.holdings.filter(h=>h.ticker!==input.ticker);
  else{
   const shares=input.action==='add_shares'?holding.shares+input.shares:input.shares;
   const cost=input.action==='add_shares'?holding.shares*holding.avgCost+input.shares*input.avgCost:shares*input.avgCost;
   const avgCost=input.action==='add_shares'?cost/shares:input.avgCost;
   if(!Number.isFinite(shares)||!Number.isFinite(cost)||!Number.isFinite(avgCost)||(state.quotes?.[input.ticker]&&!Number.isFinite(shares*state.quotes[input.ticker].price)))throw failure('Position value is too large. Check the shares and purchase price.');
   state.holdings=state.holdings.map(h=>h.ticker===input.ticker?{...h,shares,avgCost}:h);
  }
  // Cached market quotes and earlier snapshots remain valid after removal.
  state.holdingRequests=[...(state.holdingRequests||[]),{id:input.requestId,action:input.action,fingerprint}].slice(-100);
  state.updatedAt=new Date(Math.max(now(),(Date.parse(state.updatedAt)||0)+1)).toISOString();
  state.sheets=materialize(state).sheets;
  const saved=await bucket.put('dashboard.json',JSON.stringify(state),{httpMetadata:{contentType:'application/json'},onlyIf:{etagMatches:object.etag}});
  if(saved){const warning=await capturePortfolioHistory(bucket,[before,state]);return {state:warning?{...state,historyWarning:warning}:state,changed:{ticker:input.ticker,action:input.action,replayed:false}};}
 }
 throw failure('The dashboard changed while saving. Retry the same details safely.',409);
}
const result=(state,input,error=null,replayed=false)=>({state,added:{ticker:input.ticker,quoteAvailable:!!state.quotes?.[input.ticker],quoteError:error,replayed}});
export async function addSavedHolding(bucket,raw,{lookup=fetchQuote,now=()=>Date.now()}={}){
 const input=validateHolding(raw),initialObject=await bucket.get('dashboard.json');
 const initial=initialObject?await initialObject.json():{holdings:[],quotes:{},briefing:null,sheets:null};
 if(checkState(initial,input))return result(initial,input,null,true);
 const cooldowns=mergeCooldowns(initial.quoteRefresh?.providerCooldowns,initial.quoteProviderCooldowns);
 let quote=null,quoteError=null;
 try{quote=await lookup(input.ticker,{cooldowns,now});}catch(error){quoteError=error.message||'Quote temporarily unavailable';}
 if(quote&&!Number.isFinite(input.shares*quote.price))throw failure('Position value is too large. Check the number of shares.');
 for(let attempt=0;attempt<4;attempt++){
  const current=await bucket.get('dashboard.json'),state=current?await current.json():{holdings:[],quotes:{},briefing:null,sheets:null};
  if(checkState(state,input))return result(state,input,null,true);
  const before=structuredClone(state);state.holdings=[...(state.holdings||[]),{ticker:input.ticker,shares:input.shares,avgCost:input.avgCost}];state.quotes||={};
  if(quote&&(!state.quotes[input.ticker]||Date.parse(quote.asOf)>=Date.parse(state.quotes[input.ticker].asOf)))state.quotes[input.ticker]=quote;
  state.quoteProviderCooldowns=mergeCooldowns(state.quoteProviderCooldowns,cooldowns);
  state.holdingRequests=[...(state.holdingRequests||[]),{id:input.requestId,ticker:input.ticker,shares:input.shares,avgCost:input.avgCost}].slice(-100);
  state.updatedAt=new Date(now()).toISOString();state.sheets=materialize(state).sheets;
  const saved=await bucket.put('dashboard.json',JSON.stringify(state),{httpMetadata:{contentType:'application/json'},onlyIf:current?{etagMatches:current.etag}:{etagDoesNotMatch:'*'}});
  if(saved){const warning=await capturePortfolioHistory(bucket,[before,state]);return result(warning?{...state,historyWarning:warning}:state,input,quoteError);}
 }
 throw failure('The dashboard changed while saving. Try again; the same request will not add the stock twice.',409);
}
