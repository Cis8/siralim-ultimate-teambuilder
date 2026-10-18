# ADR-0010 — Query assist: the logic in `core`, the layer lazy over the same input

- Status: Accepted
- Date: 2026-10-18
- Builds on: ADR-0003 (framework-free core), ADR-0006 (taxonomy as data)

## Context
Phase 2 (M9–M11) adds to the Explore search bar what the prototypes `SearchBar.dc.html` and `MobileSearch.dc.html` show: issues with
one-click fixes, autocomplete with result counts, syntax colours, a plain-language "reads as", saved searches and a mobile sheet.
The owner decided (PLAN D14) that all of it lives in the existing bar, as a reusable component with its logic in `core`, the rich
editor lazy-loaded to keep the 150 kB initial budget, and no new page.

Today the bar is a plain `<input>`: the parser is error-tolerant and reports syntax problems only, each field is a `FieldDefinition`
with a matcher, and the values a field accepts live in private maps inside the matchers (`mat:`, `stack:`) or in the taxonomy.
The prototypes show the behaviour but have faults the product must not inherit: the input trapped Tab, a fix moved the caret to
the end, a lone quote raised an error at once, and `tidy` rewrote text the person had not touched.

## Decision
- **`core` owns every rule and stays pure.** New modules, each a registry or a pure function so that adding a rule, a field or a
  context never edits the engine (open/closed):
  - `TextEdit {span, text}` and `applyEdit`. A fix is one edit; **text outside the edit stays byte-identical**.
  - `QueryDiagnostic` gains `severity` (`error` | `warning`) and `fix?: {label, edit}`. The parser still reports syntax only
    (the fixes of those reports are added by `withSyntaxFixes`, and a fix is given only if the query means the same after it);
    semantic checks need the vocabulary and so live in the lint layer, not in the parser.
  - A **lint-rule registry** (`LintRule {id, check}` over a `LintContext` with the fields, the taxonomy, the vocabulary and a memoised
    `hits(term)`), and `lintQuery(source, context, {caret})`. For the term still being typed (PLAN D20) the rules that do not
    `reportsWhileTyping` are not asked at all, so their findings are neither shown nor paid for. This replaces the separate
    `settledDiagnostics` filter the first plan had, which would have worked out the offers only to throw them away.
  - **Value domains** on `FieldDefinition` (`choices` | `vocabulary` | `keyword`, with a matching mode) and `describe(value)`:
    evaluation, lint, suggestions and the explanation read **one table** per field, so they cannot disagree.
  - **Suggestions**: a context detector over `(source, caret)`, a registry of providers per context, ranking, `acceptSuggestion`
    (the new text and the caret), `ghostText`, and counts from `SearchService.countMatches` (PLAN D18).
  - `explainQuery` (a visitor shaped like `serialise`) and `syntaxSegments` (contiguous coloured segments whose concatenation is the
    source), `SearchHistory` with a JSON export and import that never throws.
- **`web` has one assist layer, loaded lazily and attached to the same `<input>`.** `query-input.svelte` keeps the plain input; the
  layer (lint, suggestions, dropdown, issues, later the mirror) is `import()`ed on the first idle, focus or pointer event and
  attaches to that element. Nothing is swapped, so no focus is lost and nothing shifts (Lighthouse CLS ≤ 0.1).
- **The dropdown is an editable combobox with a list (ARIA APG).** No option is active until the person types or uses the arrows, so
  Tab is never captured on a plain focus. The active option's name carries kind, detail and count; a debounced polite line gives
  the size of the list; issues are announced the same way.
- **Colours come from a transparent input over an `aria-hidden` mirror** with identical metrics, under a `forced-colors: active`
  fallback (the input's own text, the mirror hidden). The mirror re-colours synchronously (the lexer only); lint and counts may follow.
  Underlines are never the only signal: the badge and the panel say it in words.
- **Edits to the field go through `applyFieldEdit(input, edit)`**, which restores the caret after the framework's flush and keeps the
  native undo where `execCommand('insertText')` or `setRangeText` allow it.
- **Saved and recent searches** are plain data in `localStorage` (lazy, throw-safe) with a JSON file for export and import, checked
  by hand-written narrowing (no schema library, PLAN D24).
- **Under 700 px with a coarse pointer** the field opens a full-screen modal dialog with the same editor and a docked syntax toolbar.
- **A budget for the assist.** Lint, suggestions and counts are timed as `atlas:assist` and held to p95 < 16 ms at 4× CPU, beside
  `atlas:search`. If it misses, the counts are computed after the frame; the mirror stays synchronous.

## Alternatives considered
- **A code-editor library (CodeMirror and the like) or a `contenteditable`.** More than the 150 kB budget allows without a lazy
  chunk of its own, a new dependency (PLAN D24), editor accessibility and IME behaviour on phones that the product would inherit; a
  plain input with a mirror gives the colours and keeps the native field, selection, undo and keyboard.
- **Semantic checks in the parser.** It would need the vocabulary, lose its "never throws, syntax only" contract and make the parser
  depend on the dataset. Rules in a registry also let a future rule be added without touching it.
- **Loading the assist eagerly.** It would spend the initial JS budget on code only a focused field needs.
- **A separate search page.** Rejected by the owner (PLAN D14).

## Consequences
- The size-budget tool gains `lazyJs` and `totalJs` (a lazy chunk is invisible to it today) and `timeSearches` times the new calls.
- The private `oneOf` maps of `mat:` and `stack:` move into the field's value domain; the matchers and the lint read the same table.
- Soundness is tested on the real sheet: every key, alias and actor combination, every class and a sample of names lint clean; every
  unknown-value error finds no trait; every accepted suggestion parses to one term of the intended field and lints clean.
- The mirror must line up in every engine (the e2e runs Chromium and WebKit): the same font stack on both layers,
  `font-variant-ligatures: none`, `white-space: pre`, scroll sync; and a composition guard (`isComposing`) keeps IME and predictive keyboards from being cut off.
- Keyboard docking and caret behaviour of the mobile sheet can only be judged on a real iOS Safari and Chrome Android: an owner
  device check (PLAN).
- QUERY_LANGUAGE §5–§8, SPEC §8.3 and DESIGN are rewritten, slice by slice, to what ships.
