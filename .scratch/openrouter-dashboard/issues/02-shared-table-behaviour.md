# 02: Shared table behaviour

**What to build:** Every page's table behaves the same way, demonstrated on All models.
- **Columns:** the core columns are Model (name with id, and clicking the id copies it), Author, Added and Context, plus a ↗ link to the Model's OpenRouter page.
- **Interaction:** clicking a row expands it to show OpenRouter's description. Any column can be sorted. An Author filter and a text search over name and id narrow the list.
- **Badges and free models:** Models with an `expiration_date` carry an "expires <date>" badge. `:free` variants are shown by default, a hide-free toggle hides them, and they sort first when sorting by cost.
- **Aliases:** the core excludes `~-latest` aliases from every page except All models.
- **Layout:** the layout works at phone width with no horizontal page scroll.

**Blocked by:** 01

**Status:** resolved

- [ ] Core columns, the ↗ link, copy-id and the expandable description work on All models
- [ ] Sorting works on every column; Author filter and search narrow the rows
- [ ] The expires badge appears exactly when `expiration_date` is set (core test)
- [ ] Alias exclusion is covered by a core test, with aliases still present in All models
- [ ] The hide-free toggle works, and free rows sort first by cost (core test)
- [ ] The page is usable at phone width

## Comments

Resolved on branch `integration/openrouter-dashboard` (merged at 1b17936, after code-review fixes). Tests: 119/119 passing.
