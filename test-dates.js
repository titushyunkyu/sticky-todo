/* Run with: node test-dates.js
   Anchored to a fixed "today" so results are reproducible. */

const { parseWhen, describe, describeLong, fmtTime, isPast, toISO } = require('./dates.js');

// Wednesday, 7 October 2026.
const BASE = new Date(2026, 9, 7);

let pass = 0;
let fail = 0;

function eq(label, actual, expected) {
  if (actual === expected) {
    pass += 1;
  } else {
    fail += 1;
    console.log(`  FAIL  ${label}\n        got ${JSON.stringify(actual)} want ${JSON.stringify(expected)}`);
  }
}

function due(input, expected) {
  const r = parseWhen(input, BASE);
  eq(`parse "${input}"`, r.status === 'ok' ? r.iso : r.status, expected);
}

// date + time together
function dt(input, expected) {
  const r = parseWhen(input, BASE);
  const got = r.status === 'ok' ? `${r.iso} ${r.time || '--'}` : r.status;
  eq(`parse "${input}"`, got, expected);
}

console.log('base = Wed 2026-10-07\n');

// relative words
due('today', '2026-10-07');
due('tod', '2026-10-07');
due('Tomorrow', '2026-10-08');
due('tom', '2026-10-08');
due('tmrw', '2026-10-08');
due('yesterday', '2026-10-06');
due('next week', '2026-10-14');

// offsets
due('3d', '2026-10-10');
due('3 days', '2026-10-10');
due('in 3 days', '2026-10-10');
due('+10d', '2026-10-17');
due('0d', '2026-10-07');
due('2w', '2026-10-21');
due('1 week', '2026-10-14');

// weekdays: next occurrence, today counts as itself
due('wed', '2026-10-07');
due('wednesday', '2026-10-07');
due('thu', '2026-10-08');
due('thurs', '2026-10-08');
due('fri', '2026-10-09');
due('friday', '2026-10-09');
due('sat', '2026-10-10');
due('sun', '2026-10-11');
due('mon', '2026-10-12');
due('tue', '2026-10-13');
due('tues', '2026-10-13');
due('next fri', '2026-10-16');
due('next wed', '2026-10-14');

// numeric
due('10/14', '2026-10-14');
due('10-14', '2026-10-14');
due('10.14', '2026-10-14');
due('1/5', '2027-01-05'); // already past this year -> rolls forward
due('10/7', '2026-10-07'); // today is still "this year"
due('10/6', '2027-10-06'); // yesterday's date rolls to next year
due('12/25/26', '2026-12-25');
due('12/25/2027', '2027-12-25');
due('2026-11-03', '2026-11-03');
due('2026-1-3', '2026-01-03'); // an explicit year is honoured, even if past
due('12/25/99', '2099-12-25');

// month names
due('oct 14', '2026-10-14');
due('october 14', '2026-10-14');
due('Oct 14', '2026-10-14');
due('sept 30', '2027-09-30'); // past -> next year
due('sep 30', '2027-09-30');
due('14 oct', '2026-10-14');
due('14th oct', '2026-10-14');
due('oct 14th', '2026-10-14');
due('jan 5 2028', '2028-01-05');
due('dec 25, 2026', '2026-12-25');
due('mar 1', '2027-03-01');
due('may 1', '2027-05-01');
due('jun 1', '2027-06-01');
due('jul 1', '2027-07-01');

// empty
due('', 'empty');
due('   ', 'empty');
due('-', 'empty');
due('none', 'empty');
due(null, 'empty');
due(undefined, 'empty');

// invalid -> must be reported, never silently guessed
due('13/45', 'bad');
due('2/30', 'bad');
due('2/31/2027', 'bad');
due('feb 30', 'bad');
due('4/31', 'bad');
due('asdf', 'bad');
due('14', 'bad');
due('next', 'bad');
due('99/99/9999', 'bad');
due('0/5', 'bad');
due('5/0', 'bad');

// leap-year handling
eq('feb 29 2028 (leap)', parseWhen('2/29/2028', BASE).iso, '2028-02-29');
eq('feb 29 2027 (not leap)', parseWhen('2/29/2027', BASE).status, 'bad');

// round trip: parse -> store -> reparse gives the same day
for (const s of ['fri', '10/14', 'oct 14', '3d', 'tomorrow']) {
  const first = parseWhen(s, BASE).iso;
  const again = parseWhen(first, BASE).iso;
  eq(`round trip "${s}"`, again, first);
}

/* ---------- times ---------- */

// the headline request: eod means 11:59 PM that day
dt('eod', '2026-10-07 23:59');
dt('EOD', '2026-10-07 23:59');
dt('eod today', '2026-10-07 23:59');
dt('fri eod', '2026-10-09 23:59');
dt('10/14 eod', '2026-10-14 23:59');
dt('tomorrow eod', '2026-10-08 23:59');
dt('oct 14 eod', '2026-10-14 23:59');
dt('eod friday', '2026-10-09 23:59');
dt('3d eod', '2026-10-10 23:59');
dt('12/25/26 eod', '2026-12-25 23:59');
dt('end of day', '2026-10-07 23:59');
dt('midnight', '2026-10-07 23:59');
dt('fri midnight', '2026-10-09 23:59');
dt('tonight', '2026-10-07 23:59');

// 12-hour clock
dt('5pm', '2026-10-07 17:00');
dt('5 pm', '2026-10-07 17:00');
dt('5PM', '2026-10-07 17:00');
dt('5p', '2026-10-07 17:00');
dt('9am', '2026-10-07 09:00');
dt('9a', '2026-10-07 09:00');
dt('5:30pm', '2026-10-07 17:30');
dt('5.30pm', '2026-10-07 17:30');
dt('11:59pm', '2026-10-07 23:59');
dt('12pm', '2026-10-07 12:00');
dt('12am', '2026-10-07 00:00');
dt('12:30am', '2026-10-07 00:30');
dt('noon', '2026-10-07 12:00');

// 24-hour clock
dt('17:00', '2026-10-07 17:00');
dt('09:05', '2026-10-07 09:05');
dt('23:59', '2026-10-07 23:59');
dt('0:30', '2026-10-07 00:30');

// date and time in combination, both orders
dt('fri 5pm', '2026-10-09 17:00');
dt('fri at 5pm', '2026-10-09 17:00');
dt('fri @ 5pm', '2026-10-09 17:00');
dt('friday by 5pm', '2026-10-09 17:00');
dt('5pm friday', '2026-10-09 17:00');
dt('10/14 3:30pm', '2026-10-14 15:30');
dt('oct 14 9am', '2026-10-14 09:00');
dt('14 oct 9am', '2026-10-14 09:00');
dt('tomorrow 8:15am', '2026-10-08 08:15');
dt('next fri 5pm', '2026-10-16 17:00');
dt('2026-11-03 17:00', '2026-11-03 17:00');
dt('dec 25, 2026 5pm', '2026-12-25 17:00');
dt('in 3 days at 5pm', '2026-10-10 17:00');

// a plain date still has no time attached
dt('fri', '2026-10-09 --');
dt('10/14', '2026-10-14 --');

// bad times must be rejected, not rounded
dt('fri 25:00', 'bad');
dt('fri 13pm', 'bad');
dt('fri 5:75pm', 'bad');
dt('fri 0pm', 'bad');
dt('25:00', 'bad');
dt('12:60', 'bad');
dt('fri 5', 'bad');       // a bare number is never guessed as a time
dt('fri elevenish', 'bad');

// the edit box prefills "<iso> <HH:MM>" and must round-trip
for (const [d, tm] of [['2026-10-14', '23:59'], ['2027-01-05', '09:00'], ['2026-12-25', '17:30']]) {
  const r = parseWhen(`${d} ${tm}`, BASE);
  eq(`round trip "${d} ${tm}"`, `${r.iso} ${r.time}`, `${d} ${tm}`);
}

// clock formatting
eq('fmt 23:59', fmtTime('23:59'), '11:59pm');
eq('fmt 17:00', fmtTime('17:00'), '5pm');
eq('fmt 09:30', fmtTime('09:30'), '9:30am');
eq('fmt 12:00', fmtTime('12:00'), '12pm');
eq('fmt 00:00', fmtTime('00:00'), '12am');
eq('fmt 00:30', fmtTime('00:30'), '12:30am');

/* ---------- overdue, which now depends on the clock ---------- */

const at = (h, m) => new Date(2026, 9, 7, h, m);

eq('undated is never late', isPast(null, null, at(23, 59)), false);
eq('due today, no time, not late during the day', isPast('2026-10-07', null, at(23, 59)), false);
eq('due yesterday, no time, late', isPast('2026-10-06', null, at(0, 1)), true);
eq('due today 9am, not late at 8am', isPast('2026-10-07', '09:00', at(8, 0)), false);
eq('due today 9am, late at 9:01am', isPast('2026-10-07', '09:00', at(9, 1)), true);
eq('due today eod, not late at 11:58pm', isPast('2026-10-07', '23:59', at(23, 58)), false);
eq('due tomorrow 9am, not late', isPast('2026-10-08', '09:00', at(23, 59)), false);

eq('row shows the time', describe('2026-10-07', '17:00', at(9, 0)).text, 'Today 5pm');
eq('row shows eod', describe('2026-10-09', '23:59', at(9, 0)).text, 'Fri 11:59pm');
eq('row far off', describe('2026-11-20', '09:30', at(9, 0)).text, 'Nov 20 9:30am');
eq('tone late once the hour passes', describe('2026-10-07', '09:00', at(10, 0)).tone, 'late');
eq('tone still soon before it', describe('2026-10-07', '09:00', at(8, 0)).tone, 'soon');
eq('echo with time', describeLong('2026-10-09', '17:00', at(9, 0)), 'Fri, Oct 9 at 5pm');
eq('echo eod today', describeLong('2026-10-07', '23:59', at(9, 0)), 'Wed, Oct 7 at 11:59pm (today)');

// display labels
eq('label today', describe('2026-10-07', null, BASE).text, 'Today');
eq('label tomorrow', describe('2026-10-08', null, BASE).text, 'Tomorrow');
eq('label +3', describe('2026-10-10', null, BASE).text, 'Sat');
eq('label +6', describe('2026-10-13', null, BASE).text, 'Tue');
eq('label +7', describe('2026-10-14', null, BASE).text, 'Oct 14');
eq('label next year', describe('2027-01-05', null, BASE).text, 'Jan 5 ’27');
eq('label yesterday', describe('2026-10-06', null, BASE).text, 'Yesterday');
eq('label old', describe('2026-09-01', null, BASE).text, 'Sep 1');
eq('tone overdue', describe('2026-10-06', null, BASE).tone, 'late');
eq('tone today', describe('2026-10-07', null, BASE).tone, 'soon');
eq('tone future', describe('2026-11-01', null, BASE).tone, '');
eq('echo today', describeLong('2026-10-07', null, BASE), 'Wed, Oct 7 (today)');
eq('echo future', describeLong('2026-10-14', null, BASE), 'Wed, Oct 14');

// no timezone drift: stored string must survive a Date round trip
eq('no utc drift', toISO(new Date(2026, 0, 1)), '2026-01-01');

// exercise every day of a year for parser stability
let crashes = 0;
for (let i = 0; i < 400; i += 1) {
  const d = new Date(2026, 0, 1 + i);
  const iso = toISO(d);
  const r = parseWhen(iso, BASE);
  if (r.status !== 'ok' || r.iso !== iso) crashes += 1;
  const us = `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`;
  const r2 = parseWhen(us, BASE);
  if (r2.status !== 'ok' || r2.iso !== iso) crashes += 1;
}
eq('400 days round trip', crashes, 0);

// the same checks, but with "today" landing on each weekday
let wdFail = 0;
for (let off = 0; off < 7; off += 1) {
  const base = new Date(2026, 9, 4 + off);
  for (let w = 0; w < 7; w += 1) {
    const r = parseWhen(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][w], base);
    if (r.status !== 'ok') { wdFail += 1; continue; }
    const got = new Date(r.iso.slice(0, 4), Number(r.iso.slice(5, 7)) - 1, Number(r.iso.slice(8)));
    if (got.getDay() !== w) wdFail += 1;
    if (got < base) wdFail += 1;
    if ((got - base) / 86400000 > 6) wdFail += 1;
  }
}
eq('weekday resolution across all 7 base days', wdFail, 0);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
