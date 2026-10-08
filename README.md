# OpenRouter Dashboard

A public, keyless, static dashboard of OpenRouter's live model catalogue. It's plain
HTML, CSS and ES modules with no build step and no dependencies.

## Layout

The pure core (no DOM, no network):

- `js/core.js`: its single entry point, `buildPages(sources, settings, now)`,
  turns raw API responses into each page's rows, plus every Author and each
  page's Workload inputs and values. It holds the Capability page registry
  (which Models each page lists), the All models, What's new and Code pages,
  and the pipeline every page shares (filters, sorting, Workload costs). A
  page with a Workload declares its inputs and a pure cost rule (see the
  comment above the page definitions); the shell then shows the inputs and a
  sortable cost column with no further changes.
- `js/pricing.js`: the vocabulary the core and pages share: the one shape of a
  price or cost (`{kind: 'usd', usd}` or `{kind: 'reason', reason}`), the
  reasons a price can be unavailable, USD rounding, price parsing and `:free`
  variants.
- `js/<page>.js` for `image`, `audio`, `video`, `transcription` and
  `decisions`: each Capability page's definition (its rows, sort keys,
  Workload and cost rule), one factory each, all given the same argument.

The shell (browser only):

- `index.html`, `css/`, `js/app.js`: fetching the catalogue, tabs, filters,
  the Workload panel and rendering.
- `js/<page>-view.js` for the same five pages: each page's part of the shell
  (its columns, badges, header note, and for Image and Video the lazy fetch
  of their extra pricing data), one factory each, all given the same argument.
- `js/table.js`: the table every page shares (core columns, badges, sortable
  headers, expandable descriptions, click-to-copy ids). A page passes its own
  columns after `CORE_COLUMNS`; row order always comes from the core.
- `js/store.js`: remembered settings and theme override in browser storage
  (versioned keys, every access guarded), and the guarded JSON storage the
  image-price cache uses. The whole settings object is saved and merged over
  `DEFAULT_SETTINGS` in `app.js` on load, so a new setting or a new page's
  Workload is remembered with no change here.
- `js/fetch-json.js`: fetching JSON from OpenRouter's API and checking it.

Tests and tools:

- `test/`: tests at two seams, run against saved real API responses in
  `test/fixtures/`. Every core test (`core`, `image`, `audio`, `video`,
  `transcription`, `decisions`) drives only `buildPages`. `store.test.js`
  tests the second seam, `js/store.js`'s settings merge, which is pure given
  a storage stand-in.
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
`test/fixtures/transcription.json` (four more transcription Models) was captured on 2026-10-08.
`test/fixtures/decisions.json` (every Decisions Model, plus one text Model) was captured on 2026-10-08.
