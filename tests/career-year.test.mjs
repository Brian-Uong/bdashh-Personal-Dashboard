import assert from 'node:assert/strict';
import {test} from 'node:test';
import {careerYears, monthMetrics, preserveCareerDates} from '../public/dashboard/core.mjs';
import {hasActiveCalendarFormat} from '../public/dashboard/career-date-format.mjs';

const rows = (...data) => [[], [], [], [], ...data];
const contact = (date, followup = 'No') => [date, '', 'Synthetic contact', '', '', '', 'Yes', followup];
const app = date => [date, '', 'Synthetic company'];
const sheets = {
  'Application Tracker': rows(app('1/1/2026'), app('2026-01-18'), app('2026-12-31'),
    app('2027-01-01'), app('2027-09-09'), app('2027-02-29'), app(''), app('12/31/2099?'),
    ['2028-01-01', '', '']),
  'Networking Tracker': rows(contact('2026-01-20', 'Yes'), contact('2027-01-31', 'Yes'),
    contact('2027-01-21', 'Yes'), contact('2027-01-05'), contact('2027-02-03'), contact('2030-13-14', 'Yes')),
  'Potential Events': rows(['Event', '2097-01-01'])
};

const summary = ({applications, contacts, followups}) => [applications, contacts, followups];
const chart = (workbook, year) => Array.from({length: 12}, (_, month) => {
  const activity = monthMetrics(workbook, month, year);
  return activity.contacts + activity.applications;
});

test('valid career dates give unique sorted years and isolate the same month across years', () => {
  const before = JSON.stringify(sheets);
  assert.deepEqual(careerYears(sheets), ['2027', '2026']);
  assert.deepEqual(summary(monthMetrics(sheets, 0, '2026')), [2, 1, 1]);
  assert.deepEqual(summary(monthMetrics(sheets, 0, '2027')), [1, 3, 2]);
  assert.deepEqual(summary(monthMetrics(sheets, 0, '')), [3, 4, 3]);
  assert.deepEqual(monthMetrics(sheets, 0, ''), monthMetrics(sheets, 0));
  assert.equal(JSON.stringify(sheets), before);
});

test('all twelve chart buckets respect year boundaries and keep the combined totals', () => {
  assert.deepEqual(chart(sheets, '2026'), [3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
  assert.deepEqual(chart(sheets, '2027'), [4, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]);
  assert.deepEqual(chart(sheets, ''), [7, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1]);
  assert.deepEqual(chart(sheets, '2028'), Array(12).fill(0));
  assert.deepEqual(chart({}, ''), Array(12).fill(0));
  assert.deepEqual(careerYears({}), []);
});

test('unqualified numbers and yearless text contribute no career activity', () => {
  const invalid = [2027, 46023, '2027', '46023', 'Jan 1', '1/1',
    new Date(NaN), '', null, '2026-02-29', '2026-04-31', 'unknown'];
  const workbook = {'Application Tracker': rows(...invalid.map(app))};
  assert.deepEqual(careerYears(workbook), []);
  assert.deepEqual(chart(workbook, ''), Array(12).fill(0));
});

test('date-formatted days survive a JSON round trip while invalid values and other cells stay intact', () => {
  const tab = 'Application Tracker';
  const formatted = {[tab]: rows(['Dec 31', 'original note', 'Synthetic company'],
    app('2027'), app('Jan 1'), app('00:00'), app('Jan 1')), 'Potential Events': [['Other sheet']]};
  const source = {
    Workbook: {WBProps: {date1904: true}},
    Sheets: {[tab]: {
      A5: {t: 'n', v: 44925.9999, z: 'mmm d'},
      A6: {t: 'n', v: 2027, z: 'General'},
      A7: {t: 's', v: 'Jan 1'},
      A8: {t: 'n', v: 2027, z: 'hh:mm'},
      A9: {t: 'd', v: new Date('2027-01-01T00:00:00Z')}
    }}
  };
  const xlsx = {utils: {encode_cell: ({r}) => 'A' + (r + 1)}, SSF: {
    is_date: format => format !== 'General',
    parse_date_code: (serial, {date1904}) => {
      assert.equal(serial, 44925);
      assert.equal(date1904, true);
      return {y: 2026, m: 12, d: 31};
    }
  }};
  const before = JSON.stringify({formatted, source});
  const saved = JSON.parse(JSON.stringify(preserveCareerDates(formatted, source, xlsx)));
  assert.deepEqual(saved[tab].slice(4), [
    ['2026-12-31', 'original note', 'Synthetic company'], app(2027), app('Jan 1'), app(2027), app('2027-01-01')
  ]);
  assert.deepEqual(saved['Potential Events'], formatted['Potential Events']);
  assert.deepEqual(careerYears(saved), ['2027', '2026']);
  assert.deepEqual(chart(saved, ''), [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
  assert.equal(JSON.stringify({formatted, source}), before);
});

test('calendar classification follows the numeric section and ignores format literals', () => {
  // The browser replay exercises the real pinned SheetJS reader. This test
  // isolates our section and token handling from the reader's broad predicate.
  const ssf = {is_date: () => true};
  const cases = [
    ['[>=40000]mmm d;0', 2027, false],
    ['[>=40000]mmm d;0', 40000, true],
    ['[Red][<100]0;[Blue][>=40000]mmm d;0', 46000, true],
    ['[Red][<100]0;[Blue][>=40000]mmm d;0', 2027, false],
    ['[Red][<100]0;[Blue][>=40000]mmm d;0', 99, false],
    ['[>40000]mmm d', 40000, false],
    ['[=46000]mmm d;0', 46000, true],
    ['[<>46000]0;mmm d', 46000, true],
    ['[<=40000.5]0;mmm d', 40000.6, true],
    ['[<=40000.5]0;mmm d', 40000.5, false],
    ['mmm d;0;0;@', 1, true],
    ['mmm d;0;0;@', -1, false],
    ['mmm d;0;0;@', 0, false],
    ['0;mmm d;0', 1, false],
    ['0;mmm d;0', -1, true],
    ['0;0;mmm d', 0, true],
    ['mmm d;0', 0, true],
    ['mmm d;;0', -1, false],
    ['mmm d;@', 1, true],
    ['0"@"', 1, false],
    ['"2030-02-10"', 91, false],
    ['"[>=40000]; mmm d"0;mmm d', 2027, false],
    ['0\\;\\d;mmm d', 2027, false],
    ['"label;"mmm d;0', 46000, true],
    ['0_;*d;mmm d', 2027, false],
    ['[Blue][$-409]mmm d', 46000, true],
    ['[h]:mm', 2027, false],
    ['mm:ss', 2027, false],
    ['hh:mm AM/PM', 2027, false],
    ['m h:mm', 46000, true],
    ['0.00E+00;0', 2027, false],
    ['"unclosed;mmm d', 46000, false]
  ];
  for (const [format, value, expected] of cases) {
    assert.equal(hasActiveCalendarFormat(format, value, ssf), expected, format + ' for ' + value);
  }
});
