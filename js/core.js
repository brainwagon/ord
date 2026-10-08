// The dashboard's pure core: raw OpenRouter responses + viewer settings + the
// current time in, the rows each page shows out. No DOM, no network.
import { videoRates } from './video-pricing.js';
import { transcriptionPage } from './transcription.js';
import { decisionsPage } from './decisions.js';
import { audioPage } from './audio.js';
import { imagePage } from './image.js';

/**
 * The core's single public entry point.
 *
 * Returns ordered rows per page, keyed by page id: `allModels`, `whatsNew`,
 * `code`, `image`, `transcription`, `decisions`, `audio` and `video`.
 * What's new lists every New model in the catalogue (any kind, aliases
 * excluded); its rows add `badges.pages`, the ids of every Capability page
 * the Model appears on (see CAPABILITY_PAGES), in tab order.
 *
 * Also returns `authors`: every Author in the catalogue, sorted, whatever the
 * filters (for the Author filter's choices).
 *
 * Every row has the core fields: id, name, author, created (ms epoch),
 * contextLength (null when unknown), description, url, and
 * `badges: {expires: 'YYYY-MM-DD' | null, free: boolean, new: boolean}`
 * (free = a `:free` variant; new = a New model, created no earlier than
 * `newWindowDays` before `now`). Pages add their own fields and badges; All models adds
 * `prices: {input, output}`, each a Price:
 *   {kind: 'usd', usd}   USD per 1M tokens ($0 only for a free offering)
 *   {kind: 'variable'}   the API's -1 (routers)
 *   {kind: 'unpriced'}   zero on a Model that isn't a free offering
 *
 * Code adds `codingIndex` (Artificial Analysis, null when unscored), the same
 * `prices: {input, output}`, `extraPrices` ({cacheRead, cacheWrite,
 * cacheWrite1h, reasoning} per 1M tokens and {webSearch} per search, each a
 * Price, only those the API gives), and badges `reasoning: boolean` (has a
 * `reasoning` field) and `tiered`: null, or the higher-rate tiers
 * [{minPromptTokens, input, output, extraPrices}].
 *
 * Transcription (js/transcription.js) adds `perMinute`, a Cost per minute of
 * audio; its Workload is minutes of audio (default 60), costed per second for
 * Models with one input price and no output price, "unit unclear" above
 * $0.01/s, and per-token for Models with both prices.
 *
 * Audio (js/audio.js) adds `charPrice` (USD per 1M characters, or null)
 * and `billing` (how the Model is billed); its Workload is characters to speak.
 *
 * Every page with a Workload (WORKLOADS; Code, Transcription, Decisions, Audio) adds `cost`, a Cost:
 * {kind: 'usd', usd} for the viewer's Workload, or {kind: 'reason', reason}
 * with one of REASONS. Code's cost is input tokens × `prompt` + output tokens
 * × `completion`, at the base tier. Sorting by cost puts USD amounts first,
 * ascending, then every reason, in either direction.
 *
 * Every page drops `~…-latest` aliases (All models keeps them), applies the
 * filters, and sorts. Sorting by a Price puts USD amounts first, so $0 (with
 * `:free` variants first among ties), and any other kind last in either
 * direction; unknown values (null) also sort last. Ties go `:free` first
 * (among equal known values), then newest first.
 *
 * @param {{catalogue: {data: object[]}}} sources raw API responses, as fetched
 *   (plus `videoModels` and `imagePricing` once the shell has loaded them)
 * @param {{hideFree?: boolean, author?: string, search?: string, reasoningOnly?: boolean,
 *   sort?: {key: string, dir: 'asc'|'desc'}, newWindowDays?: number,
 *   workloads?: {[pageId: string]: {[inputKey: string]: any}}}} settings
 *   the viewer's settings. `newWindowDays` is the "new" window (default 30).
 *   `search` matches name or id, case-insensitively. Sort keys: name, author,
 *   created, contextLength, plus each page's own (All models: input, output;
 *   Code: codingIndex, input, output; any page with a Workload: cost); an
 *   unknown key means the page's default order (newest first; Code: coding
 *   index, highest first). `reasoningOnly` narrows Code to reasoning Models.
 *   `workloads` holds each page's Workload values (see workloadValues).
 * @param {number} now current time, ms since the epoch
 * @returns {{authors: string[], allModels: object[], whatsNew: object[], code: object[]}}
 */
export function buildPages(sources, settings, now) {
  const models = sources.catalogue.data;
  const authors = [...new Set(models.map(m => authorOf(m.id)))].sort();
  const isNew = isNewModel(settings, now);
  return {
    authors,
    allModels: buildPage(models, settings, ALL_MODELS, isNew),
    whatsNew: buildPage(models.filter(isNew), settings, WHATS_NEW, isNew),
    code: buildPage(models, settings, CODE, isNew, sources),
    image: buildPage(models, settings, IMAGE, isNew, sources),
    transcription: buildPage(models, settings, TRANSCRIPTION, isNew, sources),
    decisions: buildPage(models, settings, DECISIONS, isNew, sources),
    audio: buildPage(models, settings, AUDIO, isNew, sources),
    video: buildPage(models, settings, VIDEO, isNew, sources),
  };
}

const DAY_MS = 86_400_000;
const DEFAULT_NEW_WINDOW_DAYS = 30;

// A New model: `created` within the viewer's "new" window before `now`
// (inclusive at the window's far edge; anything created after `now` counts).
function isNewModel(settings, now) {
  const days = settings.newWindowDays > 0 ? settings.newWindowDays : DEFAULT_NEW_WINDOW_DAYS;
  const since = now - days * DAY_MS;
  return m => m.created * 1000 >= since;
}

// What's new: every New model in the catalogue, whatever its kind.
const WHATS_NEW = {
  includeAliases: false,
  rowOf: whatsNewRow,
  sortKeys: {},
};

function whatsNewRow(m) {
  const row = coreFields(m);
  row.badges.pages = capabilityPagesOf(m);
  return row;
}

// Page membership: the single registry of Capability pages, in tab order,
// each with the predicate deciding (from `architecture.output_modalities`)
// whether a Model appears on it. Capability pages filter their Models with
// these, and What's new badges each Model with the ids of every page here it
// qualifies for, so a page joins both just by being listed. Aliases are
// dropped by the shared pipeline, not here.
const outputs = m => m.architecture?.output_modalities || [];
const outputsAny = (...kinds) => m => outputs(m).some(o => kinds.includes(o));
const CAPABILITY_PAGES = [
  { id: 'code', includes: m => outputs(m).includes('text') &&
      !outputs(m).some(o => ['decisions', 'embeddings', 'rerank'].includes(o)) },
  { id: 'image', includes: outputsAny('image') },
  { id: 'audio', includes: outputsAny('speech', 'audio') },
  { id: 'video', includes: outputsAny('video') },
  { id: 'transcription', includes: outputsAny('transcription') },
  { id: 'decisions', includes: outputsAny('decisions') },
];

// The ids of every Capability page this Model appears on, in tab order.
function capabilityPagesOf(m) {
  return CAPABILITY_PAGES.filter(p => p.includes(m)).map(p => p.id);
}

// A page definition: how to turn a Model into the page's row, the extra
// columns it can be sorted on (key -> the row's value for that column), and
// whether it lists `~…-latest` aliases (only All models does). Optional:
// `includes(model)` (page membership), `keep(row, settings)` (a page-only
// filter), `defaultSort` ({key, dir}; otherwise newest first) and
// `workload`.
//
// Plugging in a Workload. A page that costs work gives
//   workload: {
//     id,       // its key in settings.workloads and WORKLOADS (the page id)
//     inputs,   // [WorkloadInput], see WORKLOADS
//     cost: (model, workload, sources) => Cost,
//   }
// and adds it to WORKLOADS. `cost` is pure: the raw API model, the Workload's
// values ({[input key]: value}, defaults filled in from `inputs`, numbers
// clamped to >= 0) and the raw `sources` (for extra price data, which may not
// be loaded). It returns a Cost:
//   {kind: 'usd', usd}             the Model's cost for the Workload, in USD
//   {kind: 'reason', reason}       no cost; `reason` is one of REASONS
// The shared pipeline then puts it on each row as `row.cost`, makes the page
// sortable by `cost` (USD amounts ascending, $0 and `:free` first, every
// reason after them in either direction) and checks the reason. The shell
// renders the inputs and the cost column from these alone (js/app.js), so a
// page needs nothing else.
const ALL_MODELS = {
  includeAliases: true,
  rowOf: allModelsRow,
  sortKeys: { input: r => r.prices.input, output: r => r.prices.output },
};

// Code: membership from the registry (text output, but not decisions,
// embeddings or rerank). Workload: tokens in and out, priced at the base tier.
const CODE_WORKLOAD = {
  id: 'code',
  inputs: [
    { key: 'inputTokens', label: 'Input tokens', default: 3_000_000, step: 100_000 },
    { key: 'outputTokens', label: 'Output tokens', default: 1_000_000, step: 100_000 },
  ],
  cost: (m, w) => tokenCost(m, [[m.pricing.prompt, w.inputTokens], [m.pricing.completion, w.outputTokens]]),
};

const CODE = {
  workload: CODE_WORKLOAD,
  includes: CAPABILITY_PAGES.find(p => p.id === 'code').includes,
  rowOf: codeRow,
  keep: (r, settings) => !settings.reasoningOnly || r.badges.reasoning,
  sortKeys: {
    codingIndex: r => r.codingIndex,
    input: r => r.prices.input,
    output: r => r.prices.output,
  },
  defaultSort: { key: 'codingIndex', dir: 'desc' },
};

// Video: membership from the registry (video output). Its prices come from
// the video-models listing (`sources.videoModels`, fetched when the tab is
// first opened), normalised to USD per second by video-pricing.js; the
// catalogue's $0 video prices are never used. Workload: seconds of video, with
// audio on or off, costed at the matching rate (and never below a Model's
// minimum charge per clip).
const VIDEO_WORKLOAD = {
  id: 'video',
  inputs: [
    { key: 'seconds', label: 'Seconds of video', default: 8, step: 1 },
    { key: 'audio', label: 'Audio', default: 'on', options: [{ value: 'on', label: 'on' }, { value: 'off', label: 'off' }] },
  ],
  cost: (m, w, sources) => {
    const v = videoRates(m.id, sources.videoModels);
    const rate = toVideoPrice(w.audio === 'on' ? v.withAudio : v.withoutAudio);
    if (rate.kind !== 'usd') return rate;
    return { kind: 'usd', usd: w.seconds > 0 ? Math.max(rate.usd * w.seconds, v.minimumUsd) : 0 };
  },
};

const VIDEO = {
  workload: VIDEO_WORKLOAD,
  includes: CAPABILITY_PAGES.find(p => p.id === 'video').includes,
  rowOf: videoRow,
  sortKeys: { withAudio: r => r.rates.withAudio, withoutAudio: r => r.rates.withoutAudio },
};

// A video-pricing.js Rate as a Price ({kind: 'usd', usd} per second) or a Cost reason.
const toVideoPrice = r => r.reason ? reason(REASONS[r.reason]) : { kind: 'usd', usd: r.usd };

// Video rows add `rates: {withAudio, withoutAudio}` (USD per second, or a
// reason), `minimumUsd` (the least a clip costs; 0 when none), `skus` (the
// listing's raw pricing_skus, null until loaded) and badge `silent` (the
// listing says the Model doesn't generate audio).
function videoRow(m, sources) {
  const core = coreFields(m), v = videoRates(m.id, sources.videoModels);
  const listed = v.skus && sources.videoModels.data.find(x => x.id === m.id);
  return {
    ...core,
    badges: { ...core.badges, silent: listed?.generate_audio === false },
    rates: { withAudio: toVideoPrice(v.withAudio), withoutAudio: toVideoPrice(v.withoutAudio) },
    minimumUsd: v.minimumUsd,
    skus: v.skus,
  };
}

// The default order for a page that doesn't give its own `defaultSort`.
const NEWEST_FIRST = { key: 'created', dir: 'desc' };

// Columns every page can be sorted on.
const CORE_SORT_KEYS = {
  name: r => r.name,
  author: r => r.author,
  created: r => r.created,
  contextLength: r => r.contextLength,
};

// The pipeline every page shares: the page's rows, each badged "new" when it's
// a New model (`isNew`, from isNewModel), through the viewer's filters, in the
// viewer's sort order (newest first by default).
function buildPage(models, settings, page, isNew, sources) {
  const author = settings.author || '';
  const search = (settings.search || '').trim().toLowerCase();
  const costOf = page.workload ? workloadCoster(page.workload, settings, sources) : null;
  const rows = models
    .filter(m => page.includeAliases || !m.alias_target)
    .filter(m => !page.includes || page.includes(m))
    .map(m => {
      const row = page.rowOf(m, sources);
      row.badges.new = isNew(m);
      if (costOf) row.cost = costOf(m);
      return row;
    })
    .filter(r => !page.keep || page.keep(r, settings))
    .filter(r => !(settings.hideFree && r.badges.free))
    .filter(r => !author || r.author === author)
    .filter(r => !search || r.id.toLowerCase().includes(search) || r.name.toLowerCase().includes(search));
  const sortKeys = { ...CORE_SORT_KEYS, ...page.sortKeys, ...(costOf && { cost: r => r.cost }) };
  const asked = settings.sort || {};
  const { key, dir } = sortKeys[asked.key] ? asked : page.defaultSort || NEWEST_FIRST;
  const valueOf = sortKeys[key];
  const sign = dir === 'desc' ? -1 : 1;
  // Ties: `:free` variants first among equal values (so first among $0
  // prices), then newest first, then by id.
  return rows.sort((a, b) =>
    compareValues(valueOf(a), valueOf(b), sign) ||
    (isKnown(valueOf(a)) && b.badges.free - a.badges.free) ||
    b.created - a.created ||
    a.id.localeCompare(b.id));
}

// Every reason a cost can be unavailable. A cost rule returns
// {kind: 'reason', reason: REASONS.…}; anything else is an error.
export const REASONS = Object.freeze({
  perToken: 'per-token pricing',     // billed by the token, not by the Workload's unit
  unpriced: 'unpriced',              // OpenRouter lists zero, and it isn't a free offering
  unitUnclear: 'unit unclear',       // a price whose unit can't be pinned down
  variable: 'variable',              // the API's -1: a router, priced by what it picks
  notLoaded: 'pricing data not loaded',  // the extra source this page needs is missing
  byResolution: 'priced by resolution',  // the rate depends on a resolution the Workload doesn't set
});
const REASON_SET = new Set(Object.values(REASONS));

// Transcription: minutes of audio, priced per second (js/transcription.js).
const TRANSCRIPTION = transcriptionPage({ REASONS, coreFields, includes: CAPABILITY_PAGES.find(p => p.id === 'transcription').includes });

// Decisions: a batch of decisions, priced on input tokens (js/decisions.js).
const DECISIONS = decisionsPage({ coreFields, tokenCost, includes: CAPABILITY_PAGES.find(p => p.id === 'decisions').includes });

// Audio: characters to speak, priced per character (js/audio.js).
const AUDIO = audioPage({ REASONS, coreFields, includes: CAPABILITY_PAGES.find(p => p.id === 'audio').includes });

// Image: a number of images at a resolution, priced per image (js/image.js).
const IMAGE = imagePage({ REASONS, coreFields, includes: CAPABILITY_PAGES.find(p => p.id === 'image').includes });

/**
 * Each page's Workload inputs, keyed by page id, for the shell to render. A
 * WorkloadInput is {key, label, default, ...}: a number (`step`, `min`
 * optional, min defaults to 0) unless it gives `options` ([{value, label}],
 * a choice; `default` is one of the values). The viewer's values live in
 * `settings.workloads[pageId][key]`; missing or invalid ones mean the default.
 */
export const WORKLOADS = Object.freeze(Object.fromEntries(
  [CODE_WORKLOAD, IMAGE.workload, TRANSCRIPTION.workload, DECISIONS.workload, AUDIO.workload, VIDEO_WORKLOAD].map(w => [w.id, w.inputs])));

/** A page's Workload values: the viewer's, with defaults for anything missing or invalid. */
export function workloadValues(pageId, settings) {
  const asked = settings.workloads?.[pageId] || {};
  return Object.fromEntries((WORKLOADS[pageId] || []).map(input => [input.key, inputValue(input, asked[input.key])]));
}

function inputValue(input, v) {
  if (input.options) return input.options.some(o => o.value === v) ? v : input.default;
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? Math.max(input.min ?? 0, n) : input.default;
}

// A page's Model -> Cost for the viewer's Workload, checking what the rule returns.
function workloadCoster(workload, settings, sources) {
  const values = workloadValues(workload.id, settings);
  return m => {
    const c = workload.cost(m, values, sources);
    if (c?.kind === 'usd' && Number.isFinite(c.usd) && c.usd >= 0) {
      return { kind: 'usd', usd: Number(c.usd.toPrecision(12)) };
    }
    if (c?.kind === 'reason' && REASON_SET.has(c.reason)) return c;
    throw new Error(`${workload.id} cost rule gave ${JSON.stringify(c)} for ${m.id}`);
  };
}

const reason = r => ({ kind: 'reason', reason: r });

// The cost of [[USD-per-unit price string, units], …] on a Model: any -1 makes
// it variable, a zero price on a Model that isn't token-priced makes it
// unpriced (see isTokenPriced), otherwise the sum.
function tokenCost(m, terms) {
  let usd = 0;
  for (const [price, units] of terms) {
    const v = Number(price);
    if (v < 0) return reason(REASONS.variable);
    if (v === 0 && !isTokenPriced(m)) return reason(REASONS.unpriced);
    usd += v * units;
  }
  return { kind: 'usd', usd };
}

// Orders two column values; `sign` is 1 ascending, -1 descending. Missing
// values (null) and Prices that aren't a USD amount sort last either way.
function compareValues(a, b, sign) {
  if (a && typeof a === 'object') a = a.kind === 'usd' ? a.usd : null;
  if (b && typeof b === 'object') b = b.kind === 'usd' ? b.usd : null;
  if (a === null || b === null) return (a === null) - (b === null);
  const c = typeof a === 'string' ? a.localeCompare(b) : a - b;
  return sign * c;
}

const isKnown = v => v !== null && (typeof v !== 'object' || v.kind === 'usd');

const authorOf = id => id.replace(/^~/, '').split('/')[0];

// Fields every page's rows share.
function coreFields(m) {
  return {
    id: m.id,
    name: m.name,
    author: authorOf(m.id),
    created: m.created * 1000,
    contextLength: m.context_length || null,
    description: m.description || '',
    url: 'https://openrouter.ai/' + m.id,
    badges: {
      expires: m.expiration_date || null,
      free: m.id.endsWith(':free'),
    },
  };
}

function codeRow(m) {
  const core = coreFields(m);
  const p = m.pricing, zeroIsFree = isTokenPriced(m);
  // Only prompt-length tiers count; some overrides are by time of day instead.
  const tiers = (p.overrides || []).filter(o => o.min_prompt_tokens != null).map(o => ({
    minPromptTokens: o.min_prompt_tokens,
    input: perMillionTokens(o.prompt, zeroIsFree),
    output: perMillionTokens(o.completion, zeroIsFree),
    extraPrices: extraPrices(o),
  }));
  return {
    ...core,
    badges: { ...core.badges, reasoning: 'reasoning' in m, tiered: tiers.length ? tiers : null },
    codingIndex: m.benchmarks?.artificial_analysis?.coding_index ?? null,
    prices: {
      input: perMillionTokens(p.prompt, zeroIsFree),
      output: perMillionTokens(p.completion, zeroIsFree),
    },
    extraPrices: extraPrices(p),
  };
}

// The secondary text-model prices (shown on hover), keyed by our name: the
// API's per-token prices as USD per 1M tokens, and web search per search.
// Only those the API gives are present.
const EXTRA_TOKEN_PRICES = {
  cacheRead: 'input_cache_read',
  cacheWrite: 'input_cache_write',
  cacheWrite1h: 'input_cache_write_1h',
  reasoning: 'internal_reasoning',
};
function extraPrices(pricing) {
  const out = {};
  for (const [name, field] of Object.entries(EXTRA_TOKEN_PRICES)) {
    if (pricing[field] != null) out[name] = perMillionTokens(pricing[field], true);
  }
  if (pricing.web_search != null) out.webSearch = { kind: 'usd', usd: Number(pricing.web_search) };
  return out;
}

function allModelsRow(m) {
  const zeroIsFree = isTokenPriced(m);
  return {
    ...coreFields(m),
    prices: {
      input: perMillionTokens(m.pricing.prompt, zeroIsFree),
      output: perMillionTokens(m.pricing.completion, zeroIsFree),
    },
  };
}

// Kinds of output OpenRouter bills by the token, so a zero token price there
// is genuinely free. Everything else (image, video, speech, audio,
// transcription, rerank) is priced elsewhere or not at all when it shows zero.
const TOKEN_BILLED_OUTPUTS = new Set(['text', 'decisions', 'embeddings']);

// Whether a zero token price on this Model means "free" rather than "unpriced":
// it's a `:free` variant, or everything it outputs is billed by the token.
function isTokenPriced(m) {
  return m.id.endsWith(':free') ||
    m.architecture.output_modalities.every(o => TOKEN_BILLED_OUTPUTS.has(o));
}

// API prices are USD-per-token strings; "-1" means variable (routers).
// Rounding to 12 significant digits removes the float noise scaling adds.
function perMillionTokens(s, zeroIsFree) {
  const v = Number(s);
  if (v < 0) return { kind: 'variable' };
  if (v === 0 && !zeroIsFree) return { kind: 'unpriced' };
  return { kind: 'usd', usd: Number((v * 1e6).toPrecision(12)) };
}
