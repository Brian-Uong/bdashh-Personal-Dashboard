export function compareRoles(records, headers, initialRow) {
  const read = (record, name) => String(record.cells[headers.indexOf(name)] ?? '').trim();
  const role = record => [read(record,'Company'),read(record,'Role')].filter(Boolean).join(' · ') || 'Row '+(record.row+1);
  const dialog = document.createElement('dialog');
  dialog.className = 'application-compare';
  dialog.setAttribute('aria-label','Compare applications');
  function add(tag, parent, text) {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    parent.append(el);
    return el;
  }
  function addTable(parent) {
    const wrap = add('div', parent);
    wrap.className = 'comparison-table-wrap';
    return add('table', wrap);
  }
  add('h2', dialog, 'Compare applications');
  add('p', dialog, 'Enter each posted base salary range. For a confirmed fixed salary, use the same amount twice. Leave an undisclosed endpoint blank. Edits stay in this comparison. Travel and hours start with the same example assumptions for both roles.');
  const grid = add('div', dialog);
  grid.className = 'comparison-grid';
  const assumptions = [
    ['low','Annual base salary minimum ($)',null,0], ['high','Annual base salary maximum ($)',null,0], ['bonus','Guaranteed annual cash bonus ($)',null,0],
    ['weeks','Weeks worked per year',48,1,52], ['hours','Work hours per week',40,1,168],
    ['days','On-site days per week',2,0,7], ['minutes','Round-trip minutes per on-site day',60,0,1440],
    ['travel','Total per-trip cost without a pass ($)',20,0],
    ['pass','Annual parking or transit pass ($, optional)','',0],
    ['residual','Per-trip cost still payable with the pass ($)',0,0]
  ];
  const panels = [];
  const selections = [];
  const estimates = new Map();
  for (const side of [0,1]) {
    const panel = add('fieldset',grid);
    add('legend',panel,'Application '+(side+1));
    const label = add('label',panel,'Tracked role');
    const select = add('select',label);
    selections.push(select);
    add('option',select,'Choose a role').value='';
    for (const record of records) add('option',select,role(record)).value = String(record.row);
    const inputs = {};
    for (const [key,title,defaultValue,min,max] of assumptions) {
      const input = add('input',add('label',panel,title));
      Object.assign(input,{type:'number', step:'any', min, required:key!=='pass', placeholder: defaultValue===null?'Unknown':''});
      if (max!==undefined) input.max=max;
      inputs[key]=input;
    }
    let selected='';
    function populate() {
      if (selected) estimates.set(selected,Object.fromEntries(Object.entries(inputs).map(([k,i])=>[k,i.value])));
      selected=select.value;
      const record=records.find(r=>String(r.row)===selected);
      const saved=estimates.get(selected);
      for(const [key,,defaultValue] of assumptions) {
        inputs[key].value=saved?.[key] ?? defaultValue ?? '';
        inputs[key].disabled=!record;
      }
      if(record && !saved) {
        for(const [key,name] of [['low','Annual base salary minimum ($)'],['high','Annual base salary maximum ($)'],['bonus','Guaranteed annual bonus ($)']]) {
          const hasRange = ['Annual base salary minimum ($)','Annual base salary maximum ($)'].some(field => read(record,field) !== '');
          const value = key !== 'bonus' && !hasRange ? read(record,'Annual base salary ($)') : read(record,name);
          if (/^\d+(\.\d+)?$/.test(value)) inputs[key].value=value;
        }
      }
    }
    if (!side) select.value=String(initialRow);
    populate(); panels.push(inputs);
    select.addEventListener('change',()=>{populate();render()});
  }
  const status=add('p',dialog);
  status.setAttribute('role','status');
  const details=add('p',dialog);
  const schedule = add('section',dialog);
  add('h3',schedule,'Weekly on-site schedule');
  const payChoices = [0,1].map(side => {
    const label=add('label',schedule,'Fixed pay for application '+(side+1));
    const select=add('select',label);
    for (const [key,title] of [['low','Range minimum'],['high','Range maximum']]) {
      add('option',select,title).value=key;
    }
    select.value='low';
    select.addEventListener('change',render);
    return select;
  });
  const summary=add('p',schedule);
  const table=addTable(schedule);
  add('caption',table,'Application 2 attendance sensitivity');
  const header=add('tr',add('thead',table));
  for (const heading of ['Days per week','Hourly value','Lead']) add('th',header,heading).scope='col';
  const body=add('tbody',table);
  const scenarios=Array.from({length:8},(_,days)=>{
    const row=add('tr',body);
    add('th',row,String(days)).scope='row';
    return [add('td',row),add('td',row)];
  });
  const passNote=add('p',schedule);
  function commute(v,trips) {
    const regular=trips*v.travel;
    const prepaid=v.pass+trips*v.residual;
    return Number.isFinite(v.pass)?Math.min(regular,prepaid):regular;
  }
  function passSummary(v, label, money) {
    if (!Number.isFinite(v.pass)) return '';
    const trips=v.weeks*v.days, regular=trips*v.travel, prepaid=v.pass+trips*v.residual;
    const savings=v.travel-v.residual;
    const choice=Math.abs(regular-prepaid)<0.000001?'Equal cost':regular<prepaid?'Pay per trip':'Buy pass';
    let boundary='The pass never costs less at a whole number of trips.';
    if(savings>0) {
      const first=Math.floor(v.pass/savings+1e-9)+1;
      const days=Math.ceil(first/v.weeks);
      boundary='Pass first costs less at '+first+(first===1?' trip':' trips')+' per year. '+(days<=7?'First cheaper weekly schedule: '+days+(days===1?' day.':' days.'):'No 0–7 day weekly schedule reaches this threshold.');
    }
    return label+' · '+trips+' annual trips: '+money(regular)+' per-trip total, '+money(prepaid)+' with pass. '+choice+'. '+boundary;
  }
  const monthly=add('details',dialog);
  add('summary',monthly,'Monthly commute budget for application 2');
  const context=add('p',monthly);
  const monthlyTable=addTable(monthly);
  add('caption',monthlyTable,'One round trip per travel day. Enter each month’s pass price.');
  const headings=add('tr',add('thead',monthlyTable));
  for(const heading of ['Month','Travel days','Pass price ($)','Cheaper choice','Planned cost','Actual cost ($)','Actual minus plan'])
    add('th',headings,heading).scope='col';
  const months=add('tbody',monthlyTable);
  const lines=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((name,index)=>{
    const row=add('tr',months);
    add('th',row,name).scope='row';
    function field(label,max,step) {
      const input=add('input',add('td',row));
      Object.assign(input,{type:'number',min:0,max,step,value:''});
      input.setAttribute('aria-label',name+' '+label);
      return input;
    }
    return {name,days:field('travel days',[31,29,31,30,31,30,31,31,30,31,30,31][index],1),fee:field('monthly pass price',1e8,0.01),choice:add('td',row),cost:add('td',row),actual:field('actual commute cash cost',1e8,0.01),variance:add('td',row)};
  });
  const exportBudget=add('button',monthly,'Download monthly budget (CSV)');
  exportBudget.type='button';
  let exportRows=null;
  exportBudget.onclick=()=>{
    if(!exportRows || exportBudget.disabled) return;
    const csv=exportRows.map(row=>row.map(cell=>{
      const value=String(cell??'');
      const safe=typeof cell==='string' && (/^\s*[=+@-]|^[\t\r\n]/.test(value))?"'"+value:value;
      return '"'+safe.replaceAll('"','""')+'"';
    }).join(',')).join('\r\n')+'\r\n';
    const url=URL.createObjectURL(new Blob(['\uFEFF',csv],{type:'text/csv;charset=utf-8'}));
    const download=document.createElement('a');
    download.href=url;
    download.download='application-commute-budget.csv';
    document.body.append(download);
    download.click();
    download.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const loader=add('input',add('label',monthly,'Restore a saved commute CSV'));
  loader.type='file';loader.accept='.csv,text/csv';
  const preview=add('p',monthly);
  preview.setAttribute('aria-live','polite');
  const apply=add('button',monthly,'Apply reviewed changes');
  const cancel=add('button',monthly,'Cancel restore');
  apply.type=cancel.type='button';
  let pending=null,request=0;
  function clearRestore(message='') {
    request++; pending=null; apply.disabled=cancel.disabled=true;
    preview.textContent=message;loader.value='';
  }
  clearRestore();
  function decodeBudget(text,side=1) {
    // The offline exporter quotes every field, doubles embedded quotes and uses blank separator rows.
    const csv=text.replace(/^\uFEFF/,'').replace(/\r\n/g,'\n');
    const token=/"((?:[^"]|"")*)"(,|\n|$)/gy;
    const rows=[];let row=[],pos=0;
    while(pos<csv.length){
      if(csv[pos]==='\n' && !row.length){pos++;continue}
      token.lastIndex=pos;const field=token.exec(csv);
      if(!field)throw Error('Unrecognized CSV field.');
      row.push(field[1].replaceAll('""','"'));pos=token.lastIndex;
      if(field[2]!==','){rows.push(row);row=[]}
    }
    if(row.length)throw Error('Incomplete CSV row.');
    let index=0;
    const take=(label,length)=>{
      const r=rows[index++];
      if(!r || r[0]!==label || r.length!==length)throw Error('Expected '+label+'.');
      return r;
    };
    const expect=(ok,msg)=>{if(!ok)throw Error(msg)};
    const cents=(str,limit=1e8)=>{
      expect(/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(str) && Number(str)<=limit,'Invalid dollar amount.');
      return Math.round(Number(str)*100);
    };
    const checkAmount=(str,expected)=>expect(cents(str,1e12)===expected,'Exported totals disagree with the inputs.');
    const fields=[],changes=[];
    function stage(input,label,value) {
      const before=String(input.value),after=String(value);
      fields.push({input,after});
      if(before!==after && !(before!=='' && after!=='' && Number(before)===Number(after)))
        changes.push(label+' '+(before||'blank')+' → '+(after||'blank'));
    }
    take('Compared application',2);
    const role=take('Budget for',2)[1];
    const current=selections[side].selectedOptions[0]?.textContent||'';
    const escaped=/^\s*[=+@-]|^[\t\r\n]/.test(current)?"'"+current:current;
    expect(current && escaped===role,'Choose the application named in the exported budget.');
    expect(take('Currency',2)[1]==='USD','Expected a USD budget.');
    const trip=take('Round-trip fare',2)[1],residual=take('Per-trip cost with pass',2)[1];
    const t=cents(trip),r=cents(residual);
    stage(panels[1].travel,'Trip cost',trip);stage(panels[1].residual,'Residual trip cost',residual);
    expect(take('Month',6).join('|')==='Month|Round trips|Monthly pass price|Decision|Per-trip only|Selected cost','Invalid monthly headers.');
    let count=0,full=0,plan=0;
    const byMonth=new Map();
    for(const line of lines){
      const [name,days,fee,choice,pay,selected]=take(line.name,6);
      expect(/^(0|[1-9]\d*)$/.test(days) && Number(days)<=line.days.max,'Invalid travel days for '+name+'.');
      const n=Number(days),pass=fee==='' && !n?0:cents(fee);
      const all=n*t,withPass=pass+n*r,least=n?Math.min(all,withPass):0;
      expect(choice===(!n?'No travel':all===withPass?'Tie':all<withPass?'Pay per trip':'Monthly pass'),'Inconsistent decision for '+name+'.');
      checkAmount(pay,all);checkAmount(selected,least);
      stage(line.days,name+' days',days);stage(line.fee,name+' pass price',fee);
      byMonth.set(name,{line,least,actual:''});
      count+=n;full+=all;plan+=least;
    }
    const year=take('Year',6);expect(year[1]===String(count),'Annual trip count disagrees.');checkAmount(year[4],full);checkAmount(year[5],plan);
    checkAmount(take('Savings from monthly choices',2)[1],full-plan);
    if(rows[index]?.[0]==='Month'){
      expect(take('Month',4).join('|')==='Month|Matched plan|Actual cost|Actual minus plan','Invalid actuals header.');
      let planned=0,spent=0;
      while(byMonth.has(rows[index]?.[0])){
        const [name,matched,actual,delta]=take(rows[index][0],4),entry=byMonth.get(name);
        expect(entry.actual==='','Duplicate actual month.');
        checkAmount(matched,entry.least);const a=cents(actual);
        expect(delta===String((a-entry.least)/100),'Invalid monthly variance.');
        entry.actual=actual;planned+=entry.least;spent+=a;
      }
      const total=take('Matched months total',4);checkAmount(total[1],planned);checkAmount(total[2],spent);
      expect(total[3]===String((spent-planned)/100),'Invalid total variance.');
    }
    for(const [name,m] of byMonth)stage(m.line.actual,name+' actual',m.actual);
    let annual='',annualCost=null;
    if(rows[index]?.[0]==='Annual pass price'){
      annual=take('Annual pass price',2)[1];
      annualCost=cents(annual)+count*r;
      checkAmount(take('Annual pass with remaining trip costs',2)[1],annualCost);
    }
    stage(panels[1].pass,'Annual pass',annual);
    expect(index===rows.length,'Unexpected trailing rows.');
    return {fields,changes,monthlyCosts:[...byMonth.values()].map(m=>m.least),plan,annualCost};
  }
  loader.addEventListener('change',async()=>{
    const file=loader.files?.[0];
    clearRestore();
    if(!file)return;
    const ticket=request;
    try{
      if(file.size>65536)throw Error('File exceeds the 64 KB export limit.');
      const text=await file.text();
      if(ticket!==request)return;
      pending=decodeBudget(text);
      preview.textContent=pending.changes.length?'Review '+pending.changes.length+' changes: '+pending.changes.join('; ')+'.':'The budget already matches.';
      apply.disabled=!pending.changes.length;cancel.disabled=false;
    }catch(error){if(ticket===request)clearRestore('Could not restore: '+error.message)}
  });
  cancel.onclick=()=>clearRestore('Restore canceled.');
  apply.onclick=()=>{
    if(!pending || apply.disabled)return;
    for(const {input,after} of pending.fields)input.value=after;
    clearRestore('Budget restored.');render();
  };
  const review=add('p',monthly);
  review.setAttribute('aria-live','polite');
  const budget=add('p',monthly);
  budget.setAttribute('aria-live','polite');
  let budgetRole='';
  function renderMonths() {
    exportRows=null;exportBudget.disabled=true;
    const selected=selections[1].value;
    monthly.hidden=!selected;
    if(selected!==budgetRole) {
      clearRestore();
      for(const {days,fee,actual} of lines) days.value=fee.value=actual.value='';
      budgetRole=selected;
    }
    if(!selected) return;
    context.textContent=selections[1].selectedOptions[0].textContent+' · Uses this role’s round-trip costs. Monthly entries apply only to this cash budget. Enter zero days for months without travel.';
    const p=panels[1],money=cents=>(cents/100).toLocaleString('en-US',{style:'currency',currency:'USD'});
    const cents=input=>{
      const num=input.valueAsNumber;
      return input.validity.valid && Number.isFinite(num) && num>=0 && num<=1e8 && Math.abs(Math.round(num*100)-num*100)<1e-5 ? Math.round(num*100):NaN;
    };
    const trip=cents(p.travel),residual=cents(p.residual);
    let total=0,perTripTotal=0,count=0,completed=0;
    const rows=[], observations=[];
    let invalidActual=false;
    const dollars=c=>(c/100).toFixed(2);
    for(const {name,days,fee,choice,cost,actual,variance} of lines) {
      const n=days.valueAsNumber,f=cents(fee);
      const spent=cents(actual);
      const invalid=(actual.value!=='' || actual.validity.badInput) && !Number.isFinite(spent);
      invalidActual ||= invalid;
      variance.textContent=invalid?'Enter a nonnegative amount in cents':Number.isFinite(spent)?'Plan pending':'—';
      choice.textContent='Pending';cost.textContent='—';
      if(!days.validity.valid || !Number.isInteger(n) || n<0 || n>days.max || !Number.isFinite(trip+residual)) continue;
      if(n && !Number.isFinite(f)) continue;
      const perTrip=n*trip,pass=f+n*residual;
      const cheapest=n?Math.min(perTrip,pass):0;
      choice.textContent=!n?'No travel':perTrip===pass?'Tie':perTrip<pass?'Pay per trip':'Monthly pass';
      cost.textContent=money(cheapest);
      if(Number.isFinite(spent)){
        const delta=spent-cheapest;
        variance.textContent=money(delta);
        observations.push({name,planned:cheapest,spent,delta});
      }
      rows.push([name,n,Number.isFinite(f)?dollars(f):'',choice.textContent,dollars(perTrip),dollars(cheapest)]);
      total+=cheapest;perTripTotal+=perTrip;count+=n;completed++;
    }
    const deltaTotal=observations.reduce((sum,item)=>sum+item.delta,0);
    const actualTotal=observations.reduce((sum,item)=>sum+item.spent,0);
    const planTotal=actualTotal-deltaTotal;
    if(observations.length){
      const max=Math.max(...observations.map(item=>Math.abs(item.delta)));
      const leaders=observations.filter(item=>Math.abs(item.delta)===max);
      review.textContent=observations.length+' of 12 months compared · Actual '+money(actualTotal)+' · Matched plan '+money(planTotal)+' · Actual minus plan '+money(deltaTotal)+'. '+(max?'Largest absolute difference: '+leaders.map(item=>item.name+' ('+money(item.delta)+')').join(', ')+'.':'Every reported month matched its plan.');
    }else review.textContent='Enter an actual amount alongside a valid monthly plan to compare spending.';
    if(invalidActual) review.textContent+=' Correct the invalid actual amounts to include them.';
    if(completed<12){budget.textContent=completed+' of 12 months complete. Annual total appears when all months have valid day counts and travel months have a pass price.';return}
    budget.textContent=count+' trips · Best monthly choices '+money(total)+' · Per-trip only '+money(perTripTotal)+' · Saved '+money(perTripTotal-total)+'.';
    const first=selections[0].selectedOptions[0]?.textContent||'';
    exportRows=[['Compared application',first],['Budget for',selections[1].selectedOptions[0].textContent],
      ['Currency','USD'],['Round-trip fare',dollars(trip)],['Per-trip cost with pass',dollars(residual)],[],
      ['Month','Round trips','Monthly pass price','Decision','Per-trip only','Selected cost'],...rows,
      ['Year',count,'','',dollars(perTripTotal),dollars(total)],['Savings from monthly choices',dollars(perTripTotal-total)]];
    if(observations.length) {
      exportRows.push([],['Month','Matched plan','Actual cost','Actual minus plan'],
        ...observations.map(item=>[item.name,dollars(item.planned),dollars(item.spent),item.delta/100]),
        ['Matched months total',dollars(planTotal),dollars(actualTotal),deltaTotal/100]);
    }
    exportBudget.disabled=invalidActual;
    if(p.pass.value!==''){
      const annual=cents(p.pass)+count*residual;
      if(Number.isFinite(annual)) exportRows.push(['Annual pass price',dollars(cents(p.pass))],['Annual pass with remaining trip costs',dollars(annual)]);
      else {exportRows=null;exportBudget.disabled=true}
      budget.textContent+=Number.isFinite(annual)?' Annual pass including remaining trip costs: '+money(annual)+'. '+(annual===total?'Both strategies tie.':annual<total?'Annual pass costs less.':'Monthly choices cost less.'):' Enter an annual price in whole cents to compare.';
    }
  }
  const comparison=add('details',dialog);
  add('summary',comparison,'Compare two exported commute budgets');
  add('p',comparison,'Choose a saved budget for each selected application. The table compares the cheapest monthly choices and shows application 2 minus application 1.');
  const sources=[0,1].map(side=>{
    const label=add('label',comparison);
    const title=add('span',label);
    const file=add('input',label);
    file.type='file';file.accept='.csv,text/csv';
    return {title,file,side};
  });
  const compare=add('button',comparison,'Compare both files');
  compare.type='button';
  const feedback=add('p',comparison);
  feedback.setAttribute('aria-live','polite');
  const totals=add('p',comparison);
  const comparisonTable=addTable(comparison);
  const headerRow=add('tr',add('thead',comparisonTable));
  const pairHeadings=['Month','Application 1','Application 2','Difference'].map(value=>add('th',headerRow,value));
  const tableBody=add('tbody',comparisonTable);
  const comparisonRows=[...lines.map(line=>line.name),'Year'].map(month=>{
    const row=add('tr',tableBody);add('th',row,month).scope='row';
    return [add('td',row),add('td',row),add('td',row)];
  });
  const strategies=addTable(comparison);
  add('caption',strategies,'Full-year fare strategies');
  const strategyHeader=add('tr',add('thead',strategies));
  for(const name of ['Application','Monthly choices','Annual pass with trip costs','Cheapest quoted strategy','Yearly cost'])
    add('th',strategyHeader,name).scope='col';
  const strategyBody=add('tbody',strategies);
  const strategyRows=[0,1].map(()=>{
    const row=add('tr',strategyBody);
    const label=add('th',row);label.scope='row';
    return [label,...Array.from({length:4},()=>add('td',row))];
  });
  const offerTable=addTable(comparison);
  add('caption',offerTable,'Annual base pay plus guaranteed bonus after commute costs');
  const offerHead=add('tr',add('thead',offerTable));
  for(const title of ['Application','At minimum base','At maximum base']) add('th',offerHead,title).scope='col';
  const offerBody=add('tbody',offerTable);
  const offerRows=[0,1,2].map(()=>{
    const row=add('tr',offerBody);
    const name=add('th',row);name.scope='row';
    return [name,add('td',row),add('td',row)];
  });
  const spread=add('p',comparison);
  let verifiedCosts=null;
  function updateOffers() {
    offerTable.hidden=!verifiedCosts;
    spread.textContent='';
    if(!verifiedCosts)return;
    const cents=input=>{
      if(!input.validity.valid || input.value==='')return null;
      const raw=input.valueAsNumber*100;
      const rounded=Math.round(raw);
      return Number.isSafeInteger(rounded) && Math.abs(raw-rounded)<1e-6 ? rounded : null;
    };
    const ranges=panels.map((panel,side)=>{
      const low=cents(panel.low), high=cents(panel.high), bonus=cents(panel.bonus);
      if(low!==null && high!==null && high<low)return [null,null];
      return [low,high].map(base=>base===null || bonus===null ? null : base+bonus-verifiedCosts[side]);
    });
    const money=value=>value===null?'Unavailable':(value/100).toLocaleString('en-US',{style:'currency',currency:'USD'});
    const difference=(b,a)=>a===null || b===null ? null : b-a;
    const gaps=ranges[1].map((value,i)=>difference(value,ranges[0][i]));
    [...ranges,gaps].forEach((values,i)=>{
      const [name,minimum,maximum]=offerRows[i];
      name.textContent=i===2?'Application 2 minus application 1':sources[i].title.textContent;
      minimum.textContent=money(values[0]);maximum.textContent=money(values[1]);
    });
    const lower=difference(ranges[1][0],ranges[0][1]), upper=difference(ranges[1][1],ranges[0][0]);
    spread.textContent=lower===null || upper===null
      ? 'Full difference range unavailable. Check both salary endpoints and guaranteed bonuses in dollars and cents.'
      : 'Across all salary combinations, application 2 minus application 1 ranges from '+money(lower)+' to '+money(upper)+'.';
  }
  let selectedPair='',loadId=0;
  function refreshPair() {
    const pair=JSON.stringify(selections.map(s=>s.value));
    if(pair===selectedPair)return;
    selectedPair=pair;loadId++;verifiedCosts=null;
    for(const {file,title,side} of sources){
      file.value='';title.textContent=selections[side].selectedOptions[0]?.textContent||('Application '+(side+1));
    }
    comparison.hidden=selections.some(s=>!s.value);
    comparisonTable.hidden=strategies.hidden=true;totals.textContent='';feedback.textContent='';
    compare.disabled=true;
  }
  function filesChanged() {
    loadId++;compare.disabled=sources.some(s=>!s.file.files?.length);
    feedback.textContent=compare.disabled?'Choose both budget files.':'Both files selected. Ready to compare.';
  }
  for(const source of sources)source.file.addEventListener('change',filesChanged);
  compare.onclick=async()=>{
    if(compare.disabled)return;
    const id=++loadId;
    try{
      if(sources[0].title.textContent===sources[1].title.textContent)throw Error('These roles share an export label. Choose roles with distinct labels.');
      const pair=await Promise.all(sources.map(async({file,side})=>{
        const item=file.files?.[0];
        if(!item || item.size>65536)throw Error('Choose an original CSV under 64 KB for both applications.');
        return decodeBudget(await item.text(),side);
      }));
      if(id!==loadId)return;
      const [a,b]=pair,delta=b.plan-a.plan;
      const money=c=>(c/100).toLocaleString('en-US',{style:'currency',currency:'USD'});
      for(const [i,cells] of comparisonRows.entries()){
        const x=i===12?a.plan:a.monthlyCosts[i],y=i===12?b.plan:b.monthlyCosts[i];
        [x,y,y-x].forEach((v,j)=>cells[j].textContent=money(v));
      }
      pairHeadings[1].textContent=sources[0].title.textContent;
      pairHeadings[2].textContent=sources[1].title.textContent;
      const chosen=pair.map(({plan,annualCost},i)=>{
        const best=annualCost===null?plan:Math.min(plan,annualCost);
        const strategy=annualCost===null || plan<annualCost?'Monthly choices':plan===annualCost?'Tie':'Annual pass';
        const labels=[sources[i].title.textContent,money(plan),annualCost===null?'No quote':money(annualCost),strategy,money(best)];
        labels.forEach((value,j)=>strategyRows[i][j].textContent=value);
        return best;
      });
      verifiedCosts=chosen;updateOffers();
      strategies.hidden=false;
      totals.textContent='Cheapest quoted strategy for each offer: application 2 minus application 1 is '+money(chosen[1]-chosen[0])+'. Annual monthly-choice costs: '+pairHeadings[1].textContent+' '+money(a.plan)+' · '+pairHeadings[2].textContent+' '+money(b.plan)+'. Application 2 minus application 1: '+money(delta)+'.';
      comparisonTable.hidden=false;feedback.textContent='Both saved budgets verified.';
    }catch(error){
      if(id===loadId)feedback.textContent='Comparison was not updated. '+error.message;
    }
  };
  function render() {
    renderMonths();refreshPair();updateOffers();
    schedule.hidden=true;
    for(const [side,select] of selections.entries()) for(const opt of select.options) opt.disabled=!!opt.value && opt.value===selections[1-side].value;
    details.textContent='';
    if(selections.some(s=>!s.value)){status.textContent='Choose two distinct roles to compare.';return}
    if(panels.some(p=>Object.entries(p).some(([key,i])=>!(key==='pass' && i.value==='' && !i.validity.badInput) && !i.validity.valid))){status.textContent='Comparison pending. Each role needs both salary endpoints, a confirmed bonus (zero is valid), and valid travel and hours estimates. Unknown amounts stay blank.';return}
    const values=panels.map(p=>Object.fromEntries(Object.entries(p).map(([k,i])=>[k,i.valueAsNumber])));
    if(values.some(v=>v.high<v.low)){
      status.textContent='Minimum base salary exceeds maximum. Check both endpoints.';return;
    }
    const rates=values.map(v=>{
      const trips=v.weeks*v.days;
      const cost=commute(v,trips), hours=v.weeks*v.hours+trips*v.minutes/60;
      return {low:(v.low+v.bonus-cost)/hours,high:(v.high+v.bonus-cost)/hours,cost,hours};
    });
    if(!rates.every(r=>Object.values(r).every(Number.isFinite))){status.textContent='Reduce the entered amounts to calculate the comparison.';return}
    const [a,b]=rates;
    const money=n=>n.toLocaleString('en-US',{style:'currency',currency:'USD'});
    const name=i=>selections[i].selectedOptions[0].textContent;
    // Floating-point tolerance is below a millionth of one cent per hour.
    const cmp=(x,y)=>Math.abs(x-y)<1e-9?0:Math.sign(x-y);
    if(cmp(a.low,b.high)>0) status.textContent=name(0)+' leads throughout both ranges.';
    else if(cmp(b.low,a.high)>0) status.textContent=name(1)+' leads throughout both ranges.';
    else if(!cmp(a.low,a.high)&&!cmp(b.low,b.high)&&!cmp(a.low,b.low)) status.textContent='Both roles tie at the confirmed pay.';
    else if(!cmp(a.low,b.high)) status.textContent=name(0)+' leads or ties at the boundary.';
    else if(!cmp(b.low,a.high)) status.textContent=name(1)+' leads or ties at the boundary.';
    else status.textContent='Crossover: either role can lead, depending on the two offers.';
    const match=rate=>Math.max(0,Math.ceil(rate*b.hours+b.cost-values[1].bonus-1e-8));
    details.textContent=name(0)+' earns '+money(a.low)+'–'+money(a.high)+' per work and commute hour; '+name(1)+' earns '+money(b.low)+'–'+money(b.high)+'. To match or exceed the first role at its low and high endpoints, the second needs base pay of '+money(match(a.low))+' and '+money(match(a.high))+', respectively. Taxes, benefits and discretionary bonuses are excluded.';
    const [first,second]=values;
    const chosen=payChoices.map((sel,i)=>values[i][sel.value]);
    const firstRate=a[payChoices[0].value];
    const groups=[];
    for(const [days,cells] of scenarios.entries()){
      const trips=second.weeks*days;
      const rate=(chosen[1]+second.bonus-commute(second,trips))/
        (second.weeks*second.hours+trips*second.minutes/60);
      if(!Number.isFinite(rate)) return;
      const rank=cmp(rate,firstRate);
      const leader=rank===0?'Tie':name(rank>0?1:0);
      cells[0].textContent=money(rate);
      cells[1].textContent=leader;
      const last=groups[groups.length-1];
      if(last && last.rank===rank) last.end=days;
      else groups.push({start:days,end:days,rank,leader});
    }
    const spans=groups.map(({start,end,rank,leader})=>{
      const span=start===end?String(start):start+'–'+end;
      return span+(start===end && start===1?' day':' days')+' · '+(rank===0?'tie':leader+' leads');
    });
    summary.textContent=name(0)+' stays at '+first.days+' on-site days per week ('+money(firstRate)+'/hour). '+
      'Base pay stays at '+money(chosen[0])+' and '+money(chosen[1])+', respectively. '+spans.join('. ')+'.';
    passNote.textContent=values.map((v,i)=>passSummary(v,name(i),money)).filter(Boolean).join(' ');
    schedule.hidden=false;
  }
  dialog.addEventListener('input',event=>{if(event?.target!==loader){if(pending || request)clearRestore();render()}});
  const close=add('button',dialog,'Close comparison');
  close.type='button'; close.onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>dialog.remove(),{once:true});
  document.body.append(dialog);render();dialog.showModal();
}
