# OpenRouter Dashboard

A public, keyless web dashboard that helps people discover models available through OpenRouter, including newly added ones, and compare what they would cost.

## Language

**Model**:
One entry in OpenRouter's model catalogue, identified by its OpenRouter id (e.g. `anthropic/claude-opus-5.5`).
_Avoid_: Endpoint, engine

**Capability page**:
A page of the dashboard listing every Model that can do one kind of thing: generate code, images, audio, or video; transcribe audio; or answer through the Decisions API. A Model appears on every Capability page it qualifies for.
_Avoid_: Category, tab, section

**Author**:
The organisation that made a Model; the part of its id before the `/` (e.g. `meta-llama`).
_Avoid_: Provider, vendor, maker

**Provider**:
An organisation that hosts a Model and serves requests for it through OpenRouter; one Model may have several.
_Avoid_: Host, author

**New model**:
A Model whose OpenRouter creation date falls within the recent window (30 days by default, adjustable by the viewer).
_Avoid_: Recent model, fresh model

**What's new**:
The dashboard's landing view: every New model across all Capability pages, each badged with the pages it appears on.
_Avoid_: Home, overview, feed

**Workload**:
A viewer-entered description of the work they plan to do (e.g. tokens in and out, number of images), used to compute each Model's cost for that work.
_Avoid_: Usage profile, scenario
