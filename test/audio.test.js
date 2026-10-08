import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPages, WORKLOADS, workloadValues } from '../js/core.js';
import { loadSettings, saveSettings } from '../js/store.js';

// The shared catalogue fixture plus test/fixtures/audio-catalogue.json: more
// real speech and audio Models captured 2026-10-08 (byte-for-byte as returned).
const read = name => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
const catalogue = { data: [...read('catalogue.json').data, ...read('audio-catalogue.json').data] };
const NOW = Date.parse('2026-10-08T12:00:00Z');

const audio = (settings = {}, cat = catalogue) => buildPages({ catalogue: cat }, settings, NOW).audio;
const ids = rows => rows.map(r => r.id).sort();

test('Audio lists every Model whose outputs include speech or audio', () => {
  assert.deepEqual(ids(audio()), [
    'bytedance-seed/seed-audio-1-0', 'elevenlabs/eleven-v4', 'fish-audio/s2.1-pro-free:free',
    'google/gemini-3.8-flash-tts', 'google/lyria-3-clip-preview', 'google/lyria-3-pro-preview',
    'hexgrad/kokoro-82m', 'minimax/speech-2.8-hd', 'openai/gpt-audio', 'openai/gpt-audio-mini',
  ]);
});

test('transcription Models stay off Audio unless they also output speech or audio', () => {
  const whisper = catalogue.data.find(m => m.id === 'openai/whisper-1');
  // whisper-1 as it really is (transcription only), and as if it also spoke.
  const speaking = { ...whisper, id: 'openai/whisper-1-speaking',
    architecture: { ...whisper.architecture, output_modalities: ['transcription', 'speech'] } };
  const rows = audio({}, { data: [whisper, speaking] });
  assert.deepEqual(ids(rows), ['openai/whisper-1-speaking']);
});

// --- Workload: characters of text to speak ---

const usd = n => ({ kind: 'usd', usd: n });
const reason = r => ({ kind: 'reason', reason: r });
const cost = (id, settings) => audio(settings).find(r => r.id === id).cost;

test('per-character Models cost characters × input price, for 100K characters by default', () => {
  // 100,000 × $0.00004
  assert.deepEqual(cost('elevenlabs/eleven-v4'), usd(4));
  // 100,000 × $0.0001
  assert.deepEqual(cost('minimax/speech-2.8-hd'), usd(10));
  // 100,000 × $0.00000062
  assert.deepEqual(cost('hexgrad/kokoro-82m'), usd(0.062));
  assert.deepEqual(cost('fish-audio/s2.1-pro-free:free'), usd(0));
});

test('the viewer\'s character count, from settings.workloads.audio, changes the cost', () => {
  const chars = n => ({ workloads: { audio: { characters: n } } });
  // 2,500 × $0.00004
  assert.deepEqual(cost('elevenlabs/eleven-v4', chars(2500)), usd(0.1));
  // 1,000,000 × $0.00000062
  assert.deepEqual(cost('hexgrad/kokoro-82m', chars('1000000')), usd(0.62));
});

test('Models billed by the token get the per-token reason, not a character cost', () => {
  // gpt-audio and gpt-audio-mini: audio output tokens (pricing.audio_output).
  assert.deepEqual(cost('openai/gpt-audio'), reason('per-token pricing'));
  assert.deepEqual(cost('openai/gpt-audio-mini'), reason('per-token pricing'));
  // Gemini TTS: text tokens in, audio tokens out (prompt and completion).
  assert.deepEqual(cost('google/gemini-3.8-flash-tts'), reason('per-token pricing'));
});

test('Models with no non-zero price (Lyria) are "unpriced", never free', () => {
  assert.deepEqual(cost('google/lyria-3-pro-preview'), reason('unpriced'));
  assert.deepEqual(cost('google/lyria-3-clip-preview'), reason('unpriced'));
});

test('a Model billed per second of generated audio (Seed Audio) is "unit unclear" for a character Workload', () => {
  // OpenRouter's TTS docs: Seed Audio 1.0 reports a per-second rate under
  // pricing.completion, and characters don't convert to seconds.
  assert.deepEqual(cost('bytedance-seed/seed-audio-1-0'), reason('unit unclear'));
});

test('each row says how its Model is billed, with per-character prices per 1M characters', () => {
  const row = id => audio().find(r => r.id === id);
  // $0.00004 per character = $40 per 1M characters
  assert.deepEqual(row('elevenlabs/eleven-v4').charPrice, usd(40));
  assert.deepEqual(row('elevenlabs/eleven-v4').billing, { unit: 'character' });
  assert.deepEqual(row('hexgrad/kokoro-82m').charPrice, usd(0.62));
  assert.deepEqual(row('fish-audio/s2.1-pro-free:free').charPrice, usd(0));
  // gpt-audio: $64 per 1M audio output tokens, $32 per 1M audio input tokens
  assert.deepEqual(row('openai/gpt-audio').billing, { unit: 'token',
    tokenPrices: { input: 2.5, output: 10, audioInput: 32, audioOutput: 64 } });
  assert.deepEqual(row('google/gemini-3.8-flash-tts').billing, { unit: 'token',
    tokenPrices: { input: 0.5, output: 9 } });
  // Seed Audio: $0.0025 per second of audio out
  assert.deepEqual(row('bytedance-seed/seed-audio-1-0').billing, { unit: 'second', usd: 0.0025 });
  assert.deepEqual(row('google/lyria-3-pro-preview').billing, { unit: 'unpriced' });
  for (const id of ['openai/gpt-audio', 'bytedance-seed/seed-audio-1-0', 'google/lyria-3-pro-preview']) {
    assert.equal(row(id).charPrice, null, id);
  }
});

test('sorting by per-character price is cheapest first, other billing last either way', () => {
  for (const dir of ['asc', 'desc']) {
    const rows = audio({ sort: { key: 'charPrice', dir } });
    const priced = rows.filter(r => r.charPrice).map(r => r.id);
    assert.equal(priced.length, 4, dir);
    assert.ok(rows.slice(0, 4).every(r => r.charPrice), dir);
    assert.deepEqual(priced, dir === 'asc'
      ? ['fish-audio/s2.1-pro-free:free', 'hexgrad/kokoro-82m', 'elevenlabs/eleven-v4', 'minimax/speech-2.8-hd']
      : ['minimax/speech-2.8-hd', 'elevenlabs/eleven-v4', 'hexgrad/kokoro-82m', 'fish-audio/s2.1-pro-free:free']);
  }
});

test('sorting by cost puts character costs first, then every reason', () => {
  const rows = audio({ sort: { key: 'cost', dir: 'asc' } });
  assert.deepEqual(rows.slice(0, 4).map(r => r.cost.usd), [0, 0.062, 4, 10]);
  assert.ok(rows.slice(4).every(r => r.cost.kind === 'reason'));
});

test('the Audio Workload is declared for the shell, defaulting to 100K characters', () => {
  assert.deepEqual(WORKLOADS.audio.map(i => [i.key, i.default]), [['characters', 100_000]]);
  assert.deepEqual(workloadValues('audio', { workloads: { audio: { characters: -3 } } }), { characters: 0 });
});

test('the Audio Workload is remembered across loads', () => {
  const m = new Map();
  const storage = { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) };
  saveSettings(storage, { workloads: { audio: { characters: 5000 } } });
  const settings = loadSettings(storage, { sort: null, workloads: {} });
  // 5,000 × $0.00004
  assert.deepEqual(cost('elevenlabs/eleven-v4', settings), usd(0.2));
});

test('a -1 price is "variable", never a cost', () => {
  const eleven = catalogue.data.find(m => m.id === 'elevenlabs/eleven-v4');
  const routed = { ...eleven, id: 'x/routed-speech', pricing: { prompt: '-1', completion: '-1' } };
  assert.deepEqual(audio({}, { data: [routed] })[0].cost, reason('variable'));
});
