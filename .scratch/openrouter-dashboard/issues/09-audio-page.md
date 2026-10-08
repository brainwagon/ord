# 09: Audio page

**What to build:** An Audio tab listing every Model whose outputs include `speech` or `audio`. Transcription Models are excluded unless they also output speech or audio. The Workload is characters of text to speak.
- **Per-character Models:** Models priced per input character, such as ElevenLabs speech, get a cost of characters × that price.
- **Per-token Models:** Models priced only on audio output tokens (e.g. gpt-audio) show the per-token reason.
- **Unpriced Models:** Models with no non-zero price, such as Lyria, show as "unpriced", never free.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] Fixtures include an ElevenLabs speech Model, gpt-audio and a Lyria Model
- [ ] Membership and each of the three pricing outcomes are covered by core tests
- [ ] The Workload persists
