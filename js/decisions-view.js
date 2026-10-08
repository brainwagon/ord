// The Decisions page's part of the shell (app.js): its header note and its
// own columns, after the core ones. The cost column and Workload inputs come
// from the core's declaration (js/decisions.js).

// OpenRouter's guide to the Decisions API (it arrived with TypeSafe's Jev).
const DOCS_URL = 'https://openrouter.ai/docs/guides/community/jev';

const flagCell = (on, title) => on
  ? `<td class="flag" title="${title}">✓</td>`
  : '<td class="flag"></td>';

export const DECISIONS_VIEW = {
  intro: '<p class="page-intro"><span class="badge warn">alpha</span> ' +
    'These Models answer through OpenRouter\'s Decisions API, which is in alpha and may change. ' +
    `See <a href="${DOCS_URL}" target="_blank" rel="noopener">OpenRouter's Decisions API documentation</a>.</p>`,
  columns: [
    { key: 'acceptsImages', label: 'Images', defaultDir: 'desc', title: 'accepts images as input',
      cell: r => flagCell(r.acceptsImages, 'accepts images as input') },
    { key: 'free', label: 'Free', defaultDir: 'desc', title: 'costs nothing: listed at $0',
      cell: r => flagCell(r.free, 'listed at $0') },
  ],
};
