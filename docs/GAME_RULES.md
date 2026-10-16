# Game rules (confirmed)

These are the Siralim Ultimate rules the app relies on. They were confirmed by the product owner, who plays the
game. **Code must never contradict this file.** When a new rule is needed, ask, then add it here with the date.

Status legend: **Confirmed** · **Assumed** (reasonable default, still to verify; build so it is easy to change).
Counts quoted below are from the compendium **v2.0** (1,780 trait rows) and are asserted by pipeline tests.

## R1 — Party shape · Confirmed (2026-10-16)
A party has **6 creatures**. Each creature has up to **3 trait slots**:

| Slot | What it holds | Accepts |
|---|---|---|
| Innate | The trait of the creature itself (the *first* creature of a fusion) | `creature` and `avatar` traits |
| Fused | The trait of the *second* creature of a fusion | `creature` traits only |
| Artifact | A trait granted by an artifact material | Any trait whose `material` is not null |

A trait with `Material Name = "No Material Exists"` can never sit in the Artifact slot. Kinds are defined in R7;
special kinds are artifact-only (R6).

## R2 — Fusion: what each creature contributes · Confirmed (2026-10-16)
For a fused creature:
- **Family, personality, skin** and the **innate trait** come from the **first** creature.
- **Class** (Chaos, Death, Life, Nature, Sorcery) comes from the **second** (fused) creature, along with its trait.

Consequences:
- `member.family = innate.family` always.
- `member.class = fused ? fused.class : innate.class`.
- Anything that counts classes (composition, class-based traits) uses `member.class`.
- Anything that counts families (mastery conditions, family-based traits) uses `member.family`.

## R3 — Mastery traits · Confirmed (2026-10-16)
Mastery traits are the rows with `Creature = "Mastery Trait"` (class `Rodian Master`, 156 rows). Two separate facts are
recorded for each:
- **`masteryFamily`**: the family the trait belongs to, taken from the **Family column** (never parsed from the text).
- **`partyRequirement`**: what the party needs for the trait to matter, parsed from the text.

Not every mastery without "If all…" is unconditional. Requirement types observed in v2.0:

| Type | Wording | Rows |
|---|---|---|
| `allFamily` | "If all the creatures in your party are X" / "…belong to the X race" | 76 |
| `distinctFamilyCount` | "If you have 6 different X in your party" | 2 |
| `perFamilyCount` | effect scales "for each X fighting on your side" / "in your party" | 24 |
| `classDiversity` | "for each different class…" / "a creature from each class" (Master of Mirelings) | 1 |
| `familyScoped` | the effect targets "your X" creatures, no explicit party condition | 52 |
| `none` | no requirement (Master of Diabolic Horde) | 1 |

Conditions are evaluated on **innate creatures only** (their family), never on fused or artifact traits. An empty
party never satisfies a condition. A mastery trait whose requirement is not met is **inactive**: whatever it applies
is only a *conditional* source.

**Phase 1:** every mastery trait counts as a potential source; activation is evaluated from M14 on.

## R4 — "This trait does not stack" · Confirmed (2026-10-16)
Non-stacking is **party-wide**: if the same non-stacking trait appears more than once anywhere in the party
(any member, any slot), only one copy has an effect. Duplicates are a conflict to report.

## R5 — Random debuffs · Confirmed (2026-10-16)
A trait that afflicts "a random debuff" (e.g. Pandemic, Slosh; 30 rows mention it) records:
- **`target`**: `enemy` | `self_or_allies` | `both`.
- **`activation`**: `unconditional` | `conditional` (with a short note saying what it depends on).

Only **`target: enemy`** traits count as random sources (the *enemy-only* set). Going Mad and Dusty Struggle
(`self_or_allies`) and Glitch In The System (`both`) are excluded from it. Conditional traits stay in the set, flagged
conditional: Grim Ailment (only after your creatures apply a debuff), Flubris's Entrapment (only when an enemy takes
Poisoned or Burning damage).

An enemy-only random source is a **weak source of every debuff that can be randomly applied** (R8): it never makes a
dependency fully *covered*, but it upgrades *missing* to *random-only*.

Detection is a regex plus reviewed entries in `packages/pipeline/overrides.yaml`.

## R6 — Special slots for special traits · Confirmed (2026-10-16)
- **Mastery, Backer, Nether Boss, Boss, Pandemonium, Nether Room** traits can only sit in the **Artifact** slot.
- **Avatar** traits can only sit in the **Innate** slot: an Avatar cannot be the second creature of a fusion.

## R7 — Classes and kinds · Confirmed (2026-10-16)
The five creature classes are **Chaos, Death, Life, Nature, Sorcery**. v2.0 also has Rodian Master (156 rows),
Backer (135), Nether Boss (105), Boss (10, Zantai materials), Pandemonium (9) and Nether Room (3).

| Kind | Rule | Rows in v2.0 |
|---|---|---|
| `creature` | creature class, family is not `Avatar` | 1,331 |
| `avatar` | creature class, family `Avatar` | 31 |
| `mastery` | `Creature = "Mastery Trait"` | 156 |
| `backer` | `Creature = "Backer Trait"` | 135 |
| `other` | any other class (Nether Boss, Boss, Pandemonium, Nether Room) | 127 |

*Assumed:* a class never seen before maps to `other` (artifact-only) and is flagged in the pipeline report until the
owner confirms it.

## R8 — Buffs and debuffs · Confirmed (2026-10-16)
The buff and debuff lists come from canonical sources (SPEC §4), not from manual classification. Each debuff records
whether it **can be randomly applied**: Inverted and Mania cannot. When the sources disagree with the compendium v2.0,
v2.0 wins.

## R9 — Protection is not a dependency · Confirmed (2026-10-16)
A trait that only guards against a buff or debuff does not rely on anyone applying it: "immune to Silenced", "resistant to
Burning", "50% chance to avoid Scorned", "takes 90% less damage from Bleeding", "cannot be Sealed". Its mention has the role
`resists`: not `applies`, not `uses`, so the analysis never calls that buff or debuff a missing source. Searching for it
still works by keyword (`kw:`). Recovering health from a debuff instead of taking damage is not protection: it needs the
debuff to be there (`uses`).

## R10 — Pairs: "whichever of these debuffs the target doesn't already have" · Confirmed (2026-10-16)
Flesh Rot, Here to Die, Scared Stiff and Kindling wait for an enemy to be afflicted with one debuff of a pair and then afflict
it with the other. Both debuffs are named only as the trigger (`uses`), but the trait is also a **conditional source** of
each of them: `conditionalSources` on the trait lists the pair. A conditional source never makes a dependency fully
*covered* (it needs the other debuff of the pair to be there first); it upgrades *missing* to *conditional*.

## R11 — What else is searchable · Confirmed (2026-10-16)
Builds are made of more than the canonical buffs and debuffs, so more is a keyword:
- **Effects**, with roles like a buff (a trait gives, relies on or guards against them): **Sealed** (Seal, Seals, Sealed
  Spell Gems), the stacking minions **Dire Wolves** and **Zombies**, and **Mega Magic**. A trait that relies on Dire Wolves
  needs a source of them, exactly as one that relies on Vulnerable needs one (see the table below).
- **Mechanics**, without a role: the Spell Gem properties **Charges** and **Cascading**, and **Fused**.

## Dependency statuses (derived from R3–R5, R9–R11)
For each buff, debuff or effect that at least one party trait **relies on** (`uses`; a mention that only `resists` it is no dependency, R9):

| Status | Meaning | Severity |
|---|---|---|
| `covered` | At least one active, specific source applies it | ok |
| `random` | No specific source, but an active enemy-only random source exists and the debuff can be randomly applied (debuffs only, never effects) | warning |
| `conditional` | Only inactive mastery traits apply it, or only conditional sources (R10) | warning |
| `missing` | Nothing in the party applies it | critical |
| `nopayoff` | Applied, but nobody relies on it (informational, not an issue) | none |

Order of evaluation: `covered` → `random` → `conditional` → `missing`.

## Open questions
1. Are there traits that apply buffs or debuffs **to allies** vs **to enemies**, and does the app need to tell them
   apart beyond random debuffs (R5)? Today "applies Shelled" and "applies Weak" are treated alike.
2. Should "When X is afflicted with Y" triggers count as relying on Y? (Currently yes.)
3. Before M14: when is a `perFamilyCount`, `familyScoped` or `classDiversity` mastery *active*? (Likely "at least one
   innate creature of that family", to confirm.)
4. Before M14: Master of Diabolic Horde changes your creatures' race at the start of battle. Does that satisfy other
   masteries' family requirements?
5. Dusty Struggle ends with "This trait will not activate if another creature in your party has it as well" instead of
   "This trait does not stack". It is the only trait with that wording. Should it count as non-stacking (R4)? Today
   its `stacks` is `true`, because only the exact sentence counts.
