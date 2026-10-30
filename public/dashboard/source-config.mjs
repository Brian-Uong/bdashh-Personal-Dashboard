// Runtime-only connection input. Never put a real spreadsheet ID or token here.
export function sheetExportUrl(value){
 const input=String(value??'').trim();if(!input)return null;
 let u;try{u=new URL(input)}catch{throw Error('Enter a full Google Sheets URL.');}
 const match=u.pathname.match(/^\/spreadsheets\/d\/([A-Za-z0-9_-]+)(?:\/|$)/);
 if(u.protocol!=='https:'||u.hostname!=='docs.google.com'||u.port||u.username||u.password||!match)throw Error('Use an HTTPS docs.google.com/spreadsheets/d/… URL.');
 return 'https://docs.google.com/spreadsheets/d/'+match[1]+'/export?format=xlsx';
}
