# 03: Code page

**What to build:** A Code tab listing every Model whose outputs include text, excluding decisions, embeddings and rerank models. It is sorted by default on the Artificial Analysis coding index, highest first, with unscored Models after the scored ones so New models aren't hidden.
- **Reasoning:** Models with a `reasoning` field get a "reasoning" badge, and a toggle (off by default) shows only those.
- **Prices:** shown per 1M tokens for input and output. Models with tiered `overrides` get a "tiered" badge that shows the higher rates on hover, and cache, reasoning and web-search prices also appear on hover.

This ticket does not include a Workload.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Code-page membership and the default coding-index ordering (unscored last) are covered by core tests
- [ ] The reasoning badge appears exactly when a Model has a `reasoning` field, and the toggle filters to those (core test)
- [ ] The tiered badge is covered by a core test using a fixture Model with `overrides`
- [ ] Hover shows the tier, cache, reasoning and web-search prices where present
- [ ] OpenRouter's `programming` category is not used
