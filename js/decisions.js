// The Decisions page's definition and cost rule, plugged into the core
// (core.js) as a page definition: Models answering through OpenRouter's alpha
// Decisions API. Pure: no DOM, no network.
//
// Decision models charge for input only (completion is always 0), so a batch
// of decisions costs decisions × input tokens per decision × `prompt`.

/**
 * The Decisions page definition (see the page definitions in core.js). Rows
 * add `acceptsImages` (`image` among the input modalities) and `free` (input
 * and output both listed at $0; decisions are billed by the token, so that
 * is a genuine $0, `:free` variant or not). The core passes in what the page
 * needs from it, so this module imports nothing.
 *
 * @param {{coreFields: (m: object) => object,
 *   tokenCost: (m: object, terms: [string, number][]) => object,
 *   includes: (m: object) => boolean}} core
 */
export function decisionsPage({ coreFields, tokenCost, includes }) {
  return {
    includes,
    workload: {
      id: 'decisions',
      inputs: [
        { key: 'decisions', label: 'Decisions', default: 1000, step: 100 },
        { key: 'tokensPerDecision', label: 'Input tokens per decision', default: 2000, step: 100 },
      ],
      cost: (m, w) => tokenCost(m, [[m.pricing?.prompt, w.decisions * w.tokensPerDecision]]),
    },
    rowOf: m => ({
      ...coreFields(m),
      acceptsImages: (m.architecture?.input_modalities || []).includes('image'),
      free: Number(m.pricing?.prompt) === 0 && Number(m.pricing?.completion) === 0,
    }),
    sortKeys: { acceptsImages: r => Number(r.acceptsImages), free: r => Number(r.free) },
  };
}
