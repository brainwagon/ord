// Remembered settings: the viewer's settings saved in browser storage and
// merged back over the defaults on load. Part of the shell; `storage` is the
// browser's localStorage (or anything with its getItem/setItem/removeItem).
// Every access is guarded: a missing, blocked or full store means defaults.

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
  try { storage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {}
}

export function loadSettings(storage, defaults) {
  let saved;
  try { saved = JSON.parse(storage.getItem(SETTINGS_KEY)); } catch {}
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
  // against the page's inputs (workloadValues), so any page's, including
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
