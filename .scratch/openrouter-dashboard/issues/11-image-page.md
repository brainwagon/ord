# 11: Image page

**What to build:** An Image tab listing every Model whose outputs include `image`. The first time the tab is opened, it fetches OpenRouter's image-models listing and then each Model's per-image pricing endpoints, about 4 requests at a time, keeping the results in browser storage for several hours. A failed request is never stored as an empty result, so it is retried on the next visit.
- **Workload:** number of images and a resolution (1K, 2K or 4K). Cost is the number of images × the Model's per-image price at the closest resolution it offers.
- **Per-token Models:** Models whose image pricing unit is `token` (e.g. Nano Banana) show the per-token reason.
- **Loading:** rows fill in as their prices arrive, and other tabs stay usable while loading.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] Image pricing is fetched only when the Image tab is first opened, with limited concurrency, and kept for several hours
- [ ] A failed fetch is retried on the next visit rather than stored as empty
- [ ] Fixtures include a Flux Model with several resolutions, Seedream (flat per-image) and Nano Banana (token unit), exactly as returned
- [ ] The closest-resolution choice and the per-token reason are covered by core tests with hand-computed amounts
- [ ] The Workload persists
