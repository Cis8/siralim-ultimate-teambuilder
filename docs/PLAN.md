# Implementation plan

Claude Code's working file: where we are, what comes next, how each step is tested. Read it at the start of every
session (after `CLAUDE.md`), update it before ending one.

**Keeping this file small**
- *Resume here* is **overwritten** every session, never appended (≤ 12 lines).
- Tick a slice when it is on `main` with all checks green. When a milestone closes, collapse its slices into one line
  (what shipped + deviations worth knowing). Git history is the changelog: no step-by-step logs here.
- *Notes* holds only what a future session would otherwise rediscover the hard way. Delete notes that stop being true.
- Owner decisions on game rules go to `GAME_RULES.md`, on behaviour to `SPEC.md`, on architecture to an ADR, not here.
- Target size: under ~250 lines. When a phase closes, replace its plan with a 3-line summary.

## Resume here
- **Phase 1 · M8: 8.1–8.3 done. M8b: 8b.1–8b.3, 8b.5 (the event plan) and 8b.6 (events in core and the data) done; next is
  8b.4 (party), then 8b.7–8b.9; one session each.** 8.4 (credits: ask the owner to confirm the authors' names first; README;
  the criteria-to-tests table; ROADMAP ticks) then closes Phase 1: ask the owner before starting Phase 2.
  Until 8b.8 the panel lists the 18 events flat with Applies / Relies on sides, and a click on an event token shows the traits
  that mention it (`clickGoal`: an event has no counterpart yet, nobody causes the start of a battle); 8b.7 gives the actor a
  place in the query and 8b.8 the section, the "Who" control and the token.
  Waiting on the owner, none blocking: run `docs/SCREEN_READER_CHECKLIST.md` (NVDA, VoiceOver) and report what sounded wrong;
  on a real iPhone (Safari and Chrome), check that focusing the search field and the sort no longer zooms the page (8b.1).
  A new control needs `min-height: var(--target-min)` under `pointer: coarse`, or `touch-targets.test.ts` fails and names it.
  A control that draws an outline of its own needs a `:focus-visible` rule, or `keyboard.test.ts` names it (no 2 px ring).
  Anything that changes the layout between the prerendered page and the loaded one (a line that appears, a layout JS decides)
  counts as a layout shift: Lighthouse CI fails above 0.1. Decide it in CSS, or hold the room.
- Open for the owner, none blocking: GAME_RULES open questions 1-5 (allies vs enemies; "afflicted with" as a trigger;
  when a mastery is active; Diabolic Horde; Dusty Struggle's wording).
- Every green commit on `main` is deployed to Pages (D2). Before coding: `git pull`, `gh run list --branch main -L 3` (main
  must be green), `gh pr list` (read a data-refresh PR's report before merging it).

## Owner decisions (2026-10-16)
| # | Decision | Recorded in |
|---|---|---|
| D1 | Repo `Cis8/siralim-ultimate-teambuilder`, public, Pages base path `/siralim-ultimate-teambuilder` | here |
| D2 | The compendium authors agreed (2026-10-16): deploy every commit on `main` once CI is green | `deploy.yml` |
| D3 | Node 24 LTS, pnpm via corepack | ADR-0002 |
| D4 | No PRs: direct commits to `main`, quality guaranteed by gates and `CLAUDE.md` rules | ADR-0007 |
| D5 | Slots per kind; Avatar innate-only; special kinds artifact-only; fallback colour `#8fa1b3` | GAME_RULES R1, R6, R7 |
| D6 | `masteryFamily` ≠ `partyRequirement`; all masteries are potential sources in Phase 1 | GAME_RULES R3 |
| D7 | Random debuffs: regex + overrides, `target` + `activation`, enemy-only set | GAME_RULES R5 |
| D8 | Buff/debuff lists from canonical sources; `canBeRandomlyApplied`; v2.0 wins | GAME_RULES R8, SPEC §4 |
| D9–D13 | Defaults accepted: Phase 1 coverage = covered/missing only; free text is substring; overrides need `reason:`; data-refresh PR runs its own checks; GAME_RULES open questions don't block Phase 1 | SPEC, here |

## Notes (toolchain gotchas)
- Node 24 via nvm (`nvm use` reads `.nvmrc`); pnpm 12 via corepack. pnpm enforces a minimum release age, so versions
  published in the last day are skipped. That is expected.
- TypeScript is pinned `~6.0`: typescript-eslint and svelte-check do not support TS 7 yet.
- SvelteKit 3: config in `apps/web/vite.config.ts`; there is no `svelte.config.js`. tsconfig extends `$app/tsconfig`.
  `$lib` is gone (use relative imports or `#lib/*` subpath imports).
- `ssr.noExternal: ['cookie']` in the Vite config: without it the prerender step cannot resolve `cookie` under pnpm.
- Internal links need `resolve()` from `$app/paths`; external links use `lib/components/external-link.svelte`.
- The RTK hook compacts command output: vitest prints nothing useful through it, and `cat` of a long file can drop lines
  (a test file seemed to lack its `vitest` import). Use `rtk proxy <command>` for the raw output, or Read.
- A data-refresh PR shows a `pull_request` CI run with conclusion failure, no jobs and no log (opened by the bot). Ignore
  it; judge `main` with `gh run list --branch main`.
- pnpm in CI fails on unapproved dependency build scripts (`ERR_PNPM_IGNORED_BUILDS`), locally it only warns:
  `allowBuilds` in `pnpm-workspace.yaml` must list every package that has one.
- Pipeline scripts run with `tsx` (the sources use extensionless imports, which plain Node cannot load).
- Prettier skips Markdown on purpose (hand-wrapped prose, tables).
- Windows clone: `.gitattributes` makes every checkout LF. Git for Windows sets `core.autocrlf=true`, which gave a CRLF tree
  where `.editorconfig`, Prettier and so `pnpm check` (the pre-push hook) failed on every file. Node 24 is not the default
  there: `fnm install 24`, put `%APPDATA%\fnm\node-versions\v24.22.0\installation` on PATH (from PowerShell: Git Bash does not
  expand `%APPDATA%`), `corepack prepare pnpm@12.14.0 --activate`. `gh` may be missing: read CI from
  `https://api.github.com/repos/Cis8/siralim-ultimate-teambuilder/actions/runs?branch=main&per_page=3`.
- `asset()` from `$app/paths` is typed with the names of the files in `static/`, and the dataset file is renamed whenever the
  data changes, so a literal name would break the typecheck of the next data-refresh: find the dataset next to
  `data/manifest.json` (`lib/composition-root.ts`). `base` is no longer exported.
- Playwright browsers are not part of `pnpm install`: once per machine, `pnpm exec playwright install chromium webkit` (in
  `apps/web`), or every e2e fails with "Executable doesn't exist".
- typescript-eslint cannot see the props of an imported `.svelte` component (svelte-check can): a callback passed to one
  needs its parameters typed (`onchange={(query: string) => …}`), or `no-unsafe-assignment` fires.
- Changing what the pipeline emits does not change `apps/web/static/data` by itself: run `pnpm pipeline:fetch && pnpm pipeline:build`
  and commit the result (`chore(data)`), or the app keeps showing the old shape (the dataset lacked keywords until M5.6).
- `playwright test` reuses whatever answers on port 4173: a `vite preview` left running serves the old build. Stop it first
  (on Windows one is often left behind after a run: stop the process that listens on the port).
- `virtual-list`: `@tanstack/virtual-core` rebuilds what it measured from the last row that changed and keeps the keys of
  the rows above it, so a key function that reads the `keys` prop when called, or a list that changes under a pending
  measure, draws a trait twice (`each_key_duplicate`, a 500 page). `options()` snapshots the keys and `measure()` runs when
  the list is another one. The e2e that proves it is the chain of filters taken off one by one (`draws no trait twice…`).
- `virtual-list` and scrolling: `@tanstack/virtual-core` corrects the scroll (a `scrollTo` with no behaviour) whenever it measures
  a row above the window, which cancels any native smooth scroll the page starts: one from six screens down stopped 35 px in. Only the
  library's own `scrollToOffset(…, { behavior: 'smooth' })` is exempt (`scrollState`). The page therefore jumps
  (`window.scrollTo({ top: 0 })`, as "Back to top" does). A scroll test must go far down (20 screens): near the top the rows
  are measured already.
- e2e: wait for the first row before typing or clicking (`openExplore`): the traits load after hydration, and a field filled
  earlier is lost (WebKit gets there last). Safari does not focus a button that is clicked: to test focus, use the keyboard.
- SvelteKit 3 navigation: `pushState` / `replaceState` are deprecated and a shallow entry keeps `page.url` on the page
  underneath, so the address is written with `goto(resolve('/?…'), { replace, reset: false })`: a real navigation on the same
  route, with no load to run. `reset: false` leaves scroll and focus alone, also on back/forward. `afterNavigate` tells the
  page's own write (`type: 'goto'`, ignored: reading it back would put the text of the last pause over what was typed since)
  from `enter` / `popstate` / `link` (read). A navigation started while another is in flight drops the first one's history
  entry, hence the writer's queue. The lint rule `no-navigation-without-resolve` accepts `resolve()` only with `'/'` or
  `` `/?${string}` ``, and `page.url` is a read-only type: build a `URL` from its `href`.
- e2e: `rows` is the list items of the *Results* region (the party panel has lists too). Playwright will not click a button
  that says `aria-disabled="true"`: `click({ force: true })` is the person pressing it. A poll that waits for an address
  parameter can be satisfied by an earlier write: wait for the value the step just wrote.
- `rtk` is not on every machine: run `pnpm exec vitest …` directly; in PowerShell prefix `$env:PATH` with the Node 24 folder.
- `.visually-hidden` is `position: absolute`: inside a scroll area that is not itself positioned it escapes the scroller and
  makes the nearest positioned ancestor scrollable (the bottom sheet's title slid out of view); the area gets `position: relative`.
- e2e, filters on a narrow screen: they are in the sheet, so `facet` / `side` / `mode` / `flag` read their state shut or open
  (`includeHidden`), a press needs `openFilters`, and anything on the page behind needs `closeFilters` first (a modal dialog
  blocks it). `explore-page.ts` is the one place that knows the 700 px breakpoint, as `FiltersRegion` and `+page.svelte` are
  for the app.
- e2e, tabs: under 1100 px the party is on its own tab, so a test shows it (`showParty` in `party-page.ts`) before it reads or
  presses anything in it, and `findRow` / `addToParty` bring the search forward; both do nothing on a wide screen.
  `explore-page.ts` knows the 1100 px breakpoint as well as the 700 px one. A `toHaveCount(0)` on a locator inside `partyPanel`
  passes without the tab (the region is not in the page then): show it first. A `click({ force: true })` does not look at what
  covers the element: under the fixed bars it hits a bar (scroll the element to the middle first).
- Performance (criterion 9): the budget is the search itself, which the page times (`timeSearches`, User Timing `atlas:search`,
  read by `typing-latency.test.ts` under a 4× CPU): p95 4.3 ms, so no inverted index. The whole keystroke is dearer: median
  7 ms, p95 35–45 ms at 4×, on the keys that swap the list (profile: Svelte creating ~10 rows, and the layout that
  `measureElement` forces by reading `offsetHeight`). If that ever needs to come down, it is the cost of a row, not the search.
- Lighthouse (`pnpm lighthouse`, phone profile, simulated slow 4G): serves `apps/web/build` from the root with gzip, so the
  build must not have a `BASE_PATH`; Chromium comes from Playwright (`playwright install chromium`). What is left to gain:
  the LCP (3.0 s, score 0.77) is the waterfall HTML → scripts → manifest → dataset, which starts in `onMount`; and 0.035 of
  layout shift is the meta line, 32 px before the traits and 71 px after on a phone (the sort wraps). To see what moves, record
  `layout-shift` entries (`sources` has the rects before and after) under a throttled Playwright page.
- Keyboard e2e (`support/keyboard.ts`): Safari's tab key skips links (a setting), so WebKit does not count a link as missed;
  WebKit scrolls a focused control into view after the key press, so the walk waits two frames before it measures; start
  a walk on a page that was only opened (a field filled earlier is where the tab key starts from).
- Vitest does not process CSS: an import of a stylesheet, `?raw` too, is an empty string. The web project lists `tokens.css` in
  `css.include` (`vitest.config.ts`); web code may not import `node:fs` (boundary rule), so a test cannot read it that way.
- `vitest bench` (Vitest 5): `bench` is a fixture of `test` in a `*.bench.ts` file (`test.each` does not hand it over: loop);
  `vitest` alone ignores those files; `pnpm bench` needs `--reporter=verbose` to print the table.
- Svelte templates: `{@render localSnippet(args)}` trips `no-confusing-void-expression` (a rendered `children()` does not): use
  a component. `hidden` loses to any `display` rule on the same element, so a section hides a plain wrapper around its flex box.
- Do not rewrite files with Python's text mode on Windows: it writes CRLF into an LF tree (use the Edit tool).
- `packages/core` and `pipeline` export TypeScript source (`exports: ./src/index.ts`); there is no build step.
- The 8b.5 research lives in `packages/pipeline/.cache/research/events-v2.0/` (git-ignored, this machine only):
  `findings.records.json` (the sweep: 4,400 records of id, quote, span, use, actor, event, qualifier), `findings.md`, the
  prototypes and `scripts/` (`extract`, `census`, `merge`, `prompt.md` for the agents, `proto2.ts`, and `measure.ts`: it runs
  `extractKeywords` over the dataset and lists, beside the sweep, the records no mention covers, the mentions the sweep did not
  record, and the disagreements in role and actor; run from `packages/pipeline` with `pnpm exec tsx scripts/measure.ts
  <dataset.json> <records.json> <out.md> [<lines.txt>]`). It is a review aid, never a fixture. Without it, read every new
  snapshot line. A Haiku agent on 75 rows costs ~110k tokens and needs no prompt changes; output to a file, one line back.
- Bash tool: a heredoc with apostrophes and quotes mixed can fail with "unexpected EOF" before anything runs; write the script
  with the Write tool and run it. Node 24 is not on Git Bash's PATH either: `export PATH=/c/Users/<user>/AppData/Roaming/fnm/node-versions/v24.22.0/installation:$PATH`.

## Phase 1 — slices
One slice = one commit (or a few) on `main`. *T:* = tests written with or before the code (TDD for `core`).

### M1 Scaffold — done
Monorepo, strict TS, ESLint with package-boundary rules (tested in `tools/boundaries.test.ts`) + dependency-cruiser,
Prettier, Vitest projects, Playwright (desktop Chromium, Pixel 7, iPhone 14 WebKit) + axe, CI, Pages deploy,
app shell with tokens, self-hosted fonts and footer credits.

### M2 Pipeline v1 — done
`pnpm pipeline:fetch` (retries, one `SheetSource` per tab) and `pnpm pipeline:build` run parse → clean and validate → ids →
base enrichment (kind, stacks, R3 requirement, R5 random debuff) → dataset + manifest + Markdown report with a diff against
the previous build; the nightly `data-refresh.yml` opens a PR when the data changes. Real v2.0: 1,780 traits, 704 KB
(~100 KB gzip). Deviations: an id collision fails the build instead of getting a suffix (SPEC §5/§6); the pinned snapshot
(`pipeline/fixtures/traits-v2.0.csv`) and the GAME_RULES counts test (`build/real-sheet.test.ts`) landed with 2.4; nothing is
rewritten when the hash is unchanged.

### M3 Keyword extraction — done (with its follow-up)
`core`: a `taxonomy` registry (20 debuffs and 18 buffs from the wiki, cross-checked with the Codex Reference; mechanics,
triggers with a battle phase, the no-stack flag), `createKeywordMatcher` (spans), `assignRoles`, one `extractKeywords`
used by `enrichTraits`. `pipeline`: `overrides.yaml` with a schema, keywords in the dataset (2,174 mentions; 275 applies /
262 uses), committed snapshots in `packages/pipeline/snapshots/`, and a *Taxonomy* section in the report (candidates,
differences with the canonical lists). Deviations: Barrier is a buff, not a mechanic (both sources and the compendium say
so); buffs and debuffs match only as capitalised names (25 false positives otherwise); an opening condition makes a
status `uses`, which refines SPEC §4. All 537 role mentions were read by hand; 11 are overridden.
Owner decisions of 2026-10-16 added three things (3.8-3.10): the role `resists` for protective mentions (GAME_RULES R9),
`Trait.conditionalSources` for the "whichever of these debuffs" pair traits (R10), and the `effect` keyword kind with
Seal/Sealed, Dire Wolves, Zombies and Mega Magic, plus Charges, Cascading and Fused as mechanics (R11). Dataset v2.0 now
has 2,299 mentions: 311 applies, 270 uses, 21 resists.

### M4 Query core — done
`core/src/query/`: lexer with spans, error-tolerant parser (`{ast, tokens, diagnostics}`, never throws, repairs reported),
field registry (`FieldDefinition` with `highlightsDescription`), per-trait index and `evaluate`, `createHighlighter` and
`serialise`, all folds over `visitQuery`. Deviations: a term under two NOTs (`--weak`) is highlighted (QUERY_LANGUAGE §4);
the serialiser quotes a value exactly when the lexer would read it otherwise (it asks the lexer), and writes `-`, a space and
` OR `.

### M5 Explore UI — done
`core`: `ExploreState` + URL codec, `search(state)` with facets and sort strategies, chip operations on the query text,
`clickKeyword`, `descriptionParts`. `web`: three columns (filters | results | party), query input, chip row, result count in
`aria-live`, virtualised results against the window (`@tanstack/virtual-core`), keyword tokens by role shape, `<mark>`
highlights, facet panel (`aria-pressed`), effective query + copy, empty state, and the URL kept in step with the state
(`page-address`, `page-url-writer`; SPEC §7). Deviations worth knowing: the filters are written as a query and that
text is what is searched (`filterQuery`); a click on a token turns the other side of the keyword off, the panel does not;
filter chips are remove-only; a pressed token is a ring, not a fill (contrast of a highlight); narrow screens stack the
panel above the list until the bottom sheet (M7.1); back and forward bring back the state and start the list over.

### M6 Party planner — done
`core`: immutable `Party` + `SLOT_POSITIONS`, slot-rule registry (R1, R6), `PartyCommand` + `PartyHistory`, the `Planner`
(history + target slot), `nextEmptySlot` / `firstEmptySlot`, `partyCoverage` (applies, relies on, covered / missing,
non-stacking duplicates), the address codec, `lostTraitSearch`. `web`: party panel with coverage, target toggle per slot,
Undo / Redo / Clear / Ctrl+Z, "Add to" on every result with the rule's reason when refused, "In party" marker, copy link,
"not found in vX" slots with a search, the last party in `localStorage`, one writer for the search and the party in the
address. Deviations worth knowing: the party is a comma list in the address, not base64url (ADR-0008); choosing a target
replaces the history entry instead of pushing one; undo returns the target to the slot of the edit; a trait that applies and
relies on the same keyword covers itself (as in the prototype); the last party is used only when the address names none.

### M7 Mobile — done
The filters are a modal bottom sheet under 700 px (`BottomSheet`, `FiltersRegion`, a fixed "Filters" bar); Explore and Party are
ARIA tabs under 1100 px (`TabBar`, `tab=party` in the address, the page scrolled back to where each tab was left; the view not
shown is `visibility: hidden; height: 0`, not `display: none`, or the virtual list would measure its rows as 0 px); the bars at the
foot leave room (`--bars-height`). The result is a card: under 700 px its add button is a 44 px square beside the name, and the
DOM puts it before the description. `touch-targets.test.ts` measures every control of Explore, the open sheet and the Party tab
in the two phone projects. Deviations worth knowing: keywords inside a description and the footer link stay line-high (WCAG 2.5.8
Inline, DESIGN § Accessibility); a bordered control is 44 px *inside* its border (chip 46, segmented 50).

### M8 Hardening
- [x] **8.1** Performance: `pnpm bench` (Vitest bench of `search` on the snapshot) + `typing-latency.test.ts` (Chromium
      projects, 4× CPU, p95 of the search < 16 ms; criterion 9). Deviation: the e2e times the search through a User Timing
      measure the page emits (`apps/web/src/lib/search-timing.ts`), not the whole keystroke, as SPEC §9 words the budget;
      no inverted index was needed.
- [x] **8.2** Size budgets and Lighthouse CI. `pnpm size-budget` (`tools/size-budget`, a step of `ci.yml` after the build) fails
      over 150 kB of initial JS or 300 kB of data, gzipped: now 69.9 and 120.4. Lighthouse CI (`@lhci/cli`, the `lighthouse` job
      of `ci.yml`, thresholds in `apps/web/lighthouserc.cjs`). Deviation: its first run found performance 0.69 and a layout shift
      of 0.75, so the slice fixed them: the stylesheets are inlined (`inlineStyleThreshold`), the results hold their room while
      the traits load, the filters column is dropped by CSS under 700 px, and the fonts are `font-display: optional`
      (`styles/fonts.css`; DESIGN § Typography). Now 0.93 and 0.035. The runner (Linux) measured 0.139 where Windows said 0.036:
      the fallback font there is wider than Plex and the swap moved the page three times, so judge a layout shift on CI.
- [x] **8.3** `keyboard.test.ts` (criterion 8): Tab walks of Explore, the Party tab and the open sheet (every control reached,
      a 2 px ring, nothing under a fixed bar) and two flows with no pointer. `contrast.test.ts`: every text token on every
      surface, under the match highlight, and the 3:1 lines. `docs/SCREEN_READER_CHECKLIST.md` for the owner. Deviations: the
      walks found three faults and the slice fixed them: a keyword that relies on or guards against something lost its focus
      ring (its role outline outranked the page's ring), the sheet opened with the focus on an unnamed scrolled `div` in Chrome
      (now its title), and the filters took 124 presses of Tab to pass (new "Skip filters" link, from 700 px).
- [ ] **8.4** Final credits (authors confirmed with the owner), README, docs, table mapping acceptance criteria to tests.
      Starts only when M8b is done.

### M8b The owner's notes (before 8.4)
Phase 1 refinements from the owner's play-testing notes (2026-10-17). Decisions: the "…" shows only where the target slot refuses
the trait, in place of the disabled add; the five standard classes come first in the filters; back-to-top sits top right.
Defaults chosen, change on request: filter sections open by default and remembered only while the page lives (not in the
address, not in `localStorage`); "Clear filters" keeps the query, sort and Match all/any (settings, not filters); input font
16 px only under `pointer: coarse`, the viewport meta stays as it is (WCAG 1.4.4). Events (8b.5): GAME_RULES R12, ADR-0009.
- [x] **8b.1** Mobile, web only. The search field and the sort are 16 px under `pointer: coarse` (iOS zooms on focus below that;
      `touch-targets.test.ts` reads the computed size of every text field and select; the viewport meta is unchanged). A fixed
      top-right "Back to top" (`back-to-top.svelte`, 44 px) after a screen of scroll, Explore only, the focus to the page heading;
      the window's scroll is watched once for it and for `trackViewportOffset` (`page-scroll.ts`); `scroll-padding-top` while it
      shows (WCAG 2.4.11). `e2e/back-to-top.test.ts`, entries in `touch-targets` and `keyboard`, axe. Deviations: the page
      jumps instead of scrolling smoothly (see Notes: the virtual list stops a native smooth scroll), so reduced motion needs
      no case of its own; and the button is the last control of the page's content in the document, because forward the list
      is endless to the tab key and, wide, the party at the top of the page scrolls the button away: Shift+Tab from the foot
      finds it (Home is the quick way).
- [x] **8b.2** Filters: "Clear filters (N)" at the top of the panel (`clearFilters` in `core`: keeps query, sort and mode, gives
      back the same state when nothing is on; `aria-disabled` at 0 with the focus kept; a polite "Cleared N filters." inside the
      panel, so it is heard in the sheet too) and the order of the classes (`facetVocabulary`: Chaos, Death, Life, Nature, Sorcery
      first, then the others by size; `ClassFacet.standard`; a rule between the two groups). SPEC §8.1, DESIGN. Deviations: the
      five classes are `CREATURE_CLASSES` (GAME_RULES R7), not a second list; "by trait count" is the whole dataset's, fixed at
      load, so the list does not reshuffle as filters change (v2.0: Rodian Master, Backer, Nether Boss, Boss, Pandemonium,
      Nether Room). The sheet now holds two `aria-live` lines: `filters-sheet.test.ts` picks the count by its text.
- [x] **8b.3** Filters: collapsible sections (Class, Debuffs, Buffs, Effects, Triggers, Mechanics, Flags; Match all/any stays
      visible). `SectionToggle` is the button inside each heading (`aria-expanded`, `aria-controls` the body, which is `hidden`
      while shut); shut, it adds "· 2 on", counted by `activeFilterCounts` in `core` (one per class, side of a keyword and flag,
      as the chips do). The shut list lives in `+page.svelte` and is passed down, because `FacetPanel` is rebuilt across 700 px.
      Open by default, so no layout shift. `e2e/filter-sections.test.ts`: toggle, counts, tab order, resize, closing the sheet,
      axe; the walks and touch-target tests cover the new buttons by themselves. SPEC §8.1, DESIGN. Deviation: the hint "any of"
      is hidden with the classes.
- [ ] **8b.4** Party: the "…" for traits the target slot refuses (mastery, backer, boss on Innate or Fused; avatar on Fused or
      Artifact; a trait with no material on Artifact). Today the add is disabled and adding onto an occupied slot replaces it
      without saying so. `core` first: `allowedSlots(trait, rules)` (no such function exists; Phase 3 `pickSlot` will need it),
      `addTraitAt(planner, trait, position)` returning `replaced`, the target advancing only when the position is the target; the
      announcement says "replacing Y" for every add. Web: the refused add becomes an active "Add to…" that opens a page-level
      dialog (rows are virtualised) listing the allowed slots of the target's creature, one button each: "Add to Artifact (empty)"
      or "Replace Y in Artifact" (icon and text); the rule's sentence stays under the card (acceptance criterion 5). With no
      allowed slot the disabled add stays. Generalise `bottom-sheet.svelte`'s foot instead of copying it. Rewrite the criterion-5
      e2e (it presses a disabled button today); `filters-sheet.test.ts:30,197` take the first `<dialog>` for the filters: bind them
      by name. Docs: SPEC §8.2 ("a disabled add with its reason" changes), DESIGN. Out of scope: adding a plain trait to a slot
      that is not the target without moving the target.
- [x] **8b.5** Keywords and events: research and plan, no product code. A census of the 774 opening clauses no trigger covers
      (452 forms) and a sweep of all 1,780 traits by 24 Haiku agents (100% of quotes verbatim but 2 of 4,400; every known trigger
      and census clause found; 92% agreement on a second reading of 373 traits), then a prototype on the snapshot. Outcome:
      triggers become **events** with a role and an actor (ADR-0009), 18 of them after the game's own effect categories, plus
      the mechanics Spells and Stats; the owner's decisions are GAME_RULES R12 (who acts is a filter, never required; no event is a
      dependency; dies = is killed; manual cast apart; events grouped in the filters with one "Who" control). Deviation: the
      sweep cost about 3.3M Haiku tokens, not the 0.4M estimated (each agent re-reads its context every turn).
- [x] **8b.6** Events in `core`, the snapshot and the data (ADR-0009, GAME_RULES R12). `trigger` became `event` (`EventEntry`:
      inflections as patterns, a `phase` or none, `aliases`, `turnEdge`, `statPatterns`, `moment`); the 18 events, Spells and
      Stats; `KeywordHit.actor`; `readEvent` (role and actor by wording), `findTurns` (the turns by a grammar), `isStatSense`;
      `partyCoverage` ignores events; `overrides.yaml` takes an `actor` and holds 22 corrections. Data: 4,453 mentions (2,149
      of events), 139 kB gzip; the snapshot has the actor column; the web compiles with the new kind (colour, "Events"). SPEC §4,
      DESIGN. Deviations: the extractor alone agrees with the sweep on role in 91–100% of the mentions both found (dodge 58%,
      critical hit 53%: the sweep calls "has a 50% chance to dodge" a modifier, the rules call it causing) and on actor in
      93–100%; recall is 84–100% per event, but 53% and 45% for the two buff events (the sweep counts every gain of a named
      buff; "immune to debuffs" and "their debuffs last 1 turn" are not mentions). Reading every disagreement and 60 other lines
      taught the heuristics nouns, names ("Death creatures"), "attacked", pronouns, lists and the start of battle as a moment;
      what is left is the 22 overrides. `triggers-before-events-v2.0.txt` pins the 564 traits of the old phrases (the aliases
      find at least those, tested).
- [ ] **8b.7** Query and address. Keyword fields take an actor after a slash (`uses:provoke/self`; the key prefix still
      applies before it; values `self`, `ally`, `enemy`, `any`); `IndexedTrait` lists event keys with and without their actor;
      an alias is read by the keyword fields and by `decodeExploreState` (`kw=k:after this creature attacks` reads as
      `k:attack/self` and is written back so); `filterQuery` and the chips write the suffix. *T:* lexer and serialiser round trip
      with a slash, field tests, the URL codec, and on the real sheet each of the 11 old keys finds a superset of what it found
      before (the 11 sets pinned). Docs: QUERY_LANGUAGE §2, SPEC §7.
- [ ] **8b.8** Web: the Events section and the event token. The section in place of Triggers, with five groups under small
      headings (Battle and turns, Actions, Hits, Life and death, Buffs and debuffs), each event with Causes / Reacts toggles
      counted as a buff's Applies / Relies on; one "Who" segmented control at the top of the section (Any, This creature, Your
      creatures, Enemies) that narrows every event filter on (writes the suffix, one step of the history, counted by
      `activeFilterCounts`). The token of an event has a buff's role shapes in the event colour and says who in its accessible
      name; a click leads to the counterpart without the actor. *T:* a new e2e (toggles, who, chips, address, back), the walks
      and touch-target tests on the new controls, axe, Lighthouse layout shift (open by default, nothing moves). Docs: SPEC §8.1,
      DESIGN (facet panel, tokens).
- [ ] **8b.9** Report: an *Events* section in the pipeline report, as the *Taxonomy* one is for capitalised words: the event
      words of the 8b.5 census and the opening clauses no keyword covers, with counts and an example, and a reviewed list for
      those looked at, so a new version of the sheet shows its new forms. *T:* the finder's unit tests, `build-report` test.
      Docs: SPEC §6.
