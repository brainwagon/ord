# 05: Remembered settings, Reset view, and theme

**What to build:** A returning viewer finds the dashboard as they left it. Each page's Workload, the "new" window, filters and toggles, and sort order are saved in their browser and restored on load, and a Reset view button returns everything to the defaults. The dashboard follows the system's light/dark setting, with a toggle that overrides it and is also remembered. If browser storage is missing or blocked, as in a private window, the dashboard still works and simply uses the defaults.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] Workloads, filters, toggles and sort order survive a reload
- [ ] Reset view restores every default
- [ ] Storage keys are versioned, and every storage access is guarded so a blocked store falls back to defaults
- [ ] Colours are CSS custom properties. The page follows `prefers-color-scheme`, and the override toggle persists
- [ ] Later pages can add their Workloads to persistence without changing the mechanism
