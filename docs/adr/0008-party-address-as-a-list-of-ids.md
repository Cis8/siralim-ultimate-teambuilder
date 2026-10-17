# ADR-0008 — The party is written in the address as a list of ids, not as base64

- Status: Accepted
- Date: 2026-10-17
- Amends: ADR-0005 (the last consequence, "base64url of a small array")

## Context
ADR-0005 expected the party to be a base64url of `[datasetVersion, 18 ids]`. Trait ids are slugs (SPEC §5), already safe in
an address, and the longest of v2.0 has 45 characters. Base64 of the JSON text of eighteen such ids is about 1,000
characters, a third more than the ids themselves, and it needs bytes and UTF-8 in `core`, which has no DOM and no Node types.
The address is pasted into chats, where a list of readable ids says more than an opaque blob, and the search already writes
its lists (`class=`, `kw=`) as comma-separated items with `%2C` and `%25` escapes.

## Decision
`party=<datasetVersion>,<id of slot 1>,…,<id of slot 18>` in reading order (creature by creature, Innate, Fused, Artifact),
an empty item for an empty slot and the empty slots at the end left out; `target=<1–6>-<innate|fused|artifact>`, written
only when it is not the first empty slot. The list is written and read by the helpers the search codec uses
(`url/url-params`). An empty party with its target on the first slot writes nothing.

## Consequences
- Eighteen of the longest ids of v2.0 make an address under 1,000 characters with every comma escaped (a test over the
  pinned snapshot keeps it so); with the readable commas the address is shorter still.
- No encoding step can fail on a hand-edited link: an item is an id or it is empty, and an id the dataset does not know is
  kept (SPEC §5).
- The version travels with the party, so the page can say a link was made on another one.
- A different format later means a new `party` value the old reader rejects as an empty party: change the name of the
  parameter, not the meaning of this one.
