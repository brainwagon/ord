# 12: Release check against the live site

**What to build:** Confirm the finished dashboard works for a real viewer at its published URL, `mvandewettering.com/ord/`, served by GitHub Pages from `main` of `brainwagon/ord`. Do a one-off check in a real browser of every tab against the live OpenRouter API, at desktop width and phone width, in both light and dark themes. No browser test suite is kept in the repo.

**Blocked by:** 06, 07, 08, 09, 10, 11

**Status:** ready-for-agent

- [ ] Every tab renders a populated table at the published URL with no console errors
- [ ] The Image and Video tabs load their extra pricing, and a forced fetch failure shows Retry
- [ ] Phone width has no horizontal page scroll
- [ ] Light, dark and override theme all render legibly
- [ ] Any defects found are fixed or filed as new tickets
