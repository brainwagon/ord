// The dashboard's pure core: raw OpenRouter responses + viewer settings + the
// current time in, the rows each page shows out. No DOM, no network.

/**
 * The core's single public entry point.
 *
 * Returns ordered rows per page, keyed by page id. Today `allModels` and
 * `whatsNew`; later pages add keys alongside them (`code`, `image`, `audio`,
 * `video`, `transcription`, `decisions`). A page with no key isn't built yet.
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
 * Every page drops `~…-latest` aliases (All models keeps them), applies the
 * filters, and sorts. Sorting by a Price puts USD amounts first, so $0 (with
 * `:free` variants first among ties), and any other kind last in either
 * direction; unknown values (null) also sort last.
 *
 * @param {{catalogue: {data: object[]}}} sources raw API responses, as fetched
 *   (later: `videoModels`, `imagePricing` when loaded)
 * @param {{hideFree?: boolean, author?: string, search?: string,
 *   sort?: {key: string, dir: 'asc'|'desc'}, newWindowDays?: number}} settings
 *   the viewer's settings. `newWindowDays` is the "new" window (default 30).
 *   `search` matches name or id, case-insensitively. Sort keys: name, author,
 *   created, contextLength, plus each page's own (All models: input, output);
 *   an unknown key means the page's default order (newest first).
 *   (Later: Workloads, ...)
 * @param {number} now current time, ms since the epoch
 * @returns {{authors: string[], allModels: object[], whatsNew: object[]}}
 */
export function buildPages(sources, settings, now) {
  const models = sources.catalogue.data;
  const authors = [...new Set(models.map(m => authorOf(m.id)))].sort();
  const isNew = isNewModel(settings, now);
  return {
    authors,
    allModels: buildPage(models, settings, ALL_MODELS, isNew),
    whatsNew: buildPage(models.filter(isNew), settings, WHATS_NEW, isNew),
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
// whether it lists `~…-latest` aliases (only All models does).
const ALL_MODELS = {
  includeAliases: true,
  rowOf: allModelsRow,
  sortKeys: { input: r => r.prices.input, output: r => r.prices.output },
};

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
function buildPage(models, settings, page, isNew) {
  const author = settings.author || '';
  const search = (settings.search || '').trim().toLowerCase();
  const rows = models
    .filter(m => page.includeAliases || !m.alias_target)
    .map(m => {
      const row = page.rowOf(m);
      row.badges.new = isNew(m);
      return row;
    })
    .filter(r => !(settings.hideFree && r.badges.free))
    .filter(r => !author || r.author === author)
    .filter(r => !search || r.id.toLowerCase().includes(search) || r.name.toLowerCase().includes(search));
  const sortKeys = { ...CORE_SORT_KEYS, ...page.sortKeys };
  const { key, dir } = settings.sort || {};
  const valueOf = sortKeys[key] || CORE_SORT_KEYS.created;
  const sign = sortKeys[key] ? (dir === 'desc' ? -1 : 1) : -1;
  return rows.sort((a, b) =>
    compareValues(valueOf(a), valueOf(b), sign) ||
    b.badges.free - a.badges.free ||
    a.id.localeCompare(b.id));
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
