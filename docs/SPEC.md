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
   holds the same hash nothing is rewritten, so an unchanged sheet leaves the tree clean. Compendium v2.0 with its
   keywords: 878 KB, about 120 KB gzipped.
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
- Party: `?party=2.0,abomination--sin-and-sentence,,life--mender&target=3-fused` (ADR-0008)

The search codec (`ExploreState`, `decodeExploreState` / `encodeExploreState`) writes only what differs from the initial
state, so that state has no parameter at all, and reads any address: what is missing or says nothing usable is the initial
value. `q` is the query bar exactly as typed. `class` and `kw` are comma-separated lists in the order chosen, lower case,
trimmed and without repeats; a comma inside an item is written `%2C` and a percent sign `%25`. A `kw` item is a letter and a
key: `a` = `applies:`, `u` = `uses:`, `k` = `kw:` (the aliases of QUERY_LANGUAGE §2); unknown keys are kept, they match
nothing. `mode` is `all` (default) or `any`; `mat=yes` and `stack=no` are the two flags; `sort` is `book` (the order of the
dataset: by family, then trait name; default), `class` (class, then family) or `az` (trait name). The party and the tab live in other parameters that the search codec leaves alone.

**The tab codec** (`decodeTab` / `encodeTab`, `page-tab.ts` in `web`: the tabs are a layout, not a domain concept) follows
the same rules. `tab` is the view a narrow screen shows, `explore` (default, never written) or `party`; reading ignores case
and the blanks around the name, and a name that is no tab is `explore`. The Synergies tab of Phase 2 adds a value here.

**The party codec** (`decodePartyState` / `encodePartyState`, `party-url.ts`) follows the same rules and shares the list
helpers (`url/url-params.ts`). `party` is a list: the dataset version, then the trait id of each of the 18 slots in reading
order (creature by creature, Innate, Fused, Artifact), an empty item for an empty slot; the empty slots at the end are left
out, and an empty party writes no `party`. `target` is `<creature 1–6>-<innate|fused|artifact>` and is written only when it
is not the first empty slot (the first slot when the party is full), which is also what it is when the address names none or
names something that is no slot. Reading trims the blanks around an item, ignores whatever is beyond the 18th slot and keeps
every id, known to the dataset or not. `SharedParty.datasetVersion` is the version the link was made on, `null` when it
states none; the page compares it with the dataset it has (6.7). Eighteen of the longest ids of v2.0 stay below 1,000
characters, commas escaped (`party-acceptance.test.ts`).

**The page and its address** (`page-address.ts`, `page-url-writer.ts`). The page reads the address when it opens and
when the browser goes to another one (back, forward, a link); an address it cannot read is the plain page and stays as it is
until something changes. Every change of the state, the search, the party and the tab, is written back by one writer, and
the parameters that are none of theirs stay:
- typing *replaces* the current history entry once the text has stayed as it is for 400 ms, so a stretch of typing is one
  entry (and a browser's limit on how often the history may change is out of reach);
- a facet, a chip, a click on a keyword, the sort, each edit of the party (an add, a clear, an undo, a redo) and a change of
  tab *push* an entry, after the text typed so far has been written to the entry it was typed in, so that back returns to
  it. Choosing the
  target slot *replaces* the entry at once: it is in the address but no step of its own. A state that is already the address
  writes nothing;
- the writes are made one after another, and an arrival by back or forward drops the text that was waiting;
- a link is written to be read: the colon of `a:vulnerable` and the comma between two items are not escaped;
- a party is written under the version of the dataset in use, or while the data loads under the one the address stated, so
  that a link opened before the data arrives is written back as it was; arriving at an address with the same party keeps
  what can be undone, another party starts a new history.

Back and forward bring back the state and start the list over; they do not restore the scroll position (the list is another
one). Going back to a tab with the same search finds the page where that tab was left (§ 8.2, *The tabs*).

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
  with *Match any*). *Match all / Match any* is a pair of toggle buttons; the two flags are checkboxes. Under 700 px the panel is
  not on the page but in a modal bottom sheet that a "Filters" button (with the number of filters on) opens; Esc, its close
  button ("Show N traits") or a tap outside close it and the focus goes back to the button (DESIGN § Facet panel and chips).
  Whether the sheet is open is no part of the address, and opening it is no step of the history.
- **The chip row** has a chip for every filter that is on (`filterChips`, `removeFilterChip`: `class:life`, `applies:vulnerable`,
  `stack:no`, in the order of the effective query, each with a remove button), then one per term of the query bar (QUERY_LANGUAGE
  §4: the term flips between included and excluded, or goes). The chips do not show the operators between the terms: the
  effective query line has the exact meaning. When a chip is removed the focus goes to the next chip's remove button, or to
  the row itself if none is left. The list starts over when a filter changes while the page is scrolled into it.
- **The effective query line** shows `SearchOutcome.effectiveQuery` with a *Copy query* button (the clipboard; if the browser
  refuses, the text is on the page to select), and is absent while there is no filter and no query.
- **Empty state.** "No trait matches." with a hint; when several keywords must all be found, the hint says to try *Match any*.
- **Back to top.** Once the page is scrolled more than a screen (`showsBackToTop`), a button fixed at the top right of the window
  takes it back to its top and moves the focus to the heading of the page, never to the search field (on a phone that raises
  the keyboard). It is on Explore only (not on the Party tab), jumps instead of scrolling smoothly (the virtual list corrects
  the scroll as it measures the rows it passes, which stops a smooth scroll within pixels), and while it is there the page
  keeps a control that takes the focus clear of it (`scroll-padding-top`, WCAG 2.2 2.4.11). Under `pointer: coarse` the search
  field and the sort are 16 px, so that iOS does not zoom the page in when they take the focus (DESIGN § Accessibility).

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
- **Edits are commands, and the history keeps them** (`party-command`, `party-history`). A `PartyCommand` is data: `place-trait`
  (a slot and the `Trait`, since the rules need the trait and not its id), `clear-slot`, `clear-party`. `applyCommand(party,
  command, rules = slotRules)` gives `{ ok: true, party }` or the refusal of the rules (`{ ok: false, rule, reason }`), and the
  very same party when nothing changed. `PartyHistory` is `{ party, done, undone }`, two stacks of `PartyEdit` (`command`,
  `before`, `after`); `executeCommand` records an edit only when the party changed, and then empties `undone`. A refused
  command and one that changed nothing give the history back untouched (the same object, redo list included), `undo` / `redo`
  do the same when there is nothing to step over. A history starts on a given party (one from a link) with nothing to undo;
  `clear-party` is one edit, undone in one step.
- **The target slot moves on by a strategy** (`TargetStrategy`: party and the slot just filled → the next target; it only
  reads). The one there is, `nextEmptySlot`, takes the first empty slot after it in reading order (`SLOT_POSITIONS`: creature
  by creature, Innate, Fused, Artifact), going round after the last one, and stays where it is when no other slot is empty.
  It does not look at the rules or at the trait that comes next: a target the next trait cannot use is a disabled "add"
  with its reason, not a skipped slot.
- **Coverage** (`partyCoverage(party, lookup)`, `lookup` gives the `Trait` of an id or `undefined`) is `{ applies, relies,
  duplicates }`. `applies` and `relies` list the buffs, debuffs and effects the party's traits give (`applies`) or need
  (`uses`), once each, in the order of the slots; a `relies` entry is `covered` when some trait of the party applies the
  same key (a trait that does both covers itself, as in the prototype) and `missing` otherwise. Phase 1 has only those two
  statuses: random and conditional sources, inactive masteries and "no payoff" are Phase 3 (D9), every mastery counts as a
  source (D6), a `resists` mention is neither (R9), and an id the dataset does not know is passed over. `duplicates` lists
  each non-stacking trait found more than once, with the positions of its copies (R4, acceptance criterion 7); a stacking
  trait, or an unknown id (it is not known whether it stacks), is never listed.
- **The planner** (`createPlanner`, `addTrait`, `clearSlot`, `clearParty`, `chooseTarget`, `undoEdit`, `redoEdit`;
  `planner.ts`) is a `PartyHistory` and the target slot, immutable like the party, with the page holding only the current
  one. `addTrait` puts the trait in the target and moves the target on with the strategy; a refusal is returned with its
  reason, and a trait already in the target changes nothing. Clearing a slot makes it the target, clearing the party puts the
  target on the first slot, and undo returns the target to the slot of the edit so that the next trait refills it; choosing a
  target is no edit (it is not undone and keeps what can be redone). Every operation that changes nothing returns the very
  same planner.
- **The party panel** (web). Six creatures of three slots; the name of a creature is the creature of its Innate trait. A slot is
  a toggle that makes it the target (`aria-pressed`, a ring and the word *Target*, named "Target slot: Creature 2 · Fused,
  *name*"), with a button to clear it; a trait the dataset does not know is shown by its id and "Not found in vX". Undo,
  Redo and Clear party are `aria-disabled` when there is nothing to do, so that the focus stays on them; clearing a slot
  moves the focus to the slot's button. Ctrl/Cmd+Z undoes and Ctrl/Cmd+Shift+Z (or Ctrl+Y) redoes anywhere but in a text
  field. A polite live region says what changed ("Added X to Creature 1 · Innate.", "Undid: …") and, when a refused add is
  pressed, why. The coverage (SPEC above) sits under the creatures: a missing dependency is a button that shows the traits
  that apply it, a covered one says so; duplicates are a warning with the places of the copies.
- **Add from the results.** Every result has "Add to *target*" (the creature and slot named). When the slot rules refuse the
  trait for that slot the button is `aria-disabled`, stays in the tab order, and the reason is on the page under it and its
  accessible description (acceptance criterion 5); a press then does nothing but announce the reason. A trait that is in the
  party is marked "In party: …" with where.
- **The tabs.** Where the party has no room beside the list (under 1100 px: the width at which it used to be stacked under
  the list) Explore (the query, the facets and the results) and Party are the two views of a `tablist` of tabs at the foot of
  the window (ARIA tabs: the selected tab is the one in the tab order, the arrows, Home and End move along them and select
  as they go, each tab names its `tabpanel`). The Party tab says how many slots are filled ("1/18", and "1 of 18 slots filled"
  to a screen reader). Pressing a tab, or going back to one, shows that view with the page scrolled to where the tab was left
  (to its top the first time). The view that is not shown stays laid out but takes no room and nothing of it can be reached
  (not `display: none`: the virtual list of the results would measure its rows as 0 px tall). The Filters button (under
  700 px) is part of Explore: it sits above the tabs, and goes with the view. A search the party asks for (a missing
  dependency, a trait that was lost) brings Explore forward, from the start of its list. A trait added from the results is
  announced while the party is out of sight (the live region is beside the views, not in one). On a wider screen all of it
  is side by side and the tab in an address is ignored. The bars at the foot of the window leave room at the foot of the page,
  and a control that takes the focus is scrolled clear of them (`scroll-padding-bottom`, WCAG 2.2 Focus Not Obscured).
- **Sharing and remembering.** *Copy link* copies the address of the page as it is now, the typed text included, so a link
  opened in a browser that has never seen the app brings back the same party and search (acceptance criterion 6); when the
  clipboard refuses, the link is shown on the page to select. An id the dataset has no trait for stays in its slot, shown
  by the id and "Not found in vX" (X the version in use), with a button that searches the trait names for the words the id
  keeps (`lostTraitSearch`: what follows the family in the slug, hyphens as blanks) and shows them from the start of the list
  with every other filter off. The last party is kept in `localStorage` in the same text as the address writes it and used
  when a page is opened at an address with no `party`, which then says it; it is replaced by every edit and by choosing a
  target, forgotten when the party is cleared, and never read from an address that has its own party. A browser that keeps
  nothing (a private window, blocked site data) costs the convenience and nothing else.
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
| Performance | Initial JS ≤ 150 KB gzip; data ≤ 300 KB gzip; search + facet recount ≤ 16 ms per keystroke on the full dataset on a mid-range phone; result list virtualised. The search is timed by the page (`timeSearches`, a User Timing measure) and checked by an e2e on the production build with the CPU slowed down 4×: p95 of a typed query under 16 ms. Redrawing the list is not in the budget: virtualisation bounds it. The sizes are checked by `pnpm size-budget` on the production build (KB = 1000 bytes; initial JS is the scripts the page preloads, data is every file under `data/`, both gzipped as GitHub Pages serves them). Lighthouse CI, on a phone profile, fails the build below performance 0.85, accessibility 1, best practices 0.95 or SEO 0.95, or above a cumulative layout shift of 0.1 (`apps/web/lighthouserc.cjs`) |
| Accessibility | WCAG 2.2 AA; axe clean; full keyboard use; see DESIGN § Accessibility |
| Browsers | Last 2 versions of Chrome, Firefox, Safari, Edge; iOS Safari 16+ |
| Offline | Phase 1: none required. By end of Phase 3: PWA, data cached, works offline |
| Reliability | App keeps working with the last good dataset if the sheet changes shape |
| Privacy | No tracking, no cookies; local storage only for user conveniences |
| Legal | "Unofficial" label; credit and link to the compendium and its authors; ask the authors' permission before launch |
