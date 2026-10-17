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

A slot is addressed by a `SlotPosition` `{ member: 0–5, slot: 'innate' | 'fused' | 'artifact' }`. The party holds ids, not
traits, and keeps an id the dataset does not know (§5).

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
- `createTaxonomy` rejects a taxonomy with duplicate keys, a key that is the start of another (a query finds a keyword by
  the start of its key, so the two could not be told apart: `applies:seal` would find `sealed` too), a pattern shared by
  two entries, or patterns that are not plain text, and lists all violations at once.
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
- Search: `?q=<query>&class=life,nature&kw=a:vulnerable,u:weak,k:start of battle&mode=any&mat=yes&stack=no&sort=az`
- Party: `?party=<base64url of [datasetVersion, 18 TraitIds-or-empty]>&target=<slot>`

The search codec (`ExploreState`, `decodeExploreState` / `encodeExploreState`) writes only what differs from the initial
state, so that state has no parameter at all, and reads any address: what is missing or says nothing usable is the initial
value. `q` is the query bar exactly as typed. `class` and `kw` are comma-separated lists in the order chosen, lower case,
trimmed and without repeats; a comma inside an item is written `%2C` and a percent sign `%25`. A `kw` item is a letter and a
key: `a` = `applies:`, `u` = `uses:`, `k` = `kw:` (the aliases of QUERY_LANGUAGE §2); unknown keys are kept, they match
nothing. `mode` is `all` (default) or `any`; `mat=yes` and `stack=no` are the two flags; `sort` is `book` (the order of the
dataset: by family, then trait name; default), `class` (class, then family) or `az` (trait name). The party and the tab live in other parameters that the search codec leaves alone.

**The page and its address** (`explore-address.ts`, `explore-url-writer.ts`). The page reads the address when it opens and
when the browser goes to another one (back, forward, a link); an address it cannot read is the plain page and stays as it is
until something changes. Every change of the state is written back, and the parameters that are not Explore's stay:
- typing *replaces* the current history entry once the text has stayed as it is for 400 ms, so a stretch of typing is one
  entry (and a browser's limit on how often the history may change is out of reach);
- a facet, a chip, a click on a keyword and the sort each *push* an entry, after the text typed so far has been written to
  the entry it was typed in, so that back returns to it. A state that is already the address writes nothing;
- the writes are made one after another, and an arrival by back or forward drops the text that was waiting;
- a link is written to be read: the colon of `a:vulnerable` and the comma between two items are not escaped.

Back and forward bring back the state and start the list over; they do not restore the scroll position (the list is another
one).

The URL is the source of truth; local storage keeps only conveniences (recent searches, saved searches, last party).

## 8. Features

### 8.1 Explore (Phase 1)
Query bar (QUERY_LANGUAGE), facets (class: any-of; keywords: per keyword "applies"/"uses" toggles with match all/any;
triggers; mechanics; flags: artifact-eligible, does-not-stack), result list with keyword tokens styled by kind and role,
match highlighting, and click-a-keyword → counterpart jump (applies ↔ uses). Facet counts reflect the current results
(class counts ignore the class filter itself). An "effective query" line shows the full query the UI state stands for.
The terms of the query bar are shown as chips, each with a toggle-NOT and a remove button that edit the text of the bar in
place (QUERY_LANGUAGE §4, *Chips*).

`SearchService.search(state)` gives, for an `ExploreState`, the traits in the order of the sort, the effective query and the
facets (`Facets`); any state can be searched, since the parser repairs the query bar and a name nobody has finds nothing.
- **The filters are a query.** `filterQuery` writes the class, keyword and flag filters as text of the query language and
  the search runs that very text, so the effective query is not a description of the filters but what they are: the filters
  as `class:… (applies:… OR uses:…) mat:yes stack:no`, then the query bar (an OR of its own in parentheses). Typed in the
  query bar, it finds the same traits (tested on the real sheet).
- **Classes** are any-of, written `(class:life OR class:nature)`. `class:` looks for a name inside the class, so
  `class:boss` would find Nether Boss too: a chosen class is written with the classes whose name contains it left out,
  `class:boss -class:"nether boss"`.
- **Keywords** are `applies:`, `uses:` or `kw:` terms, joined by AND (match all) or OR (match any). They use the key prefix of
  those fields, which the taxonomy keeps exact (no key is the start of another).
- **Counts.** A class is counted among the traits the other filters and the query bar find, so choosing a class does not
  empty the others. A keyword is counted among the traits shown: how many apply it, rely on it, or mention it in any role
  (`kw:`); a trigger or a mechanic has `mentions` only. The facets list the classes of the dataset from A to Z, and the
  buffs, debuffs, effects, triggers and mechanics of the taxonomy, with the counts they have, 0 included.
- **The description of a result** is cut by `descriptionParts(description, keywords, marks)` into the keywords of the trait
  (spans of the dataset, in order and apart: tested on the real sheet) and the plain text between them, each with the
  pieces that the query marks (`SearchOutcome.highlight`); a mark that crosses the edge of a keyword is one piece in each
  part, and joining the pieces gives the description back. The page asks for it only for the rows it draws.
- **A click on a keyword** of a description (`clickGoal`, `isClickOn`, `clickKeyword`) turns one filter on or off and leaves
  the query bar alone. A keyword a trait applies leads to the traits that rely on it (`uses:key`), one it relies on to the
  traits that apply it (`applies:key`): the two are sides of one keyword, so turning one on takes the other off
  (`applies:vulnerable` becomes `uses:vulnerable`, and the click shows the counterpart, not the traits that are both).
  A keyword with no side (a trigger, a mechanic, a mention that only `resists`, GAME_RULES R9) is `kw:key`; the flag "does
  not stack" is `doesNotStack`. A second click on a token whose filter is on turns it off, which leaves the other side as
  it was. The page then shows the new list from its first trait and moves the focus to the results heading, since the row
  clicked may be gone.
- **Sort** is a strategy per key: `book` keeps the order of the dataset (by family, then trait name, since the dataset is
  sorted by id, §6), `class` and `az` compare ignoring letter case, and traits that tie keep the order of the dataset.
- **The facet panel** turns the filters on and off with the same state-in, state-out functions as the click on a keyword
  (`toggleClass`, `toggleKeywordFilter`; `hasClass`, `hasKeywordFilter` tell what is on). Classes are toggles with the count of
  traits each would show; a buff, a debuff or an effect has two, *Applies* and *Relies on* (`applies:` and `uses:`), and a
  trigger or a mechanic one (`kw:`), counted by the traits that mention it. Unlike a click in a description, the panel does
  what it is told: both sides of a keyword can be on at once (traits that give it *and* rely on it with *Match all*, either
  with *Match any*). *Match all / Match any* is a pair of toggle buttons; the two flags are checkboxes.
- **The chip row** has a chip for every filter that is on (`filterChips`, `removeFilterChip`: `class:life`, `applies:vulnerable`,
  `stack:no`, in the order of the effective query, each with a remove button), then one per term of the query bar (QUERY_LANGUAGE
  §4: the term flips between included and excluded, or goes). The chips do not show the operators between the terms: the
  effective query line has the exact meaning. When a chip is removed the focus goes to the next chip's remove button, or to
  the row itself if none is left. The list starts over when a filter changes while the page is scrolled into it.
- **The effective query line** shows `SearchOutcome.effectiveQuery` with a *Copy query* button (the clipboard; if the browser
  refuses, the text is on the page to select), and is absent while there is no filter and no query.
- **Empty state.** "No trait matches." with a hint; when several keywords must all be found, the hint says to try *Match any*.

### 8.2 Party planner (Phase 1)
6 × 3 slots (GAME_RULES R1), a target slot that results fill, slot validation with a reason, basic coverage
(applies / relies on / missing sources, non-stacking duplicates), share link, undo/redo (Command pattern).

- **The party is immutable.** `emptyParty`, `traitAt(party, position)` and `withTraitAt(party, position, id | null)`, which
  gives another party and returns the very same one when the slot already holds that, so a change that changed nothing is
  told by identity (the history of 6.2 records no such change). `withTraitAt` only writes: it holds ids, and whether a
  trait may sit in a slot needs the trait.
- **Slot rules are a registry** (`createSlotRuleRegistry`, the default `slotRules`). A `SlotRule` has an `id` and
  `refusal(trait, slot)`, a sentence or `null`; `slotRules.canPlace(trait, slot)` is `{ ok: true }` or `{ ok: false, rule,
  reason }`, with the reason of the first rule in the registry's order that refuses. Three rules, which together give the
  table of GAME_RULES R1: `special-traits-artifact-only` (mastery, backer and `other` traits, R6),
  `avatar-innate-only` (R6), `artifact-needs-material` (R1). The reason speaks of the kind of trait and the slot, not of the
  trait ("Mastery traits can only go in the Artifact slot."), since the page shows next to it which trait it is; it is the
  visible text of a disabled "add" button. A new rule of the game is a new entry.
- **Not enforced.** A slot may be filled whatever the others hold (a Fused trait with no Innate one, the same trait twice):
  the player plans in their own order (GAME_RULES R1, *Filling order*, confirmed by the owner). Duplicates of a non-stacking
  trait are reported (R4), not refused.

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
