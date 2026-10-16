# Trait Atlas — Specification

Source of truth for behaviour. Game rules live in `GAME_RULES.md`, the search language in `QUERY_LANGUAGE.md`,
visual rules in `DESIGN.md`, delivery order in `ROADMAP.md`.

## 1. Product

**Problem.** Siralim Ultimate has 1,000+ creatures, each with a trait (1,780 trait rows in the compendium v2.0). In game, browsing them is slow; the community
compendium (a Google Sheet) is complete but has no keyword logic, no AND/OR, no role awareness and no build tooling.

**Users.** Players who theorycraft parties: they look for traits by mechanic ("what applies Snared?"), combine
conditions, and check whether a party's traits actually feed each other. They use both desktop (long sessions) and
phone (while playing).

**Principles.**
1. *Mechanics first*: keywords and their roles (applies vs relies on) are first-class, not free text.
2. *Everything is a link*: every search and every party is a shareable URL.
3. *Explain, don't just filter*: show why a result matches and why a party has a gap.
4. *Fast on a phone*: the full dataset is searched locally, as you type.

**Non-goals.** Accounts, server storage, editing the compendium, combat simulation, damage calculation.

## 2. Data source

- Compendium sheet ID `1qvWwf1fNB5jN8bJ8dFGAVzC7scgDCoBO-hglwjTT4iY`, tab **Traits** (`gid=0`). Other tabs (Spells,
  Relics, Cards, …) are out of scope for now; design the pipeline so a tab is a pluggable source.
- Fetch: `https://docs.google.com/spreadsheets/d/<id>/gviz/tq?tqx=out:csv&gid=<gid>`.
- Shape observed (Traits): leading rows with a title and a version note (e.g. `"Siralim Ultimate","","Version 2.0"`),
  then the header `Class, Family, Creature, Trait Name, Trait Description, Material Name`, then one row per trait.
- Special values: `Material Name = "No Material Exists"` → `material: null`. `Creature = "Mastery Trait"` and
  `"Backer Trait"` mark non-creature traits.
- Observed in v2.0: **1,780 rows**, 11 classes, 166 families, no duplicate family + trait name. Kinds per GAME_RULES R7.

## 3. Domain model (`packages/core`)

```ts
type ClassName = string;            // "Death", "Life", …; open set, see GAME_RULES R7
type TraitKind = 'creature' | 'avatar' | 'mastery' | 'backer' | 'other';   // GAME_RULES R7

interface Trait {
  id: TraitId;                      // stable slug, see §5
  name: string;                     // "Sin and Sentence"
  creature: string | null;          // null for mastery/backer
  family: string;
  class: ClassName;
  kind: TraitKind;
  description: string;
  material: string | null;
  stacks: boolean;                  // false if text contains "This trait does not stack"
  randomDebuff: RandomDebuffSource | null;     // GAME_RULES R5
  masteryFamily: string | null;                // mastery only: the Family column, GAME_RULES R3
  partyRequirement: PartyRequirement | null;   // mastery only: parsed from the text, GAME_RULES R3
  keywords: KeywordHit[];           // ordered by position in description
  conditionalSources: KeywordKey[];  // buffs/debuffs applied only as "whichever of these the target lacks", GAME_RULES R10
}

interface RandomDebuffSource {
  target: 'enemy' | 'self_or_allies' | 'both';
  activation: 'unconditional' | 'conditional';
  note?: string;                    // what a conditional source depends on
}

type PartyRequirement =             // GAME_RULES R3; `families` holds plural forms resolved to family names
  | { type: 'allFamily'; families: string[] }
  | { type: 'distinctFamilyCount'; families: string[]; count: number }
  | { type: 'perFamilyCount'; families: string[] }
  | { type: 'classDiversity' }
  | { type: 'familyScoped'; families: string[] }
  | { type: 'none' };

interface KeywordHit {
  key: KeywordKey;                  // "vulnerable", "start of battle", "barrier", …
  kind: 'debuff' | 'buff' | 'effect' | 'mechanic' | 'trigger' | 'flag';
  role?: 'applies' | 'uses' | 'resists';   // only for debuff/buff/effect; `resists` = guards against it (R9)
  span: [start: number, end: number];
}

interface PartyMember { innate: TraitId | null; fused: TraitId | null; artifact: TraitId | null; }
type Party = readonly [PartyMember, PartyMember, PartyMember, PartyMember, PartyMember, PartyMember];
```

Derived per member (GAME_RULES R2): `family` from innate, `class` from fused if present, else innate.

## 4. Keyword extraction

- **Taxonomy as data** (`packages/core/src/taxonomy/*.ts`): debuffs, buffs, mechanics, triggers, flags — each entry has
  `key`, `label`, `kind`, `patterns` (one or more phrases), for triggers a `phase` (see §8.5), and for debuffs
  `canBeRandomlyApplied` (GAME_RULES R8).
- **Buffs and debuffs come from canonical lists** (20 debuffs, 18 buffs; Barrier is a buff), transcribed once with a
  source note, not classified by hand:
  [wiki Buffs](https://siralimultimate.wiki.gg/wiki/Buffs), [wiki Debuffs](https://siralimultimate.wiki.gg/wiki/Debuffs),
  [Codex Reference](https://steamcommunity.com/sharedfiles/filedetails/?id=2197484456). When they disagree with the
  compendium v2.0, v2.0 wins and the pipeline report lists the discrepancy: the entry keeps the canonical name in
  `canonicalName` (the compendium writes "Stoned" for the canonical "Stone").
- **Effects** (GAME_RULES R11) are what traits give and build on beyond the canonical lists, found in the compendium: Sealed
  (Seal, Seals, Sealed), Dire Wolves, Zombies, Mega Magic. They have roles like buffs and debuffs but match without regard
  to letter case, and an effect can name its active forms ("Seals"): written that way the trait is the one doing it
  (`applies`); "that Spell Gem is Sealed" is also given, "for each Sealed Spell Gem" relied on, "cannot be Sealed" guarded
  against. Charges, Cascading (Spell Gem properties) and Fused are plain mechanics, without a role.
- `createTaxonomy` rejects a taxonomy with duplicate keys, a pattern shared by two entries, or patterns that are not
  plain text, and lists all violations at once.
- Mechanics and triggers start from the prototypes; the pipeline also reports frequent capitalised words not in the
  taxonomy so the lists can grow.
- **Matching**: whole words, longest match wins. Phrases, mechanics and triggers ignore letter case; buffs and debuffs
  are names and count only when written as the taxonomy writes them ("gain Immune" is the buff, "immune to damage" and
  "weak against" are not: case-insensitive matching gave 25 such false positives on v2.0). A status followed by a
  capitalised word is the start of a longer name ("Savage Spores" is not Savage). A run of blanks matches the
  space of a pattern and a curly apostrophe a straight one, without moving spans.
- **Role detection** for buffs and debuffs (`assignRoles`; heuristic, then overrides), per sentence:
  - a status in the condition the sentence opens with (After / When / If / While / … up to the first comma) is one the
    trait waits for → `uses` ("After an enemy is afflicted with Weak, …");
  - otherwise the nearest signal before it decides. `applies`: `afflict(s/ed) … with`, `gain(s)`, `grant(s)`/`give(s)`,
    `always has/have`, `is/are always`, `battles with`. `uses`: `has/have`, `damage from`,
    `enemies/creatures with`, `creatures afflicted with`, `for each … afflicted with`, `if/while/when … afflicted with`
    inside a sentence, `cannot gain`. Where two end together the one that starts first wins
    ("afflicts enemies with" over "enemies with", "always has" over "has");
  - a status after another in a list ("Poisoned, Burning and Bomb", "Weak or Vulnerable") takes its role;
  - protection (`immune/resistant to`, `avoid`, `less damage from`, `no longer takes damage from`, `cannot be`) → `resists`
    (GAME_RULES R9); "cannot be immune to" is the reverse and stays `uses`;
  - no signal → `uses` (e.g. "Enemies' Burning debuff lasts forever").
  On v2.0 it gives 311 `applies`, 270 `uses` and 21 `resists` (the first 537 mentions, buffs and debuffs, are
  275 / 244 / 18). All 537 mentions were read by hand (M3.7): the cues above came from
  that reading, and 11 mentions it could not tell apart are in `overrides.yaml` (conditional grants such as "As long as
  this creature hasn't gained or lost speed, it has … and has Agile", and a Barrier named again as a reference).
- **Conditional sources** (`detectConditionalSources`, GAME_RULES R10): a sentence with "whichever of these debuffs
  (buffs) …" makes the trait a conditional source of every buff and debuff it names. They stay `uses` in `keywords`,
  since the trait waits for them; `conditionalSources` records the other half. Four traits on v2.0.
- **Overrides** (`packages/pipeline/overrides.yaml`, `parseOverrides` / `applyOverrides`): two sections, `roles` (trait
  id, keyword key, optional `occurrence` counting from 1 or all mentions, `role`) and `randomDebuff` (trait id, `target`,
  `activation`, optional `note`; GAME_RULES R5). Every entry needs a `reason` citing the trait; unknown fields are refused.
  An entry naming a trait, a keyword the trait does not mention, an occurrence it does not have, or a keyword without a
  role fails the build; two entries for one mention conflict; an entry that changes nothing is a warning.
- **Snapshot tests** over the pinned v2.0 sheet, as committed files in `packages/pipeline/snapshots/`: one line per
  mention, `trait | key | role` (`keywords-v2.0.txt`, 2,299 lines), and one per random-debuff trait, `trait | target |
  activation | note`. Any change to the taxonomy, the heuristics or `overrides.yaml` shows in the diff and must be read
  and approved; refresh with `pnpm exec vitest run -u`.
- Done in the **pipeline** (build time), not at runtime; `core` exposes the same extractor so tests and the pipeline
  share code.

## 5. Identity and versioning

- `TraitId` = slug of `family` + `--` + slug of `name` (e.g. `abomination--sin-and-sentence`), made unique
  deterministically. It must not change when rows are reordered.
  - Slug: lowercase ASCII, accents stripped, apostrophes dropped (`Mother's` → `mothers`), `&` → `and`, any other
    run of characters → one hyphen.
  - Collisions: `assignTraitIds` can make them unique (rows ranked by family, name, class, creature, description,
    material; the first keeps the plain id, the others get `-2`, `-3`, … skipping ids another row owns), but the
    pipeline does not use that: a collision makes the build fail (§6), because a suffix depends on how the rows
    rank and an edit to one description could swap two ids. v2.0 has no collisions.
  - A family or name with nothing left after slugging fails the build.
- The dataset carries `datasetVersion` (the sheet's "Version x.y") and a content hash.
- Saved/shared state stores TraitIds plus `datasetVersion`. When an ID is unknown in the current dataset, the UI keeps
  the slot, marks it "not found in vX", and offers a search for the old name.

## 6. Data pipeline (`packages/pipeline`)

1. **Fetch** CSV per configured tab (with retry; cache to `.cache/`).
2. **Locate header** row by column names; read version from the preamble.
3. **Validate** with a zod schema; fail on missing columns, an empty cell in any column (Material Name included: the
   explicit marker below is the only way to say "no material"), or two rows with the same id. All row problems are
   reported at once.
4. **Normalise**: trim, collapse blanks (spaces, tabs, line breaks, non-breaking spaces) to one space, curly quotes to
   straight ones, map special values (§2).
5. **Enrich**: kind, stacks, random-debuff flag, mastery condition, keywords + roles, overrides.
6. **Emit** `traits.<hash>.json` (schema-versioned) and `manifest.json` `{datasetVersion, hash, count, generatedAt}`.
   The hash is the first 16 hex digits of the SHA-256 of the dataset file, which holds the traits sorted by id, one
   per line (reviewable diffs, no dependence on row order). Time never enters the hash. When the directory already
   holds the same hash nothing is rewritten, so an unchanged sheet leaves the tree clean. Compendium v2.0: 704 KB,
   about 100 KB gzipped.
7. **Report** (Markdown, `buildReport`): the diff against the previous build (added / removed / changed traits, by id
   and field); counts per kind, class, mastery requirement, keyword role and random debuff; a *Taxonomy* section with
   the candidates (capitalised terms in at least 3 traits that no keyword covers, that are no name of a trait,
   creature, family or material, and that `REVIEWED_NON_KEYWORDS` does not rule out; flagged when they follow "gains" or
   "afflicted with", as a new buff or debuff would) and the differences with the canonical buff and debuff lists; and
   *Needs attention* (classes outside GAME_RULES R7, masteries whose requirement names no known family, override
   warnings).

GitHub Actions: nightly + manual run. If the output changed, open a PR with the report as description; the workflow
runs the full check suite itself (PRs opened with `GITHUB_TOKEN` do not trigger CI). Claude reviews and merges these
PRs at the start of a session (ADR-0007). Never deploy data that has not been through a PR.

## 7. URL state

Every view is reproducible from its URL (query string for search, compact party encoding):
- Search: `?q=<query>&class=life,nature&kw=a:vulnerable,u:weak&mode=all&mat=1&sort=az`
- Party: `?party=<base64url of [datasetVersion, 18 TraitIds-or-empty]>&target=<slot>`
The URL is the source of truth; local storage keeps only conveniences (recent searches, saved searches, last party).

## 8. Features

### 8.1 Explore (Phase 1)
Query bar (QUERY_LANGUAGE), facets (class: any-of; keywords: per keyword "applies"/"uses" toggles with match all/any;
triggers; mechanics; flags: artifact-eligible, does-not-stack), result list with keyword tokens styled by kind and role,
match highlighting, and click-a-keyword → counterpart jump (applies ↔ uses). Facet counts reflect the current results
(class counts ignore the class filter itself). An "effective query" line shows the full query the UI state stands for.

### 8.2 Party planner (Phase 1)
6 × 3 slots (GAME_RULES R1), a target slot that results fill, slot validation with a reason, basic coverage
(applies / relies on / missing sources, non-stacking duplicates), share link, undo/redo (Command pattern).

### 8.3 Smart search (Phase 2)
Syntax highlighting in the input, autocomplete by context, inline diagnostics with one-click fixes, plain-language
"reads as", ghost completion, recent and saved searches, mobile syntax toolbar. Full rules in `QUERY_LANGUAGE.md`.

### 8.4 Synergy explorer (Phase 2)
- *By trait*: **Enabled by** (traits applying any key the focus uses, grouped by key), **Enables** (traits using any key
  the focus applies), link score = number of distinct keys linking two traits, **Alternatives** (same role overlap),
  **Same trigger**, **Same family** (mastery first). Random-debuff traits appear in Enabled-by lanes for debuffs, ranked last
  and labelled "random". Breadcrumb trail; click to re-centre.
- *By keyword*: appliers vs users, verdict (`No source` if 0 appliers; `No payoff yet` if 0 users;
  `Scarce enabler` if appliers × 2 < users; else `Well supported`), keywords often applied together.

### 8.5 Party analysis (Phase 3)
- Health tiles: dependencies covered, mastery state, conflicts, open slots.
- Issues ordered by severity: missing (critical) → random/conditional → inactive mastery → non-stacking duplicates →
  invalid slot placement (critical). Each has an action.
- Suggestions, two modes: *Fix gaps* (traits applying missing/random/conditional keys) and *Add payoffs*
  (traits using keys applied by a covered source). Ranking: `10 × keys fixed + 4 if a slot fits − 3 if it breaks an
  active mastery family + 2 if it keeps it − 1 if it does not stack`. Slot choice: the user's target slot if valid;
  otherwise prefer Fused/Artifact of existing members (creatures unchanged), then an empty Innate.
- Coverage matrix (keys × members), trigger timeline by battle phase (start of battle → start of turn → attacking →
  being attacked → spellcasting → kills and deaths → always on), composition (classes per GAME_RULES R2, families).

## 9. Non-functional requirements

| Area | Target |
|---|---|
| Performance | Initial JS ≤ 150 KB gzip; data ≤ 300 KB gzip; search + facet recount ≤ 16 ms per keystroke on the full dataset on a mid-range phone; result list virtualised |
| Accessibility | WCAG 2.2 AA; axe clean; full keyboard use; see DESIGN § Accessibility |
| Browsers | Last 2 versions of Chrome, Firefox, Safari, Edge; iOS Safari 16+ |
| Offline | Phase 1: none required. By end of Phase 3: PWA, data cached, works offline |
| Reliability | App keeps working with the last good dataset if the sheet changes shape |
| Privacy | No tracking, no cookies; local storage only for user conveniences |
| Legal | "Unofficial" label; credit and link to the compendium and its authors; ask the authors' permission before launch |
