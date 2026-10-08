// The table every page shares: core columns, badges, sortable headers, the
// expandable description row and click-to-copy ids. Pages plug in their own
// columns after the core ones; row order always comes from the core.
import { REASONS } from './pricing.js';

/**
 * A column: {key, label, title?, left?, defaultDir?, cell(row) -> '<td…>' html}.
 * `key` is the core's sort key for it; `defaultDir` is the direction its first
 * click sorts in ('asc' unless given).
 */
export const CORE_COLUMNS = [
  { key: 'name', label: 'Model', left: true, cell: modelCell },
  { key: 'author', label: 'Author', left: true, cell: r => `<td class="left">${esc(r.author)}</td>` },
  { key: 'created', label: 'Added', defaultDir: 'desc', cell: r => `<td class="num">${fmtDate(r.created)}</td>` },
  { key: 'contextLength', label: 'Context', defaultDir: 'desc', cell: r => `<td class="num">${fmtContext(r.contextLength)}</td>` },
];

/**
 * The cost column every page with a Workload gets (the shell adds it after the
 * page's own columns). A row's `cost` is a USD amount, or "—" with the reason
 * it can't be computed on hover.
 */
export const COST_COLUMN = {
  key: 'cost', label: 'Cost', title: 'USD for the Workload above; "—" when it can\'t be computed (hover for why)',
  cell: r => costCell(r.cost),
};

// Hover text for each reason a price or cost is unavailable (js/pricing.js).
const REASON_HINTS = {
  [REASONS.perToken]: 'billed by the token, so no cost for this Workload',
  [REASONS.unpriced]: 'OpenRouter lists no price for this model',
  [REASONS.unitUnclear]: "the price's unit is unclear, so no cost is computed",
  [REASONS.variable]: 'price depends on the model the router picks',
  [REASONS.notLoaded]: "this page's pricing data hasn't loaded",
  [REASONS.byResolution]: 'the rate depends on the output resolution, which the Workload doesn\'t set',
};

/** The hover text explaining a reason. */
export const reasonHint = reason => REASON_HINTS[reason] || reason;

/** A cell for a Price or Cost: the USD amount, or "—" and the reason (hover for why). */
export function costCell(c) {
  if (c.kind === 'usd') return `<td class="num cost">${fmtUsd(c.usd)}</td>`;
  const hint = REASON_HINTS[c.reason];
  return `<td class="num note reason" tabindex="0" title="${esc(hint ? `${c.reason}: ${hint}` : c.reason)}">` +
    `—<span class="why">${esc(c.reason)}</span></td>`;
}

/**
 * Badge renderers, keyed by the name in a row's `badges`. Each turns the
 * badge's value into html, or '' when the badge doesn't apply. These are
 * the shared ones; the shell registers pages' own (registerBadges).
 */
const BADGES = {
  new: v => v ? '<span class="badge new" title="added within the &quot;new&quot; window">new</span>' : '',
  free: v => v ? '<span class="badge free">free</span>' : '',
  expires: v => v ? `<span class="badge warn" title="OpenRouter has scheduled this model for removal">expires ${esc(v)}</span>` : '',
  reasoning: v => v ? '<span class="badge reasoning" title="supports reasoning">reasoning</span>' : '',
  tiered: tiers => tiers ? `<span class="badge tiered" tabindex="0" title="${esc(tiersTitle(tiers))}">tiered</span>` : '',
};

/** Add badge renderers ({name: value => html}) for rows' `badges`. */
export function registerBadges(renderers) {
  Object.assign(BADGES, renderers);
}

// The hover text for a tiered badge: each tier's higher rates.
function tiersTitle(tiers) {
  return tiers.map(t =>
    `Prompts over ${t.minPromptTokens.toLocaleString('en-US')} tokens, per 1M: ` +
    [`input ${fmtPrice(t.input)}`, `output ${fmtPrice(t.output)}`, ...extraPriceLines(t.extraPrices)].join(', ')
  ).join('\n');
}

const EXTRA_PRICE_LABELS = {
  cacheRead: 'cache read', cacheWrite: 'cache write', cacheWrite1h: 'cache write (1h)', reasoning: 'reasoning',
};

/**
 * Lines describing a row's `extraPrices` (per 1M tokens; web search per
 * search), for hover text. Empty when there are none.
 */
export function extraPriceLines(extra = {}) {
  const lines = Object.entries(EXTRA_PRICE_LABELS)
    .filter(([k]) => extra[k]).map(([k, label]) => `${label} ${fmtPrice(extra[k])}`);
  if (extra.webSearch) lines.push(`web search ${fmtPrice(extra.webSearch)}/search`);
  return lines;
}

/** A Price as plain text: "$1.25", or its reason ("variable", "unpriced", …). */
export function fmtPrice(p) {
  return p.kind === 'usd' ? fmtUsd(p.usd) : p.reason;
}

const expanded = new Set();   // ids whose description is showing

/**
 * The table's html.
 * @param {object[]} rows the page's rows, in the core's order
 * @param {object[]} columns usually [...CORE_COLUMNS, ...the page's columns]
 * @param {{key, dir}} [sort] the current sort, to mark its header
 */
export function tableHtml(rows, columns, sort = {}) {
  const head = columns.map(c => {
    const dir = sort.key === c.key ? sort.dir : null;
    const aria = dir ? ` aria-sort="${dir === 'asc' ? 'ascending' : 'descending'}"` : '';
    const arrow = dir ? (dir === 'asc' ? ' ▲' : ' ▼') : '';
    return `<th${c.left ? ' class="left"' : ''}${aria}>` +
      `<button type="button" class="sort" data-sort="${esc(c.key)}" data-dir="${c.defaultDir || 'asc'}"` +
      `${c.title ? ` title="${esc(c.title)}"` : ''}>${esc(c.label)}${arrow}</button></th>`;
  }).join('');
  if (!rows.length) {
    return `<table><thead><tr>${head}</tr></thead></table><p class="placeholder">No models match.</p>`;
  }
  const body = rows.map(r => {
    const open = expanded.has(r.id);
    return `<tr class="model${open ? ' open' : ''}" data-id="${esc(r.id)}" aria-expanded="${open}">` +
      columns.map(c => c.cell(r)).join('') + '</tr>' +
      (open ? descRow(r, columns.length) : '');
  }).join('');
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

/**
 * Wires a container's tables once: header clicks call onSort({key, dir}),
 * id clicks copy the id, other row clicks toggle the description.
 * @param {HTMLElement} container
 * @param {{rows: () => object[], columns: () => object[], sort: () => object,
 *   onSort: (sort) => void}} page
 */
export function attachTable(container, page) {
  container.addEventListener('click', e => {
    const sortBtn = e.target.closest('button.sort');
    if (sortBtn) {
      const key = sortBtn.dataset.sort, cur = page.sort();
      const flip = { asc: 'desc', desc: 'asc' };
      page.onSort({ key, dir: cur.key === key ? flip[cur.dir] : sortBtn.dataset.dir });
      return;
    }
    const idBtn = e.target.closest('button.mid');
    if (idBtn) { copyText(idBtn.dataset.id, idBtn); return; }
    if (e.target.closest('a, button, input, select')) return;
    if (getSelection().toString()) return;   // don't toggle when selecting text
    const tr = e.target.closest('tr.model');
    if (tr) toggle(tr, page);
  });
}

function toggle(tr, page) {
  const id = tr.dataset.id;
  const open = !expanded.has(id);
  if (open) expanded.add(id); else expanded.delete(id);
  tr.classList.toggle('open', open);
  tr.setAttribute('aria-expanded', open);
  if (open) {
    const row = page.rows().find(r => r.id === id);
    tr.insertAdjacentHTML('afterend', descRow(row, page.columns().length));
  } else if (tr.nextElementSibling?.classList.contains('desc')) {
    tr.nextElementSibling.remove();
  }
}

function descRow(r, span) {
  const text = r.description ? esc(r.description) : '<em>OpenRouter gives no description.</em>';
  return `<tr class="desc"><td colspan="${span}">${text}</td></tr>`;
}

function modelCell(r) {
  const badges = Object.entries(r.badges || {})
    .map(([name, v]) => BADGES[name]?.(v) || '').join('');
  return `<td class="left model-cell">` +
    `<span class="mname">${esc(r.name)}</span>${badges}` +
    `<span class="idline"><button type="button" class="mid" data-id="${esc(r.id)}" title="click to copy the model id">${esc(r.id)}</button>` +
    `<a class="ext" href="${esc(r.url)}" target="_blank" rel="noopener" title="open on OpenRouter" aria-label="open ${esc(r.name)} on OpenRouter">↗</a></span>` +
    `</td>`;
}

function copyText(text, el) {
  const done = () => {
    el.classList.add('copied');
    setTimeout(() => el.classList.remove('copied'), 900);
  };
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(done).catch(() => legacyCopy(text, done));
  } else {
    legacyCopy(text, done);
  }
}

// For plain-http hosts and browsers without the async clipboard.
function legacyCopy(text, done) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
  document.body.appendChild(ta);
  ta.select();
  try { if (document.execCommand('copy')) done(); } catch {}
  ta.remove();
}

export function fmtUsd(v) {
  if (v === 0) return '$0';
  if (v >= 1) return '$' + v.toFixed(2);
  if (v >= 0.01) return '$' + v.toFixed(3);
  return '$' + v.toPrecision(2);
}

// Some context windows are binary (262144), others decimal (1000000); print
// each in whichever unit comes out round.
export function fmtContext(n) {
  if (!n) return '—';
  const v = n / (n % 1024 === 0 ? 1024 : 1000);
  if (v < 1000) return Math.round(v) + 'K';
  const m = v / 1000;
  return (Math.abs(m - Math.round(m)) < 0.05 ? Math.round(m) : m.toFixed(1)) + 'M';
}

export function fmtDate(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

export function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
