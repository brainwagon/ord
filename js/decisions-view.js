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

export const DECISIONS_VIEW = {
  intro: '<p class="page-intro"><span class="badge warn">alpha</span> ' +
    'These Models answer through OpenRouter\'s Decisions API, which is in alpha and may change. ' +
    `See <a href="${API_URL}" target="_blank" rel="noopener">OpenRouter's Decisions API reference</a> ` +
    `(and its <a href="${GUIDE_URL}" target="_blank" rel="noopener">guide to Jev and the Decisions API</a>).</p>`,
  columns: [
    { key: 'acceptsImages', label: 'Images', defaultDir: 'desc', title: 'accepts images as input',
      cell: r => flagCell(r.acceptsImages, 'accepts images as input') },
    { key: 'zeroPrice', label: 'No charge', defaultDir: 'desc', title: 'listed at $0 (not the same as a :free variant)',
      cell: r => flagCell(r.zeroPrice, 'listed at $0') },
  ],
};
