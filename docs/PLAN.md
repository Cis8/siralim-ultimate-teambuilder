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
- **Phase 1 · M6 under way: 6.1-6.3 done, 6.4 next.** `core/src/party/` has the immutable `Party` (+ `SLOT_POSITIONS`, the 18
  slots in reading order), `slotRules.canPlace`, `PartyCommand` / `applyCommand` / `PartyHistory` (`executeCommand`, `undo`,
  `redo`) and the `nextEmptySlot` target strategy (SPEC §8.2). `web` has no party state yet; the Party panel says "Coming
  soon." **Next: 6.4** (`core`, TDD): coverage of a party (applies / relies on / missing per keyword, from the members'
  traits) and party-wide non-stacking duplicates (R4); read GAME_RULES R4 and the keyword roles first. For 6.5-6.7 the party
  goes in the same address as the search: reuse or generalise `explore-address` / `explore-url-writer` (the other
  parameters are already left alone) rather than a second writer.
- Open for the owner, none blocking: GAME_RULES open questions 1-5 (allies vs enemies; "afflicted with" as a trigger;
  when a mastery is active; Diabolic Horde; Dusty Struggle's wording).
- Every green commit on `main` is deployed to Pages (D2). The nightly `data-refresh` works; read its report before merging.
- Before coding: `git pull`, `gh run list --branch main -L 3` (main must be green), `gh pr list` (data-refresh PRs).

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
- e2e: wait for the first row before typing or clicking (`openExplore`): the traits load after hydration, and a field filled
  earlier is lost (WebKit gets there last). Safari does not focus a button that is clicked: to test focus, use the keyboard.
- SvelteKit 3 navigation: `pushState` / `replaceState` are deprecated and a shallow entry keeps `page.url` on the page
  underneath, so the address is written with `goto(resolve('/?…'), { replace, reset: false })`: a real navigation on the same
  route, with no load to run. `reset: false` leaves scroll and focus alone, also on back/forward. `afterNavigate` tells the
  page's own write (`type: 'goto'`, ignored: reading it back would put the text of the last pause over what was typed since)
  from `enter` / `popstate` / `link` (read). A navigation started while another is in flight drops the first one's history
  entry, hence the writer's queue. The lint rule `no-navigation-without-resolve` accepts `resolve()` only with `'/'` or
  `` `/?${string}` ``, and `page.url` is a read-only type: build a `URL` from its `href`.
- `rtk` is not on every machine: run `pnpm exec vitest …` directly; in PowerShell prefix `$env:PATH` with the Node 24 folder.
- `packages/core` and `pipeline` export TypeScript source (`exports: ./src/index.ts`); there is no build step.

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
(`explore-address`, `explore-url-writer`; SPEC §7). Deviations worth knowing: the filters are written as a query and that
text is what is searched (`filterQuery`); a click on a token turns the other side of the keyword off, the panel does not;
filter chips are remove-only; a pressed token is a ring, not a fill (contrast of a highlight); narrow screens stack the
panel above the list until the bottom sheet (M7); back and forward bring back the state and start the list over.

### M6 Party planner
- [x] **6.1** Immutable party + slot-rule registry `canPlace → ok | reason` (R1, R6). *T:* criterion 5, every kind × slot.
- [x] **6.2** Commands + history (place, clear slot, clear party). *T:* undo/redo, redo dropped after a new command, no-ops not recorded.
- [x] **6.3** Target-slot strategy (next empty slot after placing).
- [ ] **6.4** Basic coverage (applies, relies on, missing) + party-wide non-stacking duplicates (R4). *T:* criterion 7.
- [ ] **6.5** Party codec: base64url of `[datasetVersion, 18 IDs]` + target; unknown IDs kept. *T:* property round-trip;
      a full party URL stays under 1,000 characters.
- [ ] **6.6** Party panel, target selection, add from results (`aria-disabled` + visible reason), clear, undo/redo
      (buttons, Ctrl+Z / Ctrl+Shift+Z outside text fields), "in party" marker.
- [ ] **6.7** Share link; "not found in vX" slots with a search for the name derived from the slug; last party in
      localStorage. *e2e:* criteria 5, 6 (fresh browser context), 7; undo/redo; axe.

### M7 Mobile
- [ ] **7.1** Bottom sheet on a modal `<dialog>`. *e2e:* focus trapped, Esc closes, focus returns.
- [ ] **7.2** Explore/Party tabs (`tablist`), tab in the URL; no Synergies tab before Phase 2.
- [ ] **7.3** Result card with add-to-target. *e2e:* every interactive element ≥ 44×44 px on mobile; axe.

### M8 Hardening
- [ ] **8.1** Performance: `vitest bench` on the snapshot + e2e keystroke latency with 4× CPU throttling, p95 < 16 ms
      (criterion 9). Inverted index only if the budget is missed.
- [ ] **8.2** Size budgets (initial JS ≤ 150 KB gzip, data ≤ 300 KB gzip) + Lighthouse CI.
- [ ] **8.3** Keyboard-only e2e walkthrough (criterion 8); contrast test of the DESIGN tokens on every surface they use;
      screen-reader checklist for the owner.
- [ ] **8.4** Final credits (authors confirmed with the owner), README, docs, table mapping acceptance criteria to tests.
