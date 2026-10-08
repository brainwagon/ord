// The Image page: image-output Models, costed for a Workload of a number of
// images at a resolution, each at the Model's per-image price for the closest
// resolution it offers. Prices come from OpenRouter's image-pricing data
// (`sources.imagePricing`, fetched by the shell when the tab is first opened;
// see image-pricing.js), never the catalogue's per-token `image_output`. A
// page definition for core.js's shared pipeline (see the comment above the
// page definitions there). Pure: no DOM, no network.

/**
 * The Image page definition. The core passes in what the page needs from it,
 * so this module imports nothing.
 *
 * @param {{REASONS: object, coreFields: (m: object) => object, includes: (m: object) => boolean}} core
 */
export function imagePage({ REASONS, coreFields, includes }) {
  const workload = {
    id: 'image',
    inputs: [
      { key: 'images', label: 'Images', default: 10, step: 1 },
      { key: 'resolution', label: 'Resolution', default: '1K',
        options: ['1K', '2K', '4K'].map(v => ({ value: v, label: v })) },
    ],
    cost: (m, w, sources) => {
      const p = perImagePrice(m, w.resolution, sources.imagePricing);
      return p.reason ? { kind: 'reason', reason: REASONS[p.reason] } : { kind: 'usd', usd: w.images * p.usd };
    },
  };
  // Rows add `perImage`, the per-image Price used for the Workload's
  // resolution, and `perImageAt`, the resolution that price is for ('1K',
  // '1.5K', '768' px, …; null for a flat price or none).
  function imageRow(m, sources, w) {
    const p = perImagePrice(m, w.resolution, sources.imagePricing);
    return {
      ...coreFields(m),
      perImage: p.reason ? { kind: 'reason', reason: REASONS[p.reason] } : { kind: 'usd', usd: p.usd },
      perImageAt: p.at ?? null,
    };
  }
  return { workload, includes, rowOf: imageRow, sortKeys: { perImage: r => r.perImage } };
}

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
 * @returns {{usd: number, at: string|null}} USD per image and the resolution
 *   it's for (null for a flat price), or {{reason: string}} naming a
 *   REASONS key: notLoaded (no data yet for this Model), unpriced (no image
 *   price), variable (a router), perToken (billed per token), unitUnclear
 *   (per megapixel, or variants that aren't resolutions, such as quality
 *   tiers, or that can't be placed).
 */
function perImagePrice(model, resolution, imagePricing) {
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
  const sized = prices.filter(p => p.variant != null)
    .map(p => ({ size: sizeOf(p.variant), usd: p.cost_usd, at: String(p.variant).toUpperCase() }));
  if (base.length > 1 || sized.some(p => p.size === null)) return { reason: 'unitUnclear' };
  if (base.length) {
    if (!sized.length) return priceOf(base[0].cost_usd, null);
    // The un-sized price is the smallest supported resolution's, which must
    // lack a variant of its own and sit below every sized one.
    const supported = (endpoint.supported_parameters?.resolution?.values || [])
      .map(v => ({ size: sizeOf(v), at: String(v).toUpperCase() })).filter(v => v.size !== null);
    const smallest = supported.reduce((a, b) => (b.size < a.size ? b : a), { size: Infinity });
    if (!Number.isFinite(smallest.size) || sized.some(p => p.size <= smallest.size)) return { reason: 'unitUnclear' };
    sized.push({ ...smallest, usd: base[0].cost_usd });
  }
  const want = sizeOf(resolution);
  const closest = sized.reduce((best, p) => {
    const d = Math.abs(p.size - want), bd = Math.abs(best.size - want);
    return d < bd || (d === bd && p.size > best.size) ? p : best;
  });
  return priceOf(closest.usd, closest.at);
}

const outputPrices = endpoint => (endpoint.pricing || []).filter(p => p.billable === 'output_image');

const priceOf = (usd, at) => typeof usd === 'number' && usd > 0 ? { usd, at } : { reason: 'unpriced' };

// A resolution in K (1024 px): "1K"/"1.5k" -> 1/1.5, "768" (pixels) -> 0.75;
// anything else (e.g. "high_resolution", "low_1k") -> null.
function sizeOf(s) {
  const m = /^(\d+(?:\.\d+)?)(k?)$/i.exec(String(s));
  if (!m) return null;
  return m[2] ? Number(m[1]) : Number(m[1]) / 1024;
}
