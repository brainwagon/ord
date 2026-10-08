// The Decisions page: Models answering through OpenRouter's alpha Decisions
// API, costed for a Workload of a batch of decisions. A page definition for
// core.js's shared pipeline (see the comment above the page definitions
// there). Pure: no DOM, no network.
//
// Decision models charge for input only (completion is always 0), so a batch
// of decisions costs decisions × input tokens per decision × `prompt`.

/**
 * The Decisions page definition. Rows add `acceptsImages` (`image` among the
 * input modalities) and `zeroPrice` (input and output both listed at $0;
 * decisions are billed by the token, so that is a genuine "no charge",
 * `:free` variant or not). It is not `badges.free`, which only ever means a
 * `:free` variant.
 *
 * @param {import('./core.js').PageCore} core
 */
export function decisionsPage({ coreFields, tokenCost, includes }) {
  return {
    workload: {
      id: 'decisions',
      inputs: [
        { key: 'decisions', label: 'Decisions', default: 1000, step: 100 },
        { key: 'tokensPerDecision', label: 'Input tokens per decision', default: 2000, step: 100 },
      ],
      cost: (m, w) => tokenCost(m, [[m.pricing?.prompt, w.decisions * w.tokensPerDecision]]),
    },
    includes,
    rowOf: m => ({
      ...coreFields(m),
      acceptsImages: (m.architecture?.input_modalities || []).includes('image'),
      zeroPrice: Number(m.pricing?.prompt) === 0 && Number(m.pricing?.completion) === 0,
    }),
    sortKeys: { acceptsImages: r => Number(r.acceptsImages), zeroPrice: r => Number(r.zeroPrice) },
  };
}
