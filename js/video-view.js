// The Video page's part of the shell (app.js): its rate columns, its "silent"
// badge, and the video-models listing, fetched the first time the tab is
// opened (with a Retry when it fails). The pricing itself is in the core
// (js/video.js).
import { esc, fmtUsd } from './table.js';
import { fetchJson } from './fetch-json.js';

const VIDEO_MODELS_URL = 'https://openrouter.ai/api/v1/videos/models';

// A per-second rate cell; hover lists the listing's raw SKUs and any minimum.
function rateCell(r, rate) {
  const lines = [];
  if (r.minimumUsd) lines.push(`minimum ${fmtUsd(r.minimumUsd)} per clip`);
  if (r.skus) lines.push('OpenRouter pricing_skus:', ...Object.entries(r.skus).map(([k, v]) => `${k}: ${v}`));
  if (rate.kind === 'usd') {
    const title = lines.length ? ` title="${esc(lines.join('\n'))}"` : '';
    return `<td class="num${lines.length ? ' more' : ''}"${title}>${fmtUsd(rate.usd)}</td>`;
  }
  return `<td class="num note" title="${esc([rate.reason, ...lines].join('\n'))}">—</td>`;
}

const COLUMNS = [
  { key: 'withAudio', label: 'With audio /s', title: "USD per second of video with audio, at the Model's base resolution; hover for every SKU",
    cell: r => rateCell(r, r.rates.withAudio) },
  { key: 'withoutAudio', label: 'Without audio /s', title: "USD per second of video without audio, at the Model's base resolution; hover for every SKU",
    cell: r => rateCell(r, r.rates.withoutAudio) },
];

const BADGES = {
  silent: v => v ? '<span class="badge" title="makes video without an audio track">silent</span>' : '',
};

/**
 * The Video page's view (see the page views in app.js).
 * @param {import('./app.js').ViewShell} shell
 */
export function videoView({ rerender }) {
  let data = null, status = 'idle', error = '';   // idle | loading | loaded | failed

  async function load() {
    if (status === 'loading') return;
    status = 'loading';
    rerender();
    try {
      data = await fetchJson(VIDEO_MODELS_URL, b => Array.isArray(b?.data));
      status = 'loaded';
    } catch (err) {
      error = err.message;
      status = 'failed';
    }
    rerender();   // one batch: the table re-sorts once, now
  }

  document.addEventListener('click', e => {
    if (e.target.closest('[data-video-retry]')) load();
  });

  return {
    id: 'video',
    label: 'Video',
    description: 'Models that output video, priced per second of video, with and without audio.',
    columns: COLUMNS,
    badges: BADGES,
    onShow: () => { if (status === 'idle') load(); },
    notice: () => {
      if (status === 'loading') return '<p class="placeholder" role="status">loading prices…</p>';
      if (status !== 'failed') return '';
      return `<div class="error video-error"><p>Couldn't load video prices from OpenRouter: ${esc(error)}.</p>` +
        '<button type="button" data-video-retry>Retry</button></div>';
    },
    sources: () => (data ? { videoModels: data } : {}),
  };
}
