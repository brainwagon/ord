# 12: Release check against the live site

**What to build:** Confirm the finished dashboard works for a real viewer at its published URL, `mvandewettering.com/ord/`, served by GitHub Pages from `main` of `brainwagon/ord`. Do a one-off check in a real browser of every tab against the live OpenRouter API, at desktop width and phone width, in both light and dark themes. No browser test suite is kept in the repo.

**Blocked by:** 06, 07, 08, 09, 10, 11

**Status:** resolved

- [x] Every tab renders a populated table at the published URL with no console errors
- [x] The Image and Video tabs load their extra pricing, and a forced fetch failure shows Retry
- [x] Phone width has no horizontal page scroll
- [x] Light, dark and override theme all render legibly
- [x] Any defects found are fixed or filed as new tickets

## Comments

Release check run 2026-10-08 against https://mvandewettering.com/ord/ (main @ 5560c6d) in headless Chromium, at 1280px and 390px wide, under both the light and dark system schemes. No defects found and no code changes needed.

- Every tab rendered a populated table. Row counts were: What's new 97, Code 449, Image 61, Audio 36, Video 30, Transcription 26, Decisions 14, All models 665.
- No page scrolled sideways at 390px. Light and dark both rendered with the expected colours.
- The theme override cycles system → light → dark → system and survives a reload.
- Image: per-image prices loaded live, giving 54 cost cells.
- Video: in a clean browser context the real `/videos/models` loaded (200, via Cloudflare). It gave 45 cost cells, with "priced by resolution" on the models that are priced by resolution only. The shared test browser had a leftover fake route from an earlier implementer's forced-failure test, which answered `503 down`. That incidentally exercised the failure path: the page showed "Couldn't load video prices from OpenRouter" with a Retry button, and the other tabs were unaffected.
- No console errors in a clean context.
