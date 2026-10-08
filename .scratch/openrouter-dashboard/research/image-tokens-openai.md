# OpenAI image models: output image tokens per image

Researched 2026-10-08. No generation API was called.

## Sources

- **[G] Image generation guide, "Cost and latency" section:** https://developers.openai.com/api/docs/guides/image-generation (platform.openai.com/docs/guides/image-generation now 301-redirects here).
- **[C] The guide's token calculator source:** https://developers.openai.com/_astro/GptImageTokenCalculator.react.DB6kMQE5.js. The page mounts it with props `{"outputPricePerMillion":30}`. This file holds OpenAI's exact token formula for gpt-image-2 and gpt-image-2.5.
- **[P] Pricing page:** https://developers.openai.com/api/docs/pricing
- **[M1] gpt-image-1 model page:** https://developers.openai.com/api/docs/models/gpt-image-1
- **[Mm] gpt-image-1-mini model page:** https://developers.openai.com/api/docs/models/gpt-image-1-mini
- **[OR] OpenRouter models API, read 2026-10-08:** https://openrouter.ai/api/v1/models?output_modalities=image
- **[ORD] OpenRouter image generation guide:** https://openrouter.ai/docs/guides/overview/multimodal/image-generation.md

## Image output prices per 1M tokens

| OpenAI model | OpenAI price [P] | OpenRouter `image_output` [OR] |
|---|---|---|
| gpt-image-1 | $40 | 0.00004/token, for openai/gpt-image-1 and openai/gpt-5-image |
| gpt-image-1-mini | $8 | 0.000008/token, for openai/gpt-image-1-mini and openai/gpt-5-image-mini |
| gpt-image-1.5 | $32 | (not on OpenRouter list) |
| gpt-image-2 | $30 | 0.00003/token, for openai/gpt-image-2 and openai/gpt-5.4-image-2 |
| gpt-image-2.5-sunburst / -flare | $30 | 0.00003/token for each |

OpenRouter's per-token prices equal OpenAI's list prices.

The bundled models use these underlying image models [OR descriptions]:

| OpenRouter bundle | Underlying image model |
|---|---|
| gpt-5-image | GPT Image 1 |
| gpt-5-image-mini | GPT Image 1 Mini |
| gpt-5.4-image-2 | GPT Image 2 |

The bundles also bill the chat model's text tokens.

**Streaming partial images:** each partial image adds 100 image output tokens [G].

---

## 1. Models before gpt-image-2: gpt-image-1, gpt-image-1.5, (gpt-image-1-mini?)

The guide [G] publishes this table for "GPT Image models prior to gpt-image-2". It does not name the individual models.

| Quality | 1024x1024 | 1024x1536 (portrait) | 1536x1024 (landscape) |
|---|---|---|---|
| low | 272 | 408 | 400 |
| medium | 1056 | 1584 | 1568 |
| high | 4160 | 6240 | 6208 |

- **Sizes:** only 1024x1024, 1024x1536 and 1536x1024, plus `auto` [M1, Mm]. These models have no 2K or 4K sizes.
- **Quality `auto`:** no token count is published. The guide says that for gpt-image-2.5 "auto depends on the generated image". No source states what `auto` resolves to for gpt-image-1.

### gpt-image-1 ($40/M): tokens × price vs the stated $/image [G, M1]

| Quality | 1024² | 1024x1536 | 1536x1024 |
|---|---|---|---|
| low | 272 tok → $0.01088 (stated $0.011) | 408 → $0.01632 ($0.016) | 400 → $0.016 ($0.016) |
| medium | 1056 → $0.04224 ($0.042) | 1584 → $0.06336 ($0.063) | 1568 → $0.06272 ($0.063) |
| high | 4160 → $0.1664 ($0.167) | 6240 → $0.2496 ($0.25) | 6208 → $0.24832 ($0.25) |

Every cell agrees. **Confidence: high.**

### gpt-image-1.5 ($32/M): for reference

272 × 32/1M = $0.0087 (stated $0.009). 4160 → $0.133 (stated $0.133). 6240 → $0.1997 (stated $0.20).

The same token table holds. **Confidence: high.**

### gpt-image-1-mini ($8/M): DISCREPANCY

OpenAI's stated $/image [G, Mm]:

| Quality | 1024² | 1024x1536 | 1536x1024 |
|---|---|---|---|
| low | $0.005 | $0.006 | $0.006 |
| medium | $0.011 | $0.015 | $0.015 |
| high | $0.036 | $0.052 | $0.052 |

The shared token table does not reproduce these prices. For example, 272 × $8/M = $0.0022, against a stated $0.005.

The stated prices imply these token counts (stated $ ÷ $8/M). These are my own back-calculations, not published figures:

| Quality | 1024² | 1024x1536 | 1536x1024 |
|---|---|---|---|
| low | ~625 | ~750 | ~750 |
| medium | ~1375 | ~1875 | ~1875 |
| high | ~4500 | ~6500 | ~6500 |

**Official per-size token counts for gpt-image-1-mini: NOT FOUND.** The mini model page [Mm] lists no token counts. For the dashboard, either use the stated $/image directly for mini, or measure `usage.output_tokens` from real calls. **Confidence that the 272/1056/4160 table applies to mini: low.**

---

## 2. gpt-image-2 ($30/M)

The calculator [C] contains OpenAI's exact formula. The minified JS, de-minified:

```
base = {"gpt-image-2": {low:16, medium:48, high:96},
        "gpt-image-2.5": {low:16, medium:24, high:48, xhigh:64, max:96}}[model][quality]
long = max(W,H); short = min(W,H)
s = base / (long/short)
u = round-half-to-even(s)      // for an exact .5, round to the even neighbour; otherwise Math.round
grid = base * u                // base on the long side, u on the short side
tokens = ceil(grid * (2_000_000 + W*H) / 4_000_000)
```

The calculator also enforces these size rules [C, G]:

- Each edge is a multiple of 16.
- 655,360 ≤ W·H ≤ 8,294,400.
- The longest edge is at most 3840.
- The aspect ratio is at most 3:1.

The calculator's default display, gpt-image-2.5 at low quality and 1024², shows 196 tokens and $0.00588. The formula gives the same result.

Tokens, with $ at $30/M. Values are computed from [C]. Values marked * also have a stated $/image in [G].

| Quality | 1024x1024 | 1024x1536 / 1536x1024 | 2048x2048 (2K sq) | 2048x1152 / 1152x2048 (2K) | 2560x1440 | 3840x2160 / 2160x3840 (4K) |
|---|---|---|---|---|---|---|
| low | 196 ($0.0059)* | 158 ($0.0047)* | 397 ($0.0119) | 157 ($0.0047) | 205 ($0.0062) | 371 ($0.0111) |
| medium | 1756 ($0.0527)* | 1372 ($0.0412)* | 3568 ($0.1070) | 1413 ($0.0424) | 1843 ($0.0553) | 3336 ($0.1001) |
| high | 7024 ($0.2107)* | 5488 ($0.1646)* | 14272 ($0.4282) | 5650 ($0.1695) | 7370 ($0.2211) | 13342 ($0.4003) |
| auto | NOT FOUND (depends on the image) | | | | | |

**Cross-check against OpenAI's stated $/image for gpt-image-2 [G]:**

| Quality | 1024² | 1024x1536 | 1536x1024 |
|---|---|---|---|
| low | $0.006 | $0.005 | $0.005 |
| medium | $0.053 | $0.041 | $0.041 |
| high | $0.211 | $0.165 | $0.165 |

All of them match. **Confidence: high.**

- **Default size and quality:** both default to `auto` [G].
- **The guide's "popular sizes" [G]:** 1024x1024, 1536x1024, 1024x1536, 2048x2048 ("2K square"), 2048x1152 ("2K landscape"), 3840x2160 ("4K landscape"), 2160x3840 ("4K portrait").
- **Non-square images can cost fewer tokens.** Because of the aspect-ratio term, a larger non-square image can cost fewer tokens than a square one. The guide says so explicitly.

---

## 3. gpt-image-2.5-sunburst and gpt-image-2.5-flare ($30/M)

Sunburst and Flare share one calculator entry, "GPT Image 2.5 (Sunburst and Flare)" [C]. They therefore have the same token table, despite their different positioning: Sunburst is the "precision" tier and Flare the "speed" tier [OR].

The guide adds: "Equal token rates don't mean equal cost per image: token consumption can differ by model and quality setting" [G]. The calculator does not model any difference between Sunburst and Flare, so treat their equality as **medium confidence**.

Quality levels are low, medium, high, xhigh, max and auto. `auto` is the default [G].

| Quality | 1024x1024 | 1024x1536 / 1536x1024 | 2048x2048 | 2048x1152 | 2560x1440 | 3840x2160 |
|---|---|---|---|---|---|---|
| low | 196 ($0.0059) | 158 ($0.0047) | 397 ($0.0119) | 157 ($0.0047) | 205 ($0.0062) | 371 ($0.0111) |
| medium | 439 ($0.0132) | 343 ($0.0103) | 892 ($0.0268) | 367 ($0.0110) | 478 ($0.0143) | 865 ($0.0260) |
| high | 1756 ($0.0527) | 1372 ($0.0412) | 3568 ($0.1070) | 1413 ($0.0424) | 1843 ($0.0553) | 3336 ($0.1001) |
| xhigh | 3122 ($0.0937) | 2459 ($0.0738) | 6343 ($0.1903) | 2511 ($0.0753) | 3276 ($0.0983) | 5930 ($0.1779) |
| max | 7024 ($0.2107) | 5488 ($0.1646) | 14272 ($0.4282) | 5650 ($0.1695) | 7370 ($0.2211) | 13342 ($0.4003) |
| auto | NOT FOUND ("auto depends on the generated image" [G]) | | | | | |

The 2.5 quality levels line up with gpt-image-2 as follows:

| gpt-image-2.5 | gpt-image-2 |
|---|---|
| low | low |
| high | medium |
| max | high |

- **Stated $/image for gpt-image-2.5:** NOT FOUND. OpenAI publishes only the calculator, not a table. The values above are computed from the calculator's own code, so they are what OpenAI's calculator displays.
- **Sizes:** the same custom-size rules as gpt-image-2. The recommended sizes are 1024x1024, 1536x1024 and 1024x1536. The guide calls the 8,294,400-pixel upper bound "4K" and says sizes above 2560x1440 are experimental [G].

---

## 4. 1K / 2K / 4K mapping

- **OpenAI docs.** Only the gpt-image-2 "popular sizes" carry labels: 2048x2048 is "2K square", 2048x1152 is "2K landscape", and 3840x2160 / 2160x3840 is "4K" [G].
  - By implication, 1024x1024, 1024x1536 and 1536x1024 are the "1K" tier. This is an inference; OpenAI never uses the word "1K".
  - gpt-image-1, gpt-image-1-mini and gpt-image-1.5 are 1K-only.
- **OpenRouter [ORD].** OpenRouter exposes a `resolution` tier: `512`, `768`, `1K`, `1.5K`, `2K`, `4K`. It states that "Concrete pixel dimensions are derived per-provider".
  - `size` accepts either a tier ("2K") or explicit pixels, "normalized for the provider".
  - The exact pixel dimensions OpenRouter sends to OpenAI for each tier: NOT FOUND.

## 5. Quality that OpenRouter uses by default

NOT FOUND.

- OpenRouter's `quality` parameter accepts `auto`, `low`, `medium` and `high` ("Providers without a quality knob ignore this") [ORD]. It documents no default. The text says that when a value is omitted, "the provider default applies" (stated for output format).
- OpenAI's own default is `auto` [G]. So the likeliest default is **`auto`**, meaning per-image cost varies with the image. This is an inference.
- OpenRouter's quality enum has no `xhigh` or `max`. Whether OpenRouter can request those levels from gpt-image-2.5: NOT FOUND.
- The `supported_parameters` that [OR] lists for these models do not include quality or size. The list contains only max_tokens, response_format, seed and structured_outputs.

**Suggested dashboard approach:** use **medium at 1024x1024** (or show a low/medium/high range) as the reference "per image" figure. To pin the OpenRouter default down, make one real call and read `usage`. That call was deliberately not made here.
