// The Video page's shell: its columns, its "silent" badge, and the
// video-models listing, fetched the first time the tab is opened (with a
// Retry when it fails). The pricing itself is in the core (core.js,
// video-pricing.js).
import { BADGES, esc, fmtUsd } from './table.js';

const VIDEO_MODELS_URL = 'https://openrouter.ai/api/v1/videos/models';

BADGES.silent = v => v ? '<span class="badge" title="makes video without an audio track">silent</span>' : '';

// A per-second rate cell; hover lists the listing's raw SKUs and any minimum.
function rateCell(r, rate) {
  const lines = [];
  if (r.minimumUsd) lines.push(`minimum ${fmtUsd(r.minimumUsd)} per clip`);
  if (r.skus) lines.push('OpenRouter pricing_skus:', ...Object.entries(r.skus).map(([k, v]) => `${k}: ${v}`));
  const title = lines.length ? ` title="${esc(lines.join('\n'))}"` : '';
  if (rate.kind === 'usd') return `<td class="num${lines.length ? ' more' : ''}"${title}>${fmtUsd(rate.usd)}</td>`;
  return `<td class="num note"${title}>—</td>`;
}

const COLUMNS = [
  { key: 'withAudio', label: 'With audio /s', title: "USD per second of video with audio, at the Model's base resolution; hover for every SKU",
    cell: r => rateCell(r, r.rates.withAudio) },
  { key: 'withoutAudio', label: 'Without audio /s', title: "USD per second of video without audio, at the Model's base resolution; hover for every SKU",
    cell: r => rateCell(r, r.rates.withoutAudio) },
];

/**
 * The Video page's entry in the shell's page table. `rerender` is called when
 * the listing arrives or fails.
 * @returns {{id, label, columns, onShow: () => void, notice: () => string,
 *   sources: () => {videoModels?: object}}}
 */
export function videoPage(rerender) {
  let data = null, status = 'idle', error = '';   // idle | loading | loaded | failed

  async function load() {
    if (status === 'loading') return;
    status = 'loading';
    rerender();
    try {
      const res = await fetch(VIDEO_MODELS_URL);
      if (!res.ok) throw new Error(`OpenRouter answered ${res.status} ${res.statusText}`.trim());
      const body = await res.json();
      if (!Array.isArray(body?.data)) throw new Error('OpenRouter sent an unexpected response');
      data = body;
      status = 'loaded';
    } catch (err) {
      error = err.message;
      status = 'failed';
    }
    rerender();
  }

  document.addEventListener('click', e => {
    if (e.target.closest('[data-video-retry]')) load();
  });

  return {
    id: 'video',
    label: 'Video',
    columns: COLUMNS,
    onShow: () => { if (status === 'idle') load(); },
    notice: () => {
      if (status === 'loading') return '<p class="placeholder">Loading video prices…</p>';
      if (status !== 'failed') return '';
      return `<div class="error video-error"><p>Couldn't load video prices from OpenRouter: ${esc(error)}.</p>` +
        '<button type="button" data-video-retry>Retry</button></div>';
    },
    sources: () => (data ? { videoModels: data } : {}),
  };
}
