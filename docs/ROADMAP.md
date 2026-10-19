# Roadmap

Three phases, each shippable on its own. A phase is done only when its exit criteria pass; then the next starts.
Milestones ship as small commits on `main` (ADR-0007), sliced in `docs/PLAN.md`. Tick them off here when complete.

**Current phase: 1 closing (only slice 8.4 is open, deferred by the owner) and 2 started on the owner's go-ahead (2026-10-18)**

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
- [x] **M4 Query core.** Tokenizer with spans, error-tolerant parser, field registry, evaluator, highlight visitor,
      serialiser (AST → canonical text). Property test: `parse(serialise(ast))` equals `ast`.
- [x] **M5 Explore UI.** Query input, chips (toggle NOT, remove), effective-query line, facets with live counts,
      keyword applies/uses toggles + match all/any, flags, sort, results with keyword tokens, highlighting, click-to-counterpart,
      virtualised list, empty state. URL state for everything.
- [x] **M6 Party planner.** 6 × 3 slots, target slot, add from results, slot validation reasons, clear, undo/redo,
      basic coverage (applies, relies on, missing sources, non-stacking duplicates per GAME_RULES R4), share URL with
      stable IDs + dataset version, unknown-ID handling.
- [x] **M7 Mobile.** Filters bottom sheet (focus trapped, Esc/close), Explore/Party tabs, 44 px targets, add-to-target button.
- [x] **M8b Owner's notes.** Refinements from play-testing, done before M8 closes: no zoom on focus and a back-to-top button on
      mobile, "Clear filters" and the class order, collapsible filter sections, a slot dialog for traits the target slot refuses,
      and event keywords (provoke, defend, attack and who does it, spells; planned in 8b.5, ADR-0009) with a report section
      that shows the event forms no keyword covers, the patterns for the buff and debuff forms it found (8b.10), and *Who acts*
      with several choices at once (8b.11).
- [ ] **M8 Hardening.** Performance budget check on the full dataset, Lighthouse CI budgets, a11y pass (keyboard-only
      walkthrough, screen-reader smoke test), footer credits + "unofficial" label, README. Slices 8.1–8.3 are done; 8.4 (credits, README,
      the criteria-to-tests table) is the only open one, deferred by the owner while Phase 2 starts.

### Acceptance criteria
1. `(vulnerable OR weak) -stack:no` returns exactly the traits mentioning Vulnerable or Weak that stack.
2. `applies:vulnerable` and `uses:vulnerable` return role-correct sets for the reviewed keywords: disjoint, but for a trait that
   gives *and* relies on the same keyword (QUERY_LANGUAGE §2).
3. Clicking “Vulnerable” in a trait that applies it shows traits that use it, and vice versa.
4. Class facet is any-of; keyword facets follow the all/any switch; counts update as filters change.
5. A trait without material cannot be placed in an Artifact slot; the button explains why.
6. Copying the party link and opening it in a private window restores the same party and search.
7. Two copies of the same non-stacking trait anywhere in the party are flagged.
8. Keyboard-only: every action reachable; focus visible; sheet traps focus; axe: 0 violations.
9. Full dataset: the search and the recount of the facets stay under 16 ms per keystroke (p95, measured in CI on the
   production build with the CPU slowed down 4×; SPEC §9). Test: `typing-latency.test.ts`.

### Exit criteria
All milestones merged, acceptance criteria covered by automated tests where possible, deployed on GitHub Pages.

---

## Phase 2 — Smart search + Synergy explorer

Prototypes: `SearchBar.dc.html`, `MobileSearch.dc.html`, `Synergy.dc.html`, `MobileSynergy.dc.html`.
Detailed slices: `docs/PLAN.md` (*Phase 2 — slices*); architecture: ADR-0010 (query assist), ADR-0011 (Synergy routes).
Opened before Phase 1 closed, on the owner's go-ahead (PLAN D25). Autocomplete, diagnostics and the editor live in the existing
Explore search bar (PLAN D14); only Synergy is a new page.

### Milestones
Build order (PLAN D15): **M9 → M10 → M12 → M13 → M11**. The numbers do not change; the editor goes last because it is the
riskiest and needs the owner's iPhone.
- [x] **M9 Diagnostics.** Lint-rule registry with all rules in QUERY_LANGUAGE §5 (errors and warnings), fixes as text edits,
      closest-match helper, field value domains, issues shown inside the search field with a one-click fix and the caret kept.
- [x] **M10 Autocomplete.** Context detection, providers per field, result-count preview, ghost text, keyboard + ARIA combobox
      (Tab never captured on a plain focus), the assist layer lazy-loaded over the same `<input>`. (The ghost text is written in
      `core` and drawn with the mirror of M11.2.)
- [x] **M12 Relations engine (core).** `enabledBy`, `enables`, link scores, alternatives, shared triggers, same family,
      random-debuff sources (GAME_RULES R5), conditional sources (R10), keyword view stats + verdicts. Buffs, debuffs and effects
      only: no event is a dependency (R12; PLAN D16). Unit-tested on the real sheet.
- [ ] **M13 Synergy UI.** By trait (lanes, trail, re-centre, add to party, artifact-eligible filter), by keyword
      (appliers/users, verdict, co-applied), deep links (`/synergy/<traitId>`, `/synergy/kw/<slug>`), mobile tabs; routes with a
      shared party session (ADR-0011).
- [ ] **M11 Editor.** Syntax-coloured input with error underlines, caret preserved after edits, explain line ("Reads as"),
      recent + saved searches (local storage, export/import as JSON), mobile search sheet with a syntax toolbar.

### Acceptance criteria
1. `clas:life (weak OR snared` shows two errors with working one-click fixes; after both fixes the query parses cleanly.
2. Typing `applies:vul` suggests `applies:vulnerable` with its result count; Tab accepts it; caret ends after it.
3. Screen readers announce the active suggestion and the result count.
4. For a trait that uses Weak and Vulnerable, a trait applying both appears once with “×2 links” (once per side, in a lane of its own).
5. Random-debuff traits appear in debuff lanes labelled “random” and ranked last.
6. Keyboard and axe: the field is no trap (Tab leaves it after a plain focus; type, ArrowDown, Tab accepts); issues and suggestions
   work without a pointer; axe reports nothing on Explore with the popup and the issues open and on every Synergy view.
7. Assist latency: lint, suggestions and counts, timed as `atlas:assist`, stay under 16 ms at p95 with the CPU slowed down 4× on the
   production build, beside the search budget (SPEC §9).
8. Size: initial JS stays at or under 150 kB gzipped; the assist chunk and the Synergy route are measured (`lazyJs`, `totalJs`).
9. Deep links: `/synergy/<traitId>` and `/synergy/kw/<slug>` open directly, Back and Forward work, an unknown id is a state, not an error.
10. History: recent and saved searches survive a reload; export, clear, import restores them; a corrupt file changes nothing.
11. Consistency: a keyword's appliers and users in Synergy equal the counts in the Explore facet panel.

### Exit criteria
All milestones merged, acceptance criteria covered by automated tests where possible, deployed on GitHub Pages; the owner's device
checks (mobile search sheet, screen-reader rows for the combobox, issues, lanes and trail) done or accepted. Ask the owner before Phase 3.

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
