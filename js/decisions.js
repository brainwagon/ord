// The Decisions page's definition, for the core (core.js): Models answering
// through OpenRouter's alpha Decisions API. Membership comes from the
// Capability page registry in core.js.
//
// Only core.js imports this module, and this module uses core.js's helpers
// only when rows are built, so the import cycle between them is safe.
import { coreFields, tokenCost } from './core.js';

// Workload: a batch of decisions, each reading the same number of input
// tokens. Decision models charge for input only (completion is always 0), so
// the cost is decisions × tokens per decision × `prompt`.
const DECISIONS_WORKLOAD = {
  id: 'decisions',
  inputs: [
    { key: 'decisions', label: 'Decisions', default: 1000, step: 100 },
    { key: 'tokensPerDecision', label: 'Input tokens per decision', default: 2000, step: 100 },
  ],
  cost: (m, w) => tokenCost(m, [[m.pricing.prompt, w.decisions * w.tokensPerDecision]]),
};

export const DECISIONS = {
  workload: DECISIONS_WORKLOAD,
  rowOf: decisionsRow,
  sortKeys: { acceptsImages: r => Number(r.acceptsImages), free: r => Number(r.free) },
};

// Adds `acceptsImages` (`image` among the input modalities) and `free` (the
// Model costs nothing: input and output both listed at $0, which for
// token-billed decisions is a genuine $0, `:free` variant or not).
function decisionsRow(m) {
  return {
    ...coreFields(m),
    acceptsImages: (m.architecture?.input_modalities || []).includes('image'),
    free: Number(m.pricing.prompt) === 0 && Number(m.pricing.completion) === 0,
  };
}
