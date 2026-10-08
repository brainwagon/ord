# 07: Decisions page

**What to build:** A Decisions tab listing every Model whose outputs include `decisions`. Its header says the Decisions API is in alpha and links to OpenRouter's documentation for it.
- **Workload:** number of decisions × input tokens per decision, defaulting to 1,000 × 2,000. Cost is computed from the input price, since decision models have no output price.
- **Extra columns:** "accepts images" (when `image` is among the input modalities) and "free".

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] Membership, the accepts-images flag and the free flag are covered by core tests using real decisions fixtures (an image-accepting Model and a `:free` Model)
- [ ] Costs match hand-computed amounts
- [ ] The Workload persists like the other pages'
