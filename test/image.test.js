import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { buildPages } from '../js/core.js';

// Real responses captured 2026-10-08 (the per-token Models, Gemini 2.5
// Flash Image on, later that day), each Model object exactly as returned:
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
    'google/gemini-2.5-flash-image', 'google/gemini-3-pro-image-preview',
    'google/gemini-3.1-flash-image', 'google/gemini-nano-banana-2.1',
    'inclusionai/ming-image-0.1-design', 'krea/krea-2-large', 'meta/muse-image', 'microsoft/mai-image-2.6',
    'openai/gpt-image-1', 'openai/gpt-image-1-mini', 'openrouter/auto', 'qwen/qwen-image-3-pro',
    'sourceful/riverflow-v2-fast', 'sourceful/riverflow-v2.5-pro', 'tencent/hy-image-v3.5-preview',
    'x-ai/grok-imagine-image-2.0',
  ]);
});

test('the Image Workload is a number of images, a resolution of 1K, 2K or 4K, and a quality, by default 10 at 1K, medium', () => {
  const [images, resolution, quality] = buildPages(loaded, {}, NOW).workloads.image.inputs;
  assert.equal(quality.key, 'quality');
  assert.deepEqual(quality.options.map(o => o.value), ['low', 'medium', 'high']);
  assert.equal(quality.default, 'medium');
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

test('a per-token Model is priced from its Author\'s documented tokens per image, at its token price', () => {
  // Gemini 2.5 Flash Image: 1290 output tokens per 1K image (Google's docs), $0.00003 per token.
  const row = image().find(r => r.id === 'google/gemini-2.5-flash-image');
  assert.deepEqual(row.perImage.usd, 0.0387);                                  // 1290 × $0.00003
  assert.equal(row.perImageAt, '1K');
  assert.deepEqual(costOf('google/gemini-2.5-flash-image').usd, 0.387);        // 10 images
});

test('a per-token Model\'s tokens per image depend on the resolution, the closest documented one used', () => {
  const row = (id, resolution) => image(loaded, workload({ resolution })).find(r => r.id === id);
  // Nano Banana 2: 1120 / 1680 / 2520 tokens at 1K / 2K / 4K, $0.00006 per token.
  assert.equal(row('google/gemini-3.1-flash-image', '4K').perImage.usd, 0.1512);
  assert.equal(row('google/gemini-3.1-flash-image', '2K').perImage.usd, 0.1008);
  assert.equal(row('google/gemini-3.1-flash-image', '2K').perImageAt, '2K');
  // Nano Banana 2.1: 1120 / 1680 / 3780 tokens, $0.00003 per token.
  assert.equal(row('google/gemini-nano-banana-2.1', '4K').perImage.usd, 0.1134);
  // Gemini 2.5 Flash Image documents 1K only: 4K is priced at 1K.
  assert.equal(row('google/gemini-2.5-flash-image', '4K').perImage.usd, 0.0387);
  assert.equal(row('google/gemini-2.5-flash-image', '4K').perImageAt, '1K');
  // Hy Image 3.5: 15000 tokens at 1K and 2K, 20000 at 4K, $0.0000016 per token.
  assert.equal(row('tencent/hy-image-v3.5-preview', '2K').perImage.usd, 0.024);
  assert.equal(row('tencent/hy-image-v3.5-preview', '4K').perImage.usd, 0.032);
});

test('a -preview id uses its released Model\'s tokens per image, at its own token price', () => {
  // Nano Banana Pro: 1120 tokens at 1K and 2K, 2000 at 4K; this endpoint lists $0.00006 per token.
  const row = resolution => image(loaded, workload({ resolution })).find(r => r.id === 'google/gemini-3-pro-image-preview');
  assert.equal(row('2K').perImage.usd, 0.0672);
  assert.equal(row('4K').perImage.usd, 0.12);
});

test('OpenAI\'s tokens per image depend on the Workload\'s quality; other Models ignore it', () => {
  const at = quality => image(loaded, workload({ quality })).find(r => r.id === 'openai/gpt-image-1').perImage.usd;
  // GPT Image 1 at 1024 × 1024: 272 / 1056 / 4160 tokens, $0.00004 per token.
  assert.equal(at('low'), 0.01088);
  assert.equal(at('medium'), 0.04224);
  assert.equal(at('high'), 0.1664);
  assert.equal(costOf('openai/gpt-image-1').usd, 0.4224);   // 10 images, medium by default
  const gemini = quality => image(loaded, workload({ quality })).find(r => r.id === 'google/gemini-2.5-flash-image').perImage;
  assert.deepEqual(gemini('high'), gemini('low'));
});

test('GPT Image 1 Mini is priced at OpenAI\'s stated per-image prices, its token table not adding up', () => {
  const at = quality => image(loaded, workload({ quality })).find(r => r.id === 'openai/gpt-image-1-mini').perImage.usd;
  assert.equal(at('low'), 0.005);
  assert.equal(at('medium'), 0.011);
  assert.equal(at('high'), 0.036);
});

test('prices estimated from Authors\' docs or from megapixels say so, with the confidence; OpenRouter\'s own don\'t', () => {
  const row = (id, settings) => image(loaded, settings).find(r => r.id === id);
  const gemini = row('google/gemini-2.5-flash-image');
  assert.match(gemini.perImage.note, /estimated/i);
  assert.match(gemini.perImage.note, /1290 output tokens/);
  assert.match(gemini.perImage.note, /Google/);
  assert.match(gemini.perImage.note, /high confidence/);
  assert.equal(gemini.cost.note, gemini.perImage.note);
  assert.match(row('microsoft/mai-image-2.6').perImage.note, /medium confidence/);
  assert.match(row('openai/gpt-image-1', workload({ quality: 'low' })).perImage.note, /low quality/);
  assert.match(row('openai/gpt-image-1', workload({ quality: 'low' })).perImage.note, /1024 × 1024/);
  assert.match(row('openai/gpt-image-1-mini').perImage.note, /stated price/);
  assert.match(row('openai/gpt-image-1-mini').perImage.note, /low confidence/);   // its docs disagree with themselves
  // Nano Banana 2.1's 4K count is where Google's own pages conflict.
  assert.match(row('google/gemini-nano-banana-2.1').perImage.note, /high confidence/);
  assert.match(row('google/gemini-nano-banana-2.1', workload({ resolution: '4K' })).perImage.note, /medium confidence/);
  assert.match(row('black-forest-labs/flux.2-pro').perImage.note, /square/);
  assert.equal(row('black-forest-labs/flux-3-image').perImage.note, undefined);
  assert.equal(row('black-forest-labs/flux-3-image').cost.note, undefined);
  assert.equal(row('inclusionai/ming-image-0.1-design').perImage.note, undefined);
});

test('a Model whose output images cost $0 per token (Ming Image, free on OpenRouter) costs $0', () => {
  const row = image().find(r => r.id === 'inclusionai/ming-image-0.1-design');
  assert.deepEqual(row.perImage, usd(0));
  assert.equal(row.perImageAt, null);
  assert.deepEqual(row.cost, usd(0));
});

test('a per-token Model the tokens-per-image table doesn\'t know keeps the per-token reason', () => {
  // A newly listed Model: Gemini 2.5 Flash Image's own responses under an id the table lacks.
  const id = 'google/gemini-9-flash-image';
  const as = m => ({ ...m, id });
  const g = 'google/gemini-2.5-flash-image';
  const sources = {
    catalogue: { data: [as(catalogue.data.find(m => m.id === g))] },
    imagePricing: { models: { data: [as(imageModels.data.find(m => m.id === g))] }, endpoints: { [id]: as(endpoints[g]) } },
  };
  assert.deepEqual(costOf(id, {}, sources), why('per-token pricing'));
  assert.deepEqual(image(sources)[0].perImage, why('per-token pricing'));
});

test('a per-megapixel price is priced for a square image at the Workload\'s resolution', () => {
  // FLUX.2 pro: $0.03 per megapixel. 1K is 1024 × 1024 px = 1.048576 MP; 2K 4.194304; 4K 16.777216.
  const row = resolution => image(loaded, workload({ resolution })).find(r => r.id === 'black-forest-labs/flux.2-pro');
  assert.equal(row('1K').perImage.usd, 0.03145728);
  assert.equal(row('1K').perImageAt, '1K');
  assert.equal(row('2K').perImage.usd, 0.12582912);
  assert.equal(row('4K').perImage.usd, 0.50331648);
  assert.equal(costOf('black-forest-labs/flux.2-pro').usd, 0.3145728);   // 10 images at 1K
});

test('variants that aren\'t resolutions are "unit unclear", never guessed', () => {
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
  const costed = rows.findIndex(r => r.cost.kind === 'reason');
  assert.ok(costed > 0 && rows.slice(costed).every(r => r.cost.kind === 'reason'));
  const amounts = rows.slice(0, costed).map(r => r.cost.usd);
  assert.deepEqual(amounts, [...amounts].sort((x, y) => x - y));
  // 10 images at 1K: free Ming first; the two at $0.40 newest first.
  assert.equal(rows[0].id, 'inclusionai/ming-image-0.1-design');
  const at40 = rows.filter(r => r.cost.usd === 0.4).map(r => r.id);
  assert.deepEqual(at40, ['qwen/qwen-image-3-pro', 'bytedance-seed/seedream-4.5']);
  assert.equal(rows[costed - 1].id, 'sourceful/riverflow-v2.5-pro');   // $1.30, the dearest
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
  assert.deepEqual(row('krea/krea-2-large').perImage, why('unpriced'));
  assert.equal(row('krea/krea-2-large').perImageAt, null);
  assert.deepEqual(image({ catalogue })[0].perImage, why('pricing data not loaded'));
});

test('Image can be sorted by per-image price, cheapest first, reasons last', () => {
  const rows = image(loaded, { sort: { key: 'perImage', dir: 'asc' } });
  assert.equal(rows[0].id, 'inclusionai/ming-image-0.1-design');   // $0
  const amounts = rows.filter(r => r.perImage.kind === 'usd').map(r => r.perImage.usd);
  assert.deepEqual(amounts, [...amounts].sort((x, y) => x - y));
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

test('a remembered Image Workload is used, and an invalid resolution or quality falls back to the default', () => {
  const flux = 'black-forest-labs/flux-3-image';
  assert.deepEqual(costOf(flux, workload({ images: '4', resolution: '4K' })), usd(2.428));   // 4 × $0.607
  assert.deepEqual(costOf(flux, workload({ images: 1, resolution: '8K' })), usd(0.048));
  assert.equal(costOf('openai/gpt-image-1', workload({ images: 1, quality: 'high' })).usd, 0.1664);
  assert.equal(costOf('openai/gpt-image-1', workload({ images: 1, quality: 'max' })).usd, 0.04224);   // medium
});
