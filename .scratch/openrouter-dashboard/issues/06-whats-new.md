# 06: What's new landing view

**What to build:** Opening the dashboard with no tab selected shows What's new: every New model in the whole catalogue, newest first, including kinds that have no Capability page (embeddings, rerank, routers). Each Model is badged with the Capability pages it appears on. The viewer can change the "new" window, which defaults to 30 days. New models also carry a "new" badge on every other page.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] What's new is the default tab
- [ ] The New model boundary (created within the window before the current time) is covered by a core test with a fixed current time
- [ ] Page badges list every Capability page each Model appears on (core test with a multi-capability fixture Model)
- [ ] Changing the window updates What's new and the "new" badges everywhere
- [ ] Aliases are excluded from What's new
