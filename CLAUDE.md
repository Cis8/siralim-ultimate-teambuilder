# Trait Atlas — guide for Claude Code

Trait Atlas is an unofficial, static web app for theorycrafting **Siralim Ultimate** builds. It turns the community
"Siralim Ultimate Compendium" Google Sheet into a fast, searchable, mobile-friendly tool: boolean keyword search,
role-aware keywords (applies vs relies on), a party planner, a synergy explorer and party analysis.
It is hosted on GitHub Pages (`Cis8/siralim-ultimate-teambuilder`). There is no backend.

The owner is a player, not a reviewer: Claude works autonomously and owns code quality (ADR-0007). The owner speaks
Italian; repository docs, code and commits are in English.

## Session protocol

**Start**
1. Read `docs/PLAN.md` → *Resume here* tells you the next slice and anything pending.
2. `git pull`; `gh run list -L 3` (if `main` is red, fixing it is the first task); `gh pr list` (merge data-refresh
   PRs after reading their report, ADR-0007).
3. Read the docs the slice touches (table below).

**End**
1. Every finished slice is committed and pushed, checks green, CI green.
2. Tick the slices in `docs/PLAN.md`; tick the milestone in `docs/ROADMAP.md` when all its slices are done.
3. Overwrite *Resume here*. Add a *Note* only for something a future session would otherwise rediscover the hard way.

## Read before you code

| When | Read |
|---|---|
| Always, at the start of a session | `docs/PLAN.md`, then `docs/ROADMAP.md` (current phase, acceptance criteria) |
| Before touching domain logic | `docs/GAME_RULES.md` (confirmed game rules; never contradict them) |
| Before touching search | `docs/QUERY_LANGUAGE.md` |
| Before touching UI | `docs/DESIGN.md` and the matching prototype in `docs/prototype/` |
| Before an architectural change | `docs/adr/` — and write a new ADR if you change a decision |
| Anything else | `docs/SPEC.md` is the source of truth |

**Precedence when documents disagree:** `GAME_RULES.md` > `SPEC.md` / `QUERY_LANGUAGE.md` > `DESIGN.md` > prototypes.
The prototypes are *behavioural references*, not code to port (see "Prototype caveats" below).

## Scope discipline

- Work only on the **current phase** in `docs/ROADMAP.md`. Do not build later-phase features early, even if the
  prototypes show them. Leave extension points instead (registries, interfaces).
- If a requirement is ambiguous or a game rule is missing, **stop and ask** rather than guess. Record the answer in
  `GAME_RULES.md` or `SPEC.md` in the same commit. Everything else (technical choices, naming, structure) you decide.

## Architecture (see ADR-0003)

pnpm monorepo:

```
packages/core      Pure TypeScript domain: model, keyword extraction, query language, party rules, analysis.
                   No DOM, no framework, no network, no Date.now() without injection. 100% unit-testable.
packages/pipeline  Node scripts: fetch the sheet → validate → normalise → enrich → emit versioned JSON.
apps/web           The UI only (SvelteKit 3, ADR-0002). Depends on core through small service interfaces.
                   Never re-implements domain logic.
tools/             Repo tooling (ESLint boundary rules and their tests).
```

Hard boundaries, enforced by `tools/eslint/boundaries.js` (tested), `.dependency-cruiser.cjs` and tsconfig `lib`/`types`:
- `core` imports nothing from `web` or `pipeline`, and nothing browser- or Node-specific.
- `web` never parses trait text or evaluates queries itself — it calls `core`. Only `@atlas/core`, never its internals.
- Data access goes through a `TraitRepository` interface (static JSON in production, fixtures in tests).

## Engineering conventions

- TypeScript `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`. No `any`; use `unknown` + narrowing.
- Pure functions and immutable data in `core`. Side effects live at the edges (pipeline I/O, web stores).
- Extensibility through **registries** (keyword taxonomy, query fields, lint rules, analysis rules): adding one must not
  require editing the engine (open/closed). SOLID; small modules with one reason to change.
- Patterns already decided: Composite + Interpreter (query AST), Visitor (evaluate / highlight / explain / serialise),
  Strategy (sorting, slot picking), Repository (data), Command (party edits → undo/redo), Registry.
- Names: `camelCase` functions, `PascalCase` types, `kebab-case` files (Svelte components too). Named exports only
  (tool config files excepted).
- Tests next to code: `foo.ts` + `foo.test.ts`. Vitest for unit, Playwright for e2e (`apps/web/e2e/`).
- Commits: Conventional Commits (`feat(core): …`, `fix(web): …`), one slice per commit, directly on `main`.
- Accessibility is a requirement, not polish: WCAG 2.2 AA (details in `docs/DESIGN.md`).

## Commands

```
nvm use                  # Node 24 (.nvmrc); pnpm comes from corepack (packageManager field)
pnpm install
pnpm dev                 # web dev server
pnpm test                # all unit tests (Vitest projects: core, pipeline, tools)
pnpm test:e2e            # Playwright: desktop Chromium, Pixel 7, iPhone 14 WebKit; builds first
pnpm lint                # ESLint + Prettier check + dependency-cruiser
pnpm typecheck
pnpm check               # lint + typecheck + test — the gate before every commit (also the pre-push hook)
pnpm build               # static site into apps/web/build (BASE_PATH=/siralim-ultimate-teambuilder for Pages)
pnpm format
pnpm pipeline:fetch      # download the sheet into packages/pipeline/.cache (retries; needs network)
pnpm pipeline:build      # cache → apps/web/static/data/traits.<hash>.json + manifest.json, report in .cache/report.md
                         # (flags: --input <csv> --output <dir> --report <file>; writes nothing if the data is unchanged)
```

Keep this section accurate when scripts change.

## Working agreement (no reviewer, ADR-0007)

Before every commit, self-review the diff as a strict reviewer would:
- Behaviour matches GAME_RULES / SPEC; nothing from a later phase slipped in.
- New `core` behaviour has tests written first, including edge cases and the failure path; tests assert behaviour,
  not implementation details.
- Boundaries respected; no duplicated logic; no dead code, debug output or unexplained `eslint-disable`.
- Names say what things are; a reader understands each module without its callers.
- Docs updated in the same commit when behaviour, rules or decisions change.
- A new dependency is justified in one line in the commit body (prefer none).

A bug reported by the owner: reproduce it with a failing test, then fix, in one commit.

## Definition of done (every slice)

1. Tests for every new behaviour; written first for parser, extractor and rules (TDD).
2. `pnpm check` passes locally; e2e passes for touched flows; CI green on `main` after the push.
3. axe reports no violations on touched pages (e2e runs axe).
4. Docs and `docs/PLAN.md` updated.

## Support files hygiene

`docs/PLAN.md` is the only progress file. Keep it lean: overwrite *Resume here*, collapse finished milestones to one
line, never log step-by-step work (git history does that), delete notes that are no longer true. Do not create other
status or log files.

## Data rules

- The dataset comes **only** from the pipeline. Never hand-edit generated JSON. Corrections to keyword roles go in
  `packages/pipeline/overrides.yaml`, each with a `reason:` citing the trait.
- Fixtures for tests are generated from the **real** sheet (a pinned snapshot), not from the prototypes.
- Trait IDs are stable slugs (see SPEC § Identity). Never use array indices in URLs or saved state.
- Credit the compendium authors in the footer. The data belongs to the community; the app does not redistribute it
  in other formats.

## Prototype caveats (`docs/prototype/`)

The `*.dc.html` files were made in a design tool. They run a working mini-engine and are the best reference for
*behaviour and layout*, but:
- the dataset inside is a 33-row **sample** and several descriptions are **truncated** (`…`) — never use it as data;
- the engine is copy-pasted per file, uses `var` globals and index-based share links — do not port the code;
- keyword-role detection there is a first heuristic; the spec version has overrides and dataset-wide snapshot tests;
- where a prototype disagrees with `GAME_RULES.md` or `SPEC.md`, the documents win.
