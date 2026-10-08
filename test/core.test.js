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

test('a Model carries an "expires" badge exactly when it has an expiration_date', () => {
  assert.equal(row('poolside/laguna-s-2.1').badges.expires, '2026-10-31');
  const expiring = allModels().filter(r => r.badges.expires).map(r => r.id).sort();
  assert.deepEqual(expiring, ['poolside/laguna-s-2.1', 'poolside/laguna-s-2.1:free']);
  assert.equal(row('anthropic/claude-opus-5.5').badges.expires, null);
});

const FREE_VARIANTS = ['inception/mercury-decide:free', 'liquid/lfm-2.5-embedding-350m:free',
                       'poolside/laguna-s-2.1:free'];

test(':free variants are shown by default, badged free', () => {
  const free = allModels().filter(r => r.badges.free).map(r => r.id).sort();
  assert.deepEqual(free, FREE_VARIANTS);
});

test('hide-free removes :free variants and nothing else', () => {
  const ids = buildPages({ catalogue }, { hideFree: true }, NOW).allModels.map(r => r.id);
  assert.equal(ids.length, 31 - FREE_VARIANTS.length);
  for (const id of FREE_VARIANTS) assert.ok(!ids.includes(id), id);
  assert.ok(ids.includes('poolside/laguna-s-2.1'));
});

const idsWith = settings => buildPages({ catalogue }, settings, NOW).allModels.map(r => r.id).sort();

test('the Author filter keeps only that Author\'s Models, aliases included', () => {
  assert.deepEqual(idsWith({ author: 'anthropic' }),
    ['anthropic/claude-opus-5.5', '~anthropic/claude-opus-latest']);
});

test('search matches name or id, case-insensitively', () => {
  assert.deepEqual(idsWith({ search: 'opus' }),
    ['anthropic/claude-opus-5.5', '~anthropic/claude-opus-latest']);
  assert.deepEqual(idsWith({ search: 'WHISPER-1' }), ['openai/whisper-1']);  // id only
  assert.deepEqual(idsWith({ search: 'whisper 1' }), ['openai/whisper-1']);  // name only
  assert.deepEqual(idsWith({ search: '  laguna  ' }),
    ['poolside/laguna-s-2.1', 'poolside/laguna-s-2.1:free']);
});

test('Author filter, search and hide-free combine', () => {
  assert.deepEqual(idsWith({ author: 'poolside', search: 'laguna', hideFree: true }),
    ['poolside/laguna-s-2.1']);
  assert.deepEqual(idsWith({ author: 'openai', search: 'laguna' }), []);
});

const sorted = (key, dir) =>
  buildPages({ catalogue }, { sort: { key, dir } }, NOW).allModels.map(r => r.id);

test('sorting by input price puts :free variants first and non-USD prices last, either direction', () => {
  const asc = sorted('input', 'asc');
  // Every $0 Model leads; within the tie, :free variants come first.
  assert.deepEqual(asc.slice(0, 3), [...FREE_VARIANTS].sort());
  assert.deepEqual(asc.slice(3, 6).sort(), ['inclusionai/ling-3.1-flash', 'openrouter/free', 'respan/span-01-lite']);
  assert.equal(asc[6], 'typesafe/jev-1.13');   // $0.042, cheapest paid
  // openrouter/auto (variable) and the unpriced media Models trail.
  const notUsd = allModels().filter(r => r.prices.input.kind !== 'usd').map(r => r.id).sort();
  assert.ok(notUsd.includes('openrouter/auto') && notUsd.includes('google/veo-3.1'));
  assert.deepEqual(asc.slice(-notUsd.length).sort(), notUsd);
  const desc = sorted('input', 'desc');
  assert.equal(desc[0], 'microsoft/mai-transcribe-1.5');   // $360,000/1M
  assert.deepEqual(desc.slice(-notUsd.length).sort(), notUsd);
});

test('sorting by output price is ascending in USD with the cheapest first', () => {
  const ids = sorted('output', 'asc');
  const usd = ids.map(id => row(id).prices.output).filter(p => p.kind === 'usd').map(p => p.usd);
  assert.deepEqual(usd, [...usd].sort((a, b) => a - b));
});

test('sorting by context length puts unknown lengths last, either direction', () => {
  for (const dir of ['asc', 'desc']) {
    const lens = sorted('contextLength', dir).map(id => row(id).contextLength);
    const firstNull = lens.indexOf(null);
    assert.ok(firstNull > 0, dir);
    assert.ok(lens.slice(firstNull).every(l => l === null), dir);
    const known = lens.slice(0, firstNull);
    const ordered = [...known].sort((a, b) => dir === 'asc' ? a - b : b - a);
    assert.deepEqual(known, ordered, dir);
  }
});

test('sorting by name, Author and date added', () => {
  assert.equal(sorted('name', 'asc')[0], 'anthropic/claude-opus-5.5');   // "Anthropic: …"
  assert.equal(sorted('author', 'desc')[0], 'voyageai/voyage-code-4');
  assert.equal(sorted('created', 'asc')[0], 'openrouter/auto');
  assert.equal(sorted('created', 'desc')[0], 'stepfun/step-5-preview');
});

test('an unknown sort key falls back to the page default, newest first', () => {
  assert.equal(sorted('nonsense', 'asc')[0], 'stepfun/step-5-preview');
});

test('~-latest aliases appear on All models and on no other page', () => {
  const ALIAS = '~anthropic/claude-opus-latest';
  const pages = buildPages({ catalogue }, {}, NOW);
  assert.ok(pages.allModels.some(r => r.id === ALIAS));
  for (const [page, rows] of Object.entries(pages)) {
    if (page === 'allModels' || page === 'authors') continue;
    assert.ok(!rows.some(r => r.id === ALIAS), page);
  }
});

test('buildPages lists every Author in the catalogue, whatever the filters', () => {
  const { authors } = buildPages({ catalogue }, { author: 'openai', search: 'zzz' }, NOW);
  assert.equal(authors[0], 'anthropic');
  assert.ok(authors.includes('poolside') && authors.includes('openrouter'));
  assert.equal(new Set(authors).size, authors.length);
  assert.deepEqual(authors, [...authors].sort());
});
