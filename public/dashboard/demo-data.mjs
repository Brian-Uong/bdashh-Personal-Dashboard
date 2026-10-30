// Fictional records. Dates move forward so the demo remains visible.
export async function getTemplate(demo=false){
 const response=await fetch(demo?'demo-workbook.json':'blank-workbook.json');
 if(!response.ok)throw Error('The included workbook template could not load.');
 const sheets=await response.json();
 for(const rows of Object.values(sheets))for(const row of rows)for(let i=0;i<row.length;i++){
  if(typeof row[i]!=='string'||!/^DEMO_(TODAY|PLUS_\d+)$/.test(row[i]))continue;
  const date=new Date();date.setDate(date.getDate()+Number(row[i].split('_')[2]||0));
  row[i]=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
 }
 return sheets;
}
