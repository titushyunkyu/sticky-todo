/* ==================================================================
   Sticky Todo — renderer
   ================================================================== */

const PALETTE = 6;

/* ---------- state -------------------------------------------------- */

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

function seed() {
  return {
    version: 1,
    sort: 'due',
    categories: [
      { id: uid(), name: 'Classes', color: 0 },
      { id: uid(), name: 'Meetings', color: 1 },
      { id: uid(), name: 'Misc', color: 2 },
    ],
    tasks: [],
  };
}

/** Repair anything odd in the saved file rather than crashing on it. */
function normalize(raw) {
  if (!raw || typeof raw !== 'object') return seed();
  const base = seed();

  let categories = Array.isArray(raw.categories) ? raw.categories : [];
  categories = categories
    .filter((c) => c && typeof c.name === 'string' && c.name.trim())
    .map((c, i) => ({
      id: typeof c.id === 'string' ? c.id : uid(),
      name: c.name.trim().slice(0, 24),
      color: Number.isInteger(c.color) ? ((c.color % PALETTE) + PALETTE) % PALETTE : i % PALETTE,
    }));
  if (!categories.length) categories = base.categories;

  const ids = new Set(categories.map((c) => c.id));
  const tasks = (Array.isArray(raw.tasks) ? raw.tasks : [])
    .filter((t) => t && typeof t.text === 'string' && t.text.trim())
    .map((t) => ({
      id: typeof t.id === 'string' ? t.id : uid(),
      text: t.text.trim().slice(0, 200),
      due: typeof t.due === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.due) ? t.due : null,
      time:
        typeof t.due === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.due) &&
        typeof t.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t.time)
          ? t.time
          : null,
      catId: ids.has(t.catId) ? t.catId : categories[0].id,
      done: Boolean(t.done),
      created: Number.isFinite(t.created) ? t.created : Date.now(),
    }));

  return {
    version: 1,
    sort: raw.sort === 'cat' ? 'cat' : 'due',
    categories,
    tasks,
  };
}

let state = seed();
let editingId = null;
let flashId = null;

let saveTimer = null;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    window.api.save(state).catch((err) => console.error('Could not save:', err));
  }, 60);
}

const catById = (id) => state.categories.find((c) => c.id === id) || null;

/* ---------- sorting ------------------------------------------------ */

// '~' sorts after every digit, so a task with no set time falls to the end of
// its own day rather than jumping ahead of one that has a deadline on it.
const dueKey = (t) => (t.due ? `${t.due}T${t.time || '~~~~~'}` : null);

function byDue(a, b) {
  if (a.done !== b.done) return a.done ? 1 : -1;
  const ka = dueKey(a);
  const kb = dueKey(b);
  if (ka && kb) {
    if (ka !== kb) return ka < kb ? -1 : 1;
  } else if (ka) {
    return -1;
  } else if (kb) {
    return 1;
  }
  return a.created - b.created;
}

/* ---------- DOM ---------------------------------------------------- */

const $ = (sel) => document.querySelector(sel);

const el = {
  tally: $('#tally'),
  pin: $('#btn-pin'),
  cats: $('#btn-cats'),
  min: $('#btn-min'),
  close: $('#btn-close'),
  panel: $('#cats-panel'),
  catsList: $('#cats-list'),
  catForm: $('#cat-form'),
  catName: $('#cat-name'),
  capture: $('#capture'),
  what: $('#what'),
  when: $('#when'),
  which: $('#which'),
  echo: $('#when-echo'),
  sortbar: $('#sortbar'),
  list: $('#list'),
  clear: $('#btn-clear'),
  ics: $('#btn-ics'),
};

function icon(paths, stroke = true) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of paths) {
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', d);
    if (stroke) p.setAttribute('class', 'stroke');
    svg.appendChild(p);
  }
  return svg;
}

const checkIcon = () => icon(['M3 8.4 6.4 11.8 13 4.6']);
const crossIcon = () => icon(['M4 4l8 8M12 4l-8 8']);

/* ---------- render ------------------------------------------------- */

function render() {
  renderTally();
  renderCategorySelect();
  renderCategoryPanel();
  renderSort();
  renderList();
}

function renderTally() {
  const open = state.tasks.filter((t) => !t.done);
  if (!state.tasks.length) {
    el.tally.textContent = '';
    return;
  }
  if (!open.length) {
    el.tally.textContent = 'All done';
    return;
  }
  const now = new Date();
  const late = open.filter((t) => isPast(t.due, t.time, now)).length;
  el.tally.textContent = late ? `${open.length} left, ${late} overdue` : `${open.length} left`;
}

function renderCategorySelect() {
  const keep = el.which.value;
  el.which.replaceChildren();
  for (const c of state.categories) {
    const o = document.createElement('option');
    o.value = c.id;
    o.textContent = c.name;
    el.which.appendChild(o);
  }
  if (state.categories.some((c) => c.id === keep)) el.which.value = keep;
}

function renderCategoryPanel() {
  if (el.panel.hidden) return;
  el.catsList.replaceChildren();
  for (const c of state.categories) {
    const li = document.createElement('li');

    const dot = document.createElement('span');
    dot.className = `dot dot-c${c.color}`;
    li.appendChild(dot);

    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = c.name;
    li.appendChild(name);

    const count = document.createElement('span');
    count.className = 'when';
    const n = state.tasks.filter((t) => t.catId === c.id).length;
    count.textContent = n ? String(n) : '';
    li.appendChild(count);

    const kill = document.createElement('button');
    kill.className = 'remove';
    kill.title = `Delete ${c.name}`;
    kill.appendChild(crossIcon());
    kill.addEventListener('click', () => removeCategory(c.id));
    li.appendChild(kill);

    el.catsList.appendChild(li);
  }
}

function renderSort() {
  for (const b of el.sortbar.querySelectorAll('.sort')) {
    b.setAttribute('aria-current', String(b.dataset.sort === state.sort));
  }
}

function renderList() {
  el.list.replaceChildren();

  if (!state.tasks.length) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = 'Nothing on the list. Add something above.';
    el.list.appendChild(p);
    return;
  }

  if (state.sort === 'due') {
    for (const t of [...state.tasks].sort(byDue)) el.list.appendChild(taskNode(t));
    return;
  }

  for (const c of state.categories) {
    const group = state.tasks.filter((t) => t.catId === c.id).sort(byDue);
    if (!group.length) continue;

    const head = document.createElement('div');
    head.className = 'group';
    const dot = document.createElement('span');
    dot.className = `dot dot-c${c.color}`;
    head.appendChild(dot);
    const label = document.createElement('span');
    label.textContent = c.name;
    head.appendChild(label);
    el.list.appendChild(head);

    for (const t of group) el.list.appendChild(taskNode(t));
  }
}

function taskNode(task) {
  if (editingId === task.id) return editNode(task);

  const cat = catById(task.catId);
  const row = document.createElement('div');
  row.className = 'task';
  if (cat) row.classList.add(`tint-c${cat.color}`);
  if (task.done) row.classList.add('done');
  if (flashId === task.id) row.classList.add('just-done');

  const box = document.createElement('button');
  box.className = 'box';
  box.title = task.done ? 'Mark unfinished' : 'Mark finished';
  box.setAttribute('aria-pressed', String(task.done));
  box.appendChild(checkIcon());
  box.addEventListener('click', () => toggle(task.id));
  row.appendChild(box);

  const label = document.createElement('button');
  label.className = 'label';
  label.textContent = task.text;
  label.title = 'Click to edit';
  label.addEventListener('click', () => {
    editingId = task.id;
    render();
  });
  row.appendChild(label);

  if (task.due) {
    const when = document.createElement('span');
    const d = describe(task.due, task.time);
    when.className = `when ${task.done ? '' : d.tone}`.trim();
    when.textContent = d.text;
    row.appendChild(when);
  }

  const kill = document.createElement('button');
  kill.className = 'kill';
  kill.title = 'Delete';
  kill.appendChild(crossIcon());
  kill.addEventListener('click', () => remove(task.id));
  row.appendChild(kill);

  return row;
}

function editNode(task) {
  const wrap = document.createElement('div');
  wrap.className = 'edit';

  const text = document.createElement('input');
  text.type = 'text';
  text.maxLength = 200;
  text.value = task.text;

  const row = document.createElement('div');
  row.className = 'edit-row';

  const when = document.createElement('input');
  when.type = 'text';
  when.className = 'e-when';
  when.maxLength = 24;
  when.placeholder = 'no due date';
  when.spellcheck = false;
  when.value = task.due ? task.due + (task.time ? ` ${task.time}` : '') : '';

  const which = document.createElement('select');
  which.className = 'e-which';
  for (const c of state.categories) {
    const o = document.createElement('option');
    o.value = c.id;
    o.textContent = c.name;
    which.appendChild(o);
  }
  which.value = task.catId;

  row.append(when, which);

  const actions = document.createElement('div');
  actions.className = 'edit-actions';
  const cancel = document.createElement('button');
  cancel.className = 'ghost';
  cancel.textContent = 'Cancel';
  const save = document.createElement('button');
  save.className = 'ghost';
  save.textContent = 'Save';
  actions.append(cancel, save);

  const commit = () => {
    const title = text.value.trim();
    if (!title) {
      text.focus();
      return;
    }
    const parsed = parseWhen(when.value);
    if (parsed.status === 'bad') {
      when.focus();
      when.select();
      return;
    }
    task.text = title.slice(0, 200);
    task.due = parsed.iso;
    task.time = parsed.time;
    task.catId = which.value;
    editingId = null;
    persist();
    render();
  };

  const abandon = () => {
    editingId = null;
    render();
  };

  save.addEventListener('click', commit);
  cancel.addEventListener('click', abandon);
  for (const field of [text, when]) {
    field.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        abandon();
      }
    });
  }

  wrap.append(text, row, actions);
  queueMicrotask(() => {
    text.focus();
    text.setSelectionRange(text.value.length, text.value.length);
  });
  return wrap;
}

/* ---------- actions ------------------------------------------------ */

function addTask(e) {
  e.preventDefault();
  const title = el.what.value.trim();
  if (!title) {
    el.what.focus();
    return;
  }
  const parsed = parseWhen(el.when.value);
  if (parsed.status === 'bad') {
    el.when.focus();
    el.when.select();
    return;
  }
  state.tasks.push({
    id: uid(),
    text: title.slice(0, 200),
    due: parsed.iso,
    time: parsed.time,
    catId: el.which.value || state.categories[0].id,
    done: false,
    created: Date.now(),
  });
  el.what.value = '';
  el.when.value = '';
  el.echo.textContent = '';
  el.echo.classList.remove('bad');
  persist();
  render();
  el.what.focus();
}

function toggle(id) {
  const t = state.tasks.find((x) => x.id === id);
  if (!t) return;
  t.done = !t.done;
  flashId = t.done ? id : null;
  persist();
  render();
  setTimeout(() => {
    if (flashId === id) flashId = null;
  }, 260);
}

function remove(id) {
  state.tasks = state.tasks.filter((t) => t.id !== id);
  if (editingId === id) editingId = null;
  persist();
  render();
}

function addCategory(e) {
  e.preventDefault();
  const name = el.catName.value.trim().slice(0, 24);
  if (!name) return;
  if (state.categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
    el.catName.select();
    return;
  }
  const used = new Set(state.categories.map((c) => c.color));
  let color = 0;
  while (color < PALETTE && used.has(color)) color += 1;
  if (color === PALETTE) color = state.categories.length % PALETTE;

  state.categories.push({ id: uid(), name, color });
  el.catName.value = '';
  persist();
  render();
  el.catName.focus();
}

function removeCategory(id) {
  if (state.categories.length <= 1) return;
  const cat = catById(id);
  if (!cat) return;
  const owned = state.tasks.filter((t) => t.catId === id);
  const fallback = state.categories.find((c) => c.id !== id);
  const message = owned.length
    ? `Delete “${cat.name}”? Its ${owned.length} task${owned.length === 1 ? '' : 's'} will move to “${fallback.name}”.`
    : `Delete “${cat.name}”?`;
  if (!window.confirm(message)) return;

  for (const t of owned) t.catId = fallback.id;
  state.categories = state.categories.filter((c) => c.id !== id);
  persist();
  render();
}

function clearFinished() {
  const n = state.tasks.filter((t) => t.done).length;
  if (!n) return;
  if (!window.confirm(`Remove ${n} finished task${n === 1 ? '' : 's'}?`)) return;
  state.tasks = state.tasks.filter((t) => !t.done);
  persist();
  render();
}

/* ---------- calendar file ------------------------------------------ */

function escapeIcs(s) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

// iCalendar lines must wrap at 75 octets; continuations start with a space.
function fold(line) {
  if (line.length <= 74) return line;
  const parts = [line.slice(0, 74)];
  let rest = line.slice(74);
  while (rest.length > 73) {
    parts.push(' ' + rest.slice(0, 73));
    rest = rest.slice(73);
  }
  if (rest) parts.push(' ' + rest);
  return parts.join('\r\n');
}

function buildIcs(tasks, categories) {
  const nameOf = (id) => (categories.find((c) => c.id === id) || {}).name || 'Todo';
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//sticky-todo//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];
  // Absolute UTC instants, so the file needs no embedded timezone table.
  const utc = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  for (const t of tasks) {
    if (!t.due || t.done) continue;

    let startLine;
    let endLine;
    if (t.time) {
      const from = dueMoment(t.due, t.time);
      startLine = `DTSTART:${utc(from)}`;
      endLine = `DTEND:${utc(new Date(from.getTime() + 30 * 60000))}`;
    } else {
      startLine = `DTSTART;VALUE=DATE:${t.due.replace(/-/g, '')}`;
      endLine = `DTEND;VALUE=DATE:${toISO(shift(fromISO(t.due), 1)).replace(/-/g, '')}`;
    }

    lines.push(
      'BEGIN:VEVENT',
      `UID:${t.id}@sticky-todo`,
      `DTSTAMP:${stamp}`,
      startLine,
      endLine,
      `SUMMARY:${escapeIcs(t.text)}`,
      `CATEGORIES:${escapeIcs(nameOf(t.catId))}`,
      'TRANSP:TRANSPARENT',
      'END:VEVENT'
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

async function exportIcs() {
  const due = state.tasks.filter((t) => t.due && !t.done);
  if (!due.length) {
    window.alert('Nothing to export yet. Only unfinished tasks with a due date go into the file.');
    return;
  }
  try {
    const res = await window.api.saveIcs(buildIcs(state.tasks, state.categories));
    if (res && res.saved) {
      window.alert(
        `Saved ${due.length} task${due.length === 1 ? '' : 's'}.\n\n` +
          'In Google Calendar: Settings → Import & export → Import, and pick this file.'
      );
    }
  } catch (err) {
    console.error(err);
    window.alert('Could not write the file.');
  }
}

/* ---------- wiring ------------------------------------------------- */

el.capture.addEventListener('submit', addTask);
el.catForm.addEventListener('submit', addCategory);
el.clear.addEventListener('click', clearFinished);
el.ics.addEventListener('click', exportIcs);

el.when.addEventListener('input', () => {
  const parsed = parseWhen(el.when.value);
  if (parsed.status === 'empty') {
    el.echo.textContent = '';
    el.echo.classList.remove('bad');
  } else if (parsed.status === 'bad') {
    el.echo.textContent = 'Try fri 5pm, tomorrow, 10/14 eod, oct 14, 3d';
    el.echo.classList.add('bad');
  } else {
    el.echo.textContent = describeLong(parsed.iso, parsed.time);
    el.echo.classList.remove('bad');
  }
});

el.sortbar.addEventListener('click', (e) => {
  const b = e.target.closest('.sort');
  if (!b) return;
  state.sort = b.dataset.sort;
  persist();
  render();
});

el.cats.addEventListener('click', () => {
  el.panel.hidden = !el.panel.hidden;
  el.cats.setAttribute('aria-expanded', String(!el.panel.hidden));
  renderCategoryPanel();
  if (!el.panel.hidden) el.catName.focus();
});

el.pin.addEventListener('click', async () => {
  const now = el.pin.getAttribute('aria-pressed') !== 'true';
  const applied = await window.api.setPin(now);
  el.pin.setAttribute('aria-pressed', String(applied));
});

el.min.addEventListener('click', () => window.api.minimize());
el.close.addEventListener('click', () => window.api.close());

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (editingId) {
    editingId = null;
    render();
  } else if (!el.panel.hidden) {
    el.panel.hidden = true;
    el.cats.setAttribute('aria-expanded', 'false');
  }
});

// Labels and overdue styling go stale on their own as the clock moves. Redraw
// only when something has actually changed, and never while an edit is open —
// that would wipe out whatever is half-typed in it.
function clockSignature() {
  const now = new Date();
  return (
    toISO(now) +
    '|' +
    state.tasks.filter((t) => !t.done && isPast(t.due, t.time, now)).map((t) => t.id).join(',')
  );
}

let lastSignature = '';
setInterval(() => {
  if (editingId) return;
  const sig = clockSignature();
  if (sig !== lastSignature) {
    lastSignature = sig;
    render();
  }
}, 20000);

/* ---------- boot --------------------------------------------------- */

(async function start() {
  try {
    state = normalize(await window.api.load());
  } catch (err) {
    console.error('Could not read saved tasks, starting fresh:', err);
    state = seed();
  }
  try {
    el.pin.setAttribute('aria-pressed', String(await window.api.getPin()));
  } catch {
    /* leave the default */
  }
  render();
  lastSignature = clockSignature();
  el.what.focus();
})();
