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
- **Phase 1 · M8: 8.1–8.3 done. M8b: 8b.1–8b.9 done; two slices added on 2026-10-18, 8b.10 and 8b.11, before 8.4.** 8b.10 has
  its plan (see M8b below); 8b.11 is only listed, and its open questions are in its entry. 8.4 (credits: ask the owner to
  confirm the authors' names first; README; the criteria-to-tests table; ROADMAP ticks) comes after both and closes Phase 1:
  ask the owner before starting Phase 2.
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
      Starts only when M8b is done (8b.10 and 8b.11 are open).

### M8b The owner's notes (before 8.4)
Phase 1 refinements from the owner's play-testing notes (2026-10-17). Decisions: the "…" shows only where the target slot refuses
the trait, in place of the disabled add; the five standard classes come first in the filters; back-to-top sits top right.
Defaults chosen, change on request: filter sections open by default and remembered only while the page lives (not in the
address, not in `localStorage`); "Clear filters" keeps the query, sort and Match all/any (settings, not filters); input font
16 px only under `pointer: coarse`, the viewport meta stays as it is (WCAG 1.4.4).
- *Mobile (8b.1).* The search field and the sort are 16 px under `pointer: coarse`; a fixed top-right "Back to top" after a
  screen of scroll. The page jumps instead of scrolling (the virtual list stops a smooth scroll: see Notes), and the button is the
  last control in the document (forward, the list is endless to the tab key).
- *Filters (8b.2, 8b.3).* "Clear filters (N)" (`clearFilters`); the five classes first (`CREATURE_CLASSES`; "by trait count" is the
  whole dataset's, fixed at load); collapsible sections with "· N on" (`activeFilterCounts`; the shut list lives in `+page.svelte`).
- *Party (8b.4).* "Add to…" opens `SlotChooser` for a trait the target refuses but another slot of the creature takes
  (`allowedSlots`, `addTraitAt`); the rule's sentence stays under the card (criterion 5).
- *Events (8b.5–8b.8; GAME_RULES R12, ADR-0009).* A census and a sweep of all 1,780 traits by 24 Haiku agents (about 3.3M tokens, not
  the 0.4M estimated) turned the triggers into 18 events plus the mechanics Spells and Stats, each mention with a role and an
  actor (`readEvent`, `findTurns`, `isStatSense`; 22 overrides). The extractor agrees with the sweep on role in 91–100% of the
  mentions both found and recalls 84–100% per event, but 53% and 45% for the two buff events. The keyword fields take an actor
  after a slash (`uses:attack/self`); the 11 old trigger phrases are aliases, so old links keep finding at least what they found
  (`triggers-before-events-v2.0.txt`). The filters have an Events section (five groups, *Causes* / *Reacts*, one *Who* control
  that narrows every event filter, `narrowEventFilters`); the event token leads to the counterpart of its role (the start of
  battle is the exception: nobody causes it).
- *Report (8b.9).* An *Events* section (`findEventCandidates`): the sentences that open with After, When, If, While … and the
  phrases around an event word that no keyword covers, as forms (numbers `#`, families `<family>`), one trait is enough;
  `REVIEWED_EVENT_FORMS` holds those looked at, and `real-sheet.test.ts` fails on any form neither covered nor reviewed. v2.0 had
  63 conditions and 13 phrases: 14 are events R12 names that the patterns do not read (the last group of the list), the rest
  are states, party conditions, damage as an amount, and dealing damage, gaining stats and a status ending, which R12 leaves
  out of its 18 events. `isStatSense` is exported from `core` for it.

Open slices (added 2026-10-18 after 8b.9):
- [ ] **8b.10** Events: the patterns read the forms of *any buff* / *any debuff* that 8b.9 found and the list still holds as
      "events the patterns do not read" (the last group of `report/reviewed-event-forms.ts`), and the ones the sweep of 8b.5 found
      beside them. Plan (researched 2026-10-18: all 282 uses of the words buff / debuff in the dataset, 103 read, against the sweep):
      - *What is an event here.* A creature gets a buff or debuff that is not named, or something stops it: "afflicts X with a
        debuff", "apply / receive / gain a debuff", "gains 5 random buffs", "grants X 1 random buff", "buff an enemy", "debuff an
        ally", and the protection from all of them ("resistant / immune to debuffs", "avoid debuffs", "cannot gain additional
        buffs", "can only gain 1 buff per turn": role `resists`; the sweep calls them events too, 19 traits, and they are what a
        player looks for as debuff immunity). Not events, and left alone: a buff or debuff the text names ("Burning debuffs", "this
        / that / these debuff(s)", "whichever of these debuffs": R10), how long they last or that they persist, copying, sharing,
        removing or stealing them, counting them as a state ("has at least 3 buffs"). The actor is who gets it, as in 8b.6
        ("afflicts an enemy with a debuff": the enemy); where the text names nobody who gets it, whoever it names.
      - *8b.10a, `core`, tests first (`event-reading.test.ts`, `keyword-matcher.test.ts`).* (1) A pattern may hold `#` for a
        number (the notation of the report's forms): the matcher reads it as `\d+` and looks the phrase up with its numbers
        written `#`; `every 2 debuffs` becomes `every # debuffs`. (2) New patterns, each with the verb or preposition that makes the
        role (the span starts there, the words before it decide): `with a debuff`, `with # random debuffs`, `afflicted with #
        random debuffs`, `afflict(s) a debuff`, `afflict(s) an additional debuff`, `apply / applies / receive(s) / gain(s) a
        debuff`, `gain(s) # random buffs`, `with # random buffs`, `# random buff(s)` after "grants X", `gain additional buffs`,
        `gain # buff`, `buff / debuff` followed by "an enemy / an ally / enemies / allies"; the protective ones start with their
        cue (`resistant to debuffs`, `immune to debuffs`, `avoid(s) debuffs`, `prevent(s) debuffs`, `avoid being afflicted by
        debuffs`). (3) `readEvent`: a mention that opens with a protective cue is `resists` (after the opening-condition test,
        before the noun test, or "avoid debuffs" would be read as a noun); a transitive verb carries its object's actor; "to
        <creatures>" after the mention names the one who gets it ("grants 1 random buff to all your creatures"); "a random
        ally" is an ally. The ground is that of 8b.6: read every new line of the snapshot; a mention the wording cannot tell goes
        to `overrides.yaml` with its reason.
      - *8b.10b, data.* `pnpm pipeline:fetch && pipeline:build`, `keywords-v2.0.txt` (the new lines only, all read), the counts in
        `real-sheet.test.ts` (any buff 50, any debuff 52 today), each form that is read out of `REVIEWED_EVENT_FORMS` (the test
        that fails on a form neither covered nor reviewed also keeps the list honest), R12 (the protection sentence), the recall
        figures in the M8b summary, ROADMAP. Measure with `measure.ts` before and after: the recall of the two events was 53% and 45%.
- [ ] **8b.11** Filters: *Who acts* takes several choices at once. The owner's note (2026-10-18): today the control is a
      `Segmented` of one choice (Any, This creature, Your creatures, Enemies); it should let the player turn several on, each
      button a toggle that goes on and off on repeated taps. Recorded in SPEC §8.1. Questions for the slice to settle before it
      codes: what a selection of several means for the filters (the same event by two actors is already two items in the
      address; Match all would have them both, which is surely not meant, so they must be one *or*); how *Any* sits beside the
      others (a choice of its own, or "none pressed"); what `eventActors` and `narrowEventFilters` (one actor today) become;
      the counts of the buttons (`facetCount`, `KeywordFacet.byActor`) with several actors; the address and the chips; `Segmented`
      (it has one value) or a group of toggle buttons. Touches `core` (`event-actors`, `toggleKeywordSide`, `filterQuery`, the
      query if it needs an actor list), the web (`event-who`, `EventFacets`), SPEC §8.1, QUERY_LANGUAGE §2 if the language
      changes, DESIGN, SCREEN_READER_CHECKLIST 17, `e2e/events.test.ts`. A plan with tests first for `core`, then the web.
