# ADR-0003 — Framework-free `core` package with ports and adapters

- Status: Accepted
- Date: 2026-10-16

## Context
Search, keyword roles, synergies and party analysis are the product. They must be correct, testable and reusable by both
the pipeline (build time) and the web app (runtime).

## Decision
pnpm monorepo with three packages:
- `packages/core`: pure TypeScript. Domain model, taxonomy, keyword extraction, query language (lexer → parser → AST →
  visitors), relations, party rules and analysis. No DOM, Node or framework imports.
- `packages/pipeline`: Node I/O around `core` (fetch, validate, emit).
- `apps/web`: UI. Talks to `core` through small services (`SearchService`, `PartyService`, `SynergyService`,
  `AnalysisService`) built at one composition root, with data from a `TraitRepository`.

Extension points are registries (taxonomy entries, query fields, lint rules, autocomplete providers, analysis rules), so
new behaviour is added, not edited in (open/closed). Dependency direction is enforced by lint rules.

## Consequences
- Most bugs are caught by fast unit tests in `core`.
- The same extractor runs in the pipeline and in tests, so the snapshot of roles is trustworthy.
- Slight upfront cost in interfaces; keep them small and only where a second implementation is real (repository, rules).
