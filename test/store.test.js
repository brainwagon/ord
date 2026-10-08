import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadSettings, saveSettings, clearSaved, loadTheme, saveTheme } from '../js/store.js';

// A Storage stand-in (the browser's localStorage interface).
function memoryStorage() {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
  };
}

const DEFAULTS = { author: '', search: '', hideFree: false, newWindowDays: 30, sort: null, workloads: {} };

test('saved settings come back on the next load', () => {
  const storage = memoryStorage();
  const settings = { author: 'openai', search: 'gpt', hideFree: true, newWindowDays: 7,
    sort: { key: 'cost', dir: 'asc' }, workloads: { code: { inputTokens: 5000 }, video: { seconds: 8 } } };
  saveSettings(storage, settings);
  assert.deepEqual(loadSettings(storage, DEFAULTS), settings);
});

test('with nothing saved, the defaults are used', () => {
  assert.deepEqual(loadSettings(memoryStorage(), DEFAULTS), DEFAULTS);
});

test('a blocked or missing store falls back to the defaults, and saving is a no-op', () => {
  const fail = () => { throw new Error('SecurityError'); };
  const blocked = { getItem: fail, setItem: fail, removeItem: fail };
  for (const storage of [blocked, null, undefined]) {
    assert.deepEqual(loadSettings(storage, DEFAULTS), DEFAULTS);
    assert.doesNotThrow(() => saveSettings(storage, { ...DEFAULTS, author: 'x' }));
  }
});

test('a setting added since the last save takes its default; one since removed is dropped', () => {
  const storage = memoryStorage();
  saveSettings(storage, { author: 'openai', retiredSetting: 1 });
  assert.deepEqual(loadSettings(storage, { ...DEFAULTS, showVideo: true }),
    { ...DEFAULTS, showVideo: true, author: 'openai' });
});

test('a saved setting of the wrong kind falls back to its default', () => {
  const storage = memoryStorage();
  saveSettings(storage, { author: 7, hideFree: 'yes', newWindowDays: '7', workloads: [1], sort: 'cost', search: 'ok' });
  assert.deepEqual(loadSettings(storage, DEFAULTS), { ...DEFAULTS, search: 'ok' });
});

test('a sort needs a column key and a direction', () => {
  const storage = memoryStorage();
  for (const sort of [{ key: 'cost' }, { key: 1, dir: 'asc' }, { key: 'cost', dir: 'up' }]) {
    saveSettings(storage, { sort });
    assert.equal(loadSettings(storage, DEFAULTS).sort, null, JSON.stringify(sort));
  }
});

test('every page\'s Workload is remembered, including pages added later', () => {
  const storage = memoryStorage();
  const workloads = { code: { inputTokens: 1 }, decisions: { calls: 3 }, someFuturePage: { minutes: 2 } };
  saveSettings(storage, { workloads });
  assert.deepEqual(loadSettings(storage, DEFAULTS).workloads, workloads);
  // A malformed page entry is dropped; the core falls back to that page's defaults.
  saveSettings(storage, { workloads: { code: 'x', audio: { seconds: 4 } } });
  assert.deepEqual(loadSettings(storage, DEFAULTS).workloads, { audio: { seconds: 4 } });
});

test('Reset view forgets the saved settings and the theme override', () => {
  const storage = memoryStorage();
  saveSettings(storage, { ...DEFAULTS, author: 'openai' });
  saveTheme(storage, 'dark');
  clearSaved(storage);
  assert.deepEqual(loadSettings(storage, DEFAULTS), DEFAULTS);
  assert.equal(loadTheme(storage), null);
  assert.doesNotThrow(() => clearSaved(null));
});

test('the theme override is remembered; anything else means follow the system', () => {
  const storage = memoryStorage();
  assert.equal(loadTheme(storage), null);
  saveTheme(storage, 'light');
  assert.equal(loadTheme(storage), 'light');
  saveTheme(storage, null);
  assert.equal(loadTheme(storage), null);
  storage.setItem('ord.theme.v1', 'purple');
  assert.equal(loadTheme(storage), null);
  assert.equal(loadTheme(undefined), null);
  assert.doesNotThrow(() => saveTheme(undefined, 'dark'));
});

test('a corrupt saved value falls back to the defaults', () => {
  const storage = memoryStorage();
  for (const bad of ['{not json', '"a string"', 'null', '[1,2]']) {
    storage.setItem('ord.settings.v1', bad);
    assert.deepEqual(loadSettings(storage, DEFAULTS), DEFAULTS, bad);
  }
});
