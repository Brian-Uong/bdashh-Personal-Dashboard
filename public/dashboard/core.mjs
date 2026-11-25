import {eventCategories} from './categories.mjs';
import {hasActiveCalendarFormat} from './career-date-format.mjs';
export const sections=[
{key:'overview',name:'Today / overview',icon:'⌖',title:'Your day, in focus',sub:'Career, investments and your calendar — one clear view.'},
{key:'Networking Tracker',name:'Networking',icon:'⌘',title:'Network intelligence',sub:'Every conversation is a potential next chapter.',head:3,start:4,label:2},
{key:'Application Tracker',name:'Applications',icon:'↗',title:'Application operations',sub:'Track the opportunities that move your career forward.',head:3,start:4,label:2},
{key:'Interview Practice Tracker',name:'Interview readiness',icon:'◈',title:'Interview readiness',sub:'Preparation, practice and feedback. Make each session count.',head:3,start:4,label:1},
{key:'Monthly Check-In',name:'Monthly review',icon:'◷',title:'Monthly debrief',sub:'Review your progress. Refine your next move.',head:5,start:6,label:0},
{key:'Potential Events',name:'Local events',icon:'⌾',title:'Event intelligence',sub:'Find the right room. Meet the right people.',head:3,start:4,label:0},
{key:'Start Here',name:'Mission objectives',icon:'⚑',title:'Mission objectives',sub:'Your goals, priorities and career direction.',raw:true},
{key:'Dashboard',name:'Workbook dashboard',icon:'▥',title:'Performance telemetry',sub:'Your original workbook calculations and targets.',raw:true},
{key:'Rubric Reference',name:'Readiness reference',icon:'≡',title:'Readiness reference',sub:'The framework behind your career preparation.',raw:true}
];
export const text=v=>v==null?'':String(v).trim();
export function parseDate(v){if(typeof v==='number'&&v>20000&&v<100000){return new Date(Math.round((v-25569)*864e5)).toISOString().slice(0,10)}const s=text(v);if(/^\d{4}-\d{2}-\d{2}$/.test(s)){const d=new Date(s+'T12:00:00Z');return !isNaN(d)&&d.toISOString().slice(0,10)===s?s:null}const m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);if(m)return parseDate(`${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`);return null}
export function records(sheets,key){const def=sections.find(s=>s.key===key),rows=sheets[key]||[];if(!def||def.raw)return [];return rows.slice(def.start).map((cells,i)=>({cells,row:i+def.start,key})).filter(r=>text(r.cells[def.label])&&r.cells.some(v=>text(v)))}
export function filterEvents(rows,f={}){return rows.filter(r=>{const c=r.cells,d=parseDate(c[1]);return (!f.category||eventCategories(c).some(category=>category.id===f.category))&&(!f.q||c.some(v=>text(v).toLowerCase().includes(f.q.toLowerCase())))&&(!f.free||text(c[7])===f.free)&&(!f.beginner||text(c[26])===f.beginner)&&(!f.company||text(c[21])===f.company)&&(!f.status||text(c[10])===f.status)&&(!f.from||(d&&d>=f.from))&&(!f.until||(d&&d<=f.until))})}
const careerTabs = ['Networking Tracker', 'Application Tracker', 'Interview Practice Tracker'];

function careerDateValue(value) {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? parseDate(value.toISOString().slice(0, 10)) : null;
  }
  return typeof value === 'string' ? parseDate(value) : null;
}

function excelCareerDay(cell, date1904, ssf) {
  if (cell?.t === 'd') return careerDateValue(cell.v);
  if (cell?.t !== 'n' || !hasActiveCalendarFormat(cell.z, cell.v, ssf)) return null;
  const date = ssf.parse_date_code(Math.floor(cell.v), {date1904});
  if (!date) return null;
  return parseDate([date.y, date.m, date.d].map((part, i) =>
    String(part).padStart(i === 0 ? 4 : 2, '0')).join('-'));
}

function careerSheetDateCells(workbook) {
  // The pinned reader converts OOXML t="d" to a number in cellDates:false
  // mode. Recover those explicit dates from the original worksheet XML,
  // without applying the numeric workbook epoch to an ISO calendar date.
  if (!workbook.files || typeof DOMParser === 'undefined') return () => new Map();
  const workbookPart = workbook.Directory?.workbooks?.[0];
  if (!workbookPart?.endsWith('.xml')) return () => new Map();
  const reader = new TextDecoder();
  const parser = new DOMParser();
  const xml = (path, needsDates = false) => {
    const entry = workbook.files[path.replace(/^\//, '')];
    if (!entry?.content) return null;
    const source = reader.decode(entry.content);
    if (/<!DOCTYPE/i.test(source) || (needsDates && !/\bt\s*=\s*["']d["']/.test(source))) return null;
    return parser.parseFromString(source, 'application/xml');
  };
  const relationships = xml(workbookPart.replace(/([^/]+)$/, '_rels/$1.rels'));
  const targets = new Map();
  for (const relation of relationships?.getElementsByTagNameNS('*', 'Relationship') ?? []) {
    const target = relation.getAttribute('Target');
    if (!target || relation.getAttribute('TargetMode') === 'External' ||
        !relation.getAttribute('Type')?.endsWith('/worksheet')) continue;
    let part;
    try { part = new URL(target, 'https://workbook.invalid' + workbookPart); } catch { continue; }
    if (part.origin === 'https://workbook.invalid') {
      targets.set(relation.getAttribute('Id'), part.pathname);
    }
  }
  return tab => {
    const dates = new Map();
    const sheet = workbook.Workbook?.Sheets?.find(item => item.name === tab);
    const path = targets.get(sheet?.id);
    if (!path) return dates;
    for (const cell of xml(path, true)?.getElementsByTagNameNS('*', 'c') ?? []) {
      const address = cell.getAttribute('r');
      if (cell.getAttribute('t') !== 'd' || !/^A\d+$/.test(address)) continue;
      const value = cell.getElementsByTagNameNS('*', 'v')[0]?.textContent.trim() ?? '';
      const day = /^(\d{4}-\d{2}-\d{2})(?:T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)?)?$/.exec(value)?.[1];
      dates.set(address, day ? parseDate(day) : null);
    }
    return dates;
  };
}

export function preserveCareerDates(sheets, workbook, xlsx) {
  const normalized = {...sheets};
  const date1904 = workbook?.Workbook?.WBProps?.date1904 === true;
  const explicitDatesFor = careerSheetDateCells(workbook);
  // Resolve the original date system while its metadata is available. The
  // dashboard stores rows as JSON, so retain the decoded day as ISO text.
  for (const tab of careerTabs) {
    const worksheet = workbook.Sheets[tab];
    if (!worksheet || !xlsx.SSF) continue;
    const explicitDates = explicitDatesFor(tab);
    let rows = sheets[tab];
    for (const record of records(sheets, tab)) {
      const address = xlsx.utils.encode_cell({r: record.row, c: 0});
      const cell = worksheet[address];
      if (!cell) continue;
      const explicitlyDated = explicitDates.has(address);
      const day = explicitlyDated ? explicitDates.get(address) : excelCareerDay(cell, date1904, xlsx.SSF);
      // Persist the cell's value, not its display. A number can display the
      // exact spelling of an ISO date without being a calendar date.
      const value = day ?? (explicitlyDated || cell.t === 'd' ? '' : cell.v);
      if (value === undefined || value === record.cells[0]) continue;
      if (rows === sheets[tab]) rows = sheets[tab].slice();
      const cells = record.cells.slice();
      cells[0] = value;
      rows[record.row] = cells;
    }
    if (rows) normalized[tab] = rows;
  }
  return normalized;
}

export function careerYears(sheets) {
  const years = new Set();
  for (const tab of careerTabs.slice(0, 2)) {
    for (const record of records(sheets, tab)) {
      const date = careerDateValue(record.cells[0]);
      if (date) years.add(date.slice(0, 4));
    }
  }
  return [...years].sort().reverse();
}

export function monthMetrics(sheets, month, year = '') {
  const inMonth = record => {
    const date = careerDateValue(record.cells[0]);
    return date && Number(date.slice(5, 7)) === month + 1 &&
      (year === '' || date.slice(0, 4) === String(year));
  };
  const [network, applications, practice] = careerTabs.map(tab => records(sheets, tab).filter(inMonth));
  const yes = (record, column) => text(record.cells[column]).toLowerCase() === 'yes';
  return {
    contacts: network.length,
    outreaches: network.filter(record => yes(record, 6)).length,
    followups: network.filter(record => yes(record, 7)).length,
    interviews: network.filter(record => yes(record, 8)).length,
    events: new Set(network.filter(record => text(record.cells[1]))
      .map(record => text(record.cells[0]) + '|' + text(record.cells[1]).toLowerCase())).size,
    applications: applications.length,
    practices: practice.length,
    minutes: practice.reduce((total, record) => total + (Number(record.cells[5]) || 0), 0)
  };
}
export function groupCount(rows,col){const groups={};rows.forEach(r=>{const k=text(r.cells[col])||'Not recorded';groups[k]=(groups[k]||0)+1});return Object.entries(groups).sort((a,b)=>b[1]-a[1])}
