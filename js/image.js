// Image pricing, part of the pure core (no DOM, no network): the Image
// Workload's inputs and a Model's per-image price at the Workload's
// resolution, from OpenRouter's image-pricing data. core.js plugs these into
// the Image page; the tests reach them only through buildPages.

/** The Image Workload's inputs (see WORKLOADS in core.js). */
export const IMAGE_INPUTS = [
  { key: 'images', label: 'Images', default: 10, step: 1 },
  { key: 'resolution', label: 'Resolution', default: '1K',
    options: ['1K', '2K', '4K'].map(v => ({ value: v, label: v })) },
];

/**
 * A Model's price for one output image at `resolution` ('1K', '2K' or '4K').
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
 * Workload's (the larger on a tie).
 *
 * @returns {{usd: number}} USD per image, or {{reason: string}} naming a
 *   REASONS key: notLoaded (no data yet for this Model), unpriced (no image
 *   price), variable (a router), perToken (billed per token), unitUnclear
 *   (per megapixel, or variants that aren't resolutions, such as quality
 *   tiers, or that can't be placed).
 */
export function perImagePrice(model, resolution, imagePricing) {
  if (!imagePricing?.models?.data) return { reason: 'notLoaded' };
  if (!imagePricing.models.data.some(m => m.id === model.id)) {
    return { reason: Number(model.pricing?.prompt) < 0 ? 'variable' : 'unpriced' };
  }
  const resource = imagePricing.endpoints?.[model.id];
  if (!resource) return { reason: 'notLoaded' };
  const endpoint = (resource.endpoints || []).find(e => outputPrices(e).length);
  if (!endpoint) return { reason: 'unpriced' };
  const prices = outputPrices(endpoint);
  if (prices.some(p => p.unit === 'token')) return { reason: 'perToken' };
  if (prices.some(p => p.unit !== 'image')) return { reason: 'unitUnclear' };

  const base = prices.filter(p => p.variant == null);
  const sized = prices.filter(p => p.variant != null).map(p => ({ size: sizeOf(p.variant), usd: p.cost_usd }));
  if (base.length > 1 || sized.some(p => p.size === null)) return { reason: 'unitUnclear' };
  if (base.length) {
    if (!sized.length) return priceOf(base[0].cost_usd);
    // The un-sized price is the smallest supported resolution's, which must
    // lack a variant of its own and sit below every sized one.
    const supported = (endpoint.supported_parameters?.resolution?.values || []).map(sizeOf);
    const smallest = Math.min(...supported.filter(s => s !== null));
    if (!Number.isFinite(smallest) || sized.some(p => p.size <= smallest)) return { reason: 'unitUnclear' };
    sized.push({ size: smallest, usd: base[0].cost_usd });
  }
  const want = sizeOf(resolution);
  const closest = sized.reduce((best, p) => {
    const d = Math.abs(p.size - want), bd = Math.abs(best.size - want);
    return d < bd || (d === bd && p.size > best.size) ? p : best;
  });
  return priceOf(closest.usd);
}

const outputPrices = endpoint => (endpoint.pricing || []).filter(p => p.billable === 'output_image');

const priceOf = usd => typeof usd === 'number' && usd > 0 ? { usd } : { reason: 'unpriced' };

// A resolution in K (1024 px): "1K"/"1.5k" -> 1/1.5, "768" (pixels) -> 0.75;
// anything else (e.g. "high_resolution", "low_1k") -> null.
function sizeOf(s) {
  const m = /^(\d+(?:\.\d+)?)(k?)$/i.exec(String(s));
  if (!m) return null;
  return m[2] ? Number(m[1]) : Number(m[1]) / 1024;
}
