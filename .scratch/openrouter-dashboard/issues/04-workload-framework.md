# 04: Workload framework, shown on the Code page

**What to build:** The Code page gets a Workload of input tokens and output tokens, defaulting to 3M in and 1M out. Each row shows that Model's cost for the Workload, computed from the input and output prices at the base tier. This ticket also establishes the shared mechanism every later Capability page reuses:
- **Workload inputs:** each page declares its own inputs and passes them through the core's settings.
- **Cost cells:** a cost cell holds either a USD amount or a cost-unavailable reason (per-token pricing, unpriced, unit unclear, variable, pricing data not loaded), shown as "—" with the reason on hover.
- **Cost ordering:** sorting by cost puts computed costs first in ascending order, so free Models come first, followed by every row with a reason.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] Changing the Workload updates every cost immediately
- [ ] Code-page costs match hand-computed dollar amounts in core tests
- [ ] Rows with a reason display "—" and the reason, and sort after computed costs (core test)
- [ ] Variable-priced routers show a "variable" reason, never a cost
- [ ] Adding a Workload to a new page needs only a page-specific input declaration and a cost rule, not changes to the shared cells or sort
