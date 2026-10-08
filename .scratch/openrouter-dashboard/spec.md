Status: ready-for-agent

# Spec: OpenRouter Dashboard

## Problem Statement

OpenRouter adds models constantly, across more and more kinds of output: text and code, images, speech and music, video, transcription, and now structured answers through the alpha Decisions API. Someone trying to pick a model for a job has no good way to see, in one place, *which* models can do that job, *which ones are new*, and *what they would actually cost* for the work they have in mind.

OpenRouter's own catalogue makes this harder than it looks:

- The default model listing silently omits every model that doesn't output text.
- Prices for non-text models are reported in inconsistent or misleading units. Video models list $0 in the main catalogue, and their real prices live elsewhere in vendor-specific units (dollars per second, cents per second, per token). Image models' catalogue price is a per-token figure even when they are really billed per image. Transcription prices are mostly per second of audio, with no unit stated, and some are clearly not per second.
- There is no "code model" tag.

The existing OpenRouter Price Watch page covers a hand-picked set of text models well. But it needs hand-maintained family lists before it can see a new model line, and it ignores most non-text pricing.

## Solution

A public, keyless, static web dashboard that loads OpenRouter's full live catalogue in the browser and presents it as a set of **Capability pages**: Code, Image, Audio, Video, Transcription and Decisions. It also has a **What's new** landing view and an **All models** catch-all.

- **Placement:** every **Model** appears on every Capability page it qualifies for.
- **Pricing:** each page shows the prices that matter for that kind of model, in honest units. Each page has a **Workload** the viewer can edit, such as tokens in and out, number of images, seconds of video, or minutes of audio, and each Model's cost for that Workload is computed.
- **Exactness:** when the dashboard cannot compute an exact cost, it says so and why, rather than guessing.
- **New models:** **New models**, those added recently, are badged everywhere and gathered on the landing view, so new arrivals and new kinds of model are easy to spot.

The dashboard sits alongside Price Watch rather than replacing it, and it is published at its own URL.

## User Stories

### Finding models

1. As a viewer, I want the dashboard to open on a What's new view listing every New model across the whole catalogue, newest first, so that I can see what has appeared since I last looked.
2. As a viewer, I want each Model on What's new badged with the Capability pages it appears on, so that I can tell at a glance what a new model is for.
3. As a viewer, I want What's new to include models of kinds that have no Capability page (embeddings, rerank, routers), so that a brand-new kind of model still reaches me.
4. As a viewer, I want to change the length of the "new" window, 30 days by default, so that I can look back further or narrow the list to the last week.
5. As a viewer, I want a "new" badge on any New model wherever it appears, so that I notice new arrivals while browsing a Capability page.
6. As a viewer, I want a Code page listing every text-output model, so that I can find any model that could write code, including ones not yet benchmarked or curated.
7. As a viewer, I want the Code page sorted by coding benchmark score by default, so that the strongest known coders are at the top.
8. As a viewer, I want Models without a coding benchmark score to still appear on the Code page, below the scored ones, so that new models are not hidden.
9. As a viewer, I want a "reasoning" badge on Code-page Models that support reasoning, and a toggle (off by default) to show only those, so that I can narrow to models suited to harder coding work without hiding cheaper non-reasoning models.
10. As a viewer, I want an Image page listing every image-output model, so that I can compare image generators.
11. As a viewer, I want an Audio page listing speech and audio-output models (text-to-speech, audio chat, music), so that I can compare audio generators.
12. As a viewer, I want a Video page listing every video-output model, so that I can compare video generators.
13. As a viewer, I want a Transcription page listing every transcription model, so that I can compare speech-to-text options.
14. As a viewer, I want a Decisions page listing every model that supports the Decisions API, so that I can find models for structured choice, yes/no and score answers.
15. As a viewer, I want the Decisions page to say that the Decisions API is in alpha and to link to its documentation, so that I understand its maturity before relying on it.
16. As a viewer, I want an All models page listing the entire catalogue with prices as OpenRouter reports them, so that no Model is impossible to find.
17. As a viewer, I want a Model that has several capabilities to appear on every page it qualifies for, so that I find it whichever capability I am looking for.
18. As a viewer, I want to filter any page by **Author**, so that I can focus on one maker's models.
19. As a viewer, I want to search any page by text over a Model's name and id, so that I can jump to a model I've heard of.
20. As a viewer, I want to sort any page by any column, so that I can rank by price, context length, date added or cost.
21. As a viewer, I want each page to have its own address, so that I can bookmark it or share a link to, say, the Video page.

### Understanding a model

22. As a viewer, I want every page to show the same core columns (Model name with id, Author, date Added, Context length), so that pages feel consistent.
23. As a viewer, I want to click a Model's id to copy it, so that I can paste it into my code.
24. As a viewer, I want to expand a row to read OpenRouter's description of the Model, so that I can tell what an unfamiliar model is for.
25. As a viewer, I want a ↗ link from each Model to its OpenRouter page, so that I can go deeper or try it.
26. As a viewer, I want an "expires <date>" badge on Models that OpenRouter has scheduled for removal, so that I don't build on a model that is going away.
27. As a viewer, I want `~…-latest` alias entries hidden everywhere except All models, so that the same Model doesn't appear twice.
28. As a viewer, I want `:free` variants shown, and sorted first when sorting by cost, so that I can find zero-cost options.
29. As a viewer, I want a toggle to hide `:free` variants, so that I can see only paid, production-grade endpoints.

### Costs and Workloads

30. As a viewer, I want a Workload on the Code page (input tokens and output tokens, default 3M in and 1M out), so that I see each Model's cost for work like mine.
31. As a viewer, I want the Code page to show input and output prices per million tokens alongside the Workload cost, so that I can reason about other ratios too.
32. As a viewer, I want a "tiered" badge on Models whose price rises above a prompt-length threshold, with the higher rates on hover, so that I'm not surprised by long-prompt costs.
33. As a viewer, I want cache-read, cache-write and reasoning prices available on hover, so that I can account for them if they matter to me.
34. As a viewer, I want a Workload on the Image page (number of images and a resolution of 1K, 2K or 4K), so that I see the cost of a batch of images at the size I need.
35. As a viewer, I want per-image prices taken from OpenRouter's image-pricing data at the closest resolution each Model offers, so that the cost reflects how image models are really billed.
36. As a viewer, I want a Workload on the Video page (seconds of video, with audio on or off), so that I see the cost of a clip of the length I need.
37. As a viewer, I want video prices converted to dollars per second whatever unit the vendor uses, so that video Models are comparable.
38. As a viewer, I want a Workload on the Audio page (characters of text to speak), so that I see the cost of narrating my text.
39. As a viewer, I want a Workload on the Transcription page (minutes of audio, default 60), so that I see the cost of transcribing my recordings.
40. As a viewer, I want a Workload on the Decisions page (number of decisions × input tokens per decision, default 1,000 × 2,000), so that I see the cost of a batch of decisions.
41. As a viewer, I want "accepts images" and "free" columns on the Decisions page, so that I can find multimodal or no-cost decision models.
42. As a viewer, when a Model's cost cannot be computed exactly for my Workload, I want "—" with a short reason (priced per token, unpriced, unit unclear, variable price), so that I am never misled by a guess shown next to exact figures.
43. As a viewer, I want a price that is implausible for its assumed unit (for example a transcription price above $0.01 per second) flagged "unit unclear" instead of costed, so that a unit mismatch doesn't overstate a cost a thousandfold.
44. As a viewer, I want Models with uncomputable costs sorted after computable ones when sorting by cost, so that the ranking stays meaningful.
45. As a viewer, I want variable-priced router models shown as "variable" rather than as a negative or zero price, so that they don't look free.

### Data freshness and resilience

46. As a viewer, I want the catalogue loaded live from OpenRouter when I open the page, without an API key, so that I always see the current catalogue.
47. As a viewer, I want a "loaded N min ago" note and a Refresh button, so that I know how fresh the data is and can update it.
48. As a viewer, I want the table not to reorder by itself while I'm reading, so that I don't lose my place.
49. As a viewer, I want a clear error with a Retry button if OpenRouter can't be reached, so that I know what went wrong and can try again.
50. As a viewer, I want the Image and Video pages to fetch their extra pricing data only when I first open them, so that the dashboard loads quickly.
51. As a viewer, I want per-image price data kept in my browser for several hours, so that revisiting the Image page is fast and doesn't hammer OpenRouter.
52. As a viewer, I want the other pages to stay usable while image prices are still loading or have failed, so that one slow tab doesn't block the rest.

### Personalisation

53. As a returning viewer, I want my Workloads, "new" window, filters, sort order and theme remembered in my browser, so that the dashboard opens the way I left it.
54. As a viewer, I want a Reset view button, so that I can return to the defaults.
55. As a viewer, I want the dashboard to follow my system's light or dark setting, with a toggle to override it, so that it's comfortable to read.
56. As a viewer on a phone, I want the pages to be usable at phone width, so that I can check a model on the go.

### Maintainer

57. As the maintainer, I want new models and new Authors to appear without editing any hand-maintained list, so that the dashboard stays current with no upkeep.
58. As the maintainer, I want the dashboard to be static files served by GitHub Pages with no build step, so that a push to `main` is a deploy.
59. As the maintainer, I want the classification and pricing logic tested against real saved OpenRouter responses, so that a unit mix-up or a catalogue format change is caught by a test rather than by a viewer.
60. As the maintainer, I want the dashboard to use only documented OpenRouter endpoints, so that it doesn't break when undocumented ones change.

## Implementation Decisions

- **Hosting:** the repo is `brainwagon/ord`, served by GitHub Pages from `main` and expected at `mvandewettering.com/ord/`. It is static HTML, CSS and plain JavaScript modules loaded directly by the browser, with no framework, no build step and no runtime dependencies.
- **Single page:** the dashboard is one HTML page with hash-addressed tabs: What's new (default), Code, Image, Audio, Video, Transcription, Decisions, All models. The catalogue is fetched once and shared by all tabs, and filter and sort state carries across tabs.
- **Data sources:** all are documented OpenRouter endpoints, keyless, and send `Access-Control-Allow-Origin: *`.
  - **Catalogue:** the models listing with `output_modalities=all`. This is essential: the default listing omits non-text models. The response is about 1 MB with about 670 models. It is fetched on page load and on Refresh only, never on a timer.
  - **Video pricing:** the video-models listing, fetched the first time the Video tab is opened. Its per-model `pricing_skus` carry the real prices.
  - **Image pricing:** the image-models listing, then that listing's per-model endpoints resource for per-image prices (`billable`, `unit`, `cost_usd`, `variant`/resolution). This is fetched the first time the Image tab is opened, with limited concurrency (about 4 requests at once), and cached in browser storage for several hours. A failed fetch must not be cached as an empty result for the full lifetime.
  - Per-provider endpoint data, latency, throughput and any undocumented frontend endpoints are not used.
- **Core module (the single tested seam):** a pure module with no DOM and no network.
  - One public entry point takes the raw responses: the catalogue, plus the video-models data and image-pricing data when present. It also takes the viewer's settings (each page's Workload, the "new" window, hide-free) and the current time.
  - It returns, for each Capability page plus What's new and All models, the ordered set of rows that page shows.
  - Each row carries the core fields (id, name, Author, created date, context length, description, OpenRouter link) and its badges: new, expires-on, reasoning, tiered, accepts-images, free.
  - Each row also carries the page's price columns, and either a Workload cost in USD or a cost-unavailable reason. The reasons are: per-token pricing, unpriced, unit unclear, variable, pricing data not loaded.
  - Everything else (rendering, tabs, persistence, fetching) is a thin shell around this module.
- **Page membership:** decided from `architecture.output_modalities`.
  - **Code:** includes `text`, excluding decisions, embeddings and rerank models.
  - **Image:** includes `image`.
  - **Audio:** includes `speech` or `audio`.
  - **Video:** includes `video`.
  - **Transcription:** includes `transcription`.
  - **Decisions:** includes `decisions`.
  - **All models:** everything.
  - **What's new:** every New model from the whole catalogue.
  - `~…-latest` aliases (identified by `alias_target`) are excluded everywhere except All models.
- **Code page specifics:**
  - The default sort is by the Artificial Analysis coding index from the model's `benchmarks`, descending, with unscored models after scored ones.
  - The "reasoning" badge and toggle come from the presence of the catalogue's `reasoning` field on a Model. No extra request is needed, and OpenRouter's `programming` category is not used.
- **Pricing rules:** all API prices are USD strings and are parsed once in the core.
  - **Code:** the cost is input tokens × `prompt` + output tokens × `completion`, at the base tier. Models with `overrides` (tiered prices) get a tiered badge, with the override rates available for hover. Cache, reasoning and web-search prices are carried for hover only.
  - **Image:**
    - For each model, choose the per-image price at the resolution closest to the Workload's resolution.
    - The cost is the number of images × that price.
    - Models whose image pricing unit is `token` get a per-token reason and no cost.
  - **Video:**
    - The vendor SKUs are normalised to USD per second. This handles dollar-per-second and cents-per-second SKUs, and with-audio vs without-audio variants.
    - The cost is the seconds × the rate that matches the Workload's audio setting.
    - Token-based SKUs get a per-token reason.
    - The catalogue's $0 video prices are never shown as free.
  - **Audio:** the cost is characters × `prompt` for models priced per input character (e.g. ElevenLabs speech). Models priced only on audio output tokens get a per-token reason. Models with all-zero non-free prices (e.g. Lyria) are "unpriced".
  - **Transcription:**
    - A model with a single input price and no output price is treated as dollars per second, so the cost is minutes × 60 × `prompt`.
    - A per-second price above $0.01 is "unit unclear" and gets no cost. Today this applies to the Microsoft MAI models.
    - Models with both `prompt` and `completion` prices (e.g. gpt-4o-transcribe) get a per-token reason.
  - **Decisions:** the cost is decisions × tokens per decision × `prompt`, since completion is always 0. "Accepts images" means `image` is in `input_modalities`.
  - **All models:** raw `prompt` and `completion` per 1M tokens. A price of `-1` displays as "variable"; zero on a non-`:free` model where that is clearly not a free offering displays as "unpriced". There is no Workload cost.
- **Sorting by cost:**
  - Rows with a computed cost come first, in ascending order, so `:free` ($0) rows come first.
  - Rows with a cost-unavailable reason come after them.
- **New model:** `created` falls within the "new" window before the current time. The default is 30 days, and the viewer can change it.
- **Expiring:** a Model with a non-null `expiration_date` shows the badge and is otherwise treated normally.
- **Persistence:** browser storage holds each page's Workload, the "new" window, filters, sort order, collapsed or expanded state where relevant, and the theme override. Keys are versioned, every access is wrapped so that a missing or blocked store falls back to defaults, and Reset view clears them.
- **Theme:** colours are defined as CSS custom properties. The page follows `prefers-color-scheme` by default, and the toggle overrides it.
- **Patterns from Price Watch:** these may be adapted rather than invented: the throttled fetch queue with a TTL cache, the price and context formatters, copy-to-clipboard with a fallback, and the versioned UI-state save and restore. Its hand-maintained `FAMILIES` lists, provider-routing cost model and undocumented perf endpoints are deliberately not carried over.

## Testing Decisions

- **Good tests:** they exercise only the core module's single public entry point. They feed in raw OpenRouter responses plus settings and a fixed current time, then assert on the returned page rows: membership, ordering, badges, costs and cost-unavailable reasons. They never reach into helper functions, so the core's internals can be restructured freely.
- **Fixtures:** real responses captured from OpenRouter and saved in the repo. Trim them to the models needed when the full response is unwieldy, but keep each model object exactly as the API returned it. The fixtures must include at least:
  - **Video:** Veo (dollars per second, with/without audio), a Runway model (cents per second) and Seedance (per-token video SKUs).
  - **Image:** a Flux model with several resolutions, Seedream (flat per-image) and Nano Banana (token unit).
  - **Transcription:** whisper-1 (per second), the Microsoft MAI models (unit unclear) and gpt-4o-transcribe (per token).
  - **Audio:** an ElevenLabs speech model (per character), gpt-audio (audio output tokens) and Lyria (unpriced).
  - **Decisions:** a Decisions model that accepts images and a `:free` Decisions model.
  - **Routers:** a router with `-1` pricing.
  - **Other cases:** a `~…-latest` alias, a model with `expiration_date`, and a text model with tiered `overrides`.
  - **Multi-page:** a multi-capability model, such as a text and image Gemini model.
- **Test cases cover:**
  - every page-membership rule,
  - the reasoning badge, present exactly when a Model has a `reasoning` field,
  - the "new" window boundary,
  - alias exclusion,
  - free-first cost ordering and uncomputable-last ordering,
  - each per-page Workload formula with hand-computed expected dollar amounts,
  - each cost-unavailable reason,
  - the above-$0.01/s unit-unclear threshold,
  - the closest-resolution choice for images,
  - the cents-to-dollars normalisation for video,
  - behaviour when image or video pricing data has not loaded yet.
- **Runner:** Node's built-in test runner, with no test dependencies.
- **Prior art:** none. The repo is new, and Price Watch has no tests.
- **The shell:** rendering, tabs, persistence and fetching are not unit-tested. Before release, a one-off real-browser check loads each tab against the live API and confirms that every table renders and the console shows no errors. No browser test suite is kept in the repo.

## Out of Scope

- Per-provider pricing, provider routing or "expected cost across providers" estimates, latency and throughput.
- Undocumented OpenRouter endpoints.
- Saved snapshots, price history, price-change alerts and removed-model detection. These would require a scheduled job and storage, which the live-only design deliberately avoids.
- Estimated costs for Models priced per token where the Workload is not in tokens, such as token-priced image, video and audio models and token-priced transcription. These show a reason, not an estimate.
- Side-by-side comparison of selected Models.
- Charts.
- Capability pages for embeddings and rerank. They are reachable through All models and What's new.
- Calling any model, or anything that requires an API key.
- Replacing or modifying Price Watch.
- A "new since your last visit" personal badge.

## Further Notes

- **Live data as of 2026-10-08:** 666 models in the full catalogue, compared with 468 in the default text-only listing. By output: 61 image, 30 video, 32 speech, 4 audio, 26 transcription, 15 decisions, 37 embeddings and 9 rerank. About 337 text models support reasoning, and 19 entries are `~-latest` aliases.
- **Image prices in the main catalogue:** the main catalogue's `image_output` price is effectively per token despite the documentation calling it per image. Use the image-pricing endpoints for real per-image prices.
- **Decisions API:**
  - It lives at an alpha path, arrived with TypeSafe's Jev on 2026-09-18, and charges for input only.
  - Supporting models are identified by the `decisions` output modality.
  - Their `supported_parameters` are empty, and no separate models listing exists for them.
- **Glossary:** use the terms in the repo's `GLOSSARY.md` (Model, Capability page, Author, Provider, New model, What's new, Workload). In particular, "Author" is the id prefix, and "Provider" is reserved for hosting organisations, which this version does not surface.
- **Possible ADR:** the live-only, no-snapshot decision is the one choice a future reader may question. Record it as an ADR if snapshots are ever reconsidered.
