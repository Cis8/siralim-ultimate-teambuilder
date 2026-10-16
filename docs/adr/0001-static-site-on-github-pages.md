# ADR-0001 — Static site on GitHub Pages, no backend

- Status: Accepted
- Date: 2026-10-16

## Context
The data is public, read-only and small (≈1.2k traits). Users need search, a planner and sharing. The owner wants free
hosting on GitHub Pages.

## Decision
Ship a fully static single-page app. All computation (search, relations, analysis) runs in the browser. Sharing uses the
URL; personal conveniences use local storage. Data is produced at build time by the pipeline (ADR-0004).

## Consequences
- Zero hosting cost and no server to secure or maintain.
- No accounts or cloud sync; saved items live per browser (offer JSON export/import).
- GitHub Pages has no custom headers or rewrites: use hash routing or a `404.html` SPA fallback; hashed asset names for caching.
