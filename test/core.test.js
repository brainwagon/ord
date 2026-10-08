import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPages } from '../js/core.js';

// Real /api/v1/models?output_modalities=all response captured 2026-10-08,
// trimmed to 31 Models (each object byte-for-byte as returned).
const catalogue = JSON.parse(readFileSync(new URL('./fixtures/catalogue.json', import.meta.url), 'utf8'));
const NOW = Date.parse('2026-10-08T12:00:00Z');

const allModels = () => buildPages({ catalogue }, {}, NOW).allModels;
const row = id => allModels().find(r => r.id === id);

test('All models lists every catalogue entry, including aliases, embeddings, rerank and routers', () => {
  const ids = allModels().map(r => r.id);
  assert.equal(ids.length, 31);
  for (const id of ['~anthropic/claude-opus-latest', 'voyageai/voyage-code-4',
                    'cohere/rerank-4-fast', 'openrouter/auto', 'openrouter/free']) {
    assert.ok(ids.includes(id), id);
  }
});

test('each row carries the core Model fields', () => {
  const r = row('anthropic/claude-opus-5.5');
  assert.equal(r.name, 'Anthropic: Claude Opus 5.5');
  assert.equal(r.author, 'anthropic');
  assert.equal(r.created, 1790094732 * 1000);
  assert.equal(r.contextLength, 1000000);
  assert.match(r.description, /^\S/);
  assert.equal(r.url, 'https://openrouter.ai/anthropic/claude-opus-5.5');
});

test('an alias\'s Author drops the ~ prefix, and an unknown (0) context length is null', () => {
  assert.equal(row('~anthropic/claude-opus-latest').author, 'anthropic');
  assert.equal(row('google/veo-3.1').contextLength, null);
});

test('All models lists newest first, whatever order the API sends', () => {
  const reversed = { data: [...catalogue.data].reverse() };
  const ids = buildPages({ catalogue: reversed }, {}, NOW).allModels.map(r => r.id);
  assert.equal(ids[0], 'stepfun/step-5-preview');
  assert.equal(ids.at(-1), 'openrouter/auto');
});

test('All models shows raw input and output prices in USD per 1M tokens', () => {
  assert.deepEqual(row('anthropic/claude-opus-5.5').prices,
    { input: { kind: 'usd', usd: 4 }, output: { kind: 'usd', usd: 20 } });
  // 0.000000042 per token must come out as exactly 0.042, not 0.041999…
  assert.deepEqual(row('typesafe/jev-1.13').prices.input, { kind: 'usd', usd: 0.042 });
});

test('a -1 price (variable-priced router) is "variable", never a negative price', () => {
  assert.deepEqual(row('openrouter/auto').prices,
    { input: { kind: 'variable' }, output: { kind: 'variable' } });
});

test('zero prices on a Model that is not a free offering are "unpriced", never $0', () => {
  const unpriced = { input: { kind: 'unpriced' }, output: { kind: 'unpriced' } };
  for (const id of ['google/veo-3.1', 'runway/gen-4.5', 'black-forest-labs/flux-3-image',
                    'google/lyria-3-pro-preview', 'cohere/rerank-4-fast']) {
    assert.deepEqual(row(id).prices, unpriced, id);
  }
  // A speech Model billed on its input: the zero output price isn't "free".
  assert.deepEqual(row('elevenlabs/eleven-v4').prices,
    { input: { kind: 'usd', usd: 40 }, output: { kind: 'unpriced' } });
});

test('no price on All models is ever negative', () => {
  for (const r of allModels()) {
    for (const p of [r.prices.input, r.prices.output]) {
      assert.ok(p.kind !== 'usd' || p.usd >= 0, r.id);
    }
  }
});

test('zero prices on a free offering stay $0', () => {
  const free = { input: { kind: 'usd', usd: 0 }, output: { kind: 'usd', usd: 0 } };
  for (const id of ['poolside/laguna-s-2.1:free', 'liquid/lfm-2.5-embedding-350m:free',
                    'openrouter/free', 'respan/span-01-lite']) {
    assert.deepEqual(row(id).prices, free, id);
  }
  // Decisions Models charge for input only; their zero output price is real.
  assert.deepEqual(row('cloudflare/clef').prices.output, { kind: 'usd', usd: 0 });
});
