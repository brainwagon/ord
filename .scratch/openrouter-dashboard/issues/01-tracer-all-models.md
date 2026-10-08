# 01: Tracer bullet: All models from the live catalogue

**What to build:** Opening the dashboard loads OpenRouter's full live catalogue (all output modalities, no API key) and shows it on an All models tab: one row per Model with its raw input and output prices per 1M tokens. The page uses the single-HTML, hash-addressed tab structure from the spec. All models is the only working tab so far. The viewer sees a "loaded N min ago" note and a Refresh button. If OpenRouter can't be reached, the viewer gets a clear error with a Retry button instead of a blank page. Underneath, this establishes the pure core module's single public entry point, which turns raw responses plus settings and the current time into page rows, along with the Node test runner and the first saved real-API fixture. See the spec's Implementation and Testing Decisions.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [ ] The catalogue is fetched with `output_modalities=all`, once on load and on Refresh, never on a timer
- [ ] All models lists every catalogue entry, including `~-latest` aliases, embeddings, rerank and routers
- [ ] A `-1` price shows as "variable", and a zero price on a non-`:free` Model that isn't a free offering shows as "unpriced"
- [ ] Neither kind of price is ever shown as $0 or negative
- [ ] The core module has no DOM or network access and exposes one entry point. Tests drive only that entry point, using a saved real catalogue fixture
- [ ] A failed fetch shows an error and a Retry button that works
- [ ] The page runs as static files with no build step, and the tests run with Node's built-in runner and no dependencies

## Comments

Resolved on branch `integration/openrouter-dashboard` (merged at 1b17936, after code-review fixes). Tests: 119/119 passing.
