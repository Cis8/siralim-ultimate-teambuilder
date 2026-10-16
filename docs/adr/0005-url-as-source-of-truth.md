# ADR-0005 — The URL is the source of truth for searches and parties

- Status: Accepted
- Date: 2026-10-16

## Context
Theorycrafting is social: players share searches and parties on Discord and Reddit. There is no backend (ADR-0001).

## Decision
Every view state that matters (query, facets, sort, party, target slot, synergy focus) is encoded in the URL and restored
from it. Parties are encoded with **stable trait IDs plus the dataset version**, never array indices. Local storage holds
only conveniences: recent and saved searches, the last party.

## Consequences
- Back/forward and reload work as expected; links are durable across dataset updates.
- URL length must stay reasonable: use a compact encoding (base64url of a small array) for parties.
- Unknown IDs after a dataset update are shown as "not found in vX" with a search for the old name, never silently dropped.
