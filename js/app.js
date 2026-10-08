// The shell: fetching, tabs, filters and rendering around the pure core
// (core.js). The shared table lives in table.js.
import { buildPages } from './core.js';
import { browserStorage, loadSettings, saveSettings, clearSaved, loadTheme, saveTheme } from './store.js';
import { fetchJson } from './fetch-json.js';
import { CORE_COLUMNS, COST_COLUMN, registerBadges, tableHtml, attachTable, fmtUsd, esc, extraPriceLines, reasonHint } from './table.js';
import { imageView } from './image-view.js';
import { audioView } from './audio-view.js';
import { videoView } from './video-view.js';
import { transcriptionView } from './transcription-view.js';
import { decisionsView } from './decisions-view.js';

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

// Browser storage, or null where it's missing or blocked; store.js guards every access.
const storage = browserStorage();

/**
 * What every Capability page's view (js/<page>-view.js) is given.
 * @typedef {{rerender: (opts?: {keepOrder?: boolean}) => void, storage: Storage|null}} ViewShell
 *
 * A page view is {id, label, columns?, description?, intro?, notice?, onShow?,
 * sources?, badges?, controls?, defaultSort?}: `id` is the key buildPages
 * returns its rows under; `columns` follow the core ones (a page with a
 * Workload also gets the cost column); `description` is one or two plain
 * sentences saying what the page lists, shown first; `intro` and `notice()`
 * are html above the table;
 * `onShow()` runs each time the tab is shown (to fetch extra pricing data
 * once); `sources()` adds that data to the core's sources; `badges` are its
 * rows' own badge renderers; `controls` the ids of filter controls it shows.
 * `rerender({keepOrder: true})` redraws without re-sorting, for data that
 * streams in while the viewer may be reading.
 */
const shell = { rerender: opts => render(opts), storage };

// Hash -> page view, in tab order.
const PAGES = {
  new: { id: 'whatsNew', label: "What's new",
    description: 'Every New model of any kind, added within the "New within" window (30 days by default). Each is badged with the Capability pages it also appears on.' },
  code: { id: 'code', label: 'Code', columns: CODE_COLUMNS, defaultSort: { key: 'codingIndex', dir: 'desc' }, controls: ['reasoningOnlyLabel'],
    description: 'Models whose output is text, excluding Decisions, embedding and rerank Models, ranked by their Artificial Analysis coding index and priced per 1M input and output tokens.' },
  image: imageView(shell),
  audio: audioView(shell),
  video: videoView(shell),
  transcription: transcriptionView(shell),
  decisions: decisionsView(shell),
  all: { id: 'allModels', label: 'All models', columns: ALL_MODELS_COLUMNS,
    description: "Every Model in OpenRouter's catalogue, of any kind, including the ~…-latest aliases, with its token prices as OpenRouter reports them." },
};
const DEFAULT_HASH = 'new';
const DEFAULT_NEW_WINDOW_DAYS = 30;

// What's new badges each Model with the Capability pages it appears on (page
// ids from the core), each a link to that page's tab. Pages' own badges are
// registered alongside.
const HASH_OF_PAGE = Object.fromEntries(Object.entries(PAGES).map(([hash, p]) => [p.id, hash]));
registerBadges({
  pages: ids => ids.map(id =>
    `<a class="badge page" href="#${HASH_OF_PAGE[id]}" title="appears on the ${esc(PAGES[HASH_OF_PAGE[id]].label)} page">` +
    `${esc(PAGES[HASH_OF_PAGE[id]].label)}</a>`).join(''),
});
for (const page of Object.values(PAGES)) registerBadges(page.badges || {});

// The core's settings as a first-time viewer gets them; filters and sort
// carry across tabs. A null sort (or a key the page lacks) means the page's
// own default order. `workloads` holds each page's Workload values by page
// id; an absent page uses its inputs' defaults.
// Every key here is remembered in the browser (store.js), so a new setting
// only needs adding here.
const DEFAULT_SETTINGS = { author: '', search: '', hideFree: false, reasoningOnly: false,
  newWindowDays: DEFAULT_NEW_WINDOW_DAYS, sort: null, workloads: {} };

const state = {
  catalogue: null, loadedAt: null, loading: false,
  settings: loadSettings(storage, DEFAULT_SETTINGS),
  theme: loadTheme(storage),   // 'light', 'dark', or null to follow the system
  rows: [], columns: [],   // what the table is showing now
  shown: null,             // {hash, ids}: the page and row order last shown
  workloadInputs: [],      // the Workload panel's inputs
};

const $ = id => document.getElementById(id);

async function loadCatalogue() {
  if (state.loading) return;
  state.loading = true;
  $('refresh').disabled = true;
  $('retry').disabled = true;
  $('status').textContent = 'loading…';
  try {
    state.catalogue = await fetchJson(CATALOGUE_URL, b => Array.isArray(b?.data));
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

// Rendering re-sorts the table, except with `keepOrder` (data arriving
// without the viewer doing anything): then the rows on screen keep their
// places while their values update (user story 48).
function render({ keepOrder = false } = {}) {
  const hash = currentHash(), view = PAGES[hash];
  for (const a of document.querySelectorAll('#tabs a')) {
    if (a.getAttribute('href') === '#' + hash) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  renderStatus();
  view.onShow?.();   // a page's extra pricing data, fetched on first view
  for (const el of document.querySelectorAll('[data-page-control]')) {
    el.hidden = !(view.controls || []).includes(el.id);
  }
  const sources = Object.assign({ catalogue: state.catalogue || { data: [] } },
    ...Object.values(PAGES).map(p => p.sources?.()));
  const held = keepOrder && state.shown?.hash === hash ? { [view.id]: state.shown.ids } : undefined;
  const pages = buildPages(sources, { ...state.settings, holdOrder: held }, Date.now());
  const workload = pages.workloads[view.id];
  renderWorkload(view.id, workload);
  const page = $('page');
  if (!state.catalogue) {
    page.innerHTML = state.loading ? '<p class="placeholder">Loading the catalogue…</p>' : '';
    return;
  }
  renderAuthors(pages.authors);
  const rows = pages[view.id];
  state.rows = rows;
  state.shown = { hash, ids: rows.map(r => r.id) };
  state.columns = [...CORE_COLUMNS, ...(view.columns || []), ...(workload ? [COST_COLUMN] : [])];
  const description = view.description ? `<p class="page-description">${esc(view.description)}</p>` : '';
  page.innerHTML = description + (view.intro || '') + (view.notice?.() || '') + tableHtml(rows, state.columns, currentSort());
}

// The sort the table is showing: the viewer's, if this page has that column,
// else the page's default.
function currentSort() {
  const page = PAGES[currentHash()], sort = state.settings.sort;
  if (sort && state.columns.some(c => c.key === sort.key)) return sort;
  return page.defaultSort || { key: 'created', dir: 'desc' };
}

// The Workload panel: the current page's inputs and values, from buildPages.
// Rebuilt only when the page changes, so typing keeps focus; the count hints
// follow the values in use.
function renderWorkload(pageId, workload) {
  const panel = $('workload');
  panel.hidden = !workload;
  if (!workload) return;
  const { inputs, values } = workload;
  if (panel.dataset.page !== pageId) {
    panel.dataset.page = pageId;
    panel.innerHTML = '<span class="wl-title" title="the work each Model is costed for">Workload</span>' +
      inputs.map(i => `<label>${esc(i.label)} ${i.options
        ? `<select data-workload="${esc(i.key)}">${i.options.map(o =>
            `<option value="${esc(o.value)}"${o.value === values[i.key] ? ' selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`
        : `<input data-workload="${esc(i.key)}" type="number" min="${i.min ?? 0}" step="${i.step ?? 'any'}" ` +
          `value="${values[i.key]}" inputmode="decimal"><span class="wl-hint" data-hint="${esc(i.key)}"></span>`
      }</label>`).join('');
    state.workloadInputs = inputs;
  }
  for (const hint of panel.querySelectorAll('[data-hint]')) hint.textContent = fmtCount(values[hint.dataset.hint]);
}

// 3000000 -> "3M", for reading big counts at a glance.
function fmtCount(n) {
  if (n >= 1e6) return +(n / 1e6).toPrecision(4) + 'M';
  if (n >= 1e3) return +(n / 1e3).toPrecision(4) + 'K';
  return '';
}

function setWorkload(key, raw) {
  const panel = $('workload'), pageId = panel.dataset.page;
  const input = state.workloadInputs.find(i => i.key === key);
  // Choices keep their declared value (which may not be a string).
  const value = input.options ? input.options.find(o => String(o.value) === raw)?.value : raw;
  state.settings.workloads = { ...state.settings.workloads,
    [pageId]: { ...state.settings.workloads[pageId], [key]: value } };
  saveSettings(storage, state.settings);
  render();
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
  if (p.kind === 'reason') return `<td class="num note"${title(reasonHint(p.reason))}>${esc(p.reason)}</td>`;
  return `<td class="num${more ? ' more' : ''}"${more ? title('') : ''}>${fmtUsd(p.usd)}</td>`;
}

function setSetting(patch) {
  Object.assign(state.settings, patch);
  saveSettings(storage, state.settings);
  render();
}

// Put the settings into the filter inputs (on load and after Reset view).
// The Author list and Workload panel follow the settings as they render.
function showSettings() {
  $('search').value = state.settings.search;
  $('hideFree').checked = state.settings.hideFree;
  $('reasoningOnly').checked = state.settings.reasoningOnly;
  $('newWindow').value = state.settings.newWindowDays;
  delete $('workload').dataset.page;   // rebuild it from the settings
}

const THEME_LABELS = { null: 'system', light: 'light', dark: 'dark' };
function showTheme() {
  if (state.theme) document.documentElement.dataset.theme = state.theme;
  else delete document.documentElement.dataset.theme;
  $('theme').textContent = `Theme: ${THEME_LABELS[state.theme]}`;
}

function resetView() {
  clearSaved(storage);
  state.settings = structuredClone(DEFAULT_SETTINGS);
  state.theme = null;
  showSettings();
  showTheme();
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
$('workload').addEventListener('input', e => {
  const key = e.target.dataset.workload;
  if (key) setWorkload(key, e.target.value);
});
$('theme').addEventListener('click', () => {
  // system -> light -> dark -> system
  state.theme = { null: 'light', light: 'dark', dark: null }[state.theme];
  saveTheme(storage, state.theme);
  showTheme();
});
$('reset').addEventListener('click', resetView);
$('refresh').addEventListener('click', loadCatalogue);
$('retry').addEventListener('click', loadCatalogue);
addEventListener('hashchange', render);
// Keep "loaded N min ago" honest. This only re-labels; it never refetches.
setInterval(renderStatus, 30_000);

showSettings();
showTheme();
render();
loadCatalogue();
