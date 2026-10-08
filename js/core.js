// The dashboard's pure core: raw OpenRouter responses + viewer settings + the
// current time in, the rows each page shows out. No DOM, no network.
import { imagePage } from './image.js';
import { audioPage } from './audio.js';
import { videoPage } from './video.js';
import { transcriptionPage } from './transcription.js';
import { decisionsPage } from './decisions.js';
import { parsePrice, roundUsd, reason, usd, isPrice, isFreeVariant } from './pricing.js';

/**
 * The core's single public entry point.
 *
 * Returns ordered rows per page, keyed by page id: `allModels`, `whatsNew`,
 * `code`, `image`, `audio`, `video`, `transcription` and `decisions`.
 * What's new lists every New model in the catalogue (any kind, aliases
 * excluded); its rows add `badges.pages`, the ids of every Capability page
 * the Model appears on (see CAPABILITY_PAGES), in tab order.
 *
 * Also returns `authors`: every Author in the catalogue, sorted, whatever the
 * filters (for the Author filter's choices); and `workloads`: for each page
 * with a Workload, by page id, `{inputs, values}`, its WorkloadInputs (see
 * below) and the values in use (the viewer's, with defaults for anything
 * missing or invalid), for the shell to render.
 *
 * Every row has the core fields: id, name, author, created (ms epoch),
 * contextLength (null when unknown), description, url, and
 * `badges: {expires: 'YYYY-MM-DD' | null, free: boolean, new: boolean}`
 * (free = a `:free` variant; new = a New model, created no earlier than
 * `newWindowDays` before `now`). Pages add their own fields and badges.
 *
 * Every price and cost is one shape (js/pricing.js):
 *   {kind: 'usd', usd}         a USD amount
 *   {kind: 'reason', reason}   none, and why: one of REASONS
 *
 * All models adds `prices: {input, output}`, USD per 1M tokens ($0 only for
 * a free offering; a -1 is "variable", a zero on a Model that isn't a free
 * offering, or a missing price, "unpriced").
 *
 * Code adds `codingIndex` (Artificial Analysis, null when unscored), the same
 * `prices: {input, output}`, `extraPrices` ({cacheRead, cacheWrite,
 * cacheWrite1h, reasoning} per 1M tokens and {webSearch} per search, only
 * those the API gives), and badges `reasoning: boolean` (has a `reasoning`
 * field) and `tiered`: null, or the higher-rate tiers
 * [{minPromptTokens, input, output, extraPrices}]. Its cost is input tokens
 * × `prompt` + output tokens × `completion`, at the base tier.
 *
 * Image (js/image.js), Audio (js/audio.js), Video (js/video.js),
 * Transcription (js/transcription.js) and Decisions (js/decisions.js) each
 * document the fields they add.
 *
 * Every page with a Workload (Code and the five above) adds `cost` for the
 * viewer's Workload. Sorting by cost puts USD amounts first, ascending, then
 * every reason, in either direction.
 *
 * Every page drops `~…-latest` aliases (All models keeps them), applies the
 * filters, and sorts. Sorting by a price puts USD amounts first, so $0 (with
 * `:free` variants first among ties), and every reason last in either
 * direction; unknown values (null) also sort last. Ties go `:free` first
 * (among equal known values), then newest first.
 *
 * @param {{catalogue: {data: object[]}}} sources raw API responses, as fetched
 *   (plus `videoModels` and `imagePricing` once the shell has loaded them)
 * @param {{hideFree?: boolean, author?: string, search?: string, reasoningOnly?: boolean,
 *   sort?: {key: string, dir: 'asc'|'desc'}, newWindowDays?: number,
 *   holdOrder?: {[pageId: string]: string[]},
 *   workloads?: {[pageId: string]: {[inputKey: string]: any}}}} settings
 *   the viewer's settings. `newWindowDays` is the "new" window (default 30).
 *   `search` matches name or id, case-insensitively. Sort keys: name, author,
 *   created, contextLength, plus each page's own (All models: input, output;
 *   Code: codingIndex, input, output; any page with a Workload: cost); an
 *   unknown key means the page's default order (newest first; Code: coding
 *   index, highest first). `reasoningOnly` narrows Code to reasoning Models.
 *   `workloads` holds each page's Workload values, by page id.
 *   `holdOrder` keeps a page's rows in a given order (Model ids, as last
 *   shown), so the shell can update values without reshuffling the table
 *   while data streams in (user story 48); rows it doesn't list follow, in
 *   sort order. It's never remembered.
 * @param {number} now current time, ms since the epoch
 */
export function buildPages(sources, settings, now) {
  const models = sources.catalogue.data;
  const isNew = isNewModel(settings, now);
  const out = {
    authors: [...new Set(models.map(m => authorOf(m.id)))].sort(),
    workloads: {},
  };
  for (const [id, page] of Object.entries(PAGES)) {
    const values = page.workload ? workloadValues(page.workload, settings) : {};
    if (page.workload) out.workloads[id] = { inputs: page.workload.inputs, values };
    out[id] = buildPage(id, page.onlyNew ? models.filter(isNew) : models, settings, page, values, isNew, sources);
  }
  return out;
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

// Page membership: the single registry of Capability pages, in tab order,
// each with the predicate deciding (from `architecture.output_modalities`)
// whether a Model appears on it. Capability pages filter their Models with
// these (see includesOf), and What's new badges each Model with the ids of
// every page here it qualifies for, so a page joins both just by being
// listed. Aliases are dropped by the shared pipeline, not here.
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

// Whether a Model appears on the Capability page `id`.
const includesOf = id => CAPABILITY_PAGES.find(p => p.id === id).includes;

// The ids of every Capability page this Model appears on, in tab order.
const capabilityPagesOf = m => CAPABILITY_PAGES.filter(p => p.includes(m)).map(p => p.id);

// A page definition:
//   rowOf(model, sources, workloadValues)  the page's row (core fields if omitted)
//   sortKeys     the extra columns it can be sorted on (key -> the row's value)
//   includes     page membership (every Model if omitted)
//   includeAliases  whether it lists `~…-latest` aliases (only All models)
//   keep(row, settings)  a page-only filter
//   defaultSort  {key, dir}; otherwise newest first
//   workload     see below
//
// A Capability page's definition comes from its module's factory, which is
// given a PageCore: {coreFields, tokenCost, includes}, the same for every
// page but `includes` (its membership, from the registry).
//
// Plugging in a Workload. A page that costs work gives
//   workload: {
//     id,       // its key in settings.workloads (the page id)
//     inputs,   // [WorkloadInput]
//     cost: (model, workloadValues, sources) => Cost,
//   }
// A WorkloadInput is {key, label, default, ...}: a number (`step`, `min`
// optional, min defaults to 0) unless it gives `options` ([{value, label}],
// a choice; `default` is one of the values). `cost` is pure: the raw API
// model, the Workload's values ({[input key]: value}, defaults filled in,
// numbers clamped to >= min) and the raw `sources` (for extra price data,
// which may not be loaded). It returns a Cost (js/pricing.js). The shared
// pipeline rounds it (roundUsd) and checks it, puts it on each row as
// `row.cost` and makes the page sortable by `cost`; buildPages returns the
// inputs and values under `workloads`. The shell renders the inputs and the
// cost column from these alone (js/app.js), so a page needs nothing else.
/** @typedef {{coreFields: Function, tokenCost: Function, includes: Function}} PageCore */
const pageCore = id => ({ coreFields, tokenCost, includes: includesOf(id) });

// What's new: every New model in the catalogue, whatever its kind.
const WHATS_NEW = {
  onlyNew: true,
  rowOf: m => {
    const row = coreFields(m);
    row.badges.pages = capabilityPagesOf(m);
    return row;
  },
};

const ALL_MODELS = {
  includeAliases: true,
  rowOf: allModelsRow,
  sortKeys: { input: r => r.prices.input, output: r => r.prices.output },
};

// Code: membership from the registry (text output, but not decisions,
// embeddings or rerank). Workload: tokens in and out, priced at the base tier.
function codePage({ coreFields, tokenCost, includes }) {
  return {
    workload: {
      id: 'code',
      inputs: [
        { key: 'inputTokens', label: 'Input tokens', default: 3_000_000, step: 100_000 },
        { key: 'outputTokens', label: 'Output tokens', default: 1_000_000, step: 100_000 },
      ],
      cost: (m, w) => tokenCost(m, [[m.pricing?.prompt, w.inputTokens], [m.pricing?.completion, w.outputTokens]]),
    },
    includes,
    rowOf: m => codeRow(m, coreFields),
    keep: (r, settings) => !settings.reasoningOnly || r.badges.reasoning,
    sortKeys: {
      codingIndex: r => r.codingIndex,
      input: r => r.prices.input,
      output: r => r.prices.output,
    },
    defaultSort: { key: 'codingIndex', dir: 'desc' },
  };
}

// Every page, by the id buildPages returns its rows under, in tab order.
const PAGES = {
  whatsNew: WHATS_NEW,
  code: codePage(pageCore('code')),
  image: imagePage(pageCore('image')),
  audio: audioPage(pageCore('audio')),
  video: videoPage(pageCore('video')),
  transcription: transcriptionPage(pageCore('transcription')),
  decisions: decisionsPage(pageCore('decisions')),
  allModels: ALL_MODELS,
};

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
// viewer's sort order (newest first by default), or the held order.
function buildPage(pageId, models, settings, page, values, isNew, sources) {
  const author = settings.author || '';
  const search = (settings.search || '').trim().toLowerCase();
  const costOf = page.workload ? workloadCoster(page.workload, values, sources) : null;
  const rowOf = page.rowOf || coreFields;
  const rows = models
    .filter(m => page.includeAliases || !m.alias_target)
    .filter(m => !page.includes || page.includes(m))
    .map(m => {
      const row = rowOf(m, sources, values);
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
  rows.sort((a, b) =>
    compareValues(valueOf(a), valueOf(b), sign) ||
    (isKnown(valueOf(a)) && b.badges.free - a.badges.free) ||
    b.created - a.created ||
    a.id.localeCompare(b.id));
  return holdOrder(rows, settings.holdOrder?.[pageId]);
}

// Rows in a held order (ids, as last shown), so values can update without the
// table reshuffling; rows it doesn't list follow, in sort order (the sort is
// stable).
function holdOrder(rows, ids) {
  if (!Array.isArray(ids)) return rows;
  const at = new Map(ids.map((id, i) => [id, i]));
  const place = r => at.get(r.id) ?? Infinity;
  return rows.sort((a, b) => place(a) - place(b) || 0);
}

// A page's Workload values: the viewer's, with defaults for anything missing or invalid.
function workloadValues(workload, settings) {
  const asked = settings.workloads?.[workload.id] || {};
  return Object.fromEntries(workload.inputs.map(input => [input.key, inputValue(input, asked[input.key])]));
}

function inputValue(input, v) {
  if (input.options) return input.options.some(o => o.value === v) ? v : input.default;
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? Math.max(input.min ?? 0, n) : input.default;
}

// A page's Model -> Cost for the viewer's Workload, checking what the rule
// returns and rounding every USD amount once, here (see roundUsd).
function workloadCoster(workload, values, sources) {
  return m => {
    const c = workload.cost(m, values, sources);
    if (!isPrice(c)) throw new Error(`${workload.id} cost rule gave ${JSON.stringify(c)} for ${m.id}`);
    return c.kind === 'usd' ? usd(roundUsd(c.usd)) : c;
  };
}

// The cost of [[USD-per-unit price string, units], …] on a Model: any -1 makes
// it variable, a missing or non-numeric price, or a zero price on a Model that
// isn't token-priced (see isTokenPriced), makes it unpriced; otherwise the sum.
function tokenCost(m, terms) {
  let total = 0;
  for (const [price, units] of terms) {
    const v = parsePrice(price);
    if (v === null) return reason('unpriced');
    if (v < 0) return reason('variable');
    if (v === 0 && !isTokenPriced(m)) return reason('unpriced');
    total += v * units;
  }
  return usd(total);
}

// Orders two column values; `sign` is 1 ascending, -1 descending. Missing
// values (null) and prices that aren't a USD amount sort last either way.
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
      free: isFreeVariant(m.id),
    },
  };
}

function codeRow(m, coreFields) {
  const core = coreFields(m);
  const p = m.pricing || {}, zeroIsFree = isTokenPriced(m);
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
  if (pricing.web_search != null) {
    const v = parsePrice(pricing.web_search);
    out.webSearch = v === null ? reason('unpriced') : v < 0 ? reason('variable') : usd(v);
  }
  return out;
}

function allModelsRow(m) {
  const zeroIsFree = isTokenPriced(m);
  return {
    ...coreFields(m),
    prices: {
      input: perMillionTokens(m.pricing?.prompt, zeroIsFree),
      output: perMillionTokens(m.pricing?.completion, zeroIsFree),
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
  return isFreeVariant(m.id) || outputs(m).every(o => TOKEN_BILLED_OUTPUTS.has(o));
}

// API prices are USD-per-token strings; "-1" means variable (routers), and a
// missing or non-numeric one is unpriced. roundUsd removes the float noise
// scaling adds.
function perMillionTokens(s, zeroIsFree) {
  const v = parsePrice(s);
  if (v === null) return reason('unpriced');
  if (v < 0) return reason('variable');
  if (v === 0 && !zeroIsFree) return reason('unpriced');
  return usd(roundUsd(v * 1e6));
}
