import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPages } from '../js/core.js';

// Real /api/v1/models?output_modalities=all responses captured 2026-10-08:
// the shared catalogue (whisper-1, both Microsoft MAI models and
// gpt-4o-transcribe among them) plus four more transcription Models, each
// byte-for-byte as returned.
const load = name => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')).data;
const catalogue = { data: [...load('catalogue.json'), ...load('transcription.json')] };
const NOW = Date.parse('2026-10-08T12:00:00Z');

const transcription = (settings = {}, cat = catalogue) => buildPages({ catalogue: cat }, settings, NOW).transcription;
const cost = (id, settings) => transcription(settings).find(r => r.id === id).cost;
const usd = usd => ({ kind: 'usd', usd });
const why = reason => ({ kind: 'reason', reason });
const minutes = m => ({ workloads: { transcription: { minutes: m } } });
const whisper = catalogue.data.find(m => m.id === 'openai/whisper-1');
// whisper-1 with other prices, alone in a catalogue.
const repriced = pricing => transcription({}, { data: [{ ...whisper, pricing }] })[0];

test('Transcription lists every Model whose outputs include transcription, newest first', () => {
  assert.deepEqual(transcription().map(r => r.id), [
    'elevenlabs/scribe-v2',
    'google/gemini-3.5-transcribe',
    'microsoft/mai-transcribe-2',
    'microsoft/mai-transcribe-1.5',
    'qwen/qwen3-asr-flash-2026-02-10',
    'openai/gpt-4o-mini-transcribe',
    'openai/whisper-1',
    'openai/gpt-4o-transcribe',
  ]);
});

test('the Transcription Workload is minutes of audio, defaulting to 60', () => {
  const { inputs, values } = buildPages({ catalogue }, {}, NOW).workloads.transcription;
  assert.deepEqual(inputs.map(i => [i.key, i.default]), [['minutes', 60]]);
  assert.deepEqual(values, { minutes: 60 });
});

test('a Model with one input price and no output price is costed per second of audio', () => {
  // 60 min × 60 s × $0.0001/s
  assert.deepEqual(cost('openai/whisper-1'), usd(0.36));
  // 3600 s × $0.000035/s
  assert.deepEqual(cost('qwen/qwen3-asr-flash-2026-02-10'), usd(0.126));
  // 3600 s × $0.00003055555555555/s = $0.10999999999998, i.e. $0.11
  assert.deepEqual(cost('elevenlabs/scribe-v2'), usd(0.11));
  // 10 min × 60 s × $0.0001/s
  assert.deepEqual(cost('openai/whisper-1', minutes(10)), usd(0.06));
  assert.deepEqual(cost('openai/whisper-1', minutes(0)), usd(0));
});

test('costs carry no float noise from scaling a 15-digit price (chirp-3)', () => {
  // google/chirp-3 lists "0.000266666666667" per second: $0.016 a minute, $0.96 an hour.
  const chirp = repriced({ prompt: '0.000266666666667', completion: '0' });
  assert.deepEqual(chirp.cost, usd(0.96));
  assert.deepEqual(chirp.perMinute, usd(0.016));
});

test('a per-second price above $0.01 is "unit unclear", never a cost', () => {
  assert.deepEqual(cost('microsoft/mai-transcribe-2'), why('unit unclear'));    // "0.1"
  assert.deepEqual(cost('microsoft/mai-transcribe-1.5'), why('unit unclear'));  // "0.36"
  // Exactly $0.01/s is still costed: 3600 s × $0.01
  assert.deepEqual(repriced({ prompt: '0.01', completion: '0' }).cost, usd(36));
  assert.deepEqual(repriced({ prompt: '0.0100001', completion: '0' }).cost, why('unit unclear'));
});

test('Models with both input and output prices get the per-token reason', () => {
  for (const id of ['openai/gpt-4o-transcribe', 'openai/gpt-4o-mini-transcribe', 'google/gemini-3.5-transcribe']) {
    assert.deepEqual(cost(id), why('per-token pricing'), id);
  }
});

test('zero or variable transcription prices are "unpriced" or "variable", never $0', () => {
  assert.deepEqual(repriced({ prompt: '0', completion: '0' }).cost, why('unpriced'));
  assert.deepEqual(repriced({ prompt: '-1', completion: '-1' }).cost, why('variable'));
});

test('each Transcription row shows its price per minute of audio', () => {
  const perMinute = id => transcription().find(r => r.id === id).perMinute;
  assert.deepEqual(perMinute('openai/whisper-1'), usd(0.006));   // 60 s × $0.0001
  assert.deepEqual(perMinute('microsoft/mai-transcribe-2'), why('unit unclear'));
  assert.deepEqual(perMinute('openai/gpt-4o-transcribe'), why('per-token pricing'));
});

test('Transcription sorts by cost or price per minute, every reason after the costs', () => {
  const ids = settings => transcription(settings).map(r => r.id);
  assert.deepEqual(ids({ sort: { key: 'cost', dir: 'asc' } }).slice(0, 3),
    ['elevenlabs/scribe-v2', 'qwen/qwen3-asr-flash-2026-02-10', 'openai/whisper-1']);
  assert.deepEqual(ids({ sort: { key: 'perMinute', dir: 'desc' } }).slice(0, 4),
    ['openai/whisper-1', 'qwen/qwen3-asr-flash-2026-02-10', 'elevenlabs/scribe-v2', 'google/gemini-3.5-transcribe']);
});
