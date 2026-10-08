// The Transcription page's part of the shell (app.js): its own column, after
// the core ones: the price per minute of audio (row.perMinute, from
// js/transcription.js), or "—" and the reason.
import { fmtUsd, costCell } from './table.js';

const COLUMNS = [
  { key: 'perMinute', label: 'Per minute', title: 'USD per minute of audio; "—" when it can\'t be computed (hover for why)',
    cell: r => r.perMinute.kind === 'usd' ? `<td class="num">${fmtUsd(r.perMinute.usd)}</td>` : costCell(r.perMinute) },
];

/**
 * The Transcription page's view (see the page views in app.js).
 * @param {import('./app.js').ViewShell} shell
 */
export function transcriptionView() {
  return { id: 'transcription', label: 'Transcription', columns: COLUMNS,
    description: 'Models that turn audio into text, priced per minute of audio. A "—" means no price can be computed; hover for why.' };
}
