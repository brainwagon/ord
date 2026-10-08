// The shell: fetching, tabs, filters and rendering around the pure core
// (core.js). The shared table lives in table.js.
import { buildPages } from './core.js';
import { CORE_COLUMNS, BADGES, tableHtml, attachTable, fmtUsd, esc, extraPriceLines } from './table.js';

const CATALOGUE_URL = 'https://openrouter.ai/api/v1/models?output_modalities=all';

// All models' own columns, after the core ones.
const ALL_MODELS_COLUMNS = [
  { key: 'input', label: 'Input /1M', title: 'USD per 1M input tokens, as OpenRouter reports it', cell: r => priceCell(r.prices.input) },
  { key: 'output', label: 'Output /1M', title: 'USD per 1M output tokens, as OpenRouter reports it', cell: r => priceCell(r.prices.output) },
];

// Code's own columns. Cache, reasoning and web-search prices show on hover.
const CODE_COLUMNS = [
  { key: 'codingIndex', label: 'Coding', defaultDir: 'desc', title: 'Artificial Analysis coding index (higher is better)',
    cell: r => r.codingIndex === null ? '<td class="num note" title="no coding benchmark score yet">—</td>' : `<td class="num">${r.codingIndex.toFixed(1)}</td>` },
  { key: 'input', label: 'Input /1M', title: 'USD per 1M input tokens (base tier); hover a price for cache, reasoning and web-search prices', cell: r => priceCell(r.prices.input, extraPriceLines(r.extraPrices)) },
  { key: 'output', label: 'Output /1M', title: 'USD per 1M output tokens (base tier); hover a price for cache, reasoning and web-search prices', cell: r => priceCell(r.prices.output, extraPriceLines(r.extraPrices)) },
];

// Hash -> page id (the key buildPages returns rows under), tab label, and the
// page's columns after the core ones.
const PAGES = {
  new: { id: 'whatsNew', label: "What's new" },
  code: { id: 'code', label: 'Code', columns: CODE_COLUMNS, defaultSort: { key: 'codingIndex', dir: 'desc' }, controls: ['reasoningOnlyLabel'] },
  image: { id: 'image', label: 'Image' },
  audio: { id: 'audio', label: 'Audio' },
  video: { id: 'video', label: 'Video' },
  transcription: { id: 'transcription', label: 'Transcription' },
  decisions: { id: 'decisions', label: 'Decisions' },
  all: { id: 'allModels', label: 'All models', columns: ALL_MODELS_COLUMNS },
};
const DEFAULT_HASH = 'new';
const DEFAULT_NEW_WINDOW_DAYS = 30;

// What's new badges each Model with the Capability pages it appears on (page
// ids from the core), each a link to that page's tab.
const HASH_OF_PAGE = Object.fromEntries(Object.entries(PAGES).map(([hash, p]) => [p.id, hash]));
BADGES.pages = ids => ids.map(id =>
  `<a class="badge page" href="#${HASH_OF_PAGE[id]}" title="appears on the ${esc(PAGES[HASH_OF_PAGE[id]].label)} page">` +
  `${esc(PAGES[HASH_OF_PAGE[id]].label)}</a>`).join('');

const state = {
  catalogue: null, loadedAt: null, loading: false,
  // The core's settings; filters and sort carry across tabs.
  // A null sort (or a key the page lacks) means the page's own default order.
  settings: { author: '', search: '', hideFree: false, reasoningOnly: false,
    newWindowDays: DEFAULT_NEW_WINDOW_DAYS, sort: null },
  rows: [], columns: [],   // what the table is showing now
};

const $ = id => document.getElementById(id);

async function loadCatalogue() {
  if (state.loading) return;
  state.loading = true;
  $('refresh').disabled = true;
  $('retry').disabled = true;
  $('status').textContent = 'loading…';
  try {
    const res = await fetch(CATALOGUE_URL);
    if (!res.ok) throw new Error(`OpenRouter answered ${res.status} ${res.statusText}`.trim());
    const body = await res.json();
    if (!Array.isArray(body?.data)) throw new Error('OpenRouter sent an unexpected response');
    state.catalogue = body;
    state.loadedAt = Date.now();
    $('error').hidden = true;
  } catch (err) {
    $('errorText').textContent =
      `Couldn't load the model catalogue from OpenRouter: ${err.message}.` +
      (state.catalogue ? ' Showing the last catalogue loaded.' : '');
    $('error').hidden = false;
  } finally {
    state.loading = false;
    $('refresh').disabled = false;
    $('retry').disabled = false;
    render();
  }
}

function currentHash() {
  const h = location.hash.replace(/^#/, '');
  return PAGES[h] ? h : DEFAULT_HASH;
}

function render() {
  const hash = currentHash();
  for (const a of document.querySelectorAll('#tabs a')) {
    if (a.getAttribute('href') === '#' + hash) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  renderStatus();
  for (const el of document.querySelectorAll('[data-page-control]')) {
    el.hidden = !(PAGES[hash].controls || []).includes(el.id);
  }
  const page = $('page');
  if (!state.catalogue) {
    page.innerHTML = state.loading ? '<p class="placeholder">Loading the catalogue…</p>' : '';
    return;
  }
  const pages = buildPages({ catalogue: state.catalogue }, state.settings, Date.now());
  renderAuthors(pages.authors);
  const rows = pages[PAGES[hash].id];
  if (!rows) {
    state.rows = [];
    page.innerHTML = `<p class="placeholder">The ${esc(PAGES[hash].label)} page isn't built yet. ` +
      `See <a href="#all">All models</a> for the whole catalogue.</p>`;
    return;
  }
  state.rows = rows;
  state.columns = [...CORE_COLUMNS, ...(PAGES[hash].columns || [])];
  page.innerHTML = tableHtml(rows, state.columns, currentSort());
}

// The sort the table is showing: the viewer's, if this page has that column,
// else the page's default.
function currentSort() {
  const page = PAGES[currentHash()], sort = state.settings.sort;
  if (sort && state.columns.some(c => c.key === sort.key)) return sort;
  return page.defaultSort || { key: 'created', dir: 'desc' };
}

function renderAuthors(authors) {
  const sel = $('author');
  const want = ['', ...authors].join('\n');
  if (sel.dataset.authors !== want) {
    sel.dataset.authors = want;
    sel.innerHTML = '<option value="">All Authors</option>' +
      authors.map(a => `<option>${esc(a)}</option>`).join('');
  }
  sel.value = state.settings.author;
}

function renderStatus() {
  if (state.loading) { $('status').textContent = 'loading…'; return; }
  if (!state.loadedAt) { $('status').textContent = ''; return; }
  const mins = Math.floor((Date.now() - state.loadedAt) / 60000);
  const ago = mins < 1 ? 'just now' : `${mins} min ago`;
  $('status').textContent = `${state.catalogue.data.length} models, loaded ${ago}`;
}

// A Price cell; `extra` lines (other prices) are added to its hover text.
function priceCell(p, extra = []) {
  const more = extra.length ? 'Also (per 1M tokens unless noted): ' + extra.join(', ') : '';
  const title = t => ` title="${esc([t, more].filter(Boolean).join('\n'))}"`;
  if (p.kind === 'variable') return `<td class="num note"${title('price depends on the model the router picks')}>variable</td>`;
  if (p.kind === 'unpriced') return `<td class="num note"${title('OpenRouter lists no token price for this model')}>unpriced</td>`;
  return `<td class="num${more ? ' more' : ''}"${more ? title('') : ''}>${fmtUsd(p.usd)}</td>`;
}

function setSetting(patch) {
  Object.assign(state.settings, patch);
  render();
}

attachTable($('page'), {
  rows: () => state.rows,
  columns: () => state.columns,
  sort: () => currentSort(),
  onSort: sort => setSetting({ sort }),
});
$('author').addEventListener('change', e => setSetting({ author: e.target.value }));
$('search').addEventListener('input', e => setSetting({ search: e.target.value }));
$('newWindow').addEventListener('input', e => {
  const days = Math.floor(Number(e.target.value));
  if (days >= 1) setSetting({ newWindowDays: days });
});
$('hideFree').addEventListener('change', e => setSetting({ hideFree: e.target.checked }));
$('reasoningOnly').addEventListener('change', e => setSetting({ reasoningOnly: e.target.checked }));
$('refresh').addEventListener('click', loadCatalogue);
$('retry').addEventListener('click', loadCatalogue);
addEventListener('hashchange', render);
// Keep "loaded N min ago" honest. This only re-labels; it never refetches.
setInterval(renderStatus, 30_000);

render();
loadCatalogue();
