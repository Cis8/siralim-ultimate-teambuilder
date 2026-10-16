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
- **Phase 1 · M3 in progress** (2026-10-16): 3.1-3.6 done. The report now has a *Taxonomy* section. **Next: 3.7**, the
  hand review of the roles of the 30 most frequent keywords against their sentences, fixing through `overrides.yaml`.
  Open for the owner, not blocking: whether to make searchable the Spell Gem properties (Sealed, Seals, Charges,
  Cascading), Fused, and the stacking effects (Mega Magic, Dire Wolves, Zombies); they are the 8 candidates left in the
  report. Flesh Rot-style implicit applications name no keyword: an override that adds a mention may be needed.
- Nothing waits on the owner. The compendium authors agreed to publication (D2), so every green commit on `main` is deployed.
- The nightly `data-refresh` works (Actions may now open PRs): the first dataset (v2.0, 1,780 traits) is on `main`
  under `apps/web/static/data/`. Read the PR report before merging later ones, as the protocol says.
- Before coding: `git pull`, `gh run list --branch main -L 3` (main must be green), `gh pr list` (data-refresh PRs, from M2 on).

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
- The RTK hook compacts command output: vitest prints nothing useful through it. Use `rtk proxy <command>` for the
  raw output.
- A data-refresh PR shows a `pull_request` CI run with conclusion failure, no jobs and no log (opened by the bot). Ignore
  it; judge `main` with `gh run list --branch main`.
- pnpm in CI fails on unapproved dependency build scripts (`ERR_PNPM_IGNORED_BUILDS`), locally it only warns:
  `allowBuilds` in `pnpm-workspace.yaml` must list every package that has one.
- Pipeline scripts run with `tsx` (the sources use extensionless imports, which plain Node cannot load).
- Prettier skips Markdown on purpose (hand-wrapped prose, tables).
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

### M3 Keyword extraction
- [x] **3.1** Canonical buff/debuff lists (wiki Buffs/Debuffs, Codex Reference) transcribed into the taxonomy with a source
      note; `canBeRandomlyApplied`; mechanics/triggers from the prototypes. Registry validates unique keys/patterns.
      *T:* registry invariants; every canonical debuff is present; Inverted and Mania are not randomly applicable.
- [x] **3.2** Matcher: case-insensitive, longest match, word-bounded, with spans. *T:* "start of this creature's turn"
      vs "start of battle", "Weakness" ≠ Weak, ’ vs ', inflections via patterns (Sleep/Sleeping, Stone/Stoned).
- [x] **3.3** Role heuristic: per sentence, nearest cue before the keyword wins. *T:* real sentences: Flesh Rot (uses,
      then applies), Master of Abominations ("always have" → applies), Quell ("enemy with" → uses).
- [x] **3.4** `overrides.yaml` (roles + random-debuff target/activation) with schema: `reason` required, trait and
      keyword must exist, warning on redundant overrides. *T:* schema cases.
- [x] **3.5** Enrich the dataset with keywords + overrides; snapshot `{traitId, key, role}` one line per hit;
      random-debuff snapshot `{traitId, target, activation}`.
- [x] **3.6** Report of taxonomy candidates (frequent capitalised terms not in the taxonomy, names excluded) and
      discrepancies with the canonical lists. *T:* fixture.
- [ ] **3.7** Review the 30 most frequent keywords' roles against their sentences; fix through overrides. Ask the owner
      only about genuinely ambiguous cases.

### M4 Query core (TDD)
- [ ] **4.1** Lexer with spans. *T:* exact spans, `-stack:no`, `class:"rodian master"`, `-(weak OR snared)`, unclosed quote.
- [ ] **4.2** Error-tolerant parser → `{ast, tokens, diagnostics}`. *T:* precedence NOT > AND > OR, juxtaposition,
      missing/extra `)`, dangling OR, trailing NOT, empty query; property: never throws on arbitrary input.
- [ ] **4.3** Field registry (QUERY_LANGUAGE §2, aliases; unknown field → free text). *T:* each field, `a:vul`, `mat:none`.
- [ ] **4.4** Evaluator visitor over a precomputed index. *T:* acceptance criteria 1 and 2 on the snapshot vs an
      independent oracle.
- [ ] **4.5** Highlight visitor (positive terms only) + serialiser. *T:* property `parse(serialise(ast)) ≡ ast` (modulo spans).

### M5 Explore UI
- [ ] **5.1** `TraitRepository` port (core) + static JSON adapter + fixture adapter; composition root; `SearchService`.
- [ ] **5.2** `ExploreState` + URL codec (`q, class, kw, mode, mat, stack, sort`). *T:* property round-trip; bad params ignored.
- [ ] **5.3** Facets: class counts ignore the class filter, applies/uses counts, all/any, flags, effective query, sort
      strategies. *T:* acceptance criterion 4.
- [ ] **5.4** Chip operations on the query text (toggle NOT, remove term + adjacent operator). *T:* table cases.
- [ ] **5.5** Layout (3 columns, wrapping), query input, result count in `aria-live`.
- [ ] **5.6** Virtualised results (`@tanstack/virtual-core`), `KeywordToken` (role by shape), `<mark>` highlights.
- [ ] **5.7** Click a keyword → counterpart filter. *e2e:* acceptance criterion 3.
- [ ] **5.8** Facet panel (`aria-pressed`), chip row, effective query + copy, empty state.
- [ ] **5.9** URL sync (replace while typing, push on discrete actions; back/forward). *e2e:* criteria 1 and 4 through the
      UI, reload restores state, axe.

### M6 Party planner
- [ ] **6.1** Immutable party + slot-rule registry `canPlace → ok | reason` (R1, R6). *T:* criterion 5, every kind × slot.
- [ ] **6.2** Commands + history (place, clear slot, clear party). *T:* undo/redo, redo dropped after a new command, no-ops not recorded.
- [ ] **6.3** Target-slot strategy (next empty slot after placing).
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
