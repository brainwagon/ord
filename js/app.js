// The shell: fetching, tabs, filters and rendering around the pure core
// (core.js). The shared table lives in table.js.
import { buildPages } from './core.js';
import { CORE_COLUMNS, tableHtml, attachTable, fmtUsd, esc } from './table.js';

const CATALOGUE_URL = 'https://openrouter.ai/api/v1/models?output_modalities=all';

// All models' own columns, after the core ones.
const ALL_MODELS_COLUMNS = [
  { key: 'input', label: 'Input /1M', title: 'USD per 1M input tokens, as OpenRouter reports it', cell: r => priceCell(r.prices.input) },
  { key: 'output', label: 'Output /1M', title: 'USD per 1M output tokens, as OpenRouter reports it', cell: r => priceCell(r.prices.output) },
];

// Hash -> page id (the key buildPages returns rows under), tab label, and the
// page's columns after the core ones.
const PAGES = {
  new: { id: 'whatsNew', label: "What's new" },
  code: { id: 'code', label: 'Code' },
  image: { id: 'image', label: 'Image' },
  audio: { id: 'audio', label: 'Audio' },
  video: { id: 'video', label: 'Video' },
  transcription: { id: 'transcription', label: 'Transcription' },
  decisions: { id: 'decisions', label: 'Decisions' },
  all: { id: 'allModels', label: 'All models', columns: ALL_MODELS_COLUMNS },
};
const DEFAULT_HASH = 'new';

const state = {
  catalogue: null, loadedAt: null, loading: false,
  // The core's settings; filters and sort carry across tabs.
  settings: { author: '', search: '', hideFree: false, sort: { key: 'created', dir: 'desc' } },
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
  page.innerHTML = tableHtml(rows, state.columns, state.settings.sort);
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

function priceCell(p) {
  if (p.kind === 'variable') return '<td class="num note" title="price depends on the model the router picks">variable</td>';
  if (p.kind === 'unpriced') return '<td class="num note" title="OpenRouter lists no token price for this model">unpriced</td>';
  return `<td class="num">${fmtUsd(p.usd)}</td>`;
}

function setSetting(patch) {
  Object.assign(state.settings, patch);
  render();
}

attachTable($('page'), {
  rows: () => state.rows,
  columns: () => state.columns,
  sort: () => state.settings.sort,
  onSort: sort => setSetting({ sort }),
});
$('author').addEventListener('change', e => setSetting({ author: e.target.value }));
$('search').addEventListener('input', e => setSetting({ search: e.target.value }));
$('hideFree').addEventListener('change', e => setSetting({ hideFree: e.target.checked }));
$('refresh').addEventListener('click', loadCatalogue);
$('retry').addEventListener('click', loadCatalogue);
addEventListener('hashchange', render);
// Keep "loaded N min ago" honest. This only re-labels; it never refetches.
setInterval(renderStatus, 30_000);

render();
loadCatalogue();
