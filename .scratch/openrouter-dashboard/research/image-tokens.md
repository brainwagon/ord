# Tokens per output image for per-token image Models

Gathered 2026-10-08 from provider docs (no paid calls). Detail and source URLs
per vendor: [Google](image-tokens-google.md), [OpenAI](image-tokens-openai.md),
[Microsoft / Tencent / inclusionAI](image-tokens-others.md).

Per-image price = tokens × OpenRouter's `output_image` token price.

| Model | 1K | 2K | 4K | Confidence |
|---|---|---|---|---|
| google/gemini-2.5-flash-image | 1290 | — | — | high |
| google/gemini-3.1-flash-image(-preview) | 1120 | 1680 | 2520 (0.5K: 747) | high |
| google/gemini-3.1-flash-lite-image | 1120 | — | — | high |
| google/gemini-3-pro-image(-preview) | 1120 | 1120 | 2000 | high |
| google/gemini-nano-banana-2.1 | 1120 | 1680 | 3780 | high (4K: docs conflict, 3780 matches stated $) |
| tencent/hy-image-v3.5-preview | 15000 | 15000 | 20000 | high |
| microsoft/mai-image-2.5, -2.5-pro, -2.6, -2.6-flash | ~1024 | — | — | medium (derived, not published) |
| inclusionai/ming-image-0.1-design(-layer) | free ($0) | | | high |

OpenAI depends on quality as well as size (1024x1024 shown; 2K/4K for gpt-image-2 in the detail file):

| Model (and GPT-5 wrappers) | low | medium | high | Confidence |
|---|---|---|---|---|
| openai/gpt-image-1, gpt-5-image | 272 | 1056 | 4160 | high |
| openai/gpt-image-1-mini, gpt-5-image-mini | use stated $0.005 / $0.011 / $0.036 | | | low (table and prices disagree) |
| openai/gpt-image-2, gpt-5.4-image-2 | 196 | 1756 | 7024 | high |
| openai/gpt-image-2.5-sunburst, -flare | 196 | 439 | 1756 (xhigh 3122, max 7024) | medium-high |

## Open questions

- Which quality OpenRouter requests for OpenAI models by default (likely `auto`, undocumented).
- Pixel size OpenRouter sends for MAI models and for its resolution tiers generally.
- Nano Banana Pro preview: OpenRouter image endpoint says $0.00006/token, catalogue $0.00012 (Google's batch vs standard rate?).
- One real generation per uncertain Model, reading `usage`, would settle these.
