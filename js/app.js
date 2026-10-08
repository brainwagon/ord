// The shell: fetching, tabs and rendering around the pure core (core.js).
import { buildPages } from './core.js';

const CATALOGUE_URL = 'https://openrouter.ai/api/v1/models?output_modalities=all';

// Hash -> page id (the key buildPages returns rows under) and tab label.
const PAGES = {
  new: { id: 'whatsNew', label: "What's new" },
  code: { id: 'code', label: 'Code' },
  image: { id: 'image', label: 'Image' },
  audio: { id: 'audio', label: 'Audio' },
  video: { id: 'video', label: 'Video' },
  transcription: { id: 'transcription', label: 'Transcription' },
  decisions: { id: 'decisions', label: 'Decisions' },
  all: { id: 'allModels', label: 'All models' },
};
const DEFAULT_HASH = 'new';

const state = { catalogue: null, loadedAt: null, loading: false };

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
  const pages = buildPages({ catalogue: state.catalogue }, {}, Date.now());
  const rows = pages[PAGES[hash].id];
  if (!rows) {
    page.innerHTML = `<p class="placeholder">The ${esc(PAGES[hash].label)} page isn't built yet. ` +
      `See <a href="#all">All models</a> for the whole catalogue.</p>`;
    return;
  }
  page.innerHTML = allModelsTable(rows);
}

function renderStatus() {
  if (state.loading) { $('status').textContent = 'loading…'; return; }
  if (!state.loadedAt) { $('status').textContent = ''; return; }
  const mins = Math.floor((Date.now() - state.loadedAt) / 60000);
  const ago = mins < 1 ? 'just now' : `${mins} min ago`;
  $('status').textContent = `${state.catalogue.data.length} models, loaded ${ago}`;
}

function allModelsTable(rows) {
  const body = rows.map(r => `<tr>
    <td><a class="mid" href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.id)}</a>` +
      `<span class="mname">${esc(r.name)}</span></td>
    <td class="left">${esc(r.author)}</td>
    <td class="num">${fmtDate(r.created)}</td>
    <td class="num">${fmtContext(r.contextLength)}</td>
    ${priceCell(r.prices.input)}
    ${priceCell(r.prices.output)}
  </tr>`).join('');
  return `<table>
    <thead><tr>
      <th>Model</th><th class="left">Author</th><th>Added</th><th>Context</th>
      <th title="USD per 1M input tokens, as OpenRouter reports it">Input /1M</th>
      <th title="USD per 1M output tokens, as OpenRouter reports it">Output /1M</th>
    </tr></thead>
    <tbody>${body}</tbody>
  </table>`;
}

function priceCell(p) {
  if (p.kind === 'variable') return '<td class="num note" title="price depends on the model the router picks">variable</td>';
  if (p.kind === 'unpriced') return '<td class="num note" title="OpenRouter lists no token price for this model">unpriced</td>';
  return `<td class="num">${fmtUsd(p.usd)}</td>`;
}

function fmtUsd(v) {
  if (v === 0) return '$0';
  if (v >= 1) return '$' + v.toFixed(2);
  if (v >= 0.01) return '$' + v.toFixed(3);
  return '$' + v.toPrecision(2);
}

// Some context windows are binary (262144), others decimal (1000000); print
// each in whichever unit comes out round.
function fmtContext(n) {
  if (!n) return '—';
  const v = n / (n % 1024 === 0 ? 1024 : 1000);
  if (v < 1000) return Math.round(v) + 'K';
  const m = v / 1000;
  return (Math.abs(m - Math.round(m)) < 0.05 ? Math.round(m) : m.toFixed(1)) + 'M';
}

function fmtDate(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

$('refresh').addEventListener('click', loadCatalogue);
$('retry').addEventListener('click', loadCatalogue);
addEventListener('hashchange', render);
// Keep "loaded N min ago" honest. This only re-labels; it never refetches.
setInterval(renderStatus, 30_000);

render();
loadCatalogue();
