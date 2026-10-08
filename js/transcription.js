// The Transcription page: transcription Models, costed for a Workload of
// minutes of audio. A page definition for core.js's shared pipeline (see the
// comment above the page definitions there). Pure: no DOM, no network.
//
// OpenRouter states no unit for transcription prices. A Model with a single
// input price (`prompt`) and no output price (`completion` zero) charges
// dollars per second of audio: whisper-1's "0.0001" is $0.006 a minute. A
// "per second" price above $0.01 is implausible (the Microsoft MAI models list
// 0.1 and 0.36), so it is "unit unclear" rather than overstating a cost by
// orders of magnitude. Models with both input and output prices (e.g.
// gpt-4o-transcribe) are billed by the token.
import { parsePrice, roundUsd, reason, usd, isFreeVariant } from './pricing.js';

// The highest price per second of audio taken at face value.
const MAX_PER_SECOND_USD = 0.01;

// A Model's price per second of audio, as a Price.
function perSecond(m) {
  const input = parsePrice(m.pricing?.prompt), output = parsePrice(m.pricing?.completion ?? 0);
  if (input === null || output === null) return reason('unpriced');
  if (input < 0 || output < 0) return reason('variable');
  if (output > 0) return reason('perToken');
  if (input === 0) return isFreeVariant(m.id) ? usd(0) : reason('unpriced');
  if (input > MAX_PER_SECOND_USD) return reason('unitUnclear');
  return usd(input);
}

// A per-second Price scaled to `seconds` of audio.
const forSeconds = (p, seconds) => p.kind === 'usd' ? usd(p.usd * seconds) : p;

/**
 * The Transcription page definition. Rows add `perMinute`: the price per
 * minute of audio, as a Price.
 *
 * @param {import('./core.js').PageCore} core
 */
export function transcriptionPage({ coreFields, includes }) {
  return {
    workload: {
      id: 'transcription',
      inputs: [{ key: 'minutes', label: 'Minutes of audio', default: 60, step: 10 }],
      cost: (m, w) => forSeconds(perSecond(m), w.minutes * 60),
    },
    includes,
    rowOf: m => {
      const perMinute = forSeconds(perSecond(m), 60);
      return { ...coreFields(m), perMinute: perMinute.kind === 'usd' ? usd(roundUsd(perMinute.usd)) : perMinute };
    },
    sortKeys: { perMinute: r => r.perMinute },
  };
}
