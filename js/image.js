// The Image page: image-output Models, costed for a Workload of a number of
// images at a resolution and a quality, each at the Model's per-image price
// for the closest resolution it offers. Prices come from OpenRouter's
// image-pricing data (`sources.imagePricing`, fetched by the shell when the
// tab is first opened; see image-view.js), never the catalogue's per-token
// `image_output`. Per-token and per-megapixel prices are turned into
// estimated per-image ones (see IMAGE_COSTS). A page definition for core.js's
// shared pipeline (see the comment above the page definitions there). Pure:
// no DOM, no network.
import { reason, usd, roundUsd } from './pricing.js';

/**
 * The Image page definition. Rows add `perImage`, the per-image Price used
 * for the Workload's resolution, and `perImageAt`, the resolution that price
 * is for ('1K', '1.5K', '768' px, …; null for a flat price or none). An
 * estimated price, and the cost from it, carries a `note` saying how it was
 * estimated. Quality only matters to Models whose cost depends on it
 * (OpenAI's); every other Model ignores it.
 *
 * @param {import('./core.js').PageCore} core
 */
export function imagePage({ coreFields, includes }) {
  const workload = {
    id: 'image',
    inputs: [
      { key: 'images', label: 'Images', default: 10, step: 1 },
      { key: 'resolution', label: 'Resolution', default: '1K',
        options: ['1K', '2K', '4K'].map(v => ({ value: v, label: v })) },
      { key: 'quality', label: 'Quality', default: 'medium',
        options: ['low', 'medium', 'high'].map(v => ({ value: v, label: v })) },
    ],
    cost: (m, w, sources) => {
      const { price } = perImagePrice(m, w, sources.imagePricing);
      return price.kind === 'usd' ? withNote(usd(w.images * price.usd), price.note) : price;
    },
  };
  function imageRow(m, sources, w) {
    const { price, at } = perImagePrice(m, w, sources.imagePricing);
    return { ...coreFields(m), perImage: price, perImageAt: at };
  }
  return { workload, includes, rowOf: imageRow, sortKeys: { perImage: r => r.perImage } };
}

/**
 * A Model's price for one output image at the Workload's `resolution` ('1K',
 * '2K' or '4K') and `quality` ('low', 'medium' or 'high').
 *
 * `imagePricing` is {models, endpoints}: the raw /api/v1/images/models
 * response, and each Model's raw /api/v1/images/models/{id}/endpoints
 * response by id (only those fetched so far). Either may be missing while
 * loading.
 *
 * Only `output_image` entries count (input images, fonts and references are
 * extras the Workload doesn't include), from the first endpoint that has any.
 * An entry's `variant` names the resolution it's for: "1k", "1.5k", "4k" or
 * a pixel size such as "768". With no variant, it's the price at every
 * resolution, unless sized variants sit beside it; then it's the price at
 * the endpoint's smallest supported resolution, the one with no variant of
 * its own. The price used is the one at the priced resolution closest to the
 * Workload's (the larger on a tie). A per-token price is turned into a
 * per-image one with IMAGE_COSTS (perTokenPrice), and a per-megapixel one by
 * the megapixels of a square image (perMegapixelPrice); both carry a note.
 *
 * @returns {{price, at: string|null}} the Price per image and the resolution
 *   it's for (null for a flat price or no price). With no USD price, the
 *   reason is notLoaded (no data yet for this Model), unpriced (no image
 *   price), variable (a router), perToken (billed per token, by a Model
 *   IMAGE_COSTS lacks), unitUnclear (variants that aren't resolutions, such
 *   as quality tiers, or that can't be placed, or another unit).
 */
function perImagePrice(model, { resolution, quality }, imagePricing) {
  if (!imagePricing?.models?.data) return none('notLoaded');
  if (!imagePricing.models.data.some(m => m.id === model.id)) {
    return none(Number(model.pricing?.prompt) < 0 ? 'variable' : 'unpriced');
  }
  const resource = imagePricing.endpoints?.[model.id];
  if (!resource) return none('notLoaded');
  const endpoint = (resource.endpoints || []).find(e => outputPrices(e).length);
  if (!endpoint) return none('unpriced');
  const prices = outputPrices(endpoint);
  if (prices.some(p => p.unit === 'token')) return perTokenPrice(model.id, prices, resolution, quality);
  if (prices.some(p => p.unit === 'megapixel')) return perMegapixelPrice(prices, resolution);
  if (prices.some(p => p.unit !== 'image')) return none('unitUnclear');

  const base = prices.filter(p => p.variant == null);
  const sized = prices.filter(p => p.variant != null)
    .map(p => ({ size: sizeOf(p.variant), usd: p.cost_usd, at: String(p.variant).toUpperCase() }));
  if (base.length > 1 || sized.some(p => p.size === null)) return none('unitUnclear');
  if (base.length) {
    if (!sized.length) return priceOf(base[0].cost_usd, null);
    // The un-sized price is the smallest supported resolution's, which must
    // lack a variant of its own and sit below every sized one.
    const supported = (endpoint.supported_parameters?.resolution?.values || [])
      .map(v => ({ size: sizeOf(v), at: String(v).toUpperCase() })).filter(v => v.size !== null);
    const smallest = supported.reduce((a, b) => (b.size < a.size ? b : a), { size: Infinity });
    if (!Number.isFinite(smallest.size) || sized.some(p => p.size <= smallest.size)) return none('unitUnclear');
    sized.push({ ...smallest, usd: base[0].cost_usd });
  }
  const closest = closestTo(sized, resolution);
  return priceOf(closest.usd, closest.at);
}

// The priced resolution closest to the Workload's (the larger on a tie).
function closestTo(sized, resolution) {
  const want = sizeOf(resolution);
  return sized.reduce((best, p) => {
    const d = Math.abs(p.size - want), bd = Math.abs(best.size - want);
    return d < bd || (d === bd && p.size > best.size) ? p : best;
  });
}

// A per-token Model's price per image: its Author's documented output tokens
// per image (IMAGE_COSTS) × OpenRouter's price per output token, at the
// documented resolution closest to the Workload's (and at the Workload's
// quality, for an entry keyed by it). A `-preview` id shares its released
// Model's entry. A $0 token price is a free Model, $0 per image. A Model the
// table lacks keeps the per-token reason.
function perTokenPrice(id, prices, resolution, quality) {
  if (prices.length !== 1 || prices[0].variant != null) return none('perToken');
  const perToken = prices[0].cost_usd;
  if (perToken === 0) return { price: usd(0), at: null };   // free: $0 whatever the token count
  const entry = IMAGE_COSTS[id.replace(/-preview$/, '')];
  if (!entry) return none('perToken');
  const table = entry.byQuality ? entry.perImage[quality] : entry.perImage;
  const sized = Object.entries(table).map(([at, v]) => ({ size: sizeOf(at), at, v }));
  const { at, v } = closestTo(sized, resolution);
  const image = `${at} image${entry.pixels ? ` (${entry.pixels[at]})` : ''}${entry.byQuality ? ` at ${quality} quality` : ''}`;
  const estimated = `Estimated (${entry.confidenceAt?.[at] ?? entry.confidence} confidence)`;
  return entry.unit === 'usd'
    ? priceOf(v, at, `${estimated}: ${entry.basis}'s stated price per ${image}; its token counts don't match it.`)
    : priceOf(roundUsd(v * perToken), at,
      `${estimated}: ${v} output tokens per ${image} (${entry.basis}) × OpenRouter's $${perToken} per token.`);
}

// A per-megapixel price for one square image at the Workload's resolution
// (1K = 1024 × 1024 px = 1.048576 MP). Only a single, un-sized price is
// understood; anything else is unitUnclear.
function perMegapixelPrice(prices, resolution) {
  if (prices.length !== 1 || prices[0].variant != null || prices[0].unit !== 'megapixel') return none('unitUnclear');
  const megapixels = (sizeOf(resolution) * 1024) ** 2 / 1e6;
  const at = String(resolution).toUpperCase();
  return priceOf(roundUsd(prices[0].cost_usd * megapixels), at,
    `Estimated: OpenRouter's $${prices[0].cost_usd} per megapixel × ${megapixels} MP, assuming a square ${at} image.`);
}

// What one generated image costs a per-token Model, from its Author's docs;
// see .scratch/openrouter-dashboard/research/image-tokens.md (gathered
// 2026-10-08) for the sources. Each entry has
//   unit        'tokens' (output tokens per image) or 'usd' (the Author's
//               stated price per image, used where its token counts don't
//               match its own prices)
//   perImage    {[resolution]: amount}, or with `byQuality`,
//               {low, medium, high} each of those (OpenAI's counts depend on it)
//   basis       where the figures come from, for the hover note
//   confidence  how far to trust them; `confidenceAt` overrides it per resolution
//   pixels      the image size each resolution stands for, where it isn't obvious
const GOOGLE = { unit: 'tokens', basis: "Google's docs", confidence: 'high' };
const OPENAI = { unit: 'tokens', basis: "OpenAI's docs", confidence: 'high', byQuality: true };
const GPT_IMAGE_1 = { ...OPENAI, pixels: { '1K': '1024 × 1024' },
  perImage: { low: { '1K': 272 }, medium: { '1K': 1056 }, high: { '1K': 4160 } } };
// OpenAI's token table and its stated prices disagree for Mini: use the prices.
const GPT_IMAGE_1_MINI = { ...OPENAI, unit: 'usd', basis: 'OpenAI', confidence: 'low', pixels: { '1K': '1024 × 1024' },
  perImage: { low: { '1K': 0.005 }, medium: { '1K': 0.011 }, high: { '1K': 0.036 } } };
// A 4K image (3840 × 2160) takes fewer tokens than a 2K one (2048 × 2048).
const GPT_IMAGE_2_PIXELS = { '1K': '1024 × 1024', '2K': '2048 × 2048', '4K': '3840 × 2160' };
const GPT_IMAGE_2 = { ...OPENAI, pixels: GPT_IMAGE_2_PIXELS, perImage: {
  low: { '1K': 196, '2K': 397, '4K': 371 },
  medium: { '1K': 1756, '2K': 3568, '4K': 3336 },
  high: { '1K': 7024, '2K': 14272, '4K': 13342 },
} };
// From OpenAI's cost calculator; there are no published prices to check it against.
const GPT_IMAGE_2_5 = { ...OPENAI, basis: "OpenAI's cost calculator", confidence: 'medium-high', pixels: GPT_IMAGE_2_PIXELS,
  perImage: {
    low: { '1K': 196, '2K': 397, '4K': 371 },
    medium: { '1K': 439, '2K': 892, '4K': 865 },
    high: { '1K': 1756, '2K': 3568, '4K': 3336 },
  } };
const MAI_IMAGE = { unit: 'tokens', basis: 'derived from third-party prices; Microsoft publishes no count',
  confidence: 'medium', perImage: { '1K': 1024 } };
const IMAGE_COSTS = {
  'google/gemini-2.5-flash-image': { ...GOOGLE, perImage: { '1K': 1290 } },
  'google/gemini-3.1-flash-image': { ...GOOGLE, perImage: { '0.5K': 747, '1K': 1120, '2K': 1680, '4K': 2520 } },
  'google/gemini-3.1-flash-lite-image': { ...GOOGLE, perImage: { '1K': 1120 } },
  'google/gemini-3-pro-image': { ...GOOGLE, perImage: { '1K': 1120, '2K': 1120, '4K': 2000 } },
  // Google's image guide says 2520 at 4K; its pricing pages say 3780, the
  // only figure that matches its stated $0.113 per image.
  'google/gemini-nano-banana-2.1': { ...GOOGLE, confidenceAt: { '4K': 'medium' },
    perImage: { '1K': 1120, '2K': 1680, '4K': 3780 } },
  'tencent/hy-image-v3.5': { unit: 'tokens', basis: "Tencent's docs", confidence: 'high',
    perImage: { '1K': 15000, '2K': 15000, '4K': 20000 } },
  'openai/gpt-image-1': GPT_IMAGE_1,
  'openai/gpt-5-image': GPT_IMAGE_1,
  'openai/gpt-image-1-mini': GPT_IMAGE_1_MINI,
  'openai/gpt-5-image-mini': GPT_IMAGE_1_MINI,
  'openai/gpt-image-2': GPT_IMAGE_2,
  'openai/gpt-5.4-image-2': GPT_IMAGE_2,
  'openai/gpt-image-2.5-sunburst': GPT_IMAGE_2_5,
  'openai/gpt-image-2.5-flare': GPT_IMAGE_2_5,
  'microsoft/mai-image-2.5': MAI_IMAGE,
  'microsoft/mai-image-2.5-pro': MAI_IMAGE,
  'microsoft/mai-image-2.6': MAI_IMAGE,
  'microsoft/mai-image-2.6-flash': MAI_IMAGE,
};

const outputPrices = endpoint => (endpoint.pricing || []).filter(p => p.billable === 'output_image');

const none = r => ({ price: reason(r), at: null });
const priceOf = (v, at, note) => typeof v === 'number' && v > 0 ? { price: withNote(usd(v), note), at } : none('unpriced');

// A Price or Cost with the hover note saying how it was estimated, if any.
const withNote = (p, note) => (note ? { ...p, note } : p);

// A resolution in K (1024 px): "1K"/"1.5k" -> 1/1.5, "768" (pixels) -> 0.75;
// anything else (e.g. "high_resolution", "low_1k") -> null.
function sizeOf(s) {
  const m = /^(\d+(?:\.\d+)?)(k?)$/i.exec(String(s));
  if (!m) return null;
  return m[2] ? Number(m[1]) : Number(m[1]) / 1024;
}
