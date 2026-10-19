# Implementation plan

Claude Code's working file: where we are, what comes next, how each step is tested. Read it at the start of every
session (after `CLAUDE.md`), update it before ending one.

**Keeping this file small**
- *Resume here* is **overwritten** every session, never appended (≤ 12 lines).
- Tick a slice when it is on `main` with all checks green. When a milestone closes, collapse its slices into one line
  (what shipped + deviations worth knowing). Git history is the changelog: no step-by-step logs here.
- *Notes* holds only what a future session would otherwise rediscover the hard way. Delete notes that stop being true.
- Owner decisions on game rules go to `GAME_RULES.md`, on behaviour to `SPEC.md`, on architecture to an ADR, not here.
- Target size: under ~250 lines, not counting the slices of the phase being built (Phase 2 adds about 190 while it is open). When a
  phase closes, replace its plan with a 3-line summary.

## Resume here
- **Phase 2 is under way (D14–D32, *Phase 2 — slices* below): M9, M10 and M12 are done, 13.1 and 13.2 are done and the next slice is
  13.3** (the trait view), in the order M13 → M11 (D15). What 13.2 leaves for it: `routes/synergy/+layout.svelte` holds the relations
  (`useSynergy()`, `synergy-context.ts`), the party's place in the address (a writer over `synergyAddress`) and the bar at the foot; a
  page reads `mat` and `section` from `page.url` with `decodeSynergyView`. `routes/synergy/[traitId]/+page.svelte` is a bare head (dot,
  `h1`, origin, the description as plain text) and `TraitPicker`: 13.3 puts the focus card and the lanes in its place. It will need to
  *write* `mat` (the artifact checkbox) and the party (Add to): the layout's writer is not reachable from a page yet, so either put it in
  the context (`chosen`, `refined`) or navigate with `goto(synergyHref(place, search))`. The search field is a plain `<input>` until the
  page is idle, or the focus or a pointer arrives; then the assist layer (`query-assist.ts`) is fetched and attaches to it. Sizes now:
  initial JS 85.3 kB of 150 (80.1 before 13.2: the header, the bars, the links and the copy), lazy 19.3 of 50; Lighthouse 0.89–0.91 (LCP 3.3 s).
  **On a phone the inline list of suggestions is all there is until 11.5** (nine rows reach the
  fixed bars, which stay on top): the owner's check of it on a real iPhone is the first one that matters (checklist iPhone 8).
  Phase 1 stays open for slice 8.4 only: credits (ask the owner to confirm the authors' names first), README, the
  criteria-to-tests table, ROADMAP ticks. The owner deferred it on 2026-10-18; it is not dropped (D25).
- For the owner to veto, none blocking: D18–D32 (chosen by Claude; D30: the Synergies link sits after the tab list; D31: Party in the
  header goes to Explore with `tab=party`; D32: a trait page's description is plain text until 13.3; D27: a random or conditional source enables nobody on the Enables side; D28: the same for Alternatives; D29: with no applier by name a random source decides the verdict before a conditional one); 8b.10 made "immune to debuffs" a mention (SPEC §4); 8b.11 chose
  that *Any* is pressed exactly when no actor is, that the actors of one event side are an OR (also in Match all) and that each is a chip.
  **Needs an answer:** `/` is a character-key shortcut that works from anywhere, and WCAG 2.1.4 (level A) wants one to be switchable
  off or remappable. Proposal: a "Keyboard shortcut: /" switch in the footer, remembered in `localStorage` (about one slice); or drop
  the shortcut. Until then it ships as QUERY_LANGUAGE §6 says. **D26 is live now:** after typing, Tab and Enter take the first suggestion, so
  leaving the field with text in it takes Esc first (Shift+Tab always leaves). If that feels wrong in use, the alternative is no active
  option until ↓ (a one-line change in `combobox-state.ts`' `typed()`), at the price of Tab not taking what the ghost text will show.
- Waiting on the owner, none blocking: run `docs/SCREEN_READER_CHECKLIST.md` (NVDA, VoiceOver) and report what sounded wrong; on a real
  iPhone (Safari and Chrome) check that focusing the search field and the sort no longer zooms the page (8b.1), and that pressing a Fix
  of the issues list (type `clas:life (weak OR snared`) keeps the keyboard up and the caret where it was (9.6); when 11.5 lands, the
  mobile search sheet on iOS Safari and Chrome Android. GAME_RULES open questions 1-5 (allies vs enemies; "afflicted with" as a
  trigger; when a mastery is active; Diabolic Horde; Dusty Struggle's wording).
- Every green commit on `main` is deployed to Pages (D2). Before coding: `git pull`, `gh run list --branch main -L 3` (main must be
  green; `gh` may be missing, see Notes), `gh pr list` (read a data-refresh PR's report before merging it).

## Owner decisions (2026-10-16 unless dated)
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
| D14 | (2026-10-18) Phase 2 autocomplete/diagnostics/editor (M9–M11) live in the existing Explore search bar, no new page. Build it as a reusable component, logic in `core`, rich editor lazy-loaded (150 kB budget), mobile per `MobileSearch.dc.html`. Only Synergy (M13) is a new page | here, ADR-0010 |
| D15 | (2026-10-18) Phase 2 build order **M9 → M10 → M12 → M13 → M11**: the editor goes last, it is the riskiest and needs the owner's iPhone. Milestone numbers do not change | ROADMAP |
| D16 | (2026-10-18) Synergy lanes use buffs, debuffs and effects only (R12: no event is a dependency). Events appear only in *Same trigger*; there is no "event links" section in Phase 2 | GAME_RULES R12, here |
| D17 | (2026-10-18) A trait appears **once per side**, as ROADMAP Phase 2 criterion 4 says (not once per lane, as the prototype does): traits that cover several of the focus's keys sit in a top lane with "×N links", the single-key lanes follow | ROADMAP, here |
| D18 | (default) The count shown beside a suggestion includes the active filters: it is what Enter would show | here |
| D19 | (default) "Reads as" explains the *effective* query (the one searched, filters included), not only the text typed | here |
| D20 | (default) Warnings and unknown-value errors are hidden for the term still being typed (caret inside it, no blank after it); syntax errors are not | here |
| D21 | (default) A `family:`, `creature:` or `trait:` value that matches nothing is a warning. QUERY_LANGUAGE §5 lists only the class (an error) | here |
| D22 | (default) The keyword verdict gains `only-random` and `only-conditional` (R5, R10: such a source never fully covers a dependency). SPEC §8.4 lists four verdicts | here |
| D23 | (default) The bottom bar keeps its ARIA tablist (Explore, Party) and gets a *Synergies link* beside it, not a third tab; the Synergy pages are routes (`/synergy/…`) with a shared party session. DESIGN and SPEC §7 speak of a third tab: they were changed in 13.2 | ADR-0011 |
| D24 | (default) No new dependency in Phase 2: own Levenshtein, own narrowing of the imported JSON | here |
| D25 | (default) Slice 8.4 stays open while Phase 2 starts early on the owner's go-ahead; Phase 1 closes when 8.4 lands | here |
| D26 | (default) Typing makes the first suggestion active, so Tab and Enter accept it (what the ghost text shows); after an accept, a caret move, Esc or a blur nothing is active and Tab leaves the field. A hover does not activate | QUERY_LANGUAGE §6 |
| D27 | (default) The Enables side lists only what the focus applies **by name**: a random or conditional source appears in Enabled by (SPEC §8.4) but enables nobody, so Pandemic has an empty Enables. The other way is one table in `trait-relations.ts` and 18 lanes for Pandemic | here |
| D28 | (default) Alternatives compare what traits say by name, as D27 does: a random or conditional source is nobody's alternative for *applies*, and a mention that only guards (`resists`) makes no tie. Same trigger compares `self` with `ally` as different actors (the plan's rule: equal, or one side says none or `any`) | here |
| D29 | (default) The keyword verdict asks about the sources first, in GAME_RULES' order (*Dependency statuses*: random before conditional): no applier by name → `only-random` if a random source exists (a conditional one beside it changes nothing), else `only-conditional`, else `no-source`; then the payoff: `no-payoff`, `scarce` (appliers × 2 < users), `supported`. `scarce` and the co-applied keys count the specific appliers only, and the artifact filter acts on all four lists. SPEC §8.4 lists four verdicts (rewritten in 13.8) | here |
| D30 | (default) The bar at the foot of a narrow screen is Explore · Party · Synergies: the link comes after the tab list (a tab list may hold only tabs), on Explore and on the Synergy pages alike, so that the items do not move when the page changes | DESIGN § Layout |
| D31 | (default) "Party n/18" in the header (wide screens) is a link to Explore with `tab=party`: the party is a column of Explore there, so it is the place the party is | DESIGN § Layout |
| D32 | (default) 13.2's trait page shows the description as plain text under the head, and the "not found" page offers up to 8 traits whose name is like the id's (`lostTraitSearch`) with the picker pre-filled; 13.3 replaces the first by the focus card | DESIGN § Synergy pages |
| D9–D13 | Defaults accepted: Phase 1 coverage = covered/missing only; free text is substring; overrides need `reason:`; data-refresh PR runs its own checks; GAME_RULES open questions don't block Phase 1 | SPEC, here |

D18–D32 are defaults Claude chose while building Phase 2 (2026-10-18/19). None blocks; the owner may veto or change any, and the
slice that builds it then follows.

## Notes (toolchain gotchas)
- Guards a new control meets: it needs `min-height: var(--target-min)` under `pointer: coarse`, or `touch-targets.test.ts` fails and
  names it; one that draws an outline of its own needs a `:focus-visible` rule, or `keyboard.test.ts` names it (no 2 px ring).
  Anything that changes the layout between the prerendered page and the loaded one (a line that appears, a layout JS decides)
  counts as a layout shift: Lighthouse CI fails above 0.1. Decide it in CSS, or hold the room.
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
  `https://api.github.com/repos/Cis8/siralim-ultimate-teambuilder/actions/runs?branch=main&per_page=3` (a full SHA, not a short one;
  60 requests an hour without a token, then it answers 403). Without the API: `github.com/Cis8/siralim-ultimate-teambuilder/actions?query=branch%3Amain`
  has the state of each run in an `aria-label` ("failed: Run 85 of CI. …"), and the page of a run's job lists the failing step and the
  errors of the log in its *Annotations*. A run that is `in_progress` is not a green `main`: wait for it before starting.
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
- e2e, the announced count (`announcedCount`, the live region): it is empty until the count has stood still for 400 ms, then it says the
  whole list until the search's count has stood still as long. Reading it right after a `fill` gives either, depending on the speed of the
  machine (a fast one passes, the CI runner failed): wait for `toContainText('of')` **and** `not.toContainText('<total> of')` first.
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
  `countFacets` runs inside every timed search: working out the keys of the 15 actor sets on each call cost +15% on `pnpm bench`'s
  typing run (and failed the 16 ms e2e once under load), so they are built once at load. Compare `pnpm bench` before and after.
- `typing-latency` and `assist-latency` (p95 of `atlas:search` / `atlas:assist` at 4× CPU) can fail when the whole e2e suite runs on
  many workers at once: rerun them alone (`playwright test typing-latency assist-latency --workers=1`) before suspecting the code.
  Alone: search p95 4.5–5.4 ms; assist p95 6.4 ms with the suggestions and their counts, on a text with eight faults of every kind (the budget
  is 16 ms: 40% of it, under the 60% that the slower runner of CI allows). With the nine counts made in the key it was 16–17 ms, a count being 0.3 ms
  here: see M10.
  The assist sat at 13–14 ms here before `lint-term.ts` (2026-10-18) and went red on CI at 20–23 ms, on two runs in a row: the Linux
  runner is ~1.5× slower than this machine, so **a budget used past ~60% locally will fail there** (no Windows run can show it).
  The cost was the offer for a finished word that no trait has (a search of the vocabulary, 1.5 ms), paid again by every later key.
- e2e and the assist layer: `searchBox` is `getByRole('combobox', …)` and so waits for the layer; the sort `<select>` is a combobox too, so
  never ask for a bare `combobox`. `openExplore` hovers the field to bring the layer in at once (left alone, it comes 500 ms after the data:
  the one test that does not is in `query-suggestions.test.ts`). The list of suggestions covers the chips and the first results while it
  is open, so a test that goes on to click there puts it away first (`Escape`), as a pointer user would have to.
- `pnpm lint` runs dependency-cruiser over `apps/web/src` as well. The rule `assist-stays-lazy` lets only `query-assist-loader.ts` import
  `query-assist.ts`, with `import()`; what the loaded layer needs goes through `query-assist.ts`. Anything that `query-input.svelte` or the
  page imports statically is in the first script, which the rule cannot see: after touching imports run `pnpm build && pnpm size-budget`
  (lazy JS 19.3 kB now, initial 85.4) or look for `aria-autocomplete` in the chunks. The relation code is the same kind of thing: a
  module the first script imports (the header does, through `composition-root.ts`) brings along everything it exports, so the relation
  service is built in `relation-composition.ts` and the rule `relations-stay-lazy` lets only `routes/synergy/` import it (2 kB otherwise).
- Lighthouse: fetching the assist chunk while the first results were being drawn cost 150 ms of LCP (0.92 → 0.90): Lantern counts a
  request that starts before the LCP paint. `FETCH_AFTER_DATA_MS` (500) in `query-input.svelte` keeps it out (back to 0.91–0.92).
- On this Windows machine `keyboard.test.ts` › "reaches every control of the Party tab" fails about half the time on `mobile-webkit`
  with one stop instead of more than ten, also on a tree without the Phase 2 work (checked 2026-10-18). CI (Linux) is green: if it
  is the only failure, it is this.
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
(`page-address`, `address-writer`; SPEC §7). Deviations worth knowing: the filters are written as a query and that
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
      Deferred by the owner on 2026-10-18 while Phase 2 starts (D25); nothing else blocks it.

### M8b The owner's notes — done
Phase 1 refinements from the owner's play-testing (2026-10-17/18), slices 8b.1–8b.11. Mobile: the search field and the sort are 16 px
under `pointer: coarse`; a "Back to top" that jumps (the virtual list cancels a smooth scroll, see Notes). Filters: "Clear filters (N)"
keeps the query, sort and Match all/any; the five classes first; collapsible sections with "· N on", remembered only while the page
lives. Party: "Add to…" opens `SlotChooser` for a trait the target refuses but another slot takes (`allowedSlots`). Events (GAME_RULES
R12, ADR-0009): the triggers became 18 events plus Spells and Stats, each mention with a role and an actor (`uses:attack/self`; the 11
old phrases are aliases); the Events filters have *Who acts* as a toggle for each actor (the actors of one side are an OR: `ActorSet`,
`KeywordFacet.byActors`); the report lists the event forms no keyword covers (`REVIEWED_EVENT_FORMS`; `real-sheet.test.ts` fails on a
new one). 8b.10 made a buff or debuff no name gives, and protection from them ("immune to debuffs"), an event: it reversed a decision
of 8b.6, and if the owner vetoes it the 7 protective patterns and the cue rule in `readEvent` go.

## Phase 2 — slices
Opened early on the owner's go-ahead (D25), in the order of D15. Decisions D14–D25; architecture in ADR-0010 (query assist) and
ADR-0011 (Synergy routes). Prototypes: `SearchBar.dc.html`, `MobileSearch.dc.html`, `Synergy.dc.html`, `MobileSynergy.dc.html`
(behaviour only; where the plan departs from them it says so). QUERY_LANGUAGE, SPEC and DESIGN change in the slice that makes
them true, never ahead of it. Every new `core` module must be reachable from `core/src/index.ts` (dependency-cruiser `no-orphans`).
- *Unchanged, reused:* lexer, parser (never throws), `evaluate`, `visitQuery`, `queryChips`, `serialise`, the URL codecs (`q` stays the
  bar exactly as typed), facets, `ExploreState`, slot rules, the planner, `TraitRepository`.
- *Extended:* `QueryDiagnostic` (+`severity`, +`fix`), `FieldDefinition` (+`help`, +`values`, +`describe`), `SearchService` (+`vocabulary`,
  +`traits`, +`countMatches`), `timeSearches` (it times `.search` only today), `core/index.ts` (must export `compileQuery`; `serialiseTerm` is), `query-input.svelte` (stays the one `<input>`), `composition-root.ts` (one load, two services), `+page.svelte` (party and
  address logic move to a shared session), `support/keyboard.ts` `CONTROLS` (+`[role=option]`, `[role=combobox]`), `tools/size-budget`
  (+`lazyJs`, +`totalJs`: a lazy chunk is invisible to it today), `lighthouserc.cjs`.
- *Watch while building:* the mirror must line up across engines (same font stack on both layers, `forced-colors`, selection); IME and
  predictive keyboards (`isComposing`); iOS keyboard docking (owner device check); layout shift from the lazy chunk (the input never
  swaps, the badge sits inside the field); `no-navigation-without-resolve` with dynamic routes; GitHub Pages serves `404.html` with
  status 404 (no previews or SEO for `/synergy/…`: accepted, ADR-0001); 13.1 refactors a 776-line page (the Phase 1 e2e is the net);
  assist latency (budget first, then defer the counts); the volume of *Same trigger* (ranked and capped).

### M9 Diagnostics — done
`core`: `TextEdit` + `applyEdit` + `caretAfterEdit`; `QueryDiagnostic<Code>` with `severity` and `fix?`; `withSyntaxFixes` (a fix only if
the query means the same after it; none past 50 problems); `closestMatch` (own Levenshtein, bounded); `FieldDefinition` +`help`,
+`values` (`choices` | `vocabulary` | `keyword`), +`describe`; `createQueryVocabulary` and `SearchService` +`vocabulary`, +`traits`,
+`countMatches`; the lint registry (`LintRule`, `createLintRegistry`, `lintRegistry`: 12 rules, only `unknown-field` has
`reportsWhileTyping`, D20) and `lintQuery(source, context, {caret})` (`MAX_LINTED_LENGTH` 2,000). Soundness is tested on the real sheet
(`assist-acceptance.test.ts`: every finding of the value rules is a query that finds nothing, every fix lints clean). `web`: the badge
inside the field, the list under it (`QueryIssues`), `applyFieldEdit` (native undo kept), the polite line (`issue-announcer`),
`atlas:assist` (`timeAssist`), tokens `--issue-*`. Deviations worth knowing: D21 (a `family:`, `creature:` or `trait:` that matches
nothing is a warning; only the class is an error); the keywords are not in the vocabulary (the taxonomy has them); a value has at most
one fault; "did you mean" compares whole entries; a selection is no caret (the Tab key selects the whole text of a field); the list
opens by itself only for a query that was typed, never for one that arrives with the address (nothing moves on load: Lighthouse CLS
unchanged); `aria-invalid` for errors only; the list shows five issues, errors first. The findings of a term are remembered per text,
`typing` flag and context (`lint-term.ts`; a text that stands elsewhere gets them moved). If suggestions push `atlas:assist` up,
defer the counts (ADR-0010).

### M10 Autocomplete — done
`core`: `suggestionContext` (six kinds, each with the `replace` span an accept takes the place of), `suggestQuery` over a registry of providers
(one per kind; `rankCandidates` by tier, cut at nine; `bestFits` before anything is written out), `acceptSuggestion` (a `TextEdit`, like a fix),
`ghostText`, `withCounts` (within the filters, D18); soundness tested on the real sheet (`assist-acceptance`). `web`: `combobox-state.ts` (the
key table is a table of tests), `Combobox` (APG editable combobox attached to the host's `<input>`; `keyPressOf` reads key code 229 as an IME,
Safari), `list-announcer`, `search-shortcut` (`/`), and the wiring of 10.5: `query-input.svelte` keeps the plain `<input>` and fetches
`query-assist.ts` (`import()` in `query-assist-loader.ts`, on first idle, focus or pointer) which brings `analyseQuery` (issues and suggestions of a key
in one call, timed `atlas:assist`), `Combobox`, `IssueBadge`, `QueryIssues`. Deviations worth knowing: the ghost text is written but drawn with the
mirror of 11.2 (until then the active option in the list is what Tab takes); the `Combobox` takes the `input` as a prop; an option that continues
keeps the list open; the list does not scroll (axe: a scroll area is a tab stop); **the counts are not all made with the key**: nine searches at 4×
CPU took 16–17 ms, so the first suggestion is counted with the list (it is the active one, read at once) and the rest three at a time, each step in
a task of its own after a paint (`countNext`, `afterNextPaint`): assist p95 6.4 ms; **the list sits under the list of issues** (over it, it covered
the fixes) **and under the fixed bars** (z-index 4; on a phone the Filters button was covered); `applyFieldEdit` marks its own `input` events
(`isBeingEdited`) so a fix or an accept neither opens the list nor makes an option active. The size budget has `lazyJs` (50 kB; 9.2 now) and `totalJs`
(200 kB), and dependency-cruiser runs over `apps/web/src` with the rule `assist-stays-lazy`. e2e: `searchBox` is a combobox (it waits for the layer),
`query-suggestions.test.ts`, the option targets in `touch-targets.test.ts`.

### M12 Relations engine (core) — done
`core/src/relations/`: `createRelationIndex(traits, taxonomy)` over the 42 keys that can be a dependency (buffs, debuffs, effects; no event,
mechanic or flag: R12, D16). `get(key)` → the traits that apply, apply conditionally or at random, and rely on it (a trait is listed once per
key among the sources, under the strongest); `relationsOf(id)` → Enabled by / Enables (one trait per side, a `several` lane first, `unmet`
keys, ranked by tier, links, name: D17; Enables lists only what the focus applies by name: D27); `alternativesOf`, `sameTriggerOf`,
`sameFamilyOf` (D28); `keywordView(key)` / `keywordStats()` (lists, counts, verdict D29, co-applied keys). Each takes `artifactOnly`, returns
the whole ranked list (the UI caps) and `undefined` for an unknown id or key. `createRelationService(repository)` is the web's entry: the four
sections of a trait are remembered for the last 32 questions (`memoiseRecent`), beside `trait(id)`, `datasetVersion` and `findTraits(text,
limit)` for the focus picker (the name begins with the text, has a word that does, has it inside; then the creature or the family). `keywordSlug` /
`keywordFromSlug(slug, keys)` write and read `/synergy/kw/<slug>` (`createTaxonomy` refuses two keys with one slug or none, as it does a key
that starts another; the slug is read exactly, and the caller gives `index.keys`, because an event's key has no page). `loadOnce(repository)`:
the composition root fetches the dataset once for both services; the relation service is built in `relation-composition.ts` (13.2), so that
its code stays out of the first script. Tested on the real sheet (`relation-acceptance`, `keyword-view-acceptance`: the counts
equal Explore's facet panel for all 42 keys, with and without `mat:yes`, and the committed `keyword-verdicts-v2.0.txt`;
`relation-service-acceptance`) and with hand-made traits and fast-check oracles, all mutation-checked. `pnpm bench` (`relations.bench.ts`):
the index builds in 0.55 ms; the four sections of all 1,780 traits cost 2 µs (Enabled by / Enables), 1 µs (Alternatives), 44 µs (Same
trigger) and 7 µs (Same family) a trait on average, 0.3 ms at worst for all four (Squirmies); all 42 keyword views 0.17 ms; one key of the
focus picker 0.25 ms. Data worth knowing: the lanes are small (Poisoned 14 appliers, Burning 11, Vulnerable 8); events are huge (`attack`: 97
cause, 370 react), hence D16; 27 enemy-only random sources and 4 conditional-source traits exist.

### M13 Synergy UI — a new page, the party shared
- [x] **13.1** Shared party session (a refactor, no behaviour change; the whole Phase 1 e2e suite passed untouched, 519 tests).
      `party-session.ts`: `createPartySession({ store, rendered })` holds the planner (undo history included), the announcement, the
      chooser, the last-party persistence and the party's side of an arrival (`arrive`); `syncAddress(sink)` tells the page in front
      what a change asks of the address (`'chosen'` | `'refined'`); fields are reactive through `createSubscriber`; one instance,
      `partySession`, in `composition-root.ts`. `createPageUrlWriter` became the generic `createAddressWriter<State>(bar, addressOf)`
      (`address-writer.ts`). `+page.svelte` went from 800 to 593 lines; initial JS 79.5 → 80.1 kB. Deviations, on purpose: plain
      `.ts`, not `.svelte.ts` (Vitest has no Svelte compiler and D24 allows no new dependency; `createSubscriber` needs no runes);
      `go()` still takes a URL: the one route there is is `/`, so the bar of each page resolves its own (13.2, where the lint rule
      `no-navigation-without-resolve` meets a second route); the live `<p>` stays in the page (`partyAnnouncement` in e2e finds it
      beside the views; 13.3 decides where both pages get it); a page that goes away drops an open sheet (`forgetChooser`), or the
      next one would reopen it. *T:* `party-session.test.ts` (mutation-checked) and the writer's tests, moved.
- [x] **13.2** Routes, deep links, navigation. `routes/synergy/+page.svelte` (the picker: a trait by name, "Start from your party", a
      keyword), `[traitId]/+page.ts` and `kw/[slug]/+page.ts` with `prerender = false; ssr = false` (404.html boots them on Pages; the
      route parameter is `slug`, not `key`), one layout for the three (`+layout.svelte`: relations loaded once, `partySession` arrival and
      `syncAddress`, a writer over `synergyAddress`, the bottom bar). `synergy-address.ts` (`mat=yes`, `section=`, the party),
      `carried-search.ts` (every link carries the party), `synergy-place.ts` (route id → page), `synergy-links.ts` (every address made
      by `resolve`, typed `ResolvedPathname`, which the lint rule accepts), `relation-composition.ts` (see Notes). Header `SiteNav` from
      1100 px; under it `BottomBar` (`TabBar` is its tab list plus the Synergies link; the Synergy routes have a `nav` of three
      links). `TraitPicker` is the `Combobox` of 10.4 over `relations.findTraits`; `KeywordPicker` is links, grouped; an unknown id
      is "Trait not found" with similar names and a pre-filled search, an unknown slug the keyword picker. *T:* the address codec,
      the carried search and the place (mutation-checked); e2e `synergy.test.ts` (both URL shapes opened by address, Back and Forward,
      the party carried both ways, the restore of the last party, the places, axe), `fallback-page.test.ts` (404.html names its files
      under the base path), the walks and the targets of the Synergy pages in `keyboard.test.ts` and `touch-targets.test.ts`. *Docs:*
      SPEC §7, DESIGN (§ Synergy pages, § Layout), ADR-0011. Deviations on purpose: D30–D32; the writer ignores a write whose page has
      gone; the layout does not call `partySession.arrive` for a `goto` that changes page (it carries the party it holds).
- [ ] **13.3** Trait view. The focus card (class dot, `h1`, meta, description with tokens: buff, debuff and effect tokens open the keyword
      view, events and mechanics are plain kind-coloured text; rows Relies on / Applies / Triggers / Material with the no-material
      icon), "Add to <target>" through the shared session (the same sentence, "Add to…" chooser, "In party" marker as Explore), "Open in
      Explore". Two sides (columns from 1100 px): `h3` lane headings with key pills, real lists, a compact `TraitCard` (name button
      "Re-centre on X", creature · class, "×N links", tier label *conditional* / *random*, no material, add), the **several-keys lane
      first**, the random tier a labelled group last (a collapsed disclosure when > 3), the prototype's empty copy, the artifact
      checkbox (`mat=yes`), the trail (`nav`, last 6, session memory, `aria-current="location"`, fresh on a deep link). Re-centre is a
      history entry; the focus moves to the new `h1`; a polite "Now centred on X"; `document.title` follows. **Data:** a trait relying
      on two debuffs that can be random gets all 27 random sources in `several`, `×2`, after the specific and conditional ones (Flesh
      Rot: 36 enabled by, 8 outside the random group), so the random group needs the collapsed disclosure; Zantai's Envy is the one
      real mixed trait (random for the debuffs, specific for Mega Magic); Pandemic and the four pair traits have an empty Enables side
      (D27). *T:* the trail module
      (append, truncate, limit); e2e criteria 4 and 5 on screen, add from a card and from the focus, Back / Forward, the artifact
      filter, keyboard only.
- [ ] **13.4** Secondary sections. Alternatives (with the reason line), Same trigger, Same family: `h2` and a count, 6 cards and "Show all
      N" (capped at 200 with a message; plain DOM, measure before reaching for the virtual list). **Data:** the biggest lists in v2.0
      are 67 alternatives (Jungle Boogie), 548 same trigger (Furor; the median is 35) and 147 same family (Numerical Nightmare), so the
      cap bites on Same trigger only; Exotic (148 creatures), Backer (135) and Avatar (31) are *families* of the sheet, not real ones, so
      their lists are long and not meaningful: the page decides whether to show Same family for them; 531 of 1,780 traits rely on no
      event (`triggers: []`, the "no trigger" state). *T:* e2e counts equal core's; "Show all" keeps the focus.
- [ ] **13.5** Keyword view. A chip picker (counts spoken as "N appliers, M users", not glyphs), the summary (pill, counts, the verdict
      with icon and text, co-applied as links), Appliers and Rely on it lists (random and conditional labelled, last), "See in Explore"
      (`?kw=a:key`, `u:key`), `/synergy/kw/<slug>`; the verdict goes to the live line. **Data:** the counts are for display, the
      lists are the traits; "Often applied together" can be empty (Barrier, Zombies, Inverted); every key of v2.0 has an applier, so
      `no-source`, `only-random` and `only-conditional` never show on the real sheet; a trait that gives what it relies on (the 4 pair
      traits, any that applies and uses one key) is in both lists of that key, which is true to the sheet; `scarce`: Blighted, Bomb, Burning, Feared, Mania;
      `no-payoff`: Inverted and seven buffs (Agile, Defensive, Immune, Protected, Savage, Taunting, Warded); the artifact filter moves
      no verdict on v2.0, only counts. *T:* e2e verdict texts for three keys; the counts
      equal the Explore facet panel (criterion 11).
- [ ] **13.6** Mobile. Under 700 px: the trail is a horizontally scrolling `nav` of 44 px pills; a compact focus card (the description
      folds to 3 lines, "Show more"); a `tablist` Enabled by · Enables · Alternatives · Related (Same trigger and Same family stacked);
      the page scrolls, not a nested list; the keyword view's tabs are Appliers · Rely on it; the picker opens as a sheet; a bottom
      `nav`. Deviations from `MobileSynergy.dc.html`, on purpose: four tabs, the picker and the artifact filter exist, no fixed top
      block (DESIGN: the page scrolls). *T:* touch-target blocks for both views on both phones, keyboard, axe, no horizontal overflow.
- [ ] **13.7** Explore ↔ Synergy. A "Synergies of X" link on every result (44 px under coarse; the row height changes, so the virtual list
      is re-measured) and on every filled party slot. *T:* e2e: result → page → back keeps the search and the party.
- [ ] **13.8** Close M13. `lazyJs` and route-chunk budgets, a Lighthouse URL for `/synergy/<id>` if the static server can fall back to
      `404.html`, SPEC §8.4 rewritten to what shipped, DESIGN (TraitCard, lanes, trail, verdict), checklist, ROADMAP tick, PLAN collapse.

### M11 Editor — colours, explanation, saved searches, mobile sheet (last, D15)
- [ ] **11.1** Explain. `explainQuery(ast, registry)`, a visitor shaped like `serialise`: `FieldDefinition.describe` per field,
      parentheses only where precedence needs them (same-kind nesting flattened), `-stack:no` reads "NOT does not stack", an unknown
      field `mentions “clas:life”`, empty is "every trait". A "Reads as" line in the effective-query component (D19). *T:* a golden
      table of about 30 queries, precedence, n-ary, `--weak`, consistent with `evaluate` on a sample.
- [ ] **11.2** Syntax colours and the mirror. `syntaxSegments(source, tokens, diagnostics)` → contiguous segments (field, value, phrase,
      operator, paren, negation, text, blank; severity) whose concatenation is the source (property test). `QueryMirror` (`aria-hidden`)
      under a transparent input, in the lazy chunk: identical metrics (font, size, `font-variant-ligatures: none`, `white-space: pre`,
      padding), `scrollLeft` kept in sync, `::selection`, a wavy underline per severity (never colour alone: the badge and the panel
      say it), ghost text after the end, a `forced-colors: active` fallback (the input's own text shown, the mirror hidden), 16 px
      under coarse. Tokens `--syntax-*` and `--underline-*` go into `contrast.test.ts` (text 4.5:1, underline 3:1). The mirror
      re-colours synchronously (lexer only); lint and counts may follow. *T:* e2e: forced-colors emulation, scroll alignment of a long
      query, WebKit, typing latency, CLS.
- [ ] **11.3** Search history (core). An immutable `SearchHistory {recent, saved}`: `recordRecent` (trim, no empty, a repeat moves to the
      front, 10), `toggleSaved` (50; `{name, query}`, name = query), removals, `exportHistory` (`{app, kind: 'search-history',
      version: 1, …}`), `importHistory(text, current)` → ok or a refusal reason, merge by query, never throws, no schema library
      (D24). *T:* limits, dedupe, corrupt, foreign, oversized and wrong-version files, round trip, merge idempotent.
- [ ] **11.4** History UI. `search-history-store.ts` (`localStorage`, lazy and throw-safe like `last-party-store`); recorded on Enter, on
      blur after a change and on saving; an empty field lists Recent and Saved in the dropdown (no active option: Tab is not
      captured); a star button (`aria-pressed`, "Save this search"); a "Manage searches" panel (`BottomSheet`) with remove, **Export**
      (a download, `trait-atlas-searches.json`) and **Import** (a file input; "Imported 3 saved, 5 recent" or the refusal, nothing
      changed). *T:* the store over a storage that throws; e2e: save → reload, export → clear → import restores, a corrupt file is
      refused; axe, keyboard, touch.
- [ ] **11.5** Mobile search sheet. Under 700 px (coarse) the field opens a full-screen modal `<dialog>` (the `BottomSheet` `full`
      variant) with the same editor: back, the field and clear, the first issue as a banner with its Fix and "+N more", "Reads as",
      suggestion rows (kind badge, label, detail, count with unit), a docked footer with "Show N traits" and the syntax `toolbar` (`(`
      `)` `"` `OR` `AND` `NOT` `applies:` `uses:` `class:` `mat:yes`; 44 px; it inserts at the caret and keeps the keyboard; `NOT`
      inserts `-` and its name contains "NOT"; `"` inserts a pair: the prototype's lone quote raised an error at once).
      `visualViewport` keeps the footer above the keyboard. *T:* a pure `insertAtCaret`; e2e on Pixel 7 and iPhone 14 (open, insert, tap
      a suggestion, close, 16 px, targets, overflow). **Owner device check** (iOS Safari and Chrome Android: keyboard docking, caret,
      zoom).
- [ ] **11.6** Close M11 and Phase 2. Budgets, Lighthouse, QUERY_LANGUAGE §7–8 and SPEC §8.3 rewritten to what shipped, DESIGN components,
      the Phase 2 criteria-to-tests table, ROADMAP ticks, PLAN collapse; ask the owner before Phase 3.
