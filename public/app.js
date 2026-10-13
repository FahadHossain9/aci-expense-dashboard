// ACI Distribution Expense — buildless demo. Bangla first, English on request.
// State lives in a few top-level variables; every view is a function that returns an HTML string.

const TODAY = '2026-10-14';
const RECORDS_KEY = 'aci-demo-v1';
const LANG_KEY = 'aci-lang';
const CUSTOM_KEY = 'aci-custom-v1';
const PAGE_SIZE = 10;
const NEEDS_MODE = /Carriage|Travelling|Courier Cost/;
const MODES = ['Truck', 'Pickup', 'Van', 'Rickshaw', 'Motorcycle', 'Other'];

let catalog, records, base;
let currentDepot = 'Jashore'; // the depot the "Depot In-charge" persona works for
let custom = { depots: [], heads: [], subscriptions: [] }; // added by Management/HQ; depots/heads are { name, bn }
let lang = readPref(LANG_KEY) === 'en' ? 'en' : 'bn';
let role = 'Management';
let view = 'Overview';
let page = 1;
let editId = null;
let moreOpen = false;
let chartIndex = 11;
let filters = defaultFilters();
let numberFormat, locale;

const $ = (selector) => document.querySelector(selector);

/* ---------- small helpers ---------- */

function readPref(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function writePref(key, value) {
  try { localStorage.setItem(key, value); } catch { /* private mode: ignore */ }
}
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function t(key, vars = {}) {
  const text = STRINGS[lang][key] ?? STRINGS.en[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? '');
}
function name(kind, value) {
  if (!value) return '';
  return lang === 'bn' ? (NAMES_BN[kind]?.[value] ?? value) : String(value).replace(/\s{2,}/g, ' ');
}
function setLocale() {
  locale = lang === 'bn' ? 'bn-BD' : 'en-IN';
  numberFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
}
function num(n) { return numberFormat.format(n); }
function money(n) { return '৳ ' + num(Math.round(n)); }
function dateLabel(iso, style = 'long') {
  const options = style === 'short'
    ? { day: 'numeric', month: 'short', timeZone: 'UTC' }
    : { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' };
  return new Date(iso + 'T12:00:00Z').toLocaleDateString(locale, options);
}
function addDays(iso, days) {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
// People may type Bangla digits; turn them into a number the browser understands.
function parseAmount(text) {
  const ascii = String(text).replace(/[০-৯]/g, (d) => '০১২৩৪৫৬৭৮৯'.indexOf(d)).replace(/[,\s৳]/g, '').replace('٫', '.');
  return /^\d*\.?\d+$/.test(ascii) ? Number(ascii) : NaN;
}
const sum = (list) => list.reduce((total, r) => total + r.amount, 0);

function icon(nameOfIcon) {
  const paths = {
    overview: '<path d="M5 20v-9M12 20V4M19 20v-6"/>',
    list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
    depot: '<path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7M12 17h.01"/>',
    download: '<path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    up: '<path d="M12 19V5m0 0-6 6m6-6 6 6"/>',
    down: '<path d="M12 5v14m0 0-6-6m6 6 6-6"/>',
    flat: '<path d="M5 12h14"/>',
    arrow: '<path d="M5 12h14m0 0-6-6m6 6-6 6"/>',
    filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    settings: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
    clip: '<path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 5h6M9 13l2 2 4-4"/>',
  };
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths[nameOfIcon] || ''}</svg>`;
}

function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 4000);
}

/* ---------- data ---------- */

function defaultFilters() {
  return { period: 'month', from: '2026-10-01', to: TODAY, depot: '', business: '', head: '', search: '' };
}

// Demo transactions: 21 depots x up to 28 days x 12 months, up to the demo "today".
function seed() {
  const out = [];
  let id = 1;
  for (let m = 0; m < 12; m++) {
    const month = new Date(Date.UTC(2025, 10 + m, 1));
    const lastDay = m === 11 ? 14 : 28;
    for (let d = 1; d <= lastDay; d++) {
      for (let i = 0; i < 21; i++) {
        if (m === 11 && d === 14 && i > 17) continue; // a few depots have not reported yet today
        const business = base.businesses[(i * 3 + d) % base.businesses.length];
        const head = base.heads[(i + d * 2) % base.heads.length];
        const day = `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        out.push({
          id: id++,
          date: day,
          depot: base.depots[i],
          business,
          head,
          amount: 500 + ((i * 719 + d * 317 + m * 431) % 120) * 500,
          mode: head.includes('Carriage') ? 'Truck' : '',
          status: 'Submitted',
          note: 'Generated demonstration entry',
          source: 'Demo fixture',
        });
      }
    }
  }
  return out;
}
function saveRecords() { writePref(RECORDS_KEY, JSON.stringify(records)); }
function saveCustom() { writePref(CUSTOM_KEY, JSON.stringify(custom)); }
function nextId() { return Math.max(0, ...records.map((x) => x.id)) + 1; }

// Fold depots/categories added in the Manage page into the catalog and the Bangla name map.
function loadCustom() {
  try { custom = { ...custom, ...JSON.parse(readPref(CUSTOM_KEY)) }; } catch { /* keep defaults */ }
  custom.depots.forEach((d) => { catalog.depots.push(d.name); if (d.bn) NAMES_BN.depots[d.name] = d.bn; });
  custom.heads.forEach((h) => { catalog.heads.push(h.name); if (h.bn) NAMES_BN.heads[h.name] = h.bn; });
}

// A subscription is a recurring monthly expense. Once its day of the month has arrived,
// this month's entry is added automatically (once per month).
function postSubscriptions() {
  const month = TODAY.slice(0, 7);
  let posted = 0;
  custom.subscriptions.forEach((s) => {
    const date = `${month}-${String(s.day).padStart(2, '0')}`;
    if (!s.active || s.lastPosted === month || date > TODAY) return;
    records.push({
      id: nextId(), date, depot: s.depot, business: s.business, head: s.head, amount: s.amount,
      mode: s.mode || '', status: 'Submitted', note: s.title, source: 'Subscription',
    });
    s.lastPosted = month;
    posted++;
  });
  if (posted) { saveRecords(); saveCustom(); }
  return posted;
}

function matchesSearch(r, query) {
  const haystack = [r.depot, r.business, r.head, r.note, name('depots', r.depot), name('businesses', r.business), name('heads', r.head)].join(' ').toLowerCase();
  return haystack.includes(query.toLowerCase());
}
function filtered() {
  return records.filter((r) =>
    (role !== 'Depot In-charge' || r.depot === currentDepot) &&
    r.date >= filters.from && r.date <= filters.to &&
    (!filters.depot || r.depot === filters.depot) &&
    (!filters.business || r.business === filters.business) &&
    (!filters.head || r.head === filters.head) &&
    (!filters.search || matchesSearch(r, filters.search)));
}
function newestFirst(a, b) { return b.date.localeCompare(a.date) || b.id - a.id; }
function groupTotals(list, key) {
  const totals = {};
  list.forEach((r) => { totals[r[key]] = (totals[r[key]] || 0) + r.amount; });
  return Object.entries(totals).sort((a, b) => b[1] - a[1]);
}

function setPeriod(period) {
  filters.period = period;
  filters.to = TODAY;
  if (period === 'today') filters.from = TODAY;
  if (period === 'week') filters.from = addDays(TODAY, -6);
  if (period === 'month') filters.from = TODAY.slice(0, 8) + '01';
}

/* ---------- shared pieces ---------- */

function options(kind, items, current, allLabel) {
  const first = allLabel ? `<option value="">${esc(allLabel)}</option>` : '';
  return first + items.map((x) => `<option value="${esc(x)}" ${x === current ? 'selected' : ''}>${esc(name(kind, x))}</option>`).join('');
}

function pageHead(title, sub, action = '') {
  return `<div class="page-head"><div><h1>${title}</h1><p class="sub">${sub}</p></div>${action}</div>`;
}

function filterBar({ withDepot = true } = {}) {
  const chips = ['today', 'week', 'month', 'custom'].map((p) =>
    `<button type="button" class="chip" data-action="period" data-period="${p}" aria-pressed="${filters.period === p}">${t('period.' + p)}</button>`).join('');
  const activeExtras = [filters.depot && withDepot, filters.business, filters.head].filter(Boolean).length;
  const custom = filters.period === 'custom' ? `
    <div class="custom-dates">
      <label class="field"><span>${t('f.from')}</span><input type="date" id="from" data-filter="from" value="${filters.from}" max="${TODAY}"></label>
      <label class="field"><span>${t('f.to')}</span><input type="date" id="to" data-filter="to" value="${filters.to}" max="${TODAY}"></label>
    </div>` : '';
  const more = moreOpen ? `
    <div class="more-filters">
      ${withDepot && role !== 'Depot In-charge' ? `<label class="field"><span>${t('f.depot')}</span><select id="depot" data-filter="depot">${options('depots', catalog.depots, filters.depot, t('f.allDepots'))}</select></label>` : ''}
      <label class="field"><span>${t('f.business')}</span><select id="business" data-filter="business">${options('businesses', catalog.businesses, filters.business, t('f.allBusinesses'))}</select></label>
      <label class="field"><span>${t('f.head')}</span><select id="head" data-filter="head">${options('heads', catalog.heads, filters.head, t('f.allHeads'))}</select></label>
    </div>` : '';
  return `
    <section class="filter-bar" aria-label="Filters">
      <div class="chips">${chips}</div>
      ${custom}
      <div class="filter-row">
        <button type="button" class="link-button" id="more-toggle" data-action="toggle-more" aria-expanded="${moreOpen}">${icon('filter')} ${t('f.more')}${activeExtras ? ` <span class="count">${num(activeExtras)}</span>` : ''}</button>
        <button type="button" class="link-button" data-action="clear">${t('f.clear')}</button>
      </div>
      ${more}
      <p class="range">${t('f.showing', { from: dateLabel(filters.from), to: dateLabel(filters.to) })}</p>
    </section>`;
}

function rankList(list, key, kind) {
  const top = groupTotals(list, key).slice(0, 5);
  if (!top.length) return `<p class="empty">${t('empty')}</p>`;
  return `<ol class="ranks">${top.map(([label, value]) => `
    <li><div class="rank-top"><span>${esc(name(kind, label))}</span><b>${money(value)}</b></div>
    <div class="track"><div class="fill" style="width:${Math.max(3, value / top[0][1] * 100)}%"></div></div></li>`).join('')}</ol>`;
}

function statusPill(status) {
  return `<span class="pill ${status === 'Draft' ? 'pill-draft' : 'pill-ok'}">${t('status.' + status)}</span>`;
}

function table(list, { pager = false } = {}) {
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  page = Math.min(page, pages);
  const rows = pager ? list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) : list;
  const owner = role === 'Depot In-charge';
  if (!list.length) return `<p class="empty">${t('empty')}</p>`;

  const body = rows.map((r) => `
    <tr>
      <td data-label="${t('th.date')}">${dateLabel(r.date, 'short')}</td>
      <td data-label="${t('th.depot')}">${esc(name('depots', r.depot))}</td>
      <td data-label="${t('th.business')}">${esc(name('businesses', r.business))}</td>
      <td data-label="${t('th.head')}" class="cell-head">${esc(name('heads', r.head))}</td>
      <td data-label="${t('th.mode')}">${esc(name('modes', r.mode) || '—')}</td>
      <td data-label="${t('th.amount')}" class="amount">${money(r.amount)}</td>
      <td data-label="${t('th.status')}">${statusPill(r.status)}</td>
      ${owner ? `<td class="row-actions">${r.status === 'Draft'
        ? `<button type="button" class="btn btn-small btn-primary" data-action="submit-draft" data-id="${r.id}">${t('submit')}</button>
           <button type="button" class="btn btn-small" data-action="edit" data-id="${r.id}">${t('edit')}</button>
           <button type="button" class="btn btn-small btn-quiet" data-action="delete" data-id="${r.id}">${t('delete')}</button>`
        : `<span class="muted">${t('recorded')}</span>`}</td>` : ''}
    </tr>`).join('');

  const head = `<tr><th>${t('th.date')}</th><th>${t('th.depot')}</th><th>${t('th.business')}</th><th>${t('th.head')}</th><th>${t('th.mode')}</th><th class="amount">${t('th.amount')}</th><th>${t('th.status')}</th>${owner ? `<th>${t('th.action')}</th>` : ''}</tr>`;
  const pagerHtml = pager ? `
    <div class="pager">
      <span>${t('pageInfo', { from: num((page - 1) * PAGE_SIZE + 1), to: num(Math.min(page * PAGE_SIZE, list.length)), total: num(list.length) })}</span>
      <div>
        <button type="button" class="btn btn-small" data-action="prev" ${page === 1 ? 'disabled' : ''}>${t('prev')}</button>
        <span class="page-num">${num(page)} / ${num(pages)}</span>
        <button type="button" class="btn btn-small" data-action="next" ${page === pages ? 'disabled' : ''}>${t('next')}</button>
      </div>
    </div>` : '';
  return `<div class="table-wrap"><table class="data"><thead>${head}</thead><tbody>${body}</tbody></table></div>${pagerHtml}`;
}

/* ---------- views ---------- */

function overviewView() {
  const submitted = filtered().filter((r) => r.status === 'Submitted');
  const endDay = submitted.filter((r) => r.date === filters.to);
  const sameScope = (r) => r.status === 'Submitted' && (!filters.depot || r.depot === filters.depot) && (!filters.business || r.business === filters.business) && (!filters.head || r.head === filters.head);
  const previous = records.filter((r) => sameScope(r) && r.date === addDays(filters.to, -1));
  const change = sum(previous) ? (sum(endDay) - sum(previous)) / sum(previous) * 100 : null;

  let changeLine, changeIcon = 'flat';
  if (change === null) changeLine = t('ov.noPrev');
  else if (Math.abs(change) < 0.05) changeLine = t('ov.same');
  else {
    const pct = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(Math.abs(change)) + '%';
    changeLine = t(change > 0 ? 'ov.up' : 'ov.down', { pct });
    changeIcon = change > 0 ? 'up' : 'down';
  }

  const months = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(filters.to + 'T12:00:00Z');
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() - i);
    const prefix = d.toISOString().slice(0, 7);
    months.push({
      short: d.toLocaleDateString(locale, { month: 'short', timeZone: 'UTC' }),
      long: d.toLocaleDateString(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }),
      value: sum(records.filter((r) => sameScope(r) && r.date.startsWith(prefix) && r.date <= filters.to)),
    });
  }
  const maxMonth = Math.max(...months.map((m) => m.value), 1);
  const picked = months[chartIndex] || months[11];

  return pageHead(t('ov.title'), t('ov.sub'), `<button class="btn" data-action="export">${icon('download')} ${t('export')}</button>`)
    + filterBar()
    + `<div class="summary">
        <section class="hero">
          <p class="hero-label">${t('ov.headline', { date: dateLabel(filters.to) })}</p>
          <p class="hero-amount">${money(sum(endDay))}</p>
          <p class="hero-change">${endDay.length ? `${icon(changeIcon)} ${changeLine}` : t('ov.noData')}</p>
        </section>
        <div class="stats">
          <div class="stat"><span class="stat-label">${t('stat.total')}</span><b class="stat-value">${money(sum(submitted))}</b><span class="stat-note">${t('stat.totalNote', { n: num(submitted.length) })}</span></div>
          <div class="stat"><span class="stat-label">${t('stat.depots')}</span><b class="stat-value">${num(new Set(endDay.map((r) => r.depot)).size)} <small>/ ${num(filters.depot ? 1 : catalog.depots.length)}</small></b><span class="stat-note">${t('stat.depotsNote', { date: dateLabel(filters.to, 'short') })}</span></div>
          <div class="stat"><span class="stat-label">${t('stat.businesses')}</span><b class="stat-value">${num(new Set(submitted.map((r) => r.business)).size)} <small>/ ${num(catalog.businesses.length)}</small></b><span class="stat-note">${t('stat.businessesNote')}</span></div>
        </div>
      </div>
      <div class="grid-2">
        <section class="panel">
          <div class="panel-head"><div><h2>${t('chart.title')}</h2><p class="sub">${t('chart.sub')}</p></div></div>
          <div class="chart" role="group" aria-label="${t('chart.title')}">
            ${months.map((m, i) => `
              <div class="bar-col">
                <div class="bar-track"><button type="button" class="bar ${i === chartIndex ? 'is-picked' : ''}" id="bar-${i}" data-action="month" data-index="${i}" style="--h:${m.value / maxMonth * 100}" aria-label="${esc(m.long)}: ${money(m.value)}"></button></div>
                <span class="bar-label">${m.short}</span>
              </div>`).join('')}
          </div>
          <p class="readout" aria-live="polite"><b>${picked.long}</b> · ${money(picked.value)}</p>
          <p class="sub">${t('chart.note')}</p>
        </section>
        <section class="panel"><h2>${t('top.heads')}</h2><p class="sub">${t('top.headsSub')}</p>${rankList(submitted, 'head', 'heads')}</section>
      </div>
      <div class="grid-2 grid-2-flip">
        <section class="panel">
          <div class="panel-head"><h2>${t('recent')}</h2><button class="btn btn-small" data-action="view-all">${t('viewAll')} ${icon('arrow')}</button></div>
          ${table([...submitted].sort(newestFirst).slice(0, 8))}
        </section>
        <section class="panel"><h2>${t('top.depots')}</h2><p class="sub">${t('top.depotsSub')}</p>${rankList(submitted, 'depot', 'depots')}</section>
      </div>`;
}

function resultsHtml() {
  const list = filtered().sort(newestFirst);
  return `
    <div class="panel-head">
      <div><h2>${t('reg.count', { n: num(list.length) })}</h2><p class="sub">${t('reg.total', { amount: money(sum(list)) })}</p></div>
    </div>${table(list, { pager: true })}`;
}
function registerView() {
  const mine = role === 'Depot In-charge';
  const action = mine
    ? `<button class="btn btn-primary" data-action="add">${icon('plus')} ${t('nav.add')}</button>`
    : `<button class="btn" data-action="export">${icon('download')} ${t('export')}</button>`;
  return pageHead(t(mine ? 'mine.title' : 'reg.title'), mine ? t('mine.sub', { depot: name('depots', currentDepot) }) : t('reg.sub'), action)
    + filterBar()
    + `<label class="search">${icon('search')}<input type="search" id="search" placeholder="${t('search')}" aria-label="${t('searchLabel')}" value="${esc(filters.search)}" autocomplete="off"></label>
       <section class="panel" id="results">${resultsHtml()}</section>`;
}

function statusView() {
  const day = filters.to;
  const byDepot = {};
  records.filter((r) => r.date === day && r.status === 'Submitted').forEach((r) => (byDepot[r.depot] ||= []).push(r));
  const depots = catalog.depots.filter((d) => !filters.depot || d === filters.depot);
  const done = depots.filter((d) => byDepot[d]).length;
  const ordered = [...depots].sort((a, b) => Number(!!byDepot[a]) - Number(!!byDepot[b]));

  return pageHead(t('st.title'), t('st.sub', { date: dateLabel(day) }))
    + `<section class="filter-bar">
         <div class="filter-row filter-row-start">
           <label class="field"><span>${t('f.to')}</span><input type="date" id="status-date" data-filter="status-date" value="${day}" max="${TODAY}"></label>
           <label class="field"><span>${t('f.depot')}</span><select id="depot" data-filter="depot">${options('depots', catalog.depots, filters.depot, t('f.allDepots'))}</select></label>
         </div>
       </section>
       <p class="status-summary"><b>${t('st.summary', { done: num(done), todo: num(depots.length - done) })}</b> <span class="muted">${t('st.note')}</span></p>
       <div class="depot-grid">${ordered.map((d) => {
         const list = byDepot[d] || [];
         return `<article class="depot-card ${list.length ? '' : 'is-missing'}">
           <div class="depot-top"><h2>${esc(name('depots', d))}</h2><span class="pill ${list.length ? 'pill-ok' : 'pill-draft'}">${t(list.length ? 'st.reported' : 'st.missing')}</span></div>
           <p class="depot-amount">${money(sum(list))}</p>
           <p class="sub">${t('st.line', { n: num(list.length), b: num(new Set(list.map((x) => x.business)).size) })}</p>
           <button type="button" class="btn btn-small" data-action="depot-view" data-depot="${esc(d)}">${t('st.view')} ${icon('arrow')}</button>
         </article>`;
       }).join('')}</div>`;
}

function formView() {
  const existing = editId ? records.find((r) => r.id === editId) : null;
  const r = existing || { date: TODAY, business: 'Tractor', head: 'Service charge', amount: '', mode: '', note: '' };
  return pageHead(t(existing ? 'form.editTitle' : 'form.addTitle'), t('form.sub'))
    + `<form class="panel form" id="expense-form" novalidate>
         <label class="field field-amount">
           <span class="field-label">${t('form.amount')}</span>
           <span class="amount-input"><span aria-hidden="true">৳</span><input name="amount" id="amount" type="text" inputmode="decimal" autocomplete="off" value="${esc(r.amount)}" placeholder="${num(1500)}" aria-describedby="amount-hint amount-error" required></span>
           <span class="hint" id="amount-hint"><span id="amount-preview">${t('form.amountHint')}</span></span>
           <span class="error" id="amount-error" role="alert"></span>
         </label>
         <label class="field"><span class="field-label">${t('form.depot')}</span>
           <select name="depot">${options('depots', catalog.depots, r.depot || currentDepot)}</select>
           <span class="hint">${t('form.depotHint')}</span></label>
         <label class="field"><span class="field-label">${t('form.head')}</span>
           <select name="head" id="head-field">${options('heads', catalog.heads, r.head)}</select></label>
         <label class="field"><span class="field-label">${t('form.business')}</span>
           <select name="business">${options('businesses', catalog.businesses, r.business)}</select></label>
         <label class="field"><span class="field-label">${t('form.date')}</span>
           <input name="date" id="date-field" type="date" value="${r.date}" max="${TODAY}" required>
           <span class="error" id="date-error" role="alert"></span></label>
         <label class="field" id="mode-field" ${NEEDS_MODE.test(r.head) ? '' : 'hidden'}><span class="field-label">${t('form.mode')}</span>
           <select name="mode" id="mode">${options('modes', MODES, r.mode, t('form.modeNone'))}</select>
           <span class="hint">${t('form.modeHint')}</span>
           <span class="error" id="mode-error" role="alert"></span></label>
         <label class="field"><span class="field-label">${t('form.note')}</span>
           <input name="note" maxlength="250" placeholder="${t('form.notePh')}" value="${existing && existing.note === 'Generated demonstration entry' ? '' : esc(r.note)}"></label>
         <p class="hint">${t('form.check')}</p>
         <div class="form-actions">
           <button type="submit" class="btn btn-primary btn-big" name="action" value="Submitted">${icon('clip')} ${t('form.submit')}</button>
           <button type="submit" class="btn btn-big" name="action" value="Draft">${t('form.draft')}</button>
           <button type="button" class="btn btn-quiet btn-big" data-action="cancel-form">${t('form.cancel')}</button>
         </div>
       </form>`;
}

function chipList(items, kind) {
  if (!items.length) return `<p class="hint spaced-top">${t('mg.none')}</p>`;
  return `<ul class="tag-list">${items.map((i) => `<li>${esc(name(kind, i.name))}</li>`).join('')}</ul>`;
}

function manageView() {
  const subs = custom.subscriptions.map((s) => `
    <li class="sub-item ${s.active ? '' : 'is-paused'}">
      <div class="sub-main">
        <b>${esc(s.title)}</b> <span class="pill ${s.active ? 'pill-ok' : 'pill-draft'}">${t(s.active ? 'mg.subOn' : 'mg.subOff')}</span>
        <p class="sub">${money(s.amount)} · ${t('mg.subEvery', { day: num(s.day) })}<br>${esc(name('depots', s.depot))} · ${esc(name('businesses', s.business))} · ${esc(name('heads', s.head))}</p>
      </div>
      <div class="sub-actions">
        <button type="button" class="btn btn-small" data-action="sub-toggle" data-id="${s.id}">${t(s.active ? 'mg.pause' : 'mg.resume')}</button>
        <button type="button" class="btn btn-small btn-quiet" data-action="sub-delete" data-id="${s.id}">${t('delete')}</button>
      </div>
    </li>`).join('');
  const days = Array.from({ length: 28 }, (_, i) => `<option value="${i + 1}" ${i === 0 ? 'selected' : ''}>${num(i + 1)}</option>`).join('');

  return pageHead(t('mg.title'), t('mg.sub'))
    + `<div class="manage">
      <section class="panel">
        <h2>${t('mg.depotTitle')}</h2><p class="sub">${t('mg.depotSub')}</p>
        <form class="inline-form" id="depot-form" novalidate>
          <label class="field"><span>${t('mg.depotName')}</span><input type="text" name="name" maxlength="60" autocomplete="off"></label>
          <label class="field"><span>${t('mg.bnName')}</span><input type="text" name="bn" maxlength="60" autocomplete="off" lang="bn"></label>
          <span class="error" id="depot-form-error" role="alert"></span>
          <button type="submit" class="btn btn-primary">${icon('plus')} ${t('mg.add')}</button>
        </form>
        <h3>${t('mg.added')}</h3>${chipList(custom.depots, 'depots')}
      </section>
      <section class="panel">
        <h2>${t('mg.headTitle')}</h2><p class="sub">${t('mg.headSub')}</p>
        <form class="inline-form" id="head-form" novalidate>
          <label class="field"><span>${t('mg.headName')}</span><input type="text" name="name" maxlength="80" autocomplete="off"></label>
          <label class="field"><span>${t('mg.bnName')}</span><input type="text" name="bn" maxlength="80" autocomplete="off" lang="bn"></label>
          <span class="error" id="head-form-error" role="alert"></span>
          <button type="submit" class="btn btn-primary">${icon('plus')} ${t('mg.add')}</button>
        </form>
        <h3>${t('mg.added')}</h3>${chipList(custom.heads, 'heads')}
      </section>
      <section class="panel manage-wide">
        <h2>${t('mg.subTitle')}</h2><p class="sub">${t('mg.subSub')}</p>
        <form class="inline-form inline-form-wide" id="sub-form" novalidate>
          <label class="field"><span>${t('mg.subName')}</span><input type="text" name="title" maxlength="80" autocomplete="off" placeholder="${t('mg.subNamePh')}"></label>
          <label class="field"><span>${t('form.amount')}</span><input type="text" name="amount" inputmode="decimal" autocomplete="off" placeholder="${num(1500)}"></label>
          <label class="field"><span>${t('form.depot')}</span><select name="depot">${options('depots', catalog.depots, currentDepot)}</select></label>
          <label class="field"><span>${t('form.business')}</span><select name="business">${options('businesses', catalog.businesses, 'Tractor')}</select></label>
          <label class="field"><span>${t('form.head')}</span><select name="head" id="sub-head">${options('heads', catalog.heads, 'Telephone, internet and fax')}</select></label>
          <label class="field"><span>${t('mg.subDay')}</span><select name="day">${days}</select></label>
          <label class="field" id="sub-mode-field" hidden><span>${t('form.mode')}</span><select name="mode">${options('modes', MODES, '', t('form.modeNone'))}</select></label>
          <span class="error" id="sub-form-error" role="alert"></span>
          <button type="submit" class="btn btn-primary">${icon('plus')} ${t('mg.subAdd')}</button>
        </form>
        <h3>${t('mg.subList')}</h3>
        ${subs ? `<ul class="sub-list">${subs}</ul>` : `<p class="hint spaced-top">${t('mg.none')}</p>`}
      </section>
    </div>`;
}

function helpView() {
  const roles = [['Management', 'help.m', 'overview'], ['HQ Executive', 'help.h', 'list'], ['Depot In-charge', 'help.d', 'plus']];
  return pageHead(t('help.title'), t('help.sub'))
    + `<section class="panel">
         <h2>${t('help.pick')}</h2>
         <div class="role-cards">${roles.map(([r, text, ic]) => `
           <button type="button" class="role-card ${r === role ? 'is-current' : ''}" data-action="role" data-role="${r}">
             <span class="role-ic">${icon(ic)}</span><b>${t('role.' + r)}</b><span>${t(text)}</span>
           </button>`).join('')}</div>
         <h2 class="spaced">${t('help.stepsTitle')}</h2>
         <ol class="steps"><li>${t('help.s1')}</li><li>${t('help.s2')}</li><li>${t('help.s3')}</li></ol>
         <p class="notice">${t('help.demo')}</p>
         <h2 class="spaced">${t('help.dataTitle')}</h2>
         <ul class="plain"><li>${t('help.data1')}</li><li>${t('help.data2')}</li><li>${t('help.data3')}</li></ul>
       </section>`;
}

/* ---------- shell ---------- */

function navItems() {
  return role === 'Depot In-charge'
    ? [['My expenses', 'list', 'nav.mine'], ['Add expense', 'plus', 'nav.add'], ['Guide', 'help', 'nav.help']]
    : [['Overview', 'overview', 'nav.overview'], ['Expense register', 'list', 'nav.register'], ['Depot status', 'depot', 'nav.status'], ['Manage', 'settings', 'nav.manage'], ['Guide', 'help', 'nav.help']];
}

function renderChrome() {
  document.documentElement.lang = lang;
  document.title = `${t('appName')} · ACI`;
  $('#skip').textContent = t('skip');
  $('#brand-company').textContent = t('company');
  $('#brand-app').textContent = t('appName');
  $('#brand-app-compact').textContent = t('appName');
  $('#demo-note').textContent = t('demoNote');
  $('#reset').textContent = t('reset');
  $('#footer').textContent = t('footer');
  $('#role-label').textContent = t('viewAs');
  $('#role').innerHTML = ['Management', 'HQ Executive', 'Depot In-charge']
    .map((r) => `<option value="${r}" ${r === role ? 'selected' : ''}>${t('role.' + r)}</option>`).join('');
  document.querySelectorAll('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  const items = navItems();
  if (!items.some(([v]) => v === view)) view = items[0][0];
  $('#nav').innerHTML = items.map(([v, ic, label]) =>
    `<button type="button" data-action="nav" data-view="${v}" ${v === view ? 'aria-current="page"' : ''}>${icon(ic)}<span>${t(label)}</span></button>`).join('');
}

function render() {
  const focusId = document.activeElement && document.activeElement.id;
  const caret = document.activeElement && document.activeElement.selectionStart;
  renderChrome();
  const views = {
    'Overview': overviewView, 'Expense register': registerView, 'My expenses': registerView,
    'Depot status': statusView, 'Manage': manageView, 'Add expense': formView, 'Guide': helpView,
  };
  $('#content').innerHTML = views[view]();
  const again = focusId && document.getElementById(focusId);
  if (again && again !== document.body) {
    again.focus({ preventScroll: true });
    if (typeof caret === 'number' && again.setSelectionRange) { try { again.setSelectionRange(caret, caret); } catch { /* not a text input */ } }
  }
}

function navigate(nextView, { edit = null } = {}) {
  view = nextView;
  editId = edit;
  page = 1;
  render();
  window.scrollTo(0, 0);
  $('#content').focus({ preventScroll: true });
}

function switchRole(nextRole) {
  role = nextRole;
  filters = defaultFilters();
  moreOpen = false;
  navigate(navItems()[0][0]);
}

/* ---------- actions ---------- */

function exportCsv() {
  let list = filtered();
  if (view === 'Overview') list = list.filter((r) => r.status === 'Submitted');
  const cols = ['date', 'depot', 'business', 'head', 'amount', 'mode', 'status', 'note', 'source'];
  const cell = (v) => {
    let text = String(v ?? '');
    if (/^[=+@-]/.test(text)) text = "'" + text; // stop spreadsheet formula injection
    return '"' + text.replace(/"/g, '""') + '"';
  };
  const csv = '﻿' + [cols.join(','), ...list.map((r) => cols.map((k) => cell(r[k])).join(','))].join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `aci-expenses-${filters.from}-to-${filters.to}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  toast(t('exported', { n: num(list.length) }));
}

function setError(field, message) {
  const el = document.getElementById(field + '-error');
  if (el) el.textContent = message;
  const input = document.getElementById(field === 'amount' ? 'amount' : field === 'date' ? 'date-field' : field);
  if (input) input.setAttribute('aria-invalid', message ? 'true' : 'false');
}

function submitForm(form, status) {
  const data = Object.fromEntries(new FormData(form));
  const amount = parseAmount(data.amount);
  const needsMode = NEEDS_MODE.test(data.head);
  ['amount', 'date', 'mode'].forEach((f) => setError(f, ''));

  let firstBad = null;
  if (!Number.isFinite(amount) || amount <= 0) { setError('amount', t('err.amount')); firstBad ||= '#amount'; }
  if (!data.date) { setError('date', t('err.date')); firstBad ||= '#date-field'; }
  if (needsMode && !data.mode) { setError('mode', t('err.mode')); firstBad ||= '#mode'; }
  if (firstBad) { $(firstBad).focus(); return; }

  const record = {
    id: editId || nextId(),
    date: data.date, depot: data.depot, business: data.business, head: data.head,
    amount, mode: needsMode ? data.mode : '', status, note: data.note,
    source: 'Demo user entry',
  };
  if (editId) records[records.findIndex((x) => x.id === editId)] = record;
  else records.push(record);
  saveRecords();
  currentDepot = data.depot;

  if (record.date < filters.from) { filters.from = record.date; filters.period = 'custom'; }
  navigate('My expenses');
  toast(t(status === 'Draft' ? 'draftSaved' : 'submitted'));
}

document.addEventListener('click', (e) => {
  const lan = e.target.closest('[data-lang]');
  if (lan) { lang = lan.dataset.lang; writePref(LANG_KEY, lang); setLocale(); render(); return; }
  const el = e.target.closest('[data-action]');
  if (!el) { if (e.target.closest('#reset')) resetDemo(); return; }
  const { action } = el.dataset;
  const id = Number(el.dataset.id);

  if (action === 'nav') navigate(el.dataset.view);
  else if (action === 'period') { setPeriod(el.dataset.period); page = 1; render(); }
  else if (action === 'toggle-more') { moreOpen = !moreOpen; render(); }
  else if (action === 'clear') { filters = defaultFilters(); page = 1; render(); }
  else if (action === 'export') exportCsv();
  else if (action === 'add') navigate('Add expense');
  else if (action === 'view-all') navigate('Expense register');
  else if (action === 'prev') { page--; render(); }
  else if (action === 'next') { page++; render(); }
  else if (action === 'month') { chartIndex = Number(el.dataset.index); render(); }
  else if (action === 'role') switchRole(el.dataset.role);
  else if (action === 'cancel-form') navigate('My expenses');
  else if (action === 'sub-toggle') { const s = custom.subscriptions.find((x) => x.id === id); s.active = !s.active; saveCustom(); postSubscriptions(); render(); }
  else if (action === 'sub-delete') {
    if (confirm(t('mg.subDeleteConfirm'))) { custom.subscriptions = custom.subscriptions.filter((x) => x.id !== id); saveCustom(); render(); toast(t('mg.subDeleted')); }
  }
  else if (action === 'edit') navigate('Add expense', { edit: id });
  else if (action === 'submit-draft') {
    records.find((r) => r.id === id).status = 'Submitted';
    saveRecords(); render(); toast(t('submitted'));
  } else if (action === 'delete') {
    if (confirm(t('deleteConfirm'))) { records = records.filter((r) => r.id !== id); saveRecords(); render(); toast(t('deleted')); }
  } else if (action === 'depot-view') {
    filters.depot = el.dataset.depot; filters.from = filters.to; filters.period = 'custom';
    navigate('Expense register');
  }
});

document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.id === 'role') { switchRole(el.value); return; }
  if (el.id === 'sub-head') { $('#sub-mode-field').hidden = !NEEDS_MODE.test(el.value); return; }
  if (el.id === 'head-field') {
    const needs = NEEDS_MODE.test(el.value);
    $('#mode-field').hidden = !needs;
    if (!needs) $('#mode').value = '';
    return;
  }
  const key = el.dataset.filter;
  if (!key) return;
  const next = { ...filters };
  if (key === 'status-date') { next.to = el.value; if (next.from > next.to) next.from = next.to; next.period = 'custom'; }
  else { next[key] = el.value; if (key === 'from' || key === 'to') next.period = 'custom'; }
  if (next.from > next.to) { toast(t('f.badDates')); render(); return; }
  filters = next;
  page = 1;
  render();
});

document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.id === 'search') {
    filters.search = el.value;
    page = 1;
    $('#results').innerHTML = resultsHtml();
  } else if (el.id === 'amount') {
    const value = parseAmount(el.value);
    $('#amount-preview').textContent = Number.isFinite(value) && value > 0 ? `= ${money(value)}` : t('form.amountHint');
    setError('amount', '');
  }
});

function manageError(formId, message, field) {
  $('#' + formId + '-error').textContent = message;
  if (message && field) field.focus();
  return !message;
}
function nameTaken(list, value) {
  const key = value.toLowerCase();
  return list.some((x) => x.toLowerCase() === key) || Object.values(NAMES_BN[list === catalog.depots ? 'depots' : 'heads']).some((x) => x === value);
}
function addCatalogItem(form, kind) {
  const formId = kind === 'depots' ? 'depot-form' : 'head-form';
  const data = Object.fromEntries(new FormData(form));
  const value = data.name.trim().replace(/\s+/g, ' ');
  if (!manageError(formId, !value ? t('mg.errName') : nameTaken(catalog[kind], value) ? t('mg.errDup') : '', form.elements.name)) return;
  const bn = data.bn.trim();
  custom[kind].push({ name: value, bn });
  catalog[kind].push(value);
  if (bn) NAMES_BN[kind][value] = bn;
  saveCustom();
  render();
  toast(t(kind === 'depots' ? 'mg.depotAdded' : 'mg.headAdded', { name: name(kind, value) }));
}
function addSubscription(form) {
  const data = Object.fromEntries(new FormData(form));
  const title = data.title.trim();
  const amount = parseAmount(data.amount);
  const needsMode = NEEDS_MODE.test(data.head);
  const message = !title ? t('mg.errName') : !(amount > 0) ? t('err.amount') : needsMode && !data.mode ? t('err.mode') : '';
  const bad = !title ? form.elements.title : !(amount > 0) ? form.elements.amount : form.elements.mode;
  if (!manageError('sub-form', message, bad)) return;
  const sub = {
    id: Math.max(0, ...custom.subscriptions.map((x) => x.id)) + 1, title, amount, depot: data.depot, business: data.business,
    head: data.head, mode: needsMode ? data.mode : '', day: Number(data.day), active: true, lastPosted: '',
  };
  custom.subscriptions.push(sub);
  saveCustom();
  const posted = postSubscriptions();
  render();
  toast(t(posted ? 'mg.subPosted' : 'mg.subAdded', { day: num(sub.day) }));
}

document.addEventListener('submit', (e) => {
  const id = e.target.id;
  if (!['expense-form', 'depot-form', 'head-form', 'sub-form'].includes(id)) return;
  e.preventDefault();
  if (id === 'expense-form') submitForm(e.target, e.submitter ? e.submitter.value : 'Submitted');
  else if (id === 'sub-form') addSubscription(e.target);
  else addCatalogItem(e.target, id === 'depot-form' ? 'depots' : 'heads');
});

function resetDemo() {
  if (!confirm(t('resetConfirm'))) return;
  records = seed();
  custom.subscriptions.forEach((x) => { x.lastPosted = ''; });
  postSubscriptions();
  saveRecords();
  render();
  toast(t('resetDone'));
}

/* ---------- start ---------- */

setLocale();
renderChrome();
fetch('catalog.json')
  .then((r) => r.json())
  .then((c) => {
    catalog = c;
    base = { depots: [...c.depots], businesses: [...c.businesses], heads: [...c.heads] };
    loadCustom();
    try { records = JSON.parse(readPref(RECORDS_KEY)) || seed(); } catch { records = seed(); }
    postSubscriptions();
    render();
  })
  .catch(() => { $('#content').textContent = t('loadError'); });
