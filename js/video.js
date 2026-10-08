// The Video page: video-output Models, costed for a Workload of seconds of
// video with audio on or off. Prices come from OpenRouter's video-models
// listing (`sources.videoModels`, fetched by the shell when the tab is first
// opened; see video-view.js), normalised to USD per second; the catalogue's $0
// video prices are never used. A page definition for core.js's shared
// pipeline (see the comment above the page definitions there). Pure: no DOM,
// no network.
//
// Each listed Model carries `pricing_skus`, OpenRouter's pricing SKUs in
// mixed units. The shapes seen (2026-10-08, all 30 Models) and how each is read:
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
import { reason, usd } from './pricing.js';

/**
 * The Video page definition. Rows add `rates: {withAudio, withoutAudio}`
 * (Prices, USD per second), `minimumUsd` (the least a clip costs; 0 when
 * none), `skus` (the listing's raw pricing_skus, null until loaded) and badge
 * `silent` (the listing says the Model doesn't generate audio).
 *
 * @param {import('./core.js').PageCore} core
 */
export function videoPage({ coreFields, includes }) {
  const workload = {
    id: 'video',
    inputs: [
      { key: 'seconds', label: 'Seconds of video', default: 8, step: 1 },
      { key: 'audio', label: 'Audio', default: 'on', options: [{ value: 'on', label: 'on' }, { value: 'off', label: 'off' }] },
    ],
    cost: (m, w, sources) => {
      const v = videoRates(m.id, sources.videoModels);
      const rate = w.audio === 'on' ? v.withAudio : v.withoutAudio;
      if (rate.kind !== 'usd') return rate;
      return usd(w.seconds > 0 ? Math.max(rate.usd * w.seconds, v.minimumUsd) : 0);
    },
  };

  function videoRow(m, sources) {
    const core = coreFields(m), v = videoRates(m.id, sources.videoModels);
    const listed = v.skus && sources.videoModels.data.find(x => x.id === m.id);
    return {
      ...core,
      badges: { ...core.badges, silent: listed?.generate_audio === false },
      rates: { withAudio: v.withAudio, withoutAudio: v.withoutAudio },
      minimumUsd: v.minimumUsd,
      skus: v.skus,
    };
  }

  return {
    workload,
    includes,
    rowOf: videoRow,
    sortKeys: { withAudio: r => r.rates.withAudio, withoutAudio: r => r.rates.withoutAudio },
  };
}

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
 * A video Model's per-second rates from the listing (undefined while it isn't
 * loaded): `withAudio` and `withoutAudio` Prices (USD per second, or a reason:
 * notLoaded, unpriced when it isn't listed or has no SKUs, perToken,
 * byResolution, unitUnclear), `minimumUsd`, and `skus`, the raw pricing_skus
 * (null when unknown), for hover.
 */
function videoRates(id, listing) {
  const all = r => ({ withAudio: reason(r), withoutAudio: reason(r), minimumUsd: 0, skus: null });
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
  const missing = reason(roles.has('byResolution') || roles.has('bySize') ? 'byResolution' : 'unpriced');
  const rate = v => v === undefined ? missing : usd(v);
  return {
    withAudio: rate(found.withAudio ?? found.base),
    withoutAudio: rate(found.withoutAudio ?? found.base),
    minimumUsd: found.minimum || 0,
    skus,
  };
}
