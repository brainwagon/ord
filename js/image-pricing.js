// The Image page's extra pricing data, part of the shell. Fetched only once
// the Image tab is first opened: OpenRouter's image-models listing, then each
// listed Model's endpoints resource (its per-image prices), a few at a time.
// Every response is kept in browser storage for several hours; a failed
// request is never stored, so it's retried on the next visit. The core
// (js/image.js) prices from what `sources()` returns, so rows fill in as
// responses arrive, and the other tabs never wait on any of this.

const API_ORIGIN = 'https://openrouter.ai';
const LISTING_URL = API_ORIGIN + '/api/v1/images/models';
const CACHE_KEY = 'ord.imagePricing.v1';   // bump when the cached shape changes
const TTL_MS = 6 * 60 * 60 * 1000;          // image prices change slowly
const CONCURRENCY = 4;
const REDRAW_MS = 250;                      // batch redraws as responses land

/**
 * @param {Storage|null} storage localStorage, or null where it's missing or blocked
 * @param {() => void} onChange called (batched) whenever more data or a
 *   failure arrives, to re-render
 */
export function createImagePricing(storage, onChange) {
  // cache: {models: {at, body}, endpoints: {[id]: {at, body}}}, fresh entries only.
  const cache = loadCache(storage, Date.now());
  const s = { started: false, models: null, endpoints: {}, total: 0, failed: 0, error: null, pending: 0 };
  let redraw = null;
  const changed = () => {
    clearTimeout(redraw);
    redraw = setTimeout(onChange, REDRAW_MS);
  };
  const remember = (put) => {
    put(cache, { at: Date.now() });
    saveCache(storage, cache);
  };

  async function run() {
    let listing = cache.models?.body;
    if (!listing) {
      try {
        listing = await fetchJson(LISTING_URL, b => Array.isArray(b?.data));
        remember((c, e) => { c.models = { ...e, body: listing }; });
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
          remember((c, e) => { c.endpoints[m.id] = { ...e, body }; });
        } catch {
          s.failed++;
        }
        s.pending--;
        changed();
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  }

  let note = null;
  const api = {
    /**
     * Call on every render with whether the Image tab is showing: the first
     * time it is, loading starts (once per visit); while it is, a progress or
     * failure note shows above the table.
     */
    show(onImageTab) {
      if (onImageTab && !s.started) {
        s.started = true;
        run();
      }
      const text = onImageTab ? api.status() : '';
      if (!note && !text) return;
      if (!note) {
        note = document.createElement('p');
        note.className = 'panel note';
        note.setAttribute('role', 'status');
        document.getElementById('page').before(note);
      }
      note.textContent = text;
      note.hidden = !text;
    },
    /** The core's `sources.imagePricing`, or undefined before the listing arrives. */
    sources: () => (s.models ? { models: s.models, endpoints: s.endpoints } : undefined),
    /** A one-line progress or failure note, or '' when everything is in. */
    status() {
      if (s.error) return `Couldn't load image prices from OpenRouter: ${s.error}. They'll be retried on your next visit.`;
      if (!s.started) return '';
      if (!s.models) return 'Loading image prices…';
      if (s.pending) return `Loading image prices: ${s.total - s.pending - s.failed} of ${s.total}…`;
      if (s.failed) return `Couldn't load image prices for ${s.failed} of ${s.total} Models; ` +
        'they show "pricing data not loaded" and will be retried on your next visit.';
      return '';
    },
  };
  return api;
}

async function fetchJson(url, valid) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OpenRouter answered ${res.status} ${res.statusText}`.trim());
  const body = await res.json();
  if (!valid(body)) throw new Error('OpenRouter sent an unexpected response');
  return body;
}

// The cache as stored, keeping only entries younger than TTL_MS. Every
// access is guarded: a missing, blocked or corrupt store means an empty cache.
function loadCache(storage, now) {
  let saved = null;
  try { saved = JSON.parse(storage.getItem(CACHE_KEY)); } catch {}
  const fresh = e => e && typeof e === 'object' && now - e.at < TTL_MS && e.body ? e : undefined;
  const endpoints = {};
  for (const [id, e] of Object.entries(saved?.endpoints || {})) if (fresh(e)) endpoints[id] = e;
  return { models: fresh(saved?.models), endpoints };
}

function saveCache(storage, cache) {
  try { storage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch {}
}
