# 08: Transcription page

**What to build:** A Transcription tab listing every Model whose outputs include `transcription`. The Workload is minutes of audio, defaulting to 60.
- **Per-second Models:** a Model with a single input price and no output price is treated as charging dollars per second of audio, so its cost is minutes × 60 × that price.
- **Unit unclear:** a per-second price above $0.01 is treated as "unit unclear" and gets no cost. Today this applies to the Microsoft MAI models.
- **Per-token Models:** Models with both input and output prices (e.g. gpt-4o-transcribe) show the per-token reason.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] Fixtures include whisper-1, the Microsoft MAI models and gpt-4o-transcribe exactly as the API returns them
- [ ] whisper-1's cost for 60 minutes is $0.36, in a core test
- [ ] The $0.01/s unit-unclear threshold is covered by a core test
- [ ] Per-token Models show "—" with the per-token reason
- [ ] The Workload persists
