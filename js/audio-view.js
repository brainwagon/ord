// The Audio page's own column for the shell (app.js), after the core ones:
// the per-character price, or how the Model is billed instead (row.billing,
// from js/audio.js).
import { fmtUsd, esc } from './table.js';

const TOKEN_LABELS = { input: 'input', output: 'output', audioInput: 'audio input', audioOutput: 'audio output' };

function priceCell(r) {
  const b = r.billing;
  const note = (text, title) => `<td class="num note" title="${esc(title)}">${text}</td>`;
  if (r.charPrice) return `<td class="num">${fmtUsd(r.charPrice.usd)}</td>`;
  if (b.unit === 'token') {
    const lines = Object.entries(b.tokenPrices).map(([k, v]) => `${TOKEN_LABELS[k]} ${fmtUsd(v)}`);
    return note('per token', 'billed by the token, per 1M tokens: ' + lines.join(', '));
  }
  if (b.unit === 'second') return note(`${fmtUsd(b.usd)}/s`, 'billed per second of audio generated, which characters don\'t determine');
  if (b.unit === 'variable') return note('variable', 'price depends on the model the router picks');
  if (b.unit === 'unpriced') return note('unpriced', 'OpenRouter lists no price for this model');
  return note('unclear', "the price's unit is unclear");
}

export const AUDIO_COLUMNS = [
  { key: 'charPrice', label: 'Per 1M chars', title: 'USD per 1M characters of input text; otherwise how the model is billed (hover for details)',
    cell: priceCell },
];
