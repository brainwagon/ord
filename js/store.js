// Remembered settings: the viewer's settings saved in browser storage and
// merged back over the defaults on load, plus guarded JSON storage for the
// shell's other remembered data (the image-price cache). Part of the shell;
// `storage` is the browser's localStorage (or anything with its
// getItem/setItem/removeItem). Every access is guarded: a missing, blocked
// or full store means defaults.

/** The browser's localStorage, or null where it's missing or blocked (even reading it can throw then). */
export function browserStorage() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

/** The JSON value saved under `key`, or null when there's none or it can't be read. */
export function loadJson(storage, key) {
  try { return JSON.parse(storage.getItem(key)); } catch { return null; }
}

/** Save `value` as JSON under `key`; a blocked or full store is ignored. */
export function saveJson(storage, key, value) {
  try { storage.setItem(key, JSON.stringify(value)); } catch {}
}

// Keys are versioned: bump one when its saved shape changes incompatibly,
// and older saves are simply ignored.
const SETTINGS_KEY = 'ord.settings.v1';
const THEME_KEY = 'ord.theme.v1';
const THEMES = ['light', 'dark'];

// The theme override: 'light', 'dark', or null to follow the system.
export function loadTheme(storage) {
  let theme = null;
  try { theme = storage.getItem(THEME_KEY); } catch {}
  return THEMES.includes(theme) ? theme : null;
}

export function saveTheme(storage, theme) {
  try {
    if (THEMES.includes(theme)) storage.setItem(THEME_KEY, theme);
    else storage.removeItem(THEME_KEY);
  } catch {}
}

// Reset view: forget everything saved.
export function clearSaved(storage) {
  for (const key of [SETTINGS_KEY, THEME_KEY]) {
    try { storage.removeItem(key); } catch {}
  }
}

export function saveSettings(storage, settings) {
  saveJson(storage, SETTINGS_KEY, settings);
}

export function loadSettings(storage, defaults) {
  const saved = loadJson(storage, SETTINGS_KEY);
  const settings = structuredClone(defaults);
  if (!isPlainObject(saved)) return settings;
  // Only the defaults' keys are read, so a setting added later starts at its
  // default and one since removed is ignored. A saved value must be of the
  // same kind as its default; anything else keeps the default.
  for (const key of Object.keys(defaults)) {
    const value = (CLEAN[key] || sameKind(defaults[key]))(saved[key]);
    if (value !== undefined) settings[key] = value;
  }
  return settings;
}

// Settings whose default doesn't show what a valid value looks like.
const CLEAN = {
  // null (the page's own order) or a column and direction.
  sort: v => v === null || (isPlainObject(v) && typeof v.key === 'string' && (v.dir === 'asc' || v.dir === 'desc'))
    ? v : undefined,
  // Page id -> that page's Workload values. The core checks each value
  // against the page's inputs, so any page's, including
  // pages added later, are kept as saved.
  workloads: v => isPlainObject(v)
    ? Object.fromEntries(Object.entries(v).filter(([, w]) => isPlainObject(w)))
    : undefined,
};

const sameKind = def => v =>
  isPlainObject(def) ? (isPlainObject(v) ? v : undefined)
  : typeof def === 'number' ? (Number.isFinite(v) ? v : undefined)
  : v !== null && typeof v === typeof def ? v : undefined;

const isPlainObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
