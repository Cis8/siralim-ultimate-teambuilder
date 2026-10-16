# ADR-0007 — Trunk-based development, no pull-request review

- Status: Accepted (owner, 2026-10-16)
- Date: 2026-10-16

## Context
This is a personal tool. The owner wants maximum development speed with minimum personal effort: no time spent reviewing
pull requests. Problems are found by using the app and reported back.

## Decision
- Claude Code commits **directly to `main`**, one small Conventional Commit per slice of `docs/PLAN.md`.
- Quality is enforced by gates instead of review: `pnpm check` (lint, typecheck, unit tests) runs locally before every
  commit and as a pre-push hook; CI on `main` also builds and runs e2e + axe. A red `main` is fixed before new work.
- The rules a reviewer would apply live in `CLAUDE.md` (working agreement, self-review checklist, definition of done).
- A bug reported by the owner is first reproduced by a failing test, then fixed.
- The nightly **data refresh still opens a PR** (ADR-0004): a bad edit to the sheet must not reach `main` unseen. Claude
  reviews the change report and merges it at the start of a session; the owner is not involved.

## Consequences
- No review latency; history on `main` is the record of what shipped.
- Tests, lint rules and the dataset snapshot carry the full weight of quality control, so they must stay strict.
- New dependencies are justified in the commit body instead of a PR description.
