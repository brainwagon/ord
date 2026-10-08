# 10: Video page

**What to build:** A Video tab listing every Model whose outputs include `video`. The first time the tab is opened, it fetches OpenRouter's video-models listing and converts each Model's `pricing_skus` to USD per second, handling dollar-per-second and cents-per-second SKUs and with-audio vs without-audio variants.
- **Workload:** seconds of video, with audio on or off. Cost is the seconds × the rate that matches the audio setting.
- **Per-token Models:** Models whose SKUs are token-based (e.g. Seedance) show the per-token reason.
- **Catalogue prices:** the catalogue's $0 video prices are never shown as free.
- **Loading and failure:** until the listing loads, or if it fails, rows show a "pricing data not loaded" reason with a Retry, and the other tabs stay usable.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] The video listing is fetched only when the Video tab is first opened
- [ ] Fixtures include Veo (dollars per second, with and without audio), a Runway Model (cents per second) and Seedance (token SKUs), exactly as returned
- [ ] Cents-to-dollars conversion and audio-variant choice are covered by core tests with hand-computed amounts
- [ ] Not-loaded and failed states are covered by a core test, and the UI shows Retry
- [ ] The Workload persists
