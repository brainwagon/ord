# OpenRouter Dashboard

A public, keyless, static dashboard of OpenRouter's live model catalogue. It's plain
HTML, CSS and ES modules with no build step and no dependencies.

## Layout

- `index.html`, `css/`, `js/app.js`: the shell (fetching, tabs, filters, rendering).
- `js/table.js`: the table every page shares (core columns, badges, sortable
  headers, expandable descriptions, click-to-copy ids). A page passes its own
  columns after `CORE_COLUMNS`; row order always comes from the core.
- `js/store.js`: remembered settings and theme override in browser storage
  (versioned keys, every access guarded). The whole settings object is saved
  and merged over `DEFAULT_SETTINGS` in `app.js` on load, so a new setting or a
  new page's Workload is remembered with no change here.
- `js/core.js`: the pure core. It has no DOM or network access, and its single entry
  point is `buildPages(sources, settings, now)`, which turns raw API responses into
  rows for each page. A page with a Workload declares its inputs and a pure cost
  rule there (see the comment above the page definitions); the shell then shows
  the inputs and a sortable cost column with no further changes.
- `js/audio.js`, `js/audio-view.js`: the Audio page's definition and cost rule
  (core side) and its price column (shell side).
- `test/`: tests for `buildPages`, run against saved real API responses in
  `test/fixtures/`.
- `tools/trim-fixture.mjs`: trims a raw API response to chosen models and keeps each
  model's bytes unchanged.

## Run the tests

    node --test

This needs Node 18 or later and nothing else.

## Serve locally

    python3 -m http.server 8000

Then open <http://localhost:8000/>. ES modules won't load from `file://`.

## Refresh a fixture

    curl -sS --max-time 15 'https://openrouter.ai/api/v1/models?output_modalities=all' -o raw.json
    node tools/trim-fixture.mjs raw.json test/fixtures/catalogue.json <model ids…>

`test/fixtures/catalogue.json` was captured on 2026-10-08.
