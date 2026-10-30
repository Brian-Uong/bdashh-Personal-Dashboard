import {recordSchema} from '../public/dashboard/record-schema.mjs';
export function materialize(state){
 const sheets=structuredClone(state.sheets||{});
 for(const [tab,def] of Object.entries(recordSchema))if(!sheets[tab]){sheets[tab]=Array.from({length:def.start},()=>[]);sheets[tab][def.start-1]=def.headers.slice();}
 sheets.Holdings=[['Ticker','Company','Shares','Average Cost','Last Price','Price As Of','Notes'],...(state.holdings||[]).map(h=>[h.ticker,'',h.shares,h.avgCost,state.quotes?.[h.ticker]?.price??'',state.quotes?.[h.ticker]?.asOf??'','Dashboard portfolio'])];
 if(state.briefing)sheets['Daily Briefing']=[['As Of','Briefing','Sources'],[state.briefing.asOf,state.briefing.text,(state.briefing.sources||[]).map(s=>s.url).join('\n')]];
 return {...state,sheets};
}
export function editRecord(state,operation){
 const def=Object.hasOwn(recordSchema,operation.tab)?recordSchema[operation.tab]:null;if(!def)throw Error('Unknown record type');
 if(operation.action==='delete'){
 const next=materialize(state),rows=next.sheets[operation.tab];
 if(!Number.isInteger(operation.row)||operation.row<def.start||operation.row>=rows.length||!rows[operation.row].some(v=>String(v).trim()))throw Error('Record not found');
 if(JSON.stringify(rows[operation.row])!==JSON.stringify(operation.baseRow))throw Error('This record changed elsewhere. Close and reopen it before deleting.');
 next.deletedRecords=[...(state.deletedRecords||[]),{id:operation.requestId,tab:operation.tab,row:operation.row,cells:rows[operation.row],deletedAt:new Date().toISOString()}];
 rows[operation.row]=[];return next;
 }
 if(operation.action==='restore'){
 const next=materialize(state),record=(state.deletedRecords||[]).find(r=>r.id===operation.deletionId&&r.tab===operation.tab);if(!record)throw Error('Deleted record not found');
 const rows=next.sheets[record.tab];if(rows[record.row]?.some(v=>String(v).trim()))rows.push(record.cells);else rows[record.row]=record.cells;
 next.deletedRecords=next.deletedRecords.filter(r=>r.id!==record.id);return next;
 }
 if(!Array.isArray(operation.cells)||operation.cells.length>100||operation.cells.some(v=>typeof v!=='string'||v.length>20000))throw Error('Invalid fields');
 const next=materialize(state),rows=next.sheets[operation.tab];
 const requiredHeader=def.headers[def.required];const requiredCol=rows[def.start-1].indexOf(requiredHeader);if(requiredCol<0||!operation.cells[requiredCol]?.trim())throw Error(requiredHeader+' is required');
 if(operation.row===null){rows.push(operation.cells);}else{
 if(!Number.isInteger(operation.row)||operation.row<def.start||operation.row>=rows.length)throw Error('Record not found');
 if(JSON.stringify(rows[operation.row])!==JSON.stringify(operation.baseRow))throw Error('This record changed elsewhere. Close and reopen it to load the latest version.');
 rows[operation.row]=operation.cells;
 }return next;
}
