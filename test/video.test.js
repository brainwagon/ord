import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPages, REASONS, workloadValues } from '../js/core.js';

// Real responses captured 2026-10-08, each Model object byte-for-byte as
// returned: the catalogue (/api/v1/models?output_modalities=all) trimmed to its
// 30 video-output Models, and the whole video-models listing
// (/api/v1/videos/models), untrimmed.
const read = name => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
const catalogue = read('video-catalogue.json');
const videoModels = read('video-models.json');
const NOW = Date.parse('2026-10-08T12:00:00Z');

const video = (settings = {}, sources = { catalogue, videoModels }) =>
  buildPages(sources, settings, NOW).video;
const row = (id, settings, sources) => video(settings, sources).find(r => r.id === id);
const withVideo = values => ({ workloads: { video: values } });
const usd = v => ({ kind: 'usd', usd: v });
const because = r => ({ kind: 'reason', reason: r });
const cost = (id, values = {}) => row(id, withVideo(values)).cost;

test('Video lists every Model whose outputs include video', () => {
  assert.equal(video().length, 30);
});

test('until the video listing loads, every Video row says "pricing data not loaded"', () => {
  const rows = video({}, { catalogue });
  assert.equal(rows.length, 30);
  for (const r of rows) assert.deepEqual(r.cost, because(REASONS.notLoaded), r.id);
  for (const r of rows) assert.deepEqual(r.rates, { withAudio: because(REASONS.notLoaded),
    withoutAudio: because(REASONS.notLoaded) }, r.id);
});

test('a listing that failed to load (or came back malformed) also says "pricing data not loaded"', () => {
  for (const bad of [undefined, null, {}, { data: 'nope' }]) {
    assert.deepEqual(row('google/veo-3.1', {}, { catalogue, videoModels: bad }).cost, because(REASONS.notLoaded));
  }
});

test('Veo: dollars-per-second SKUs, with the rate matching the audio setting', () => {
  // Default Workload: 8 seconds with audio. duration_seconds_with_audio "0.40".
  assert.deepEqual(row('google/veo-3.1').cost, usd(3.2));
  assert.deepEqual(row('google/veo-3.1').rates, { withAudio: usd(0.4), withoutAudio: usd(0.2) });
  // 8 s × duration_seconds_without_audio "0.20"
  assert.deepEqual(cost('google/veo-3.1', { audio: 'off' }), usd(1.6));
  // 5 s × "0.08" with audio, × "0.05" without
  assert.deepEqual(cost('google/veo-3.1-lite', { seconds: 5 }), usd(0.4));
  assert.deepEqual(cost('google/veo-3.1-lite', { seconds: 5, audio: 'off' }), usd(0.25));
});

test('a base duration_seconds rate is the without-audio rate when a with-audio SKU is also given (Kling)', () => {
  // duration_seconds "0.112", duration_seconds_with_audio "0.168"; 5 s
  assert.deepEqual(cost('kwaivgi/kling-v3.0-pro', { seconds: 5 }), usd(0.84));
  assert.deepEqual(cost('kwaivgi/kling-v3.0-pro', { seconds: 5, audio: 'off' }), usd(0.56));
});

test('Runway: cents-per-second SKUs are converted to dollars, one rate whatever the audio setting', () => {
  // cents_per_second_output "12" = $0.12/s; 10 s = $1.20
  assert.deepEqual(row('runway/gen-4.5').rates, { withAudio: usd(0.12), withoutAudio: usd(0.12) });
  assert.deepEqual(cost('runway/gen-4.5', { seconds: 10 }), usd(1.2));
  assert.deepEqual(cost('runway/gen-4.5', { seconds: 10, audio: 'off' }), usd(1.2));
  // flux-3-video: base cents_per_second_output "17" wins over its 720p/1080p SKUs; 4 s = $0.68
  assert.deepEqual(cost('black-forest-labs/flux-3-video', { seconds: 4 }), usd(0.68));
});

test('a minimum charge per generation is a floor on the clip\'s cost (Runway Aleph 2)', () => {
  // cents_per_second_output "28", minimum_cents_per_generation "56"
  assert.deepEqual(cost('runway/aleph-2', { seconds: 1 }), usd(0.56));
  assert.deepEqual(cost('runway/aleph-2', { seconds: 5 }), usd(1.4));
  assert.equal(row('runway/aleph-2').minimumUsd, 0.56);
});

test('Seedance\'s token SKUs get the per-token reason, never a cost', () => {
  for (const id of ['bytedance/seedance-2.5', 'bytedance/seedance-2.0', 'bytedance/seedance-1-5-pro']) {
    assert.deepEqual(cost(id), because(REASONS.perToken), id);
    assert.deepEqual(cost(id, { audio: 'off' }), because(REASONS.perToken), id);
    assert.deepEqual(row(id).rates.withoutAudio, because(REASONS.perToken), id);
  }
});

test('a Model priced only per resolution (or per megapixel-second) gets "priced by resolution"', () => {
  for (const id of ['alibaba/wan-3.0', 'x-ai/grok-imagine-video', 'heygen/heygen-video-1',
                    'alibaba/wan-2.6', 'black-forest-labs/flux-video-upscale']) {
    assert.deepEqual(cost(id), because(REASONS.byResolution), id);
  }
});

test('an unrecognised SKU makes the rate "unit unclear" rather than a guess', () => {
  const listing = structuredClone(videoModels);
  listing.data.find(m => m.id === 'google/veo-3.1').pricing_skus.cents_per_frame = '2';
  assert.deepEqual(row('google/veo-3.1', {}, { catalogue, videoModels: listing }).cost, because(REASONS.unitUnclear));
});

test('a video Model missing from the listing is "unpriced"', () => {
  const listing = { data: videoModels.data.filter(m => m.id !== 'google/veo-3.1') };
  assert.deepEqual(row('google/veo-3.1', {}, { catalogue, videoModels: listing }).cost, because(REASONS.unpriced));
});

test('the catalogue\'s $0 video prices are never shown as free', () => {
  for (const sources of [{ catalogue }, { catalogue, videoModels }]) {
    for (const r of video({}, sources)) {
      assert.equal(r.badges.free, false, r.id);
      assert.ok(r.cost.kind === 'reason' || r.cost.usd > 0, r.id);
    }
  }
});

test('every listed Model gets a cost or a reason, and the costed ones are those read confidently', () => {
  const costed = video().filter(r => r.cost.kind === 'usd').map(r => r.id).sort();
  assert.deepEqual(costed, ['black-forest-labs/flux-3-video', 'black-forest-labs/flux-video-edit',
    'google/veo-3.1', 'google/veo-3.1-fast', 'google/veo-3.1-lite', 'heygen/avatar-iv',
    'kwaivgi/kling-v3.0-pro', 'kwaivgi/kling-v3.0-std', 'kwaivgi/kling-video-o1', 'minimax/hailuo-2.3',
    'minimax/hailuo-3', 'minimax/hailuo-3-max', 'runway/aleph-2', 'runway/gen-4.5', 'alibaba/wan-2.7'].sort());
});

test('Models the listing says make no audio are badged "silent"', () => {
  assert.equal(row('runway/gen-4.5').badges.silent, true);
  assert.equal(row('google/veo-3.1').badges.silent, false);
  assert.equal(row('runway/gen-4.5', {}, { catalogue }).badges.silent, false);
});

test('sorting by cost puts costs first, cheapest first, then every reason', () => {
  const rows = video({ sort: { key: 'cost', dir: 'asc' } });
  const kinds = rows.map(r => r.cost.kind);
  assert.equal(kinds.lastIndexOf('usd') + 1, kinds.indexOf('reason'));
  // Cheapest for 8 s with audio: FLUX Video Edit at cents_per_second_output "3" = $0.24
  assert.deepEqual([rows[0].id, rows[0].cost], ['black-forest-labs/flux-video-edit', usd(0.24)]);
  const desc = video({ sort: { key: 'cost', dir: 'desc' } });
  assert.equal(desc[0].id, 'google/veo-3.1');   // 8 × 0.40 = $3.20
  assert.equal(desc.at(-1).cost.kind, 'reason');
});

test('the Video Workload is seconds and an audio choice, remembered under settings.workloads.video', () => {
  assert.deepEqual(workloadValues('video', {}), { seconds: 8, audio: 'on' });
  assert.deepEqual(workloadValues('video', withVideo({ seconds: '12', audio: 'off' })), { seconds: 12, audio: 'off' });
  assert.deepEqual(workloadValues('video', withVideo({ seconds: -3, audio: 'maybe' })), { seconds: 0, audio: 'on' });
});
