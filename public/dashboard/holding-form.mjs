import {apiFetch} from './api-client.mjs';
import {canEdit} from './dashboard-access.mjs';
import {getData} from './synced.mjs';
import {money,escape as e} from './portfolio-positions.mjs';
let current=null;
export function setupHoldingForm({onSaved,onNotice=()=>{}}){
 document.addEventListener('click',event=>{
  const trigger=event.target.closest('[data-add-stock],[data-edit-stock],[data-remove-stock]');if(!trigger)return;
  const action=trigger.hasAttribute('data-remove-stock')?'remove':trigger.hasAttribute('data-edit-stock')?'update':'add';
  openHoldingForm({trigger,onSaved,onNotice,action,ticker:trigger.dataset.editStock||trigger.dataset.removeStock});
 });
}
export function openHoldingForm({trigger,onSaved,onNotice=()=>{},action='add',ticker:stockTicker}){
 if(!canEdit)return;
 if(current){current.querySelector('input,button')?.focus();return;}
 const holding=getData()?.holdings.find(h=>h.ticker===stockTicker),adding=action==='add',removing=action==='remove';
 if(!adding&&!holding)return;
 const base=holding?{shares:holding.shares,avgCost:holding.avgCost}:null;
 const dialog=current=document.createElement('dialog');dialog.className='holding-dialog';dialog.setAttribute('aria-labelledby','holdingTitle');
 let busy=false,requestId=null,fingerprint=null,savedTicker=null,savedAction=null,mode=action;
 const number=value=>value.toLocaleString('en-US',{maximumFractionDigits:8});
 const label=()=>mode==='add'?'Add stock':mode==='remove'?'Remove stock':mode==='add_shares'?'Add shares':'Save changes';
 dialog.innerHTML=`<form id="holdingForm"><header><div><span class="pd-kicker">${adding?'GROW YOUR PORTFOLIO':'MANAGE YOUR POSITION'}</span><h2 id="holdingTitle">${adding?'Add a stock':removing?`Remove ${e(stockTicker)}?`:`Edit ${e(stockTicker)}`}</h2></div><button type="button" class="quiet" data-holding-close aria-label="Close stock form">✕</button></header>
 <p class="holding-intro">${adding?'Add your position to create its card, performance breakdown and TradingView chart.':removing?'Remove this holding from your current portfolio and allocation charts. Earlier portfolio history stays saved. This does not place a trade.':'Correct your position or add a new purchase. Portfolio totals and charts update when you save.'}</p>
 ${!adding&&!removing?'<div class="holding-modes" role="group" aria-label="Edit options"><button type="button" data-holding-mode="update" aria-pressed="true">Edit position</button><button type="button" data-holding-mode="add_shares" aria-pressed="false">Add shares</button></div>':''}
 ${adding?'<label class="holding-field">Stock ticker<input name="ticker" aria-label="Stock ticker" placeholder="e.g. MSFT" maxlength="10" autocomplete="off" autocapitalize="characters" spellcheck="false" required autofocus><small>Use the ticker symbol for a US-listed stock.</small></label>':''}
 ${removing?`<div class="holding-cost"><span>${e(stockTicker)} · ${number(base.shares)} shares<br>Current cost basis</span><strong>${money(base.shares*base.avgCost)}</strong></div>`:`<div class="holding-fields"><label class="holding-field"><span data-shares-label>Shares held</span><input name="shares" aria-label="Shares held" type="number" step="any" min="0" inputmode="decimal" placeholder="e.g. 2.5" required ${!adding?'autofocus':''}><small data-shares-help>Fractional shares are welcome.</small></label><label class="holding-field"><span data-cost-label>Average purchase price</span><input name="avgCost" aria-label="Average purchase price" type="number" step="any" min="0" inputmode="decimal" placeholder="USD per share" required><small data-cost-help>Your average cost per share, in USD.</small></label></div><div class="holding-cost"><span data-cost-caption>Your cost basis</span><strong data-holding-cost>—</strong></div><p class="holding-result" data-holding-result aria-live="polite"></p>`}
 <p class="holding-help">${adding?'We’ll fetch the latest available quote. If pricing is temporarily unavailable, your holding and chart access will still be saved.':removing?'To add it again later, use Add stock and enter your shares and average purchase price.':'Saved market prices stay the same. Share and cost changes flow into allocation, gains, portfolio history, and your workbook.'}</p>
 <p id="holdingFormStatus" class="holding-form-status" role="status" aria-live="polite"></p>
 <footer><button type="button" class="button subtle" data-holding-close ${removing?'autofocus':''}>Cancel</button><button type="submit" class="button ${removing?'holding-danger':'gold'}" data-holding-submit>${label()}</button></footer></form>`;
 const form=dialog.querySelector('form'),ticker=form.elements.ticker,shares=form.elements.shares,avgCost=form.elements.avgCost,status=dialog.querySelector('#holdingFormStatus'),submit=dialog.querySelector('[data-holding-submit]');
 const validate=()=>{
  if(removing)return;
  if(ticker){const symbol=ticker.value.trim().toUpperCase();ticker.setCustomValidity(symbol&&!/^[A-Z][A-Z0-9.\-]{0,9}$/.test(symbol)?'Enter a ticker such as MSFT or BRK.B.':getData()?.holdings.some(h=>h.ticker===symbol)?`${symbol} is already in your holdings. Use Edit on its stock card to update it or add shares.`:'');}
  shares.setCustomValidity(shares.value&&(!Number.isFinite(shares.valueAsNumber)||shares.valueAsNumber<=0)?'Enter a number of shares greater than zero.':'');
  const increment=mode==='add_shares',totalShares=shares.valueAsNumber+(increment?base.shares:0),cost=shares.valueAsNumber*avgCost.valueAsNumber+(increment?base.shares*base.avgCost:0);
  avgCost.setCustomValidity(avgCost.value&&shares.value&&(!Number.isFinite(cost)||!Number.isFinite(totalShares))?'This position is too large. Check the shares and purchase price.':'');
  const valid=shares.value&&avgCost.value&&shares.valueAsNumber>0&&avgCost.valueAsNumber>=0&&Number.isFinite(cost)&&Number.isFinite(totalShares);
  dialog.querySelector('[data-holding-cost]').textContent=valid?money(cost):'—';
  dialog.querySelector('[data-holding-result]').textContent=increment&&valid?`After purchase: ${number(totalShares)} shares · ${money(cost/totalShares)} average cost per share.`:'';
 };
 if(holding&&!removing){shares.value=base.shares;avgCost.value=base.avgCost;validate();}
 const drafts={update:{shares:base?.shares,avgCost:base?.avgCost},add_shares:{shares:'',avgCost:''}};
 dialog.addEventListener('click',event=>{
  if(busy)return;
  if(event.target.closest('[data-holding-close]'))dialog.close();
  const tab=event.target.closest('[data-holding-mode]');if(!tab||tab.dataset.holdingMode===mode)return;
  drafts[mode]={shares:shares.value,avgCost:avgCost.value};mode=tab.dataset.holdingMode;
  for(const b of dialog.querySelectorAll('[data-holding-mode]'))b.setAttribute('aria-pressed',String(b.dataset.holdingMode===mode));
  const increment=mode==='add_shares',shareLabel=increment?'Additional shares':'Shares held',costLabel=increment?'Purchase price per share':'Average purchase price';
  dialog.querySelector('[data-shares-label]').textContent=shareLabel;shares.setAttribute('aria-label',shareLabel);
  dialog.querySelector('[data-cost-label]').textContent=costLabel;avgCost.setAttribute('aria-label',costLabel);
  dialog.querySelector('[data-shares-help]').textContent=increment?`You currently hold ${number(base.shares)} shares.`:'Enter the total shares you currently hold.';
  dialog.querySelector('[data-cost-help]').textContent=increment?'Price paid per new share, in USD.':'Your average cost per share, in USD.';
  dialog.querySelector('[data-cost-caption]').textContent=increment?'New total cost basis':'Your cost basis';
  shares.value=drafts[mode].shares;avgCost.value=drafts[mode].avgCost;submit.textContent=label();status.textContent='';validate();shares.focus();
 });
 form.addEventListener('input',()=>{validate();status.textContent='';});ticker?.addEventListener('blur',()=>{ticker.value=ticker.value.trim().toUpperCase();validate();});
 dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;validate();if(!form.reportValidity())return;
  const symbol=adding?ticker.value.trim().toUpperCase():stockTicker;
  const input={ticker:symbol,...(!adding?{action:mode,base}:{}),...(!removing?{shares:shares.valueAsNumber,avgCost:avgCost.valueAsNumber}:{})},key=JSON.stringify(input);
  if(fingerprint!==key){requestId=crypto.randomUUID();fingerprint=key;}
  busy=true;for(const field of form.querySelectorAll('input,button'))field.disabled=true;form.setAttribute('aria-busy','true');submit.textContent='Saving…';status.textContent=adding?'Saving your position and checking available market data…':'Saving your portfolio changes…';
  try{
   const response=await apiFetch('/api/holdings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...input,requestId}),timeoutMs:50000});
   const result=await response.json();if(!response.ok)throw Error(result.error||'Could not save the stock.');
   onSaved(result.state);savedTicker=symbol;savedAction=mode;
   let note=adding?(result.added.quoteAvailable?`${symbol} added. Its position, performance and TradingView chart are ready.`:`${symbol} added. Its TradingView chart is ready; the saved price and performance will fill in when a quote is available. Use Reload prices to retry.`):`${symbol} ${removing?'removed':mode==='add_shares'?'purchase added':'updated'}. Portfolio totals, allocation, performance charts and workbook are synced.`;
   if(result.state.historyWarning)note+=' '+result.state.historyWarning;
   const notice=document.getElementById('holdingsNotice');if(notice){notice.textContent=note;notice.classList.toggle('holding-price-pending',adding&&!result.added.quoteAvailable||!!result.state.historyWarning);}onNotice(note);dialog.close();
  }catch(error){status.textContent=error.name==='TimeoutError'||error instanceof TypeError?'The save could not be confirmed. Retry the same details safely, or reload to check your holdings.':error.message;}
  finally{busy=false;for(const field of form.querySelectorAll('input,button'))field.disabled=false;form.removeAttribute('aria-busy');submit.textContent=label();}
 });
 dialog.addEventListener('close',()=>{
  dialog.remove();current=null;document.body.classList.remove('holding-dialog-open');
  const stockDialog=document.querySelector('.stock-dialog[open]');
  const target=savedTicker?(stockDialog?.querySelector('[data-edit-stock]')||document.querySelector(`.position-ticker[data-stock-open="${CSS.escape(savedTicker)}"]`)||document.querySelector('#positionDetails [data-add-stock]')):trigger?.isConnected?trigger:null;
  if(target){if(savedTicker&&!stockDialog&&savedAction!=='remove')target.closest('.position-card')?.scrollIntoView({behavior:document.body.classList.contains('no-motion')||matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});target.focus({preventScroll:true});}
 },{once:true});
 document.body.append(dialog);document.body.classList.add('holding-dialog-open');dialog.showModal();
}
