// Video pricing, for the core (core.js): OpenRouter's video-models listing
// (/api/v1/videos/models) turned into USD per second. Pure; no imports.
//
// Each listed Model carries `pricing_skus`, vendor SKUs in mixed units. The
// shapes seen (2026-10-08, all 30 Models) and how each is read:
//   duration_seconds                          USD/s, the Model's base rate
//   duration_seconds_with_audio / _without_audio   USD/s for that audio setting
//   cents_per_second_output                   cents/s, the base rate (÷ 100)
//   minimum_cents_per_generation              a floor on each clip's cost (÷ 100)
//   …_480p / _720p / _768p / _1080p / _2k / _4k, per-second SKUs for one
//     resolution (incl. text_to_video_…, image_to_video_…, reference_…,
//     cents_per_video_output_second_…, cents_per_second_video_continuation_…)
//                                             shown on hover; the base rate wins.
//     A Model with no base rate is priced by resolution, which the Workload
//     doesn't choose, so it gets no cost.
//   cents_per_megapixel_second_…              priced by output size: no cost
//   cents_per_image_input, reference_images   surcharges for image inputs, which
//                                             a text-to-video Workload doesn't use
//   video_tokens…                             per token: no cost
// Any other SKU makes the Model's rate "unit unclear" rather than a guess.

const RESOLUTION = /_(\d+p|\d+k)$/i;

// key -> how it's read: [role, USD per unit of the SKU's value].
function skuRole(key) {
  if (key === 'duration_seconds') return ['base', 1];
  if (key === 'duration_seconds_with_audio') return ['withAudio', 1];
  if (key === 'duration_seconds_without_audio') return ['withoutAudio', 1];
  if (key === 'cents_per_second_output') return ['base', 0.01];
  if (key === 'minimum_cents_per_generation') return ['minimum', 0.01];
  if (key.startsWith('video_tokens')) return ['tokens'];
  if (key.startsWith('cents_per_megapixel_second_')) return ['bySize'];
  if (key === 'cents_per_image_input' || key === 'reference_images') return ['inputSurcharge'];
  if (RESOLUTION.test(key) && key.includes('second')) return ['byResolution'];
  return ['unknown'];
}

/**
 * A video Model's per-second rates from the listing.
 *
 * @param {string} id the Model's id
 * @param {{data: object[]} | undefined} listing the raw video-models response,
 *   or undefined while it isn't loaded
 * @returns {{withAudio: Rate, withoutAudio: Rate, minimumUsd: number, skus: object|null}}
 *   a Rate is {usd} (USD per second) or {reason}, one of 'notLoaded',
 *   'unpriced' (not in the listing, or no SKUs), 'perToken', 'byResolution',
 *   'unitUnclear' (the keys of core.js REASONS). `skus` is the raw
 *   pricing_skus (null when unknown), for hover.
 */
export function videoRates(id, listing) {
  const all = r => ({ withAudio: { reason: r }, withoutAudio: { reason: r }, minimumUsd: 0, skus: null });
  if (!Array.isArray(listing?.data)) return all('notLoaded');
  const skus = listing.data.find(m => m.id === id)?.pricing_skus;
  if (!skus || !Object.keys(skus).length) return all('unpriced');
  const found = {}, roles = new Set();
  for (const [key, value] of Object.entries(skus)) {
    const [role, scale] = skuRole(key);
    roles.add(role);
    if (scale) {
      const v = Number(value);
      if (!(v >= 0)) roles.add('unknown');
      else found[role] = v * scale;
    }
  }
  const out = r => ({ ...all(r), skus });
  if (roles.has('tokens')) return out('perToken');
  if (roles.has('unknown')) return out('unitUnclear');
  const missing = { reason: roles.has('byResolution') || roles.has('bySize') ? 'byResolution' : 'unpriced' };
  const rate = v => v === undefined ? missing : { usd: v };
  return {
    withAudio: rate(found.withAudio ?? found.base),
    withoutAudio: rate(found.withoutAudio ?? found.base),
    minimumUsd: found.minimum || 0,
    skus,
  };
}
