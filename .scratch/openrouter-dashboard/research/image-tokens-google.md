# Gemini image models: output tokens per generated image

Researched 2026-10-08. All figures were read from the live primary pages on that date
(raw HTML fetched with curl and grepped, not paraphrased by a summarizer).

Sources:
- [P] Gemini API pricing: https://ai.google.dev/gemini-api/docs/pricing
- [G] Gemini API image-generation guide ("Aspect ratios and image size" tables): https://ai.google.dev/gemini-api/docs/image-generation
- [V] Vertex AI generative AI pricing: https://cloud.google.com/vertex-ai/generative-ai/pricing
- [C] Gemini API changelog: https://ai.google.dev/gemini-api/docs/changelog
- [D] Gemini API deprecations: https://ai.google.dev/gemini-api/docs/deprecations

**Formula check**: $/image = tokens x (output-image $/1M) / 1e6. Every row below was
checked. Google rounds its stated $/image (e.g. 1120 x $60/M = $0.0672, stated as $0.067).

**Aspect ratio**: for every model, the [G] tables give the **same token count for every
aspect ratio** at a given resolution. Only pixel dimensions change. Resolution (image_size)
is the only thing that affects tokens.

**Thinking**: [G] says thinking-mode interim "thought images" are "not charged". Thinking
*text* tokens are billed at the text-output rate, which is a separate line from image tokens.

---

## google/gemini-2.5-flash-image ("Nano Banana"). Image output $30/1M ([P], [V])

| Resolution | Tokens | $/image (Google) | tokens x $0.00003 | Source |
|---|---|---|---|---|
| 1K only (up to 1024x1024; all 10 aspect ratios, e.g. 1344x768 for 16:9) | 1290 | $0.039 | $0.0387 | [P] footnote, [G] table, [V] footnote |
| 0.5K / 2K / 4K | not supported (not found in docs) | - | - | [G] lists one resolution only |

Aspect ratios 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9. All are 1290 tokens [G].
Batch/Flex: $0.0195/image. Priority: $0.0702/image [P].
**Shutdown date conflict**: [P] says "deprecated and will be shut down on October 2, 2026"
(that date has already passed). [D] lists release Oct 2, 2025 and shutdown March 15, 2027,
with replacement gemini-3.1-flash-lite-image. The pricing page may have typed the release
date where the shutdown date belongs. This is unresolved.

## google/gemini-3.1-flash-image ("Nano Banana 2"). Image output $60/1M ([P], [V] global; Vertex non-global $66/1M)

| Resolution | Tokens | $/image (Google) | tokens x $0.00006 | Source |
|---|---|---|---|---|
| 0.5K (512x512) | 747 | $0.045 | $0.04482 | [P], [G], [V] |
| 1K (1024x1024) | 1120 | $0.067 | $0.0672 | [P], [G], [V] |
| 2K (2048x2048) | 1680 | $0.101 | $0.1008 | [P], [G], [V] |
| 4K (4096x4096) | 2520 | $0.151 ([V] says $0.15) | $0.1512 | [P], [G], [V] |

Aspect ratios: 14 (1:1, 1:4, 1:8, 2:3, 3:2, 3:4, 4:1, 4:3, 4:5, 5:4, 8:1, 9:16, 16:9, 21:9).
The token count is the same for every ratio [G].
Batch: $30/1M, which is $0.022 / $0.034 / $0.050 / $0.076 per image [P].
Deprecated on 2026-10-06 in favour of gemini-nano-banana-2.1, with no shutdown date [C].
**-preview**: gemini-3.1-flash-image-preview was shut down on 2026-06-25 ([C], [D]). Google
no longer prices it. OpenRouter's -preview id presumably maps to the same rate. That mapping
is not confirmed by Google.

## google/gemini-3.1-flash-lite-image ("Nano Banana 2 Lite"). Image output $30/1M ([P], [V])

| Resolution | Tokens | $/image (Google) | tokens x $0.00003 | Source |
|---|---|---|---|---|
| 1K (1024x1024) | 1120 | $0.0336 ([V] says $0.034) | $0.0336 | [P], [V] |
| 0.5K / 2K / 4K | not supported | - | - | [G]: "only supports 1K resolution" |

Aspect ratios: [G] says it supports 1:1, 3:2, 2:3, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9.
**No per-aspect-ratio token table exists for this model (not found).** Every other model's
table is flat, so 1120 for every ratio is likely, but it is inferred and not documented.
Batch: $15/1M, which is $0.0168/image [P].

## google/gemini-3-pro-image ("Nano Banana Pro"). Image output $120/1M ([P], [V])

| Resolution | Tokens | $/image (Google) | tokens x $0.00012 | Source |
|---|---|---|---|---|
| 1K (1024x1024) | 1120 | $0.134 | $0.1344 | [P], [G], [V] |
| 2K (2048x2048) | 1120 (same as 1K) | $0.134 | $0.1344 | [P], [G], [V] |
| 4K (4096x4096) | 2000 | $0.24 | $0.24 | [P], [G], [V] |
| 0.5K | not supported (not found) | - | - | [G] lists 0.5K for 3.1 Flash Image only |

Aspect ratios: 10 (1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9). The token count is
the same for every ratio [G]. (The [G] table heading reads "3.1 Pro Image", which looks like a
docs typo. There is no gemini-3.1-pro-image model id on [G], the models page or [D].)
Batch/Flex: $0.067 per 1K/2K image and $0.12 per 4K image [P]. That implies **$60/1M**, and
[V] lists Flex/Batch Image Output at $60.00/1M. Priority on Vertex is $216/1M.
**OpenRouter discrepancy ($0.00012 vs $0.00006 for -preview)**: Google publishes no separate
-preview price. gemini-3-pro-image-preview was shut down on 2026-06-25 ([C], [D]). The only
$60/1M rate Google documents for this model is the **Batch/Flex** tier. That is a plausible
source of OpenRouter's $0.00006 figure, but this is my inference and Google does not state
it. For standard (synchronous) use, Google's rate is $120/1M.

## google/gemini-nano-banana-2.1 ("Nano Banana 2.1", GA 2026-10-06 [C]). Image output $30/1M ([P], [V])

| Resolution | Tokens | $/image (Google) | tokens x $0.00003 | Source |
|---|---|---|---|---|
| 1K (1024x1024) | 1120 | $0.0336 ([V] says $0.034) | $0.0336 | [P], [G], [V] |
| 2K (2048x2048) | 1680 | $0.0504 ([V] says $0.05) | $0.0504 | [P], [G], [V] |
| 4K (4096x4096) | **3780 per [P] and [V]; 2520 per [G] table** | $0.113 | 3780 gives $0.1134, 2520 gives $0.0756 | **CONFLICT**, see below |
| 0.5K | not supported | - | - | [G]: 512px "not supported on Gemini Nano Banana 2.1" |

**4K conflict**: both pricing pages ([P] footnote and [V] footnote [4]) say 3780 tokens / $0.113.
The image-generation guide's table [G] says 2520 for every 4K aspect ratio. Its 4K column is
identical to the 3.1 Flash Image table and may have been copied from it. The $/image Google
states ($0.113, batch $0.0567) agrees only with 3780. **Recommendation: use 3780 for 4K
pricing.** Two pricing pages agree with each other and with the stated dollar amount, but
treat the figure as medium confidence until the guide is fixed.
Aspect ratios: 14 (same set as 3.1 Flash Image, including 1:4, 4:1, 1:8, 8:1). The token
count is the same for every ratio [G].
Batch: $15/1M, which is $0.0168 / $0.0252 / $0.0567 per image [P]. Flex is not supported [V].
Vertex Priority is $54/1M.

---

## Summary for the dashboard (standard tier)

| OpenRouter id | $/token | 0.5K | 1K | 2K | 4K |
|---|---|---|---|---|---|
| google/gemini-2.5-flash-image | 0.00003 | n/a | 1290 ($0.039) | n/a | n/a |
| google/gemini-3.1-flash-image(-preview) | 0.00006 | 747 ($0.045) | 1120 ($0.067) | 1680 ($0.101) | 2520 ($0.151) |
| google/gemini-3.1-flash-lite-image | 0.00003 | n/a | 1120 ($0.0336) | n/a | n/a |
| google/gemini-3-pro-image(-preview) | 0.00012 | n/a | 1120 ($0.134) | 1120 ($0.134) | 2000 ($0.24) |
| google/gemini-nano-banana-2.1 | 0.00003 | n/a | 1120 ($0.0336) | 1680 ($0.0504) | 3780 ($0.113)* |

\* The pricing pages say 3780. The image-generation guide's table says 2520 (conflict).
Aspect ratio never changes the token count in any documented table.
