// The Audio page: speech and audio-output Models (text-to-speech, audio chat,
// music), costed for a Workload of characters to speak. A page definition for
// core.js's shared pipeline (see the comment above the page definitions there).
// Pure: no DOM, no network.

import { parsePrice } from './pricing.js';

// How a speech or audio Model is billed, from its catalogue prices. OpenRouter's
// TTS guide (docs/guides/overview/multimodal/tts) says most TTS Models are
// priced per character of input text, under `prompt`, and some (Seed Audio
// 1.0) per second of generated audio, under `completion`. The catalogue bears
// this out: every speech Model with only a `prompt` price is a per-character
// TTS Model (ElevenLabs $0.00004 = $40 per 1M characters). Token-billed ones
// show it plainly: gpt-audio has `audio`/`audio_output` token prices, and
// Gemini TTS prices text tokens in and audio tokens out (both `prompt` and
// `completion`). Anything else isn't guessed at.
//   {unit: 'character', usd}  USD per character (`prompt`; $0 on a :free variant)
//   {unit: 'second', usd}     USD per second of audio out (`completion`)
//   {unit: 'token'}           billed by the token
//   {unit: 'unclear'}         a price whose unit we can't pin down
//   {unit: 'unpriced'}        no non-zero price, and not a free offering (Lyria)
//   {unit: 'variable'}        the API's -1
function billingOf(m) {
  const n = k => parsePrice(m.pricing?.[k] ?? 0);
  const prompt = n('prompt'), completion = n('completion');
  if ([prompt, completion, n('audio'), n('audio_output')].includes(null)) return { unit: 'unpriced' };
  const audioTokens = n('audio') || n('audio_output');
  const speech = m.architecture.output_modalities.includes('speech');
  if ([prompt, completion, n('audio'), n('audio_output')].some(v => v < 0)) return { unit: 'variable' };
  if (!prompt && !completion && !audioTokens) {
    return m.id.endsWith(':free') ? { unit: 'character', usd: 0 } : { unit: 'unpriced' };
  }
  if (audioTokens || (prompt && completion)) return { unit: 'token' };
  if (speech && prompt) return { unit: 'character', usd: prompt };
  if (speech && completion) return { unit: 'second', usd: completion };
  return { unit: 'unclear' };
}

const REASON_OF_UNIT = { token: 'perToken', second: 'unitUnclear', unclear: 'unitUnclear',
  unpriced: 'unpriced', variable: 'variable' };

/**
 * The Audio page definition. The core passes in what the page needs from it,
 * so this module imports nothing.
 *
 * @param {{REASONS: object, coreFields: (m: object) => object, includes: (m: object) => boolean}} core
 */
export function audioPage({ REASONS, coreFields, includes }) {
  const workload = {
    id: 'audio',
    inputs: [
      { key: 'characters', label: 'Characters to speak', default: 100_000, step: 1_000 },
    ],
    cost: (m, w) => {
      const b = billingOf(m);
      if (b.unit === 'character') return { kind: 'usd', usd: w.characters * b.usd };
      return { kind: 'reason', reason: REASONS[REASON_OF_UNIT[b.unit]] };
    },
  };

  // Audio adds `charPrice` (a Price, USD per 1M characters, or null when the
  // Model isn't billed per character) and `billing`: its unit, as billingOf,
  // with the per-second rate (`usd`) or the token prices (`tokenPrices`, USD
  // per 1M tokens: input, output, audioInput, audioOutput, those the API gives).
  function audioRow(m) {
    const b = billingOf(m);
    const billing = b.unit === 'character' ? { unit: b.unit } : b.unit === 'token'
      ? { unit: b.unit, tokenPrices: tokenPrices(m.pricing) } : b;
    return {
      ...coreFields(m),
      charPrice: b.unit === 'character' ? { kind: 'usd', usd: perMillion(b.usd) } : null,
      billing,
    };
  }

  return {
    workload,
    includes,
    rowOf: audioRow,
    sortKeys: { charPrice: r => r.charPrice },
  };
}

const TOKEN_FIELDS = { input: 'prompt', output: 'completion', audioInput: 'audio', audioOutput: 'audio_output' };
function tokenPrices(pricing) {
  const out = {};
  for (const [name, field] of Object.entries(TOKEN_FIELDS)) {
    if (pricing[field] != null) out[name] = perMillion(Number(pricing[field]));
  }
  return out;
}

// Rounding to 12 significant digits removes the float noise scaling adds.
const perMillion = v => Number((v * 1e6).toPrecision(12));
