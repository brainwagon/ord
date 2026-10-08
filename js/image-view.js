// The Image page's part of the shell (app.js): its per-image price column,
// and its extra pricing data, fetched only once the tab is first opened:
// OpenRouter's image-models listing, then each listed Model's endpoints
// resource (its per-image prices), a few at a time. Every response is kept in
// browser storage for several hours; a failed request is never stored, so
// it's retried on the next visit. The core (js/image.js) prices from what
// `sources()` returns, so rows fill in as responses arrive, and the other
// tabs never wait on any of this.
import { esc, costCell } from './table.js';
import { fetchJson } from './fetch-json.js';
import { loadJson, saveJson } from './store.js';

// The per-image price used for the Workload's resolution, with the resolution
// it's for ("$0.048 @1K", "~$0.039 @1K" for an estimate), or "—" and the reason.
const COLUMNS = [
  { key: 'perImage', label: 'Per image', title: "USD per image at the Workload's resolution (or the closest the Model offers); \"~\" marks an estimate from the Author's docs (hover for how); \"—\" when there's no per-image price (hover for why)",
    cell: r => costCell(r.perImage, r.perImageAt ? ` <span class="at">@${esc(r.perImageAt)}</span>` : '') },
];

const API_ORIGIN = 'https://openrouter.ai';
const LISTING_URL = API_ORIGIN + '/api/v1/images/models';
const CACHE_KEY = 'ord.imagePricing.v1';   // bump when the cached shape changes
const TTL_MS = 6 * 60 * 60 * 1000;          // image prices change slowly
const CONCURRENCY = 4;
const REDRAW_MS = 250;                      // batch redraws as responses land

/**
 * The Image page's view (see the page views in app.js).
 * @param {import('./app.js').ViewShell} shell
 */
export function imageView({ rerender, storage }) {
  // cache: {models: {at, body}, endpoints: {[id]: {at, body}}}, fresh entries only.
  const cache = freshCache(loadJson(storage, CACHE_KEY), Date.now());
  const s = { started: false, models: null, endpoints: {}, total: 0, failed: 0, error: null, pending: 0 };
  let redraw = null;
  // While prices stream in, cells update but the rows hold their order (the
  // viewer may be reading); once the batch is done, the table re-sorts once.
  const changed = () => {
    clearTimeout(redraw);
    redraw = setTimeout(() => rerender({ keepOrder: s.pending > 0 }), REDRAW_MS);
  };

  async function run() {
    let listing = cache.models?.body;
    if (!listing) {
      try {
        listing = await fetchJson(LISTING_URL, b => Array.isArray(b?.data));
        cache.models = { at: Date.now(), body: listing };
        saveJson(storage, CACHE_KEY, cache);
      } catch (err) {
        s.error = err.message;
        changed();
        return;
      }
    }
    s.models = listing;
    s.total = listing.data.length;
    const queue = [];
    for (const m of listing.data) {
      const hit = cache.endpoints[m.id];
      if (hit) s.endpoints[m.id] = hit.body;
      else if (typeof m.endpoints === 'string') queue.push(m);
      else s.failed++;   // no endpoints resource named: nothing to fetch
    }
    s.pending = queue.length;
    changed();
    const worker = async () => {
      for (let m; (m = queue.shift());) {
        try {
          const body = await fetchJson(API_ORIGIN + m.endpoints, b => Array.isArray(b?.endpoints));
          s.endpoints = { ...s.endpoints, [m.id]: body };
          cache.endpoints[m.id] = { at: Date.now(), body };
          saveJson(storage, CACHE_KEY, cache);
        } catch {
          s.failed++;
        }
        s.pending--;
        changed();
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  }

  const status = () => {
    if (s.error) return `Couldn't load image prices from OpenRouter: ${s.error}. They'll be retried on your next visit.`;
    if (!s.models) return 'loading prices…';
    if (s.pending) return `loading prices ${s.total - s.pending}/${s.total}`;
    if (s.failed) return `Couldn't load image prices for ${s.failed} of ${s.total} Models; ` +
      'they show "pricing data not loaded" and will be retried on your next visit.';
    return '';
  };

  return {
    id: 'image',
    label: 'Image',
    columns: COLUMNS,
    // Start loading the first time the tab is shown (once per visit).
    onShow: () => {
      if (s.started) return;
      s.started = true;
      run();
    },
    // A progress or failure note above the table.
    notice: () => {
      const text = s.started ? status() : '';
      if (!text) return '';
      return s.error || (!s.pending && s.failed)
        ? `<div class="error"><p>${esc(text)}</p></div>`
        : `<p class="placeholder" role="status">${esc(text)}</p>`;
    },
    // The core's `sources.imagePricing`, once the listing has arrived.
    sources: () => (s.models ? { imagePricing: { models: s.models, endpoints: s.endpoints } } : {}),
  };
}

// The saved cache, keeping only entries younger than TTL_MS; anything
// missing or malformed means an empty cache.
function freshCache(saved, now) {
  const fresh = e => e && typeof e === 'object' && now - e.at < TTL_MS && e.body ? e : undefined;
  const endpoints = {};
  for (const [id, e] of Object.entries(saved?.endpoints || {})) if (fresh(e)) endpoints[id] = e;
  return { models: fresh(saved?.models), endpoints };
}
