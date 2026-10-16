# ADR-0004 — Build-time data snapshot, refreshed by a reviewed PR

- Status: Accepted
- Date: 2026-10-16

## Context
The compendium is a community Google Sheet that changes occasionally and may change shape. Fetching it live from every
browser would make the app depend on Google's availability and CORS, and a bad edit would break every user at once.

## Decision
A pipeline fetches the sheet's CSV export, validates it against a schema, enriches it (IDs, keywords, roles, flags) and
emits a versioned JSON file served with the site. A scheduled GitHub Action runs it nightly and opens a pull request with
a change report when the output differs. Only merged data is deployed.

## Consequences
- The app always loads a known-good dataset; failures are visible in CI, not in users' browsers.
- Keyword-role changes are reviewed through the snapshot diff.
- Data freshness is "next merge", not instant. Acceptable for a reference tool.
- The fetch step needs network access to `docs.google.com` in CI and in the developer's environment.
