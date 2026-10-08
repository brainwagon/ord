import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPages, WORKLOADS, workloadValues } from '../js/core.js';

// Real /api/v1/models?output_modalities=all response captured 2026-10-08,
// trimmed to every Decisions Model (15, one a ~-latest alias) plus one text
// Model (anthropic/claude-opus-5.5), each object byte-for-byte as returned.
const catalogue = JSON.parse(readFileSync(new URL('./fixtures/decisions.json', import.meta.url), 'utf8'));
const NOW = Date.parse('2026-10-08T12:00:00Z');

const decisions = (settings = {}) => buildPages({ catalogue }, settings, NOW).decisions;
const row = (id, settings) => decisions(settings).find(r => r.id === id);

test('Decisions lists every Model whose outputs include decisions, except aliases', () => {
  const ids = decisions().map(r => r.id);
  assert.equal(ids.length, 14);
  assert.ok(ids.includes('typesafe/jev-1.13'));
  assert.ok(ids.includes('inception/mercury-decide:free'));
  assert.ok(!ids.includes('~typesafe/jev-latest'));
  assert.ok(!ids.includes('anthropic/claude-opus-5.5'));
});

test('a Decisions Model accepts images exactly when image is among its input modalities', () => {
  assert.equal(row('perplexity/pplx-decider-v1.1-27b').acceptsImages, true);   // text + image
  assert.equal(row('cloudflare/clef').acceptsImages, true);
  assert.equal(row('typesafe/jev-1.13').acceptsImages, false);                 // text only
  assert.deepEqual(decisions().filter(r => r.acceptsImages).map(r => r.id).sort(),
    ['cloudflare/clef', 'cloudflare/clef-flash', 'openai/gpt-6-luna-decisions', 'perplexity/pplx-decider-v1.1-27b']);
});

test('a Decisions Model is "no charge" when listed at $0; "free" stays the :free variant badge', () => {
  assert.equal(row('inception/mercury-decide:free').zeroPrice, true);
  assert.equal(row('respan/span-01-lite:free').zeroPrice, true);
  // Decisions are billed by the token, so a $0 listing is a genuine $0 ...
  assert.equal(row('respan/span-01-lite').zeroPrice, true);
  // ... but only a :free variant carries the "free" badge.
  assert.equal(row('respan/span-01-lite').badges.free, false);
  assert.equal(row('inception/mercury-decide:free').badges.free, true);
  assert.equal(row('respan/span-01').zeroPrice, false);   // $0.02 per 1M input tokens
  assert.equal(row('typesafe/jev-1.13').zeroPrice, false);
  assert.ok(decisions().every(r => !('free' in r)));
});

test('Decisions costs each Model for the default Workload of 1,000 decisions × 2,000 input tokens', () => {
  assert.deepEqual(workloadValues('decisions', {}), { decisions: 1000, tokensPerDecision: 2000 });
  // 2,000,000 input tokens at the input price; decision models have no output price.
  assert.deepEqual(row('cloudflare/clef').cost, { kind: 'usd', usd: 0.48 });                    // $0.24 /1M
  assert.deepEqual(row('perplexity/pplx-decider-v1.1-27b').cost, { kind: 'usd', usd: 0.04 });    // $0.02 /1M
  assert.deepEqual(row('typesafe/jev-1.13').cost, { kind: 'usd', usd: 0.084 });                  // $0.042 /1M
  assert.deepEqual(row('openai/gpt-6-luna-decisions').cost, { kind: 'usd', usd: 0.2 });          // $0.10 /1M
  assert.deepEqual(row('inception/mercury-decide:free').cost, { kind: 'usd', usd: 0 });
  assert.deepEqual(row('respan/span-01-lite').cost, { kind: 'usd', usd: 0 });
});

test('the viewer\'s Decisions Workload changes every cost', () => {
  const settings = { workloads: { decisions: { decisions: 500, tokensPerDecision: 10_000 } } };
  // 5,000,000 input tokens.
  assert.deepEqual(row('cloudflare/clef', settings).cost, { kind: 'usd', usd: 1.2 });
  assert.deepEqual(row('typesafe/jev-1.13', settings).cost, { kind: 'usd', usd: 0.21 });
  assert.deepEqual(row('upstage/solar-decide', settings).cost, { kind: 'usd', usd: 0.25 });      // $0.05 /1M
});

test('Decisions sorts by cost cheapest first, free Models leading', () => {
  const ids = decisions({ sort: { key: 'cost', dir: 'asc' } }).map(r => r.id);
  assert.deepEqual(ids.slice(0, 3).sort(),
    ['inception/mercury-decide:free', 'respan/span-01-lite', 'respan/span-01-lite:free']);
  assert.equal(ids.at(-1), 'cloudflare/clef');
});

test('Decisions can be sorted by the accepts-images and no-charge columns', () => {
  const images = decisions({ sort: { key: 'acceptsImages', dir: 'desc' } }).map(r => r.id);
  assert.deepEqual(images.slice(0, 4).sort(),
    ['cloudflare/clef', 'cloudflare/clef-flash', 'openai/gpt-6-luna-decisions', 'perplexity/pplx-decider-v1.1-27b']);
  const free = decisions({ sort: { key: 'zeroPrice', dir: 'desc' } }).map(r => r.id);
  assert.deepEqual(free.slice(0, 3),
    ['inception/mercury-decide:free', 'respan/span-01-lite:free', 'respan/span-01-lite']);
});

test('Decisions declares its Workload inputs for the shell', () => {
  assert.deepEqual(WORKLOADS.decisions.map(i => [i.key, i.default]),
    [['decisions', 1000], ['tokensPerDecision', 2000]]);
});
