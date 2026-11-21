/* ==================================================================
   Sticky Todo — date and time handling
   Kept separate so it can be unit-tested in Node without a DOM.

   A due date is stored as two plain strings:
     due  'YYYY-MM-DD'   local calendar day
     time 'HH:MM'        24-hour local time, or null for "no set time"
   Never as a timestamp, and never parsed with new Date('2026-10-14'),
   which reads as UTC and lands on the wrong day west of Greenwich.
   ================================================================== */

const WEEKDAYS = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
];
const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad2 = (n) => String(n).padStart(2, '0');
const toISO = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

function fromISO(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function today() {
  return startOfDay(new Date());
}

const shift = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

// Math.round absorbs the 23- and 25-hour days around a DST switch.
const daysBetween = (a, b) => Math.round((b - a) / 86400000);

/** A due date and time as a real Date, for comparing against now. */
function dueMoment(iso, time) {
  const d = fromISO(iso);
  if (!time) return d;
  const [h, m] = time.split(':').map(Number);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
}

/**
 * Has the deadline passed?
 * With a time, the moment itself. Without one, only once the day is over —
 * a task due "Friday" is not late at 9am on Friday.
 */
function isPast(iso, time, now = new Date()) {
  if (!iso) return false;
  if (time) return dueMoment(iso, time) < now;
  return iso < toISO(startOfDay(now));
}

function buildDate(y, m, d) {
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(y, m - 1, d);
  // Rejects Feb 30, Apr 31, etc. — JS would silently roll them forward.
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

// A bare month/day with no year means the next time that date comes around.
function rollForward(month, day, base) {
  const thisYear = buildDate(base.getFullYear(), month, day);
  if (thisYear && thisYear >= base) return thisYear;
  return buildDate(base.getFullYear() + 1, month, day);
}

/* ---------- the two halves ---------------------------------------- */

/** Parse just a calendar day. Returns a Date or null. */
function parseDatePart(raw, base) {
  if (!raw) return null;

  if (raw === 'today' || raw === 'tod') return base;
  if (['tomorrow', 'tomorow', 'tom', 'tmr', 'tmrw'].includes(raw)) return shift(base, 1);
  if (raw === 'yesterday') return shift(base, -1);
  if (raw === 'next week') return shift(base, 7);

  let m = raw.match(/^(?:in )?\+?(\d{1,3}) ?d(?:ays?)?$/);
  if (m) return shift(base, Number(m[1]));

  m = raw.match(/^(?:in )?\+?(\d{1,3}) ?w(?:eeks?|ks?)?$/);
  if (m) return shift(base, Number(m[1]) * 7);

  // Weekday name. 'fri' means the next Friday, counting today as one.
  m = raw.match(/^(next )?([a-z]{3,9})$/);
  if (m) {
    const i = WEEKDAYS.findIndex((w) => w.startsWith(m[2]));
    if (i !== -1) {
      let delta = (i - base.getDay() + 7) % 7;
      if (m[1]) delta += 7;
      return shift(base, delta);
    }
  }

  m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return buildDate(Number(m[1]), Number(m[2]), Number(m[3]));

  m = raw.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2}|\d{4}))?$/);
  if (m) {
    const month = Number(m[1]);
    const day = Number(m[2]);
    if (m[3]) {
      const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
      return buildDate(year, month, day);
    }
    return rollForward(month, day, base);
  }

  // 'oct 14', 'october 14 2027', '14 oct'
  let word = null;
  let day = null;
  let year = null;
  m = raw.match(/^([a-z]{3,9}) (\d{1,2})(?:st|nd|rd|th)?(?:,? (\d{4}))?$/);
  if (m) {
    word = m[1];
    day = Number(m[2]);
    year = m[3] ? Number(m[3]) : null;
  } else {
    m = raw.match(/^(\d{1,2})(?:st|nd|rd|th)? ([a-z]{3,9})$/);
    if (m) {
      day = Number(m[1]);
      word = m[2];
    }
  }
  if (word) {
    const i = MONTHS.findIndex((x) => x.startsWith(word));
    if (i !== -1) return year ? buildDate(year, i + 1, day) : rollForward(i + 1, day, base);
  }

  return null;
}

/** Parse just a clock time. Returns 'HH:MM' or null. */
function parseTimePart(raw) {
  if (!raw) return null;

  // Deadline words. 'midnight' and 'tonight' mean the end of the stated day,
  // which is how people use them for a due date, not 00:00 at its start.
  if (['eod', 'end of day', 'midnight', 'tonight'].includes(raw)) return '23:59';
  if (raw === 'noon' || raw === 'midday') return '12:00';

  // 5pm, 5 pm, 5:30pm, 5.30pm, 5p
  let m = raw.match(/^(\d{1,2})(?:[:.](\d{2}))? ?(am|pm|a|p)$/);
  if (m) {
    let h = Number(m[1]);
    const min = m[2] ? Number(m[2]) : 0;
    if (h < 1 || h > 12 || min > 59) return null;
    const pm = m[3][0] === 'p';
    if (h === 12) h = 0;
    if (pm) h += 12;
    return `${pad2(h)}:${pad2(min)}`;
  }

  // 24-hour. The colon is required, so a bare number is never read as a time.
  m = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (m) {
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h > 23 || min > 59) return null;
    return `${pad2(h)}:${pad2(min)}`;
  }

  return null;
}

/**
 * Turn typed shorthand into a due date, optionally with a time.
 * Returns { status: 'ok' | 'empty' | 'bad', iso, time }
 */
function parseWhen(input, base = today()) {
  const EMPTY = { status: 'empty', iso: null, time: null };
  const BAD = { status: 'bad', iso: null, time: null };

  let raw = String(input || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!raw || raw === '-' || raw === 'none') return EMPTY;

  // 'fri at 5pm', 'due by eod', '10/14 @ 3pm' all mean the same thing.
  raw = raw.replace(/@/g, ' ').replace(/\b(?:at|by|due|on)\b/g, ' ').replace(/\s+/g, ' ').trim();
  if (!raw) return EMPTY;

  const whole = parseDatePart(raw, base);
  if (whole) return { status: 'ok', iso: toISO(whole), time: null };

  // A bare time means that time today.
  const only = parseTimePart(raw);
  if (only) return { status: 'ok', iso: toISO(base), time: only };

  // Otherwise split into a date half and a time half, in either order.
  const words = raw.split(' ');
  for (let cut = words.length - 1; cut >= 1; cut -= 1) {
    const left = words.slice(0, cut).join(' ');
    const right = words.slice(cut).join(' ');

    const d1 = parseDatePart(left, base);
    const t1 = parseTimePart(right);
    if (d1 && t1) return { status: 'ok', iso: toISO(d1), time: t1 };

    const t2 = parseTimePart(left);
    const d2 = parseDatePart(right, base);
    if (d2 && t2) return { status: 'ok', iso: toISO(d2), time: t2 };
  }

  return BAD;
}

/* ---------- display ------------------------------------------------ */

/** '5pm', '9:30am', '11:59pm', '12pm'. */
function fmtTime(time) {
  const [h, m] = time.split(':').map(Number);
  const suffix = h < 12 ? 'am' : 'pm';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hour}:${pad2(m)}${suffix}` : `${hour}${suffix}`;
}

function stamp(d, base) {
  const same = d.getFullYear() === base.getFullYear();
  const tail = same ? '' : ` ’${String(d.getFullYear()).slice(2)}`;
  return `${MON_SHORT[d.getMonth()]} ${d.getDate()}${tail}`;
}

/** Short label for a task row: 'Today 5pm', 'Fri', 'Oct 14 11:59pm'. */
function describe(iso, time, now = new Date()) {
  const base = startOfDay(now);
  const d = fromISO(iso);
  const delta = daysBetween(base, d);

  let text;
  if (delta === 0) text = 'Today';
  else if (delta === 1) text = 'Tomorrow';
  else if (delta === -1) text = 'Yesterday';
  else if (delta > 1 && delta <= 6) text = DAY_SHORT[d.getDay()];
  else text = stamp(d, base);

  if (time) text += ` ${fmtTime(time)}`;

  let tone = '';
  if (isPast(iso, time, now)) tone = 'late';
  else if (delta === 0 || delta === 1) tone = 'soon';

  return { text, tone };
}

/** Longer confirmation under the capture box. */
function describeLong(iso, time, now = new Date()) {
  const base = startOfDay(now);
  const d = fromISO(iso);
  const delta = daysBetween(base, d);
  let full = `${DAY_SHORT[d.getDay()]}, ${MON_SHORT[d.getMonth()]} ${d.getDate()}`;
  if (d.getFullYear() !== base.getFullYear()) full += ` ${d.getFullYear()}`;
  if (time) full += ` at ${fmtTime(time)}`;

  if (isPast(iso, time, now)) return `${full} (already past)`;
  if (delta === 0) return `${full} (today)`;
  if (delta === 1) return `${full} (tomorrow)`;
  return full;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    parseWhen, parseDatePart, parseTimePart, describe, describeLong, fmtTime,
    isPast, dueMoment, toISO, fromISO, today, startOfDay, shift, buildDate,
  };
}
