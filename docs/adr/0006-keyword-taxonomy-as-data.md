# ADR-0006 — Keyword taxonomy as data, roles by heuristic plus overrides

- Status: Accepted
- Date: 2026-10-16

## Context
Trait descriptions are free text. The app's value comes from recognising mechanics (Weak, Vulnerable, Barrier, "start of
battle") and whether a trait *applies* a buff/debuff or *relies on* it. Full NLP is overkill; pure manual tagging of
1.2k traits is too slow to maintain.

## Decision
- The taxonomy (debuffs, buffs, mechanics, triggers with battle phase, flags) is a typed data module in `core`.
- Matching is longest-phrase, case-insensitive, word-bounded.
- Roles come from a small sentence-level heuristic (see SPEC §4), corrected by `overrides.yaml`.
- A dataset-wide snapshot of `{traitId, key, role}` is committed and reviewed on every change.
- The pipeline reports frequent unknown terms to grow the taxonomy.

## Consequences
- Good coverage quickly, with a clear path to fix mistakes without code changes.
- Overrides need a reason comment; the owner (a player) reviews them.
- If heuristics prove too weak, the override file can grow into full manual tagging without changing the runtime.
