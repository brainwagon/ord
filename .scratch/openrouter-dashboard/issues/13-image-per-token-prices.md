# 13: Per-image prices for per-token and per-megapixel image Models

**What to build:** Make the Image page show an estimated per-image price for the image Models that OpenRouter bills by the token or by the megapixel. Today about 22 of the 59 image Models are per-token and show "per-token pricing", and the 4 FLUX.2 per-megapixel Models show "unit unclear". OpenRouter doesn't publish tokens per image, but the providers do. The figures are in [research/image-tokens.md](../research/image-tokens.md), gathered 2026-10-08 with sources.

- **Tokens-per-image table:** a hand-kept table in `js/image.js`, keyed by Model id and resolution (1K/2K/4K), giving output tokens per image. The per-image Price is tokens × the Model's `output_image` token price from the image-pricing data, so the dashboard follows OpenRouter's price when it changes. `-preview` ids share their released Model's entry. A resolution the Model doesn't offer uses the closest one it does offer, as per-image Models already do, and the cell shows which resolution it used ("@1K").
- **Quality (OpenAI):** OpenAI's token counts depend on quality, so add a Quality input to the Workload (low / medium / high, defaulting to medium). Models without a quality setting ignore it. GPT Image 2.5's extra xhigh and max levels are left out.
- **gpt-image-1-mini / gpt-5-image-mini:** OpenAI's token table and its stated prices disagree for this Model, so its entry gives OpenAI's stated per-image prices instead of tokens ($0.005 / $0.011 / $0.036 for low / medium / high at 1024×1024).
- **Per-megapixel Models (FLUX.2 pro/flex/max/klein):** price = the per-megapixel price × the resolution's megapixels (1K = 1024² px ≈ 1.05 MP, 2K ≈ 4.19 MP, 4K ≈ 16.8 MP).
- **Free Models:** a zero `output_image` price (the two Ming Image Models) shows $0, not a reason.
- **Marking estimates:** prices from the table carry a hover note saying they're estimated from provider docs, along with the confidence. MAI-Image's ~1,024 tokens is derived from third-party prices, not published by Microsoft, and the hover says so.
- **Unknown Models:** per-token Models missing from the table keep the "per-token pricing" reason, so a newly listed Model degrades the same way it does today.

**Blocked by:** 11

**Status:** resolved

- [x] Every per-token Model in the research summary gets a per-image price at 1K, and at 2K/4K where the provider documents them
- [x] Hand-computed core tests: Nano Banana 2.5 at 1K = $0.0387 (1290 × $0.00003); Nano Banana 2 at 4K = $0.1512 (2520 × $0.00006); gpt-image-1 at medium 1K = $0.04224 (1056 × $0.00004); Hy Image 3.5 at 4K = $0.032 (20000 × $0.0000016); FLUX.2 pro at 1K = $0.03 × 1.048576
- [x] The Quality input persists like the other Workload inputs, and changing it reprices only the Models with a quality setting
- [x] A Model missing from the table, or with variants that can't be placed, still shows its reason
- [x] Estimated prices are distinguishable on hover from prices OpenRouter publishes per image
- [x] Free Models show $0

## Open questions (don't block; record what's assumed)

- Which quality OpenRouter actually requests for OpenAI Models by default (probably `auto`, undocumented). One real generation would settle it.
- What pixel size OpenRouter sends to MAI-Image; it only takes an aspect ratio.
- Nano Banana Pro preview: the image endpoint lists $0.00006 per token, the catalogue $0.00012. Price from the image-pricing data, as with every other Model.
- Nano Banana 2.1 at 4K: Google's pages disagree (3780 vs 2520 tokens); use 3780, the only figure that matches Google's stated $0.113.

## Comments

Resolved on `main`. Tests: 127/127 passing; checked against the live API in a browser (24 image Models now show an estimated price).

- The table is `IMAGE_COSTS` in `js/image.js`. Each entry has a unit (tokens, or the Author's stated USD for GPT Image 1 Mini), a confidence (per resolution where it differs: Nano Banana 2.1 at 4K is medium), and optionally the pixel size each resolution stands for.
- An estimate is a Price with a `note`; the cost carries it too, and the table shows it as "~$0.039" with the note on hover.
- GPT Image 2 and 2.5 at 4K (3840 × 2160) cost fewer tokens than at 2K (2048 × 2048), as OpenAI's calculator says; the hover names the pixel size.
- The open questions above still stand.
