# ADR-0009 — Events are keywords with a role and an actor, not trigger phrases

- Status: Accepted
- Date: 2026-10-17
- Amends: ADR-0006 (triggers as literal phrases with a battle phase)

## Context
The taxonomy has 11 triggers, each a literal phrase ("after this creature attacks"), and no notion of who does what. The
v2.0 sheet says far more than that: 774 opening clauses ("After/When/If/While/At …,") in 749 traits carry no trigger, and
they come in 452 forms, 358 of them seen once, because each is a subject times an event times a qualifier ("after an ally
attacks", "after your creatures are resurrected", "at the end of each enemy's turn"). The game's own words for these
are a short list of categories that trait texts name: start-of-battle, start-of-turn, end-of-turn, on-attack, on-critical,
on-cast, on-defend, on-provoke, on-dodge, on-death, on-resurrect, on-buff. A list of phrases cannot follow the
combinations, and a phrase cannot say that "this creature provokes" is what "after this creature provokes" waits for.

How this was found (slice 8b.5, research only): a deterministic census of the opening clauses and of the game's verbs, and
a sweep of all 1,780 traits by 24 Haiku agents (75 rows each, a rigid record of quote, use, actor and event, every quote
checked to be verbatim, every id accounted for). The sweep found the 567 existing trigger mentions and the 774 census
clauses without a miss; a second reading of 373 traits agreed on 92% of (trait, event) pairs. A prototype of the entries
below, run on the pinned snapshot, finds 83–100% of what the sweep found for most events. The sweep's output is a review
aid kept out of the repository; nothing it wrote ships, and every count the docs quote comes from the dataset.

## Decision
- **The `trigger` kind becomes `event`.** An event is something that happens in battle, named after the game's categories
  (GAME_RULES R12): start of battle, start of turn, end of turn; attack, cast spell, manual cast, defend, provoke; being
  attacked, dodge, critical hit, damage taken; heal, kill, death, resurrection; any buff, any debuff.
- **An event mention has a role, as a buff has**: `applies` (the trait makes it happen: "attacks 1 additional time",
  "casts a random spell", "is resurrected"), `uses` (the trait pays off when it happens: it fires on it, counts it or
  improves it: "after this creature attacks", "for each spell cast", "this creature's attacks deal 75% more damage") or
  `resists` (it prevents it: "cannot be resurrected"). The fields `applies:`, `uses:` and `kw:` and the click on a keyword
  then work for events as they do for buffs.
- **An event mention has an actor**: `self` (this creature), `ally` (your creatures, an ally), `enemy`, `any` (any
  creature); for something that happens to a creature (being attacked, death, resurrection, heal) it is that creature.
  A keyword field takes it after a slash: `uses:provoke` finds every actor, `uses:provoke/self` only this creature.
- **The start of battle is a moment, not an act**: nobody makes a battle start, so a mention of it has no actor and is never
  `applies` ("Your Crusaders start battles with Shelled" waits for the start). The other events keep the actor the text names.
- **Turns are read by a small grammar** ("start|end of <whose> turn(s)"), since the possessive can be a family
  ("your Phoenixes' turns") and patterns are plain text. "attack" written as a stat ("50% more attack") is not an event.
- **The 11 old trigger keys stay valid as aliases** of an event and an actor (`after this creature attacks` →
  `attack/self`), read by the keyword fields and by the address. A shared link finds what it found before, and possibly
  more: an alias names the event, not the old phrase.
- **Two plain mechanics** join the others: Spells (spell, spells: the traits about spells that cast none) and Stats (stat,
  stats).
- **No event is ever a dependency** (GAME_RULES R12): party coverage lists buffs, debuffs and effects only.

## Consequences
- About 2,200 more mentions on v2.0 (2,299 → 4,453, with Spells and Stats) and ~20 kB more gzipped data (139 of the 300 kB
  budget); the snapshot file grows by as many lines, each read before it is accepted.
- A query that used the start of an old phrase (`kw:after`) no longer finds it: only whole old keys are aliases.
- Every new form of an event in a future sheet needs a pattern, so the report lists event words no keyword covers, as it
  lists capitalised terms today.
- Phase 2's relations get enablers for events for free (what applies an event enables what uses it); Phase 3's timeline
  needs a phase for each event: `endOfTurn` and `defending` join `TRIGGER_PHASES`, and heal, any buff and any debuff have
  none.
