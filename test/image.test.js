import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { buildPages } from '../js/core.js';

// Real responses captured 2026-10-08, each Model object exactly as returned:
// the catalogue (/api/v1/models?output_modalities=all) trimmed to the image
// Models below plus a router and a text Model; the image-models listing
// (/api/v1/images/models) trimmed to the same image Models; and each one's
// endpoints resource (/api/v1/images/models/{id}/endpoints), saved whole.
const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const catalogue = read('./fixtures/image-catalogue.json');
const imageModels = read('./fixtures/image-models.json');
const endpoints = Object.fromEntries(readdirSync(new URL('./fixtures/image-endpoints/', import.meta.url))
  .map(f => read('./fixtures/image-endpoints/' + f)).map(r => [r.id, r]));
const NOW = Date.parse('2026-10-08T12:00:00Z');

const loaded = { catalogue, imagePricing: { models: imageModels, endpoints } };
const image = (sources = loaded, settings = {}) => buildPages(sources, settings, NOW).image;
const costOf = (id, settings, sources) => image(sources, settings).find(r => r.id === id).cost;
const workload = w => ({ workloads: { image: w } });
const usd = usd => ({ kind: 'usd', usd });
const why = reason => ({ kind: 'reason', reason });

test('Image lists every Model whose outputs include image, and nothing else', () => {
  const ids = image().map(r => r.id).sort();
  assert.deepEqual(ids, [
    'black-forest-labs/flux-3-image', 'black-forest-labs/flux.2-pro',
    'bytedance-seed/seedream-4.5', 'bytedance-seed/seedream-5-0-flash', 'bytedance-seed/seedream-5-0-pro',
    'google/gemini-3.1-flash-image', 'google/gemini-nano-banana-2.1',
    'krea/krea-2-large', 'meta/muse-image', 'openrouter/auto', 'qwen/qwen-image-3-pro',
    'sourceful/riverflow-v2-fast', 'sourceful/riverflow-v2.5-pro', 'x-ai/grok-imagine-image-2.0',
  ]);
});

test('the Image Workload is a number of images and a resolution of 1K, 2K or 4K, by default 10 at 1K', () => {
  const [images, resolution] = buildPages(loaded, {}, NOW).workloads.image.inputs;
  assert.equal(images.key, 'images');
  assert.equal(images.default, 10);
  assert.equal(resolution.key, 'resolution');
  assert.deepEqual(resolution.options.map(o => o.value), ['1K', '2K', '4K']);
  assert.equal(resolution.default, '1K');
});

test('Flux is costed at the per-image price for the Workload\'s resolution', () => {
  const flux = 'black-forest-labs/flux-3-image';   // 768 $0.041, 1k $0.048, 1.5k $0.07, 2k $0.1, 4k $0.607
  assert.deepEqual(costOf(flux), usd(0.48));                                             // 10 × $0.048
  assert.deepEqual(costOf(flux, workload({ images: 3, resolution: '2K' })), usd(0.3));   // 3 × $0.1
  assert.deepEqual(costOf(flux, workload({ images: 2, resolution: '4K' })), usd(1.214)); // 2 × $0.607
});

test('a flat per-image price (Seedream) applies at every resolution', () => {
  // seedream-5-0-flash: $0.018, offered at 1K and 2K only.
  assert.deepEqual(costOf('bytedance-seed/seedream-5-0-flash'), usd(0.18));                            // 10 × $0.018
  assert.deepEqual(costOf('bytedance-seed/seedream-5-0-flash', workload({ images: 1, resolution: '4K' })), usd(0.018));
  assert.deepEqual(costOf('bytedance-seed/seedream-4.5', workload({ images: 5, resolution: '2K' })), usd(0.2)); // 5 × $0.04
});

test('a resolution a Model has no price for takes the closest one it offers', () => {
  // qwen-image-3-pro: 1k $0.04, 2k $0.075; 4K is closest to 2k.
  assert.deepEqual(costOf('qwen/qwen-image-3-pro', workload({ images: 2, resolution: '4K' })), usd(0.15));
  assert.deepEqual(costOf('qwen/qwen-image-3-pro', workload({ images: 2, resolution: '1K' })), usd(0.08));
});

test('an un-sized price beside sized ones is the smallest supported resolution\'s', () => {
  // riverflow-v2-fast: $0.02 (no variant; supports 1K, 2K, 4K), 2k $0.04.
  const fast = 'sourceful/riverflow-v2-fast';
  assert.deepEqual(costOf(fast), usd(0.2));                                              // 10 × $0.02
  assert.deepEqual(costOf(fast, workload({ images: 10, resolution: '2K' })), usd(0.4));   // 10 × $0.04
  assert.deepEqual(costOf(fast, workload({ images: 10, resolution: '4K' })), usd(0.4));   // closest: 2k
  // riverflow-v2.5-pro: $0.13 (1K), 2k $0.15, 4k $0.17.
  assert.deepEqual(costOf('sourceful/riverflow-v2.5-pro'), usd(1.3));
  assert.deepEqual(costOf('sourceful/riverflow-v2.5-pro', workload({ images: 3, resolution: '4K' })), usd(0.51));
});

test('Models billed per token (Nano Banana, Gemini on either endpoint) get the per-token reason', () => {
  assert.deepEqual(costOf('google/gemini-nano-banana-2.1'), why('per-token pricing'));
  assert.deepEqual(costOf('google/gemini-3.1-flash-image'), why('per-token pricing'));
});

test('per-megapixel prices and variants that aren\'t resolutions are "unit unclear", never guessed', () => {
  assert.deepEqual(costOf('black-forest-labs/flux.2-pro'), why('unit unclear'));      // per megapixel
  assert.deepEqual(costOf('x-ai/grok-imagine-image-2.0'), why('unit unclear'));       // low_1k, medium_1k, …
  assert.deepEqual(costOf('bytedance-seed/seedream-5-0-pro'), why('unit unclear'));   // "high_resolution"
});

test('a Model with no image price is "unpriced", and a router is "variable"', () => {
  assert.deepEqual(costOf('krea/krea-2-large'), why('unpriced'));   // an endpoint with no prices
  assert.deepEqual(costOf('meta/muse-image'), why('unpriced'));     // no endpoints at all
  assert.deepEqual(costOf('openrouter/auto'), why('variable'));     // not in the image listing; -1
});

test('before image pricing loads, every Image Model says so; rows fill in as prices arrive', () => {
  for (const r of image({ catalogue })) assert.deepEqual(r.cost, why('pricing data not loaded'), r.id);
  const partly = { catalogue, imagePricing: { models: imageModels,
    endpoints: { 'black-forest-labs/flux-3-image': endpoints['black-forest-labs/flux-3-image'] } } };
  assert.deepEqual(costOf('black-forest-labs/flux-3-image', {}, partly), usd(0.48));
  assert.deepEqual(costOf('bytedance-seed/seedream-4.5', {}, partly), why('pricing data not loaded'));
});

test('sorting Image by cost puts costed Models first, cheapest first, then every reason', () => {
  const rows = image(loaded, { sort: { key: 'cost', dir: 'asc' } });
  // 10 images at 1K: $0.18, $0.20, $0.40 (two, newest first), $0.48, $1.30.
  assert.deepEqual(rows.slice(0, 6).map(r => r.cost.usd), [0.18, 0.2, 0.4, 0.4, 0.48, 1.3]);
  assert.deepEqual(rows.slice(0, 6).map(r => r.id), [
    'bytedance-seed/seedream-5-0-flash', 'sourceful/riverflow-v2-fast', 'qwen/qwen-image-3-pro',
    'bytedance-seed/seedream-4.5', 'black-forest-labs/flux-3-image', 'sourceful/riverflow-v2.5-pro']);
  assert.ok(rows.slice(6).every(r => r.cost.kind === 'reason'));
});

test('each Image row shows the per-image price used for the Workload\'s resolution, and the resolution it\'s for', () => {
  const row = (id, settings) => image(loaded, settings).find(r => r.id === id);
  const flux = 'black-forest-labs/flux-3-image';
  assert.deepEqual(row(flux).perImage, usd(0.048));
  assert.equal(row(flux).perImageAt, '1K');
  assert.deepEqual(row(flux, workload({ resolution: '4K' })).perImage, usd(0.607));
  assert.equal(row(flux, workload({ resolution: '4K' })).perImageAt, '4K');
  // qwen has no 4K price: the closest, 2K, is the one used.
  assert.deepEqual(row('qwen/qwen-image-3-pro', workload({ resolution: '4K' })).perImage, usd(0.075));
  assert.equal(row('qwen/qwen-image-3-pro', workload({ resolution: '4K' })).perImageAt, '2K');
  // riverflow-v2-fast's un-sized price is its smallest supported resolution's.
  assert.equal(row('sourceful/riverflow-v2-fast').perImageAt, '1K');
  // A flat price is for every resolution.
  assert.deepEqual(row('bytedance-seed/seedream-5-0-flash').perImage, usd(0.018));
  assert.equal(row('bytedance-seed/seedream-5-0-flash').perImageAt, null);
  // No price: the reason, as for the cost.
  assert.deepEqual(row('google/gemini-nano-banana-2.1').perImage, why('per-token pricing'));
  assert.equal(row('google/gemini-nano-banana-2.1').perImageAt, null);
  assert.deepEqual(image({ catalogue })[0].perImage, why('pricing data not loaded'));
});

test('Image can be sorted by per-image price, cheapest first, reasons last', () => {
  const rows = image(loaded, { sort: { key: 'perImage', dir: 'asc' } });
  assert.deepEqual(rows.slice(0, 2).map(r => r.id), ['bytedance-seed/seedream-5-0-flash', 'sourceful/riverflow-v2-fast']);
  assert.equal(rows.at(-1).perImage.kind, 'reason');
});

test('while prices stream in, a held row order keeps rows in place as their values change', () => {
  const byCost = { sort: { key: 'cost', dir: 'asc' } };
  const partly = { catalogue, imagePricing: { models: imageModels,
    endpoints: { 'sourceful/riverflow-v2.5-pro': endpoints['sourceful/riverflow-v2.5-pro'] } } };
  const before = image(partly, byCost).map(r => r.id);
  assert.equal(before[0], 'sourceful/riverflow-v2.5-pro');   // the only one costed so far
  // Everything arrives. Unheld, the order changes ...
  assert.notDeepEqual(image(loaded, byCost).map(r => r.id), before);
  // ... held, it doesn't, though every value is up to date.
  const held = image(loaded, { ...byCost, holdOrder: { image: before } });
  assert.deepEqual(held.map(r => r.id), before);
  assert.deepEqual(held.find(r => r.id === 'black-forest-labs/flux-3-image').cost, usd(0.48));
  // A row the held order doesn't know (e.g. a new filter match) goes after, in sort order.
  const short = image(loaded, { ...byCost, holdOrder: { image: before.slice(1) } }).map(r => r.id);
  assert.deepEqual(short, [...before.slice(1), before[0]]);
  // Other pages ignore another page's held order.
  assert.deepEqual(buildPages(loaded, { holdOrder: { image: before } }, NOW).allModels.map(r => r.id),
    buildPages(loaded, {}, NOW).allModels.map(r => r.id));
});

test('a remembered Image Workload is used, and an invalid resolution falls back to 1K', () => {
  const flux = 'black-forest-labs/flux-3-image';
  assert.deepEqual(costOf(flux, workload({ images: '4', resolution: '4K' })), usd(2.428));   // 4 × $0.607
  assert.deepEqual(costOf(flux, workload({ images: 1, resolution: '8K' })), usd(0.048));
});
