import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import vm from 'node:vm';

import * as core from '../public/dashboard/core.mjs';
import * as navigation from '../public/dashboard/navigation.mjs';
import * as personal from '../public/dashboard/personal.mjs';

class Element {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.listeners = new Map();
    this.value = '';
    this.dataset = {};
    this.classList = {toggle() {}, remove() {}};
  }
  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    this.listeners.set(type, [...listeners, listener]);
  }
  dispatchEvent(event) {
    for (const listener of this.listeners.get(event.type) ?? []) listener(event);
  }
  append(child) {
    this.children.push(child);
    child.parent = this;
  }
  remove() {
    this.parent.children = this.parent.children.filter(child => child !== this);
  }
  before() {}
  get childElementCount() { return this.children.length; }
  get options() { return this.children; }
  get selectedOptions() { return this.children.filter(child => child.value === this.value); }
  get valueAsNumber() { return this.value === '' ? NaN : Number(this.value); }
  get validity() {
    return {valid: this.value === '' ? !this.required : this.valueAsNumber >= (this.min ?? 0) && this.valueAsNumber <= (this.max ?? Infinity)};
  }
  setAttribute(name, value) { this[name] = value; }
  removeAttribute(name) { delete this[name]; }
  querySelector() { return new Element('div'); }
  querySelectorAll() { return []; }
  showModal() { this.open = true; }
  close() { this.open = false; this.dispatchEvent({type: 'close'}); }
}

function descendants(node) {
  return [node, ...node.children.flatMap(descendants)];
}

function syntheticBudget(role, tripPrice, annualPrice) {
  const months = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');
  const rows = [
    ['Compared application', 'Other fictional role'], ['Budget for', role], ['Currency', 'USD'],
    ['Round-trip fare', tripPrice], ['Per-trip cost with pass', 0],
    ['Month', 'Round trips', 'Monthly pass price', 'Decision', 'Per-trip only', 'Selected cost'],
    ['Jan', 1, 30, 'Pay per trip', tripPrice, tripPrice],
    ...months.slice(1).map(month => [month, 0, '', 'No travel', 0, 0]),
    ['Year', 1, '', '', tripPrice, tripPrice], ['Savings from monthly choices', 0]
  ];
  if (annualPrice !== undefined) {
    rows.push(['Annual pass price', annualPrice], ['Annual pass with remaining trip costs', annualPrice]);
  }
  return rows.map(row => row.map(value => '"' + value + '"').join(',')).join('\r\n') + '\r\n';
}

test('the tracker opens the comparison for the clicked application using the imported workbook', async () => {
  const asset = name => readFile(new URL('../public/dashboard/' + name, import.meta.url), 'utf8');
  const [html, app, comparison] = await Promise.all(['index.html', 'app.js', 'role-compare.mjs'].map(asset));
  assert.match(html, /href="role-compare\.css"/);
  assert.match(html, /<script type="module" src="app\.js"/);
  assert.match(app, /import \{compareRoles\} from '\.\/role-compare\.mjs'/);
  const dom = new Map(Array.from(html.matchAll(/<([a-z][\w-]*)\b[^<>]*\bid="([\w-]+)"/g),
    ([, tag, id]) => [id, new Element(tag)]));
  const document = new Element('document');
  document.body = new Element('body');
  document.getElementById = id => {
    assert.ok(dom.has(id), 'Missing dashboard element ' + id);
    return dom.get(id);
  };
  document.createElement = tag => new Element(tag);
  const location = {hash: '#career/applications'};
  const header = ['Date', 'Source', 'Company', 'Role', 'Location', 'Job Link', 'Contact', 'Deadline', 'Status', 'Notes',
    'Annual base salary minimum ($)', 'Annual base salary maximum ($)', 'Guaranteed annual bonus ($)'];
  const sheets = {
    'Application Tracker': [[], [], [], header,
      ['', '', 'North & Co', 'Analyst', '', '', '', '', 'Offer', '', '76800', '76800', '0'],
      ['', '', 'South and Co', 'Data analyst', '', '', '', '', 'Offer', '', '81600', '91200', '0']]
  };
  const original = JSON.stringify(sheets);
  const window = new Element('window');
  window.scrollTo = () => {};
  window.XLSX = {
    read: () => ({SheetNames: Object.keys(sheets), Sheets: sheets}),
    utils: {sheet_to_json: rows => rows}
  };
  const noop = () => {};
  const context = vm.createContext({
    ...core, ...navigation, ...personal,
    document, window, location, URLSearchParams,
    history: {replaceState: noop, pushState: (_state, _title, hash) => { location.hash = hash; }},
    CustomEvent: class {constructor(type, options) { this.type = type; this.detail = options?.detail; }},
    setInterval: noop, categoryDefinitions: [], canEdit: false,
    mountSeamlessSidebar: noop, renderIllustration: noop, mountPortfolioHistory: noop,
    setupHoldingForm: noop, mountEventSearch: noop, createEditor: noop,
    syncData: () => null, syncPull: () => new Promise(() => {}),
    OpportunityMap: class {constructor(root) { this.root = root; } cancelNope() {}}
  });
  vm.runInContext(comparison.replace(/^export function /, 'function '), context);
  vm.runInContext(app.replace(/^import .*;\n/gm, ''), context);
  await dom.get('file').onchange({target: {files: [{name: 'fictional.xlsx', size: 100, arrayBuffer: async () => new ArrayBuffer(100)}]}});
  assert.match(dom.get('recordCount').textContent, /2 RECORDS/);
  const search = dom.get('search');
  search.value = 'North';
  search.dispatchEvent({type: 'input'});
  const markup = dom.get('sectionContent').innerHTML;
  const button = markup.match(/<button[^>]+data-compare-role="([^"]+)"[^>]*>/);
  assert.ok(button);
  assert.match(button[0], /North &amp; Co · Analyst/);
  assert.doesNotMatch(markup, /South and Co/);
  const row = {dataset: {row: button[1]}};
  function click(targets) {
    document.dispatchEvent({type: 'click', target: {closest: selector => targets[selector]}, preventDefault: noop});
  }
  click({'[data-row]': row, '[data-compare-role]': {dataset: {compareRole: button[1]}}});
  assert.equal(dom.get('detail').open, undefined);
  const dialog = document.body.children[0];
  assert.equal(dialog.open, true);
  const controls = descendants(dialog);
  const [first, second] = controls.filter(node => node.tag === 'select');
  assert.equal(first.selectedOptions[0].textContent, 'North & Co · Analyst');
  second.value = '5';
  second.dispatchEvent({type: 'change'});
  assert.equal(second.selectedOptions[0].textContent, 'South and Co · Data analyst');
  const schedule = controls.find(node => node.tag === 'section');
  assert.equal(schedule.hidden, false);
  assert.equal(descendants(schedule).find(node => node.tag === 'tbody').children.length, 8);
  assert.match(controls.find(node => node.role === 'status').textContent, /South and Co .* leads throughout/);
  const budgetPair = controls.filter(node => node.tag === 'details')[1];
  const budgetControls = descendants(budgetPair);
  const files = budgetControls.filter(node => node.type === 'file');
  [syntheticBudget('North & Co · Analyst', 10), syntheticBudget('South and Co · Data analyst', 20, 12)]
    .forEach((csv, index) => {
      files[index].files = [{size: csv.length, text: async () => csv}];
      files[index].dispatchEvent({type: 'change'});
    });
  await budgetControls.find(node => node.textContent === 'Compare both files').onclick();
  const offerTable = budgetControls.filter(node => node.tag === 'table')[2];
  assert.equal(offerTable.hidden, false);
  const offers = descendants(offerTable).find(node => node.tag === 'tbody').children;
  assert.deepEqual(offers.map(row => row.children.slice(1).map(cell => cell.textContent)),
    [['$76,790.00', '$76,790.00'], ['$81,588.00', '$91,188.00'], ['$4,798.00', '$14,398.00']]);
  assert.equal(JSON.stringify(sheets), original);
  controls.find(node => node.textContent === 'Close comparison').onclick();
  assert.equal(document.body.children.length, 0);
  click({'[data-row]': row});
  assert.equal(dom.get('detail').open, true);
  assert.match(dom.get('detailContent').innerHTML, /North &amp; Co/);
  click({'[data-section]': {dataset: {section: 'career'}}});
  click({'[data-compare-role]': {dataset: {compareRole: button[1]}}});
  assert.equal(document.body.children.length, 0);
});
