// The dashboard's pure core: raw OpenRouter responses + viewer settings + the
// current time in, the rows each page shows out. No DOM, no network.

/**
 * The core's single public entry point.
 *
 * Returns ordered rows per page, keyed by page id. Today only `allModels`;
 * later pages add keys alongside it (`whatsNew`, `code`, `image`, `audio`,
 * `video`, `transcription`, `decisions`). A page with no key isn't built yet.
 *
 * Every row has the core fields: id, name, author, created (ms epoch),
 * contextLength (null when unknown), description, url. Pages add their own
 * fields; All models adds `prices: {input, output}`, each a Price:
 *   {kind: 'usd', usd}   USD per 1M tokens ($0 only for a free offering)
 *   {kind: 'variable'}   the API's -1 (routers)
 *   {kind: 'unpriced'}   zero on a Model that isn't a free offering
 *
 * @param {{catalogue: {data: object[]}}} sources raw API responses, as fetched
 *   (later: `videoModels`, `imagePricing` when loaded)
 * @param {object} settings the viewer's settings (Workloads, "new" window, ...)
 * @param {number} now current time, ms since the epoch
 * @returns {{allModels: object[]}}
 */
export function buildPages(sources, settings, now) {
  const models = sources.catalogue.data;
  const newestFirst = [...models].sort((a, b) => b.created - a.created || a.id.localeCompare(b.id));
  return { allModels: newestFirst.map(allModelsRow) };
}

// Fields every page's rows share.
function coreFields(m) {
  return {
    id: m.id,
    name: m.name,
    author: m.id.replace(/^~/, '').split('/')[0],
    created: m.created * 1000,
    contextLength: m.context_length || null,
    description: m.description || '',
    url: 'https://openrouter.ai/' + m.id,
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
