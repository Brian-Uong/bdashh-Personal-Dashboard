export const WIDGET_SCRIPT='https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
export function widgetConfig(ticker,range){
 if(!/^[A-Z][A-Z0-9.-]{0,9}$/.test(ticker))throw Error('Invalid stock symbol');
 const spans={'1d':'1D','1mo':'1M','3mo':'3M','1y':'12M','5y':'60M'};
 if(!spans[range])throw Error('Invalid chart range');
 return {symbol:ticker,interval:range==='1d'?'5':range==='5y'?'W':'D',range:spans[range],timezone:'America/Los_Angeles',theme:'dark',style:'3',locale:'en',allow_symbol_change:false,hide_side_toolbar:true,hide_top_toolbar:false,hide_volume:false,save_image:false,withdateranges:true,autosize:true,backgroundColor:'#101425',gridColor:'rgba(181,164,255,0.08)',support_host:'https://www.tradingview.com'};
}
// Let TradingView's supported loader construct and configure its own frame.
// A frame load event does NOT prove that its cross-origin price feed rendered.
export function mountWidget(host,status,config,{doc=document,schedule=setTimeout,cancel=clearTimeout}={}){
 let disposed=false;
 const setStatus=message=>{if(!disposed)status.textContent=message;};
 const wrapper=doc.createElement('div');wrapper.className='tradingview-widget-container';wrapper.style.cssText='height:500px;width:100%';
 const target=doc.createElement('div');target.className='tradingview-widget-container__widget';target.style.cssText='height:100%;width:100%';wrapper.append(target);
 const script=doc.createElement('script');script.type='text/javascript';script.src=WIDGET_SCRIPT;script.async=true;script.textContent=JSON.stringify(config);
 const timer=schedule(()=>setStatus('If the chart is still blank, this browser may be unable to load the embedded market feed. Use Open full chart below, or retry the embed.'),18000);
 script.onerror=()=>{cancel(timer);setStatus('TradingView could not load in this browser. Open the full chart below to view it directly.');};
 setStatus('Loading TradingView… You can also open the full chart directly below.');
 host.replaceChildren(wrapper);wrapper.append(script);
 return ()=>{disposed=true;cancel(timer);script.onerror=null;wrapper.remove();};
}
