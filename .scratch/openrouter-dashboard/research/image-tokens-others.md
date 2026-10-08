# Output tokens per image: MAI-Image, HY-Image 3.5, Ming-Image

Researched 2026-10-08. No paid generation API was called. Labels used below:
**[stated]** means a primary source says it. **[derived]** is my arithmetic from stated figures.
**[inferred]** is a guess the sources don't make. **NOT FOUND** means the docs say nothing.

## OpenRouter endpoint data (fetched live)

Source: `https://openrouter.ai/api/v1/images/models/<id>/endpoints`.

| id | provider | output_image $/token | other billables | size controls |
|---|---|---|---|---|
| microsoft/mai-image-2.5 | Azure | 0.000047 | input_text 5e-6, input_image 8e-6 | aspect_ratio only (1:1,4:3,3:4,16:9,9:16,3:2,2:3,auto); no size/resolution param |
| microsoft/mai-image-2.5-pro | Azure | 0.000108 | input_text 5e-6, input_image 8e-6 | same |
| microsoft/mai-image-2.6 | Azure | 0.000038 | input_text 5e-6, input_image 8e-6 | same + web_grounding |
| microsoft/mai-image-2.6-flash | Azure | 0.000019 | input_text 1.75e-6, input_image 2.5e-6 | same + web_grounding |
| tencent/hy-image-v3.5-preview | Tencent Cloud | 0.0000016 | **only output_image is listed** (no input_image billable in the endpoint JSON) | resolution 1K/1.5K/2K/4K, 13 aspect ratios, size |
| inclusionai/ming-image-0.1-design | NovitaAI | 0 | input_image 0 | size, output_format |
| inclusionai/ming-image-0.1-design-layer | NovitaAI | 0 | input_image 0 | size; needs exactly 1 reference image |

Caveat: every OpenRouter model page and llms.txt shows the same example response,
`completion_tokens: 4175, cost: 0.04`. That includes the free Ming models, so it is a
boilerplate template. It is not a measured value, and you shouldn't use it.

---

## MAI-Image family (Microsoft, served via Azure AI Foundry)

### What Microsoft documents
- Billing is per token: text input, image input and image output each have a per-token price. **[stated]**
  - Azure Retail Prices API: `https://prices.azure.com/api/retail/prices?$filter=contains(productName,'MAI')`
  - Global Standard output rates: Image 2.5 $0.047/1K tokens; 2.5 Pro $106/1M; 2.6 $38/1M; 2.6 Flash $19/1M; 2.5 Flash $0.0195/1K. Separately, 2e is $0.0195/1K and 2 is $0.033/1K.
- Pixel caps come from Microsoft Learn (`https://learn.microsoft.com/en-us/azure/foundry/foundry-models/how-to/use-foundry-models-mai-image`, updated 2026-09-21). **[stated]**
  - MAI-Image-2.5 / 2.5-Flash / 2.5-Pro: width x height <= 1,048,576 (1024x1024 equivalent).
  - MAI-Image-2.6 / 2.6-Flash: width x height <= 2,359,296 (1536x1536 equivalent).
  - Each side must be at least 768 px. Width and height are free integers; there are no 1K/2K/4K tiers.
- **Tokens per output image, and how the count scales with size: NOT FOUND in any Microsoft source.**
  - The Learn page, both microsoft.ai launch posts and the Azure price meters don't give it. The Learn response schema has no `usage` block.

### Secondary evidence on tokens per image
- Forgebook notebook (`https://microsoft-foundry.github.io/forgebook/notebook/mai-image-2/`), a microsoft-foundry GitHub org page but not official docs, covers MAI-Image-2:
  - "each image is counted as a fixed number of tokens based on resolution"
  - "1024x1024 ~ 1,056 tokens (approximate; consult Azure pricing page for exact)"
- Artificial Analysis, as quoted by Microsoft's 2.6 post, runtimewire.com and orcarouter.ai, gives per-1,000-image prices. Dividing each by the per-token rate gives about 1,024 output tokens per image every time. **[derived]**

| Model | Azure $/1M output tok | AA quoted $/1k images | implied tokens/image |
|---|---|---|---|
| MAI-Image-2.6 | 38 | 38.90 | 1023.7 (1024 x 38 = $38.91) |
| MAI-Image-2.6-Flash | 19 | 19.5 | 1026 (1024 x 19 = $19.46) |
| MAI-Image-2.5-Pro | 106 | ~108.50 "per 1,000 1024x1024 images" | 1023.6 (1024 x 106 = $108.54) |
| MAI-Image-2.5-Flash | 19.5 | 20 | 1025.6 |
| MAI-Image-2.5 | 47 | NOT FOUND (cloudprice/futureagi say ~$0.050/image, unverified) | ~1064 if $0.050 is exact; 1024 gives $0.0481 |

- Conclusion: a 1024x1024 output costs about 1,024 output tokens, give or take a few percent. **[derived]**
  - The Forgebook figure is 1,056. AA's prices fit 1,024 exactly.
  - Sources: the cloudprice/futureagi pages above; orcarouter.ai/blog/mai-image-2-5-pro-tops-image-editing-leaderboard; runtimewire.com/article/microsoft-mai-image-2-6-foundry-four-cents-image.
- Scaling with size: **[inferred, NOT documented]**. 1024 tokens at 1024x1024 is consistent with 1 token per 32x32 px patch, i.e. about 977 tokens/MP.
  - Under that hypothesis, a 2.6 image at the 1536x1536 cap would be ~2,304 tokens. That would be about $0.088 on 2.6 and $0.044 on 2.6 Flash.
  - Nobody states this. AA's 2.6 price shows that AA itself priced a ~1024-token image.
- OpenRouter exposes no size parameter for MAI, only aspect_ratio. The pixel size OpenRouter actually requests per aspect ratio is NOT FOUND.
  - For 2.5 models the 1 MP cap bounds the output to <= ~1,024 tokens, if tokens scale with pixels.
  - For 2.6 models, whether OpenRouter requests 1 MP or up to 2.36 MP is unknown.
- Discrepancy: OpenRouter charges $108/M for 2.5-Pro, while Azure's meter and Microsoft's announcement say $106/M. **[stated, both]**
  - Microsoft's announcement: `https://microsoft.ai/news/introducing-mai-image-2-5-pro-and-mai-voice-2-fl`

### Suggested per-image values for the dashboard (1024 tok x OpenRouter price) [derived]

| OpenRouter id | $/token | tokens/image (1 MP) | $/image |
|---|---|---|---|
| microsoft/mai-image-2.5 | 0.000047 | ~1024 | ~$0.048 |
| microsoft/mai-image-2.5-pro | 0.000108 | ~1024 | ~$0.111 |
| microsoft/mai-image-2.6 | 0.000038 | ~1024 (more if output >1 MP, unverified) | ~$0.039 |
| microsoft/mai-image-2.6-flash | 0.000019 | ~1024 (same caveat) | ~$0.019 |

---

## tencent/hy-image-v3.5-preview

| Resolution tier | Pixels | Tokens/image | CNY (10 CNY/M tok) | USD at OpenRouter $1.6/M |
|---|---|---|---|---|
| 1K | 1,048,576 (1024x1024) | **15,000** [stated] | 0.15 [stated] | $0.024 [derived; Tencent states $0.024/image intl] |
| 1.5K | 2,359,296 (default) | **NOT FOUND** (likely 15,000 because 1K and 2K are both 15,000, [inferred]) | - | ~$0.024 [inferred] |
| 2K | 4,194,304 (2048x2048) | **15,000** [stated] | 0.15 [stated] | $0.024 [stated by Tencent X post / intl] |
| 4K | 4096x4096 via `size` | **20,000** [stated] | 0.20 [stated] | $0.032 [derived] |

- Scaling: the count is not proportional to pixels. It is a flat tier price: 15,000 tokens up to 2K, then 20,000 at 4K. **[stated]** It is not per patch.
- Sources:
  - TokenHub pricing table (Guangzhou), with "15,000 tokens/张" for 1K and 2K and "20,000 tokens/张" for 4K: `https://cloud.tencent.com/product/tokenhub`
  - API guide (CN): `https://cloud.tencent.com/document/product/1823/135745`. Its example response for a 4096x4096 request shows `total_tokens: 20000`, and it says "v3.5 目前不拆分 prompt / completion" (no prompt/completion split).
  - API guide (intl), with the tiers 1K = 1,048,576 / 1.5K = 2,359,296 (default) / 2K = 4,194,304 px, and 4K only via `size`: `https://intl.cloud.tencent.com/document/product/1300/83708`
  - Launch post, "$0.024 per image on Tencent Cloud API... Up to 2K": `https://x.com/TencentHunyuan/status/2102226552310419473`
- Input images: secondary sources (cellcog.ai, orcarouter.ai) say "only output images are charged; reference images and failed generations are free." The Tencent docs I read don't say this either way.
  - The docs do mention input images consuming context tokens, via `resize_max_pixels`.
  - The OpenRouter endpoint JSON lists **only** `output_image` at $1.6e-6. It has no `input_image` billable, which contradicts the brief's claim of image input at the same price.
  - Because usage doesn't split prompt and completion, any input-image cost would arrive inside the single `total_tokens` figure.

---

## inclusionai/ming-image-0.1-design and -design-layer

- **Free on OpenRouter: yes, confirmed.** **[stated]**
  - The endpoint JSON shows input_image = 0 and output_image = 0, with NovitaAI as the sole provider.
  - OpenRouter's compare page says: "Ming Image 0.1 Design, from inclusionai, is free to use on OpenRouter". Its price list shows "Free". Source: `https://openrouter.ai/compare/inclusionai/ming-image-0.1-design/microsoft/mai-image-2.6`
  - The base id isn't `:free`-suffixed. Search results also show a dated variant, `inclusionai/ming-image-0.1-design-20260922`.
  - Free-tier rate limits: NOT FOUND. Whether Novita charges OpenRouter: NOT FOUND.
- Tokens per image: **NOT FOUND / not applicable.** Nothing I found describes per-token image billing, and the price is 0.
- For reference, DeepInfra prices the same weights per image, not per token: `$0.01 x (width/1024) x (height/1024) x (iters/12)`. Source: `https://deepinfra.com/inclusionAI/Ming-Image-0.1-Design/api`
- Resolution, from third-party mirrors of the model card (gradually.ai, baseten.co):
  - Recommended 2048x2048, with 1024x1024 for speed. RGBA output.
  - I could not open the HF card directly.
- On OpenRouter: Design picks its own dimensions and rejects explicit sizes and aspect ratios. Design-Layer output follows the input image's size.
