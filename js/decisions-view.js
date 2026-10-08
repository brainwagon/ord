// The Decisions page's part of the shell (app.js): its header note and its
// own columns, after the core ones. The cost column and Workload inputs come
// from the core's declaration (js/decisions.js).

// OpenRouter's Decisions API reference, and its guide to the API (which
// arrived with TypeSafe's Jev).
const API_URL = 'https://openrouter.ai/docs/api/api-reference/alphadecisions/submit-a-decisions-request';
const GUIDE_URL = 'https://openrouter.ai/docs/guides/community/jev';

const flagCell = (on, title) => on
  ? `<td class="flag" title="${title}">✓</td>`
  : '<td class="flag"></td>';

const DESCRIPTION = 'Models that answer through OpenRouter\'s Decisions API, priced by the input tokens of a batch of decisions.';

const INTRO = '<p class="page-intro"><span class="badge warn">alpha</span> ' +
  'The Decisions API is in alpha and may change. ' +
  `See <a href="${API_URL}" target="_blank" rel="noopener">OpenRouter's Decisions API reference</a> ` +
  `(and its <a href="${GUIDE_URL}" target="_blank" rel="noopener">guide to Jev and the Decisions API</a>).</p>`;

const COLUMNS = [
  { key: 'acceptsImages', label: 'Images', defaultDir: 'desc', title: 'accepts images as input',
    cell: r => flagCell(r.acceptsImages, 'accepts images as input') },
  { key: 'zeroPrice', label: 'No charge', defaultDir: 'desc', title: 'listed at $0 (not the same as a :free variant)',
    cell: r => flagCell(r.zeroPrice, 'listed at $0') },
];

/**
 * The Decisions page's view (see the page views in app.js).
 * @param {import('./app.js').ViewShell} shell
 */
export function decisionsView() {
  return { id: 'decisions', label: 'Decisions', description: DESCRIPTION, intro: INTRO, columns: COLUMNS };
}
