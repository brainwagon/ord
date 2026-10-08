// The Transcription page's definition and cost rule, plugged into the core
// (core.js) as a page definition. Pure: no DOM, no network.
//
// OpenRouter states no unit for transcription prices. A Model with a single
// input price (`prompt`) and no output price (`completion` zero) charges
// dollars per second of audio: whisper-1's "0.0001" is $0.006 a minute. A
// "per second" price above $0.01 is implausible (the Microsoft MAI models list
// 0.1 and 0.36), so it is "unit unclear" rather than overstating a cost by
// orders of magnitude. Models with both input and output prices (e.g.
// gpt-4o-transcribe) are billed by the token.

// The highest price per second of audio taken at face value.
export const MAX_PER_SECOND_USD = 0.01;

/**
 * The Transcription page definition (see the page definitions in core.js).
 * Rows add `perMinute`: the price per minute of audio, as a Cost. The core
 * passes in what the page needs from it, so this module imports nothing.
 *
 * @param {{REASONS: object, coreFields: (m: object) => object, includes: (m: object) => boolean}} core
 */
export function transcriptionPage({ REASONS, coreFields, includes }) {
  const reason = r => ({ kind: 'reason', reason: r });

  // A Model's price per second of audio, as a Cost.
  function perSecond(m) {
    const input = Number(m.pricing.prompt), output = Number(m.pricing.completion || 0);
    if (input < 0 || output < 0) return reason(REASONS.variable);
    if (output > 0) return reason(REASONS.perToken);
    if (input === 0) return m.id.endsWith(':free') ? { kind: 'usd', usd: 0 } : reason(REASONS.unpriced);
    if (input > MAX_PER_SECOND_USD) return reason(REASONS.unitUnclear);
    return { kind: 'usd', usd: input };
  }

  // A per-second Cost scaled to `seconds` of audio.
  const forSeconds = (c, seconds) =>
    c.kind === 'usd' ? { kind: 'usd', usd: Number((c.usd * seconds).toPrecision(12)) } : c;

  return {
    workload: {
      id: 'transcription',
      inputs: [{ key: 'minutes', label: 'Minutes of audio', default: 60, step: 10 }],
      cost: (m, w) => forSeconds(perSecond(m), w.minutes * 60),
    },
    includes,
    rowOf: m => ({ ...coreFields(m), perMinute: forSeconds(perSecond(m), 60) }),
    sortKeys: { perMinute: r => r.perMinute },
  };
}
