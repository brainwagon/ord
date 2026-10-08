import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPages, WORKLOADS, REASONS, workloadValues } from '../js/core.js';

// Real /api/v1/models?output_modalities=all responses captured 2026-10-08,
// trimmed to 35 Models (each object byte-for-byte as returned).
const catalogue = JSON.parse(readFileSync(new URL('./fixtures/catalogue.json', import.meta.url), 'utf8'));
const NOW = Date.parse('2026-10-08T12:00:00Z');

const allModels = () => buildPages({ catalogue }, {}, NOW).allModels;
const row = id => allModels().find(r => r.id === id);

test('All models lists every catalogue entry, including aliases, embeddings, rerank and routers', () => {
  const ids = allModels().map(r => r.id);
  assert.equal(ids.length, 35);
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
  assert.equal(ids.length, 35 - FREE_VARIANTS.length);
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
  assert.equal(sorted('author', 'desc')[0], 'x-ai/grok-4.6');
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

// --- Code page ---

const code = (settings = {}) => buildPages({ catalogue }, settings, NOW).code;
const codeRow = id => code().find(r => r.id === id);

test('Code lists every Model whose outputs include text, except aliases', () => {
  assert.deepEqual(code().map(r => r.id).sort(), [
    'anthropic/claude-opus-5.5', 'google/gemini-3.1-flash-image', 'google/gemini-3.8-flash',
    'google/gemini-nano-banana-2.1', 'google/lyria-3-pro-preview', 'inclusionai/ling-3.1-flash',
    'mistralai/devstral-2512', 'openai/gpt-6.1-sol', 'openai/gpt-audio', 'openai/gpt-chat-latest',
    'openrouter/auto', 'openrouter/free', 'poolside/laguna-s-2.1', 'poolside/laguna-s-2.1:free',
    'stepfun/step-5-preview', 'tencent/hy3', 'x-ai/grok-4.6',
  ]);
});

test('Code excludes decisions, embeddings and rerank Models even when they also output text', () => {
  const withText = (id, outputs) => {
    const m = structuredClone(catalogue.data.find(m => m.id === id));
    m.id += '-with-text';
    m.architecture.output_modalities = outputs;
    return m;
  };
  const extra = [withText('typesafe/jev-1.13', ['text', 'decisions']),
                 withText('voyageai/voyage-code-4', ['embeddings', 'text']),
                 withText('cohere/rerank-4-fast', ['text', 'rerank'])];
  const ids = buildPages({ catalogue: { data: [...catalogue.data, ...extra] } }, {}, NOW).code.map(r => r.id);
  for (const m of extra) assert.ok(!ids.includes(m.id), m.id);
});

test('Code lists by Artificial Analysis coding index, highest first, then unscored Models newest first', () => {
  const rows = code();
  assert.deepEqual(rows.slice(0, 3).map(r => [r.id, r.codingIndex]), [
    ['x-ai/grok-4.6', 76.8], ['google/gemini-3.8-flash', 76.3], ['mistralai/devstral-2512', 31.3],
  ]);
  const unscored = rows.slice(3);
  assert.ok(unscored.every(r => r.codingIndex === null));
  assert.deepEqual(unscored.map(r => r.created), unscored.map(r => r.created).sort((a, b) => b - a));
  assert.equal(unscored[0].id, 'stepfun/step-5-preview');
});

test('Code can be sorted by coding index either way, unscored Models always last', () => {
  const asc = code({ sort: { key: 'codingIndex', dir: 'asc' } }).map(r => r.id);
  assert.deepEqual(asc.slice(0, 3), ['mistralai/devstral-2512', 'google/gemini-3.8-flash', 'x-ai/grok-4.6']);
  assert.deepEqual(code({ sort: { key: 'codingIndex', dir: 'desc' } }).slice(0, 3).map(r => r.id),
    ['x-ai/grok-4.6', 'google/gemini-3.8-flash', 'mistralai/devstral-2512']);
});

const REASONING = [
  'anthropic/claude-opus-5.5', 'google/gemini-3.1-flash-image', 'google/gemini-3.8-flash',
  'google/gemini-nano-banana-2.1', 'inclusionai/ling-3.1-flash', 'openai/gpt-6.1-sol',
  'poolside/laguna-s-2.1', 'poolside/laguna-s-2.1:free', 'stepfun/step-5-preview', 'tencent/hy3',
  'x-ai/grok-4.6',
];

test('a Code Model carries a "reasoning" badge exactly when it has a reasoning field', () => {
  assert.deepEqual(code().filter(r => r.badges.reasoning).map(r => r.id).sort(), REASONING);
  assert.equal(codeRow('mistralai/devstral-2512').badges.reasoning, false);
  assert.equal(codeRow('openrouter/free').badges.reasoning, false);
});

test('the reasoning toggle is off by default, and on shows only reasoning Models', () => {
  assert.equal(code().length, 17);
  assert.equal(code({ reasoningOnly: false }).length, 17);
  assert.deepEqual(code({ reasoningOnly: true }).map(r => r.id).sort(), REASONING);
  // It narrows Code only.
  assert.equal(buildPages({ catalogue }, { reasoningOnly: true }, NOW).allModels.length, 35);
});

const usd = v => ({ kind: 'usd', usd: v });

test('Code shows input and output prices per 1M tokens', () => {
  assert.deepEqual(codeRow('x-ai/grok-4.6').prices, { input: usd(2), output: usd(6) });
  assert.deepEqual(codeRow('mistralai/devstral-2512').prices, { input: usd(0.4), output: usd(2) });
  assert.deepEqual(codeRow('poolside/laguna-s-2.1:free').prices, { input: usd(0), output: usd(0) });
  assert.deepEqual(codeRow('openrouter/auto').prices,
    { input: { kind: 'variable' }, output: { kind: 'variable' } });
});

test('Code carries cache, reasoning and web-search prices for hover, where the API gives them', () => {
  // Token prices per 1M tokens; web search in USD per search.
  assert.deepEqual(codeRow('google/gemini-3.8-flash').extraPrices, {
    cacheRead: usd(0.075), cacheWrite: usd(0.0416666666667), reasoning: usd(3.75), webSearch: usd(0.014),
  });
  assert.deepEqual(codeRow('anthropic/claude-opus-5.5').extraPrices, {
    cacheRead: usd(0.2), cacheWrite: usd(5), cacheWrite1h: usd(8), webSearch: usd(0.01),
  });
  assert.deepEqual(codeRow('mistralai/devstral-2512').extraPrices, { cacheRead: usd(0.04) });
  assert.deepEqual(codeRow('openrouter/free').extraPrices, {});
});

test('a Code Model with tiered overrides is badged "tiered", carrying the higher rates', () => {
  assert.deepEqual(codeRow('openai/gpt-6.1-sol').badges.tiered, [{
    minPromptTokens: 272000, input: usd(4), output: usd(15),
    extraPrices: { cacheRead: usd(0.2), cacheWrite: usd(5) },
  }]);
  assert.deepEqual(codeRow('x-ai/grok-4.6').badges.tiered, [{
    minPromptTokens: 200000, input: usd(4), output: usd(12), extraPrices: { cacheRead: usd(1) },
  }]);
  // The base rates stay the Model's prices.
  assert.deepEqual(codeRow('openai/gpt-6.1-sol').prices, { input: usd(2), output: usd(10) });
  const tiered = code().filter(r => r.badges.tiered).map(r => r.id).sort();
  assert.deepEqual(tiered, ['openai/gpt-6.1-sol', 'x-ai/grok-4.6']);
  assert.equal(codeRow('anthropic/claude-opus-5.5').badges.tiered, null);
  // Time-of-day overrides (utc_start/utc_end) aren't prompt-length tiers.
  assert.equal(codeRow('tencent/hy3').badges.tiered, null);
});

// --- What's new ---------------------------------------------------------------

const DAY = 86_400_000;
const whatsNew = (settings = {}, now = NOW) =>
  buildPages({ catalogue }, settings, now).whatsNew;

test('What\'s new lists the Models added in the last 30 days by default, newest first', () => {
  assert.deepEqual(whatsNew().map(r => r.id), [
    'stepfun/step-5-preview', 'elevenlabs/eleven-v4', 'google/gemini-nano-banana-2.1',
    'inclusionai/ling-3.1-flash', 'bytedance-seed/seedream-5-0-flash',
    'black-forest-labs/flux-3-image', 'cloudflare/clef', 'inception/mercury-decide:free',
    'openai/gpt-6.1-sol', 'respan/span-01-lite', 'anthropic/claude-opus-5.5',
    'typesafe/jev-1.13',
  ]);
});

test('a Model is New up to exactly the end of the "new" window, and not a millisecond after', () => {
  const JEV = 'typesafe/jev-1.13';
  const added = 1789689684 * 1000;   // its `created`
  assert.equal(catalogue.data.find(m => m.id === JEV).created * 1000, added);
  assert.ok(whatsNew({}, added + 30 * DAY).some(r => r.id === JEV));
  assert.ok(!whatsNew({}, added + 30 * DAY + 1).some(r => r.id === JEV));
  assert.ok(whatsNew({ newWindowDays: 7 }, added + 7 * DAY).some(r => r.id === JEV));
  assert.ok(!whatsNew({ newWindowDays: 7 }, added + 7 * DAY + 1).some(r => r.id === JEV));
});

test('changing the "new" window narrows or widens What\'s new', () => {
  assert.deepEqual(whatsNew({ newWindowDays: 1 }).map(r => r.id),
    ['stepfun/step-5-preview', 'elevenlabs/eleven-v4']);
  assert.equal(whatsNew({ newWindowDays: 60 }).length, 17);
});

test('What\'s new includes kinds with no Capability page (embeddings, rerank, routers) but no aliases', () => {
  const ids = whatsNew({ newWindowDays: 5000 }).map(r => r.id);
  assert.equal(ids.length, 34);   // the whole fixture but its one alias
  for (const id of ['voyageai/voyage-code-4', 'cohere/rerank-4-fast', 'openrouter/auto']) {
    assert.ok(ids.includes(id), id);
  }
  assert.ok(!ids.includes('~anthropic/claude-opus-latest'));
});

const pagesOf = id => whatsNew({ newWindowDays: 5000 }).find(r => r.id === id).badges.pages;

test('each What\'s new row is badged with every Capability page its Model appears on', () => {
  assert.deepEqual(pagesOf('google/gemini-nano-banana-2.1'), ['code', 'image']);
  assert.deepEqual(pagesOf('anthropic/claude-opus-5.5'), ['code']);
  assert.deepEqual(pagesOf('openai/gpt-audio'), ['code', 'audio']);
  assert.deepEqual(pagesOf('elevenlabs/eleven-v4'), ['audio']);
  assert.deepEqual(pagesOf('google/veo-3.1'), ['video']);
  assert.deepEqual(pagesOf('openai/whisper-1'), ['transcription']);
  assert.deepEqual(pagesOf('cloudflare/clef'), ['decisions']);
  assert.deepEqual(pagesOf('openrouter/auto'), ['code', 'image']);
});

test('New models carry a "new" badge on every page, following the window', () => {
  const pages = buildPages({ catalogue }, {}, NOW);
  for (const [page, rows] of Object.entries(pages)) {
    if (page === 'authors') continue;
    for (const r of rows) {
      const expected = (NOW - r.created) <= 30 * DAY;
      assert.equal(r.badges.new, expected, `${page} ${r.id}`);
    }
  }
  const all = settings => buildPages({ catalogue }, settings, NOW).allModels;
  const opus = settings => all(settings).find(r => r.id === 'anthropic/claude-opus-5.5').badges.new;
  assert.equal(opus({}), true);
  assert.equal(opus({ newWindowDays: 7 }), false);
  assert.equal(all({}).find(r => r.id === 'openrouter/auto').badges.new, false);
});

test('embeddings and rerank Models appear on no Capability page', () => {
  assert.deepEqual(pagesOf('voyageai/voyage-code-4'), []);
  assert.deepEqual(pagesOf('liquid/lfm-2.5-embedding-350m:free'), []);
  assert.deepEqual(pagesOf('cohere/rerank-4-fast'), []);
});

// --- Workloads and costs ---

const cost = (id, settings = {}) => code(settings).find(r => r.id === id).cost;

test('Code costs each Model for the default Workload of 3M input and 1M output tokens', () => {
  // 3M × $4/M + 1M × $20/M = $12 + $20
  assert.deepEqual(cost('anthropic/claude-opus-5.5'), usd(32));
  // 3M × $1/M + 1M × $2.70/M
  assert.deepEqual(cost('stepfun/step-5-preview'), usd(5.7));
  // 3M × $0.0825/M + 1M × $0.33/M = $0.2475 + $0.33
  assert.deepEqual(cost('tencent/hy3'), usd(0.5775));
  // 3M × $0.09/M + 1M × $0.18/M = $0.27 + $0.18
  assert.deepEqual(cost('poolside/laguna-s-2.1'), usd(0.45));
  assert.deepEqual(cost('poolside/laguna-s-2.1:free'), usd(0));
});

test('the viewer\'s Workload, from settings.workloads.code, changes every cost', () => {
  const settings = { workloads: { code: { inputTokens: 1_000_000, outputTokens: 0 } } };
  assert.deepEqual(cost('anthropic/claude-opus-5.5', settings), usd(4));
  assert.deepEqual(cost('stepfun/step-5-preview', settings), usd(1));
  // 500K × $2/M + 250K × $10/M = $1 + $2.50, at the base tier even when tiered
  const half = { workloads: { code: { inputTokens: 500_000, outputTokens: 250_000 } } };
  assert.deepEqual(cost('openai/gpt-6.1-sol', half), usd(3.5));
  // Only the given input changes; the other keeps its default (1M × $20/M)
  assert.deepEqual(cost('anthropic/claude-opus-5.5', { workloads: { code: { inputTokens: 0 } } }), usd(20));
});

test('a missing, blank or negative Workload value falls back sensibly', () => {
  const w = code => ({ workloads: { code } });
  assert.deepEqual(cost('anthropic/claude-opus-5.5', w({ inputTokens: 'lots', outputTokens: null })), usd(32));
  assert.deepEqual(cost('anthropic/claude-opus-5.5', w({ inputTokens: '2000000', outputTokens: -5 })), usd(8));
  assert.deepEqual(workloadValues('code', {}), { inputTokens: 3_000_000, outputTokens: 1_000_000 });
});

test('variable-priced routers get a "variable" reason, never a cost', () => {
  assert.deepEqual(cost('openrouter/auto'), { kind: 'reason', reason: 'variable' });
  assert.deepEqual(cost('openrouter/auto', { workloads: { code: { inputTokens: 0, outputTokens: 0 } } }),
    { kind: 'reason', reason: 'variable' });
});

test('a zero-priced Model that isn\'t a free offering gets an "unpriced" reason', () => {
  assert.deepEqual(cost('google/lyria-3-pro-preview'), { kind: 'reason', reason: 'unpriced' });
});

test('sorting by cost puts computed costs first, cheapest first with :free leading $0, then every reason', () => {
  for (const dir of ['asc', 'desc']) {
    const rows = code({ sort: { key: 'cost', dir } });
    const known = rows.filter(r => r.cost.kind === 'usd');
    const reasons = rows.slice(known.length);
    assert.ok(reasons.length >= 2 && reasons.every(r => r.cost.kind === 'reason'), dir);
    assert.deepEqual(reasons.map(r => r.id).sort(), ['google/lyria-3-pro-preview', 'openrouter/auto']);
    if (dir === 'asc') {
      assert.equal(rows[0].id, 'poolside/laguna-s-2.1:free');
      assert.deepEqual(known.slice(0, 3).map(r => r.cost.usd), [0, 0, 0]);
      // laguna $0.45, hy3 $0.5775
      assert.deepEqual(known.slice(3, 5).map(r => r.id), ['poolside/laguna-s-2.1', 'tencent/hy3']);
    } else {
      assert.equal(rows[0].id, 'openai/gpt-chat-latest');   // 3 × $5 + $30 = $45
    }
  }
});

test('every Workload input is declared with a key, label and default', () => {
  assert.deepEqual(WORKLOADS.code.map(i => [i.key, i.default]),
    [['inputTokens', 3_000_000], ['outputTokens', 1_000_000]]);
  for (const inputs of Object.values(WORKLOADS)) {
    for (const i of inputs) assert.ok(i.key && i.label && i.default !== undefined, JSON.stringify(i));
  }
  assert.deepEqual(Object.values(REASONS).sort(),
    ['per-token pricing', 'priced by resolution', 'pricing data not loaded', 'unit unclear', 'unpriced', 'variable']);
});

test('pages without a Workload carry no cost', () => {
  const pages = buildPages({ catalogue }, {}, NOW);
  assert.ok(pages.allModels.every(r => !('cost' in r)));
  assert.ok(pages.whatsNew.every(r => !('cost' in r)));
});
