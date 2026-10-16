# Roadmap

Three phases, each shippable on its own. A phase is done only when its exit criteria pass; then the next starts.
Milestones ship as small commits on `main` (ADR-0007), sliced in `docs/PLAN.md`. Tick them off here when complete.

**Current phase: 1**

---

## Phase 1 — Explore + Party planner

Goal: a public, fast, accessible replacement for browsing the sheet, with keyword logic and a party planner.
Prototypes: `Main.dc.html` (desktop), `Mobile.dc.html` (mobile).

### Milestones
- [x] **M1 Scaffold.** pnpm monorepo (`core`, `pipeline`, `web`), TS strict, ESLint (+ import boundaries), Prettier,
      Vitest, Playwright + axe, GitHub Actions CI (lint, typecheck, test, build), deploy to GitHub Pages from `main`
      once CI is green (authors agreed). Framework per ADR-0002 (accepted).
- [x] **M2 Pipeline v1.** Fetch Traits tab → validate → normalise → IDs → `traits.<hash>.json` + manifest + report.
      Pinned real snapshot committed as test fixture. Nightly workflow that opens a PR on change.
- [x] **M3 Keyword extraction.** Taxonomy registry, longest-match tokenizer, role heuristic, `overrides.yaml`,
      dataset-wide snapshot test, report of unknown capitalised terms. Review the 30 most frequent keywords' roles by hand.
- [ ] **M4 Query core.** Tokenizer with spans, error-tolerant parser, field registry, evaluator, highlight visitor,
      serialiser (AST → canonical text). Property test: `parse(serialise(ast))` equals `ast`.
- [ ] **M5 Explore UI.** Query input, chips (toggle NOT, remove), effective-query line, facets with live counts,
      keyword applies/uses toggles + match all/any, flags, sort, results with keyword tokens, highlighting, click-to-counterpart,
      virtualised list, empty state. URL state for everything.
- [ ] **M6 Party planner.** 6 × 3 slots, target slot, add from results, slot validation reasons, clear, undo/redo,
      basic coverage (applies, relies on, missing sources, non-stacking duplicates per GAME_RULES R4), share URL with
      stable IDs + dataset version, unknown-ID handling.
- [ ] **M7 Mobile.** Filters bottom sheet (focus trapped, Esc/close), Explore/Party tabs, 44 px targets, add-to-target button.
- [ ] **M8 Hardening.** Performance budget check on the full dataset, Lighthouse CI budgets, a11y pass (keyboard-only
      walkthrough, screen-reader smoke test), footer credits + "unofficial" label, README.

### Acceptance criteria
1. `(vulnerable OR weak) -stack:no` returns exactly the traits mentioning Vulnerable or Weak that stack.
2. `applies:vulnerable` and `uses:vulnerable` return disjoint role-correct sets for the reviewed keywords.
3. Clicking “Vulnerable” in a trait that applies it shows traits that use it, and vice versa.
4. Class facet is any-of; keyword facets follow the all/any switch; counts update as filters change.
5. A trait without material cannot be placed in an Artifact slot; the button explains why.
6. Copying the party link and opening it in a private window restores the same party and search.
7. Two copies of the same non-stacking trait anywhere in the party are flagged.
8. Keyboard-only: every action reachable; focus visible; sheet traps focus; axe: 0 violations.
9. Full dataset: typing in the query bar stays under 16 ms per keystroke (measured in CI on a throttled profile).

### Exit criteria
All milestones merged, acceptance criteria covered by automated tests where possible, deployed on GitHub Pages.

---

## Phase 2 — Smart search + Synergy explorer

Prototypes: `SearchBar.dc.html`, `MobileSearch.dc.html`, `Synergy.dc.html`, `MobileSynergy.dc.html`.

### Milestones
- [ ] **M9 Diagnostics.** Lint-rule registry with all rules in QUERY_LANGUAGE §5, fixes as text edits, closest-match helper.
- [ ] **M10 Autocomplete.** Context detection, providers per field, result-count preview, ghost text, keyboard + ARIA combobox.
- [ ] **M11 Editor.** Syntax-coloured input with error underlines, caret preserved after edits, explain line,
      recent + saved searches (local storage, export/import as JSON), mobile syntax toolbar.
- [ ] **M12 Relations engine (core).** `enabledBy`, `enables`, link scores, alternatives, shared triggers, same family,
      random-debuff sources (GAME_RULES R5), keyword view stats + verdicts. Unit-tested on fixtures.
- [ ] **M13 Synergy UI.** By trait (lanes, trail, re-centre, add to party, artifact-eligible filter), by keyword
      (appliers/users, verdict, co-applied), deep links (`/synergy/<traitId>`, `/synergy/kw/<key>`), mobile tabs.

### Acceptance criteria
1. `clas:life (weak OR snared` shows two errors with working one-click fixes; after both fixes the query parses cleanly.
2. Typing `applies:vul` suggests `applies:vulnerable` with its result count; Tab accepts it; caret ends after it.
3. Screen readers announce the active suggestion and the result count.
4. For a trait that uses Weak and Vulnerable, a trait applying both appears once with “×2 links”.
5. Random-debuff traits appear in debuff lanes labelled “random” and ranked last.

---

## Phase 3 — Party analysis

Prototypes: `PartyLab.dc.html`, `MobileParty.dc.html`.

### Milestones
- [ ] **M14 Rules engine (core).** Member derivation (GAME_RULES R2), mastery conditions (R3), dependency statuses
      (covered / random / conditional / missing / nopayoff), conflicts (R4 duplicates, invalid slots). Rules are a
      registry of `AnalysisRule` objects returning typed issues.
- [ ] **M15 Suggestions.** Fix-gaps and add-payoffs candidates, ranking (SPEC §8.5), slot-picking strategy,
      tags explaining each suggestion.
- [ ] **M16 Analysis UI.** Health tiles, issues with actions, suggestions panel, coverage matrix (accessible table),
      trigger timeline, composition; mobile tabs + fixes sheet.
- [ ] **M17 PWA.** Offline cache of app + latest dataset, update prompt when a new dataset is available.

### Acceptance criteria
1. The prototype's example party yields: Snared missing; Weak conditional (Master of Abominations inactive because
   M1 is not an Abomination); Manipulate Fear duplicate; Vulnerable covered.
2. Fusing a Life creature onto an Abomination keeps the mastery condition met and counts the member as Life.
3. Adding Pandemic to a party that relies on Snared with no specific source turns Snared from missing to random.
4. “Fix gaps” never proposes a slot that violates GAME_RULES R1/R6 and prefers non-innate slots.
5. All analysis views work offline after one visit.
