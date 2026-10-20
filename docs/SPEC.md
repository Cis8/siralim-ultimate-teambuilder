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
  kind: 'debuff' | 'buff' | 'effect' | 'event' | 'mechanic' | 'flag';
  role?: 'applies' | 'uses' | 'resists';   // only for debuff/buff/effect/event; `resists` = guards against it (R9, R12)
  actor?: 'self' | 'ally' | 'enemy' | 'any';   // only for events, and only where the text says who (R12)
  span: [start: number, end: number];
}

interface PartyMember { innate: TraitId | null; fused: TraitId | null; artifact: TraitId | null; }
type Party = readonly [PartyMember, PartyMember, PartyMember, PartyMember, PartyMember, PartyMember];
```

A slot is addressed by a `SlotPosition` `{ member: 0–5, slot: 'innate' | 'fused' | 'artifact' }`. The party holds ids, not
traits, and keeps an id the dataset does not know (§5).

Derived per member (GAME_RULES R2): `family` from innate, `class` from fused if present, else innate.

## 4. Keyword extraction

- **Taxonomy as data** (`packages/core/src/taxonomy/*.ts`): debuffs, buffs, effects, events, mechanics, flags — each entry
  has `key`, `label`, `kind`, `patterns` (one or more phrases), for events a `group` (the heading the filters list it under)
  and a `phase` (see §8.5) or none, and for debuffs `canBeRandomlyApplied` (GAME_RULES R8).
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
  two entries, patterns that are not plain text, an alias of an event that is a key or the start of one, an alias given
  twice, and a stat word that is not one of the patterns, and lists all violations at once.
- Mechanics start from the prototypes; the pipeline also reports frequent capitalised words not in the taxonomy so the
  lists can grow.
- **Events** (GAME_RULES R12, ADR-0009) are the 18 things that happen in battle, in the order of the rules: start of battle,
  start of turn, end of turn; attack, cast spell, manual cast, defend, provoke; being attacked, dodge, critical hit, damage
  taken; heal, kill, death, resurrection; any buff, any debuff, which are also its five `EVENT_GROUPS` (battle and turns,
  actions, hits, life and death, buffs and debuffs: the semicolons). An entry lists every inflection as a pattern ("die", "dies",
  "died", "dead", "killed" are a death) and has a `phase` (`TRIGGER_PHASES`: start of battle, start of turn, attacking, being
  attacked, defending, spellcasting, kills and deaths, end of turn; none for heal and the two buff events). Spells and Stats
  are mechanics. The eleven trigger phrases of the first version are `aliases` of the event (and, where the phrase names
  one, the actor) they stand for: `after this creature attacks` is `attack` by `self`. A mention of an event is read by
  `readEvent`, by wording, like the roles of §4 below:
  - **Role.** `uses` in the condition a sentence opens with (After / When / If / While / At / Each time / The first 3 times
    / For each …, up to a comma that is not followed by "or" or "and"), in a later clause that is a condition ("for each",
    "while", "if", "that die", "at the end of", "until"), and for a noun: the creature's own ("this creature's attacks deal
    75% more damage"), the object of a preposition or a verb ("damage from attacks", "dodge attacks", "after death"), or a
    quantity ("100% more healing", "the amount healed"). `resists` after "cannot", "can't", "immune to", "never" or
    "can only" (not "can only activate"), up to the clause's end, "but", or an "and" that starts something else, and for a
    phrase that opens with its own cue ("resistant to debuffs", "avoid debuffs": after the condition a sentence opens with,
    before the noun test). Otherwise `applies`: a verb of the main clause ("attacks 1 additional time", "casts a random spell", "is resurrected", "has a 50%
    chance to dodge"). A keyword that follows another of its kind in a list ("attack, cast, defend, or provoke") takes its
    role and actor, but not from a noun ("dodge attacks and deal critical damage" are two readings).
  - **Actor.** The nearest subject before the event in its clause (this creature, it → `self`; your creatures, a family of
    yours, they → `ally`; an enemy, the target → `enemy`; a creature, all creatures → `any`), or in its sentence when the
    clause has none. "It" and "they" stand for the first subject of their number the sentence named ("After an enemy
    loses stats, it …": the enemy). A spell that was cast takes the subject after "by", or any creature; "for each debuff
    the enemy has", the one named after it. The words of a turn name their owner themselves.
  - **The start of battle is a moment**, not something a creature does: nobody makes it start, so a mention is always `uses`
    (or `resists`), whichever way it is written ("Your Crusaders start battles with Shelled" waits for the start like "At the
    start of battle"), and has no actor (`EventEntry.moment`).
  - **Turns are read by a grammar** (`findTurns`), since whose turn it is can be a family: "start|end of <owner> [ordinal]
    turn(s)", "its turn ends", and "start and end of …" as two mentions ("start and" and "end of …", so that no span overlaps
    another). A status inside the owner ("each Cursed enemy's turn") keeps its own mention and the turn shrinks to the words
    before it.
  - **"Attack" is also a stat** ("50% more attack", "its attack", "attack and defense", "gains Attack equal to"): the word
    next to words that own, count, compare or list it is the stat and no event (`EventEntry.statPatterns`, `isStatSense`);
    "attacks" never is. "Attacked" is an attack in the active ("for each time it attacked") and being attacked in the passive
    ("is attacked", "when-attacked").
  - **A name is no event.** An event is written in lower case unless it starts a sentence (or follows a dash): "Death
    creatures" (a class), "Major Healing" and "Kill Streak" (spells) are not, nor "Death - Enemies are afflicted …" (the
    label of a list).
  - **No event is a dependency** (R12): `partyCoverage` lists the buffs, debuffs and effects only (`canBeDependency`).
  **The two buff events are a buff or debuff that no name gives**, and the actor is who gets it: the counts ("for each
  debuff the enemy has"), the random ones ("gains 5 random buffs", "afflicted with a random debuff"), being given or afflicted
  with one ("afflicts an enemy with a debuff", "would afflict this creature with a debuff", "apply / receive a debuff"), the
  verbs ("buff an enemy": a phrase that ends with who gets it names them), and protection from all of them ("resistant to
  debuffs", "immune to debuffs", "avoid debuffs", "cannot gain additional buffs": `resists`, since the trait prevents the event,
  R12 and R9; 8b.10 reversed 8b.6, which left these out without saying why). Not mentions: a buff or debuff the text names or
  has just named ("Burning debuffs", "this debuff", "whichever of these debuffs"), how long they last ("their debuffs last 1
  turn"), copying, sharing, stealing or removing them, and counting them as a state ("has at least 3 buffs"). A phrase starts at
  the verb or the preposition that makes the role ("with a debuff" in "afflicts an enemy with a debuff"); a protection opens
  with its cue and so says nothing of the events listed after it.
  On v2.0: 2,201 mentions of events in 1,353 traits (1,531 `uses`, 613 `applies`, 57 `resists`; 223 with no actor, 214 of them
  the start of battle). An event that makes something happen by chance ("has a 50% chance to dodge") is `applies`: the
  trait makes the event happen, which is what a later phase can match with what pays off on it.
- **Matching**: whole words, longest match wins. Phrases, mechanics and events ignore letter case; buffs and debuffs
  are names and count only when written as the taxonomy writes them ("gain Immune" is the buff, "immune to damage" and
  "weak against" are not: case-insensitive matching gave 25 such false positives on v2.0). A status followed by a
  capitalised word is the start of a longer name ("Savage Spores" is not Savage). A run of blanks matches the
  space of a pattern, a `#` in a pattern a whole number (a pattern never holds a digit) and a curly apostrophe a straight
  one, without moving spans.
- **Role detection** for buffs, debuffs and effects (`assignRoles`; heuristic, then overrides), per sentence:
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
  id, keyword key, optional `occurrence` counting from 1 or all mentions, `role` and, for an event, `actor`: at least one of
  the two) and `randomDebuff` (trait id, `target`, `activation`, optional `note`; GAME_RULES R5). Every entry needs a
  `reason` citing the trait; unknown fields are refused. An entry naming a trait, a keyword the trait does not mention, an
  occurrence it does not have, a role on a keyword without one or an actor on a keyword that is not an event fails the build;
  two entries for one mention conflict; an entry that changes nothing is a warning. The events were read on 2026-10-17 beside
  the sweep of 8b.5 (every mention where role or actor differs from the sweep's, and a sample of the rest): 22 entries, and 5
  more for the buffs and debuffs that no name gives (8b.10: every new mention was read).
- **Snapshot tests** over the pinned v2.0 sheet, as committed files in `packages/pipeline/snapshots/`: one line per
  mention, `trait | key | role | actor` (`keywords-v2.0.txt`, 4,505 lines; `-` where there is none), and one per
  random-debuff trait, `trait | target | activation | note`. `triggers-before-events-v2.0.txt` pins the traits that had each
  of the eleven trigger phrases of the first version (564), so that an alias finds at least those (tested on the real
  sheet). Any change to the taxonomy, the heuristics or `overrides.yaml` shows in the diff and must be read
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
   "afflicted with", as a new buff or debuff would) and the differences with the canonical buff and debuff lists; an
   *Events* section with what the descriptions say about events that no keyword covers (`findEventCandidates`):
   *Conditions*, the sentences that open with After, When, Whenever, If, While, At, Each time, Once, Before, Upon, As long
   as, Every time, For each or Until, up to the comma or the full stop, and *Phrases*, the stretch between two marks of
   punctuation around a word an event goes by (attacks, heals, dies, gains a buff: the verbs of the census of 8b.5, with
   "attack" where it is a stat and a capitalised word in mid-sentence, a name, left out) outside the conditions. Each is a
   form (lower case, numbers as `#`, a family as `<family>`, so that one way of saying it is one form) with the number of
   traits and the first; one trait is enough, since a new event may start in a single description; the forms in
   `REVIEWED_EVENT_FORMS` are looked at and left out; and *Needs attention* (classes outside GAME_RULES R7, masteries whose
   requirement names no known family, override warnings).

GitHub Actions: nightly + manual run. If the output changed, open a PR with the report as description; the workflow
runs the full check suite itself (PRs opened with `GITHUB_TOKEN` do not trigger CI). Claude reviews and merges these
PRs at the start of a session (ADR-0007). Never deploy data that has not been through a PR.

## 7. URL state

Every view is reproducible from its URL (query string for search, compact party encoding):
- Search: `?q=<query>&class=life,nature&kw=a:vulnerable,u:weak,k:start of battle&mode=any&mat=yes&stack=no&sort=az`
- Party: `?party=2.0,abomination--sin-and-sentence,,life--mender&target=3-fused` (ADR-0008)
- Synergies: `/synergy`, `/synergy/<traitId>` and `/synergy/kw/<slug>`, with `?mat=yes&section=enables` and the party (ADR-0011)

The search codec (`ExploreState`, `decodeExploreState` / `encodeExploreState`) writes only what differs from the initial
state, so that state has no parameter at all, and reads any address: what is missing or says nothing usable is the initial
value. `q` is the query bar exactly as typed. `class` and `kw` are comma-separated lists in the order chosen, lower case,
trimmed and without repeats; a comma inside an item is written `%2C` and a percent sign `%25`. A `kw` item is a letter and a
keyword: `a` = `applies:`, `u` = `uses:`, `k` = `kw:` (the aliases of QUERY_LANGUAGE §2); unknown keys are kept, they match
nothing. The keyword is a key and, for an event, who acts after a slash: `u:attack/self` (`parseKeywordReference`,
`writeKeywordReference`; QUERY_LANGUAGE §2). The same event by two actors, or by one and by anyone, are separate items (alternatives of one filter, §8.1). An
old trigger phrase is read as the event and the actor it stands for and written back so: `kw=k:after this creature attacks` is
`kw=k:attack/self`, so a link of the first version finds what it found, and possibly more (ADR-0009). A slash with nobody after
it is dropped (`u:attack/` is `u:attack`), a word after it that is no actor stays in the key, and an actor with no key is no
item. `mode` is `all` (default) or `any`; `mat=yes` and `stack=no` are the two flags; `sort` is `book` (the order of the
dataset: by family, then trait name; default), `class` (class, then family) or `az` (trait name). The party and the tab live in other parameters that the search codec leaves alone.

**The tab codec** (`decodeTab` / `encodeTab`, `page-tab.ts` in `web`: the tabs are a layout, not a domain concept) follows
the same rules. `tab` is the view a narrow screen shows, `explore` (default, never written) or `party`; reading ignores case
and the blanks around the name, and a name that is no tab is `explore`. Synergies is no tab: it is a page of its own (ADR-0011,
PLAN D23), reached by a link beside the tabs.

**The Synergy codec** (`decodeSynergyView` / `encodeSynergyView` / `synergyAddress`, `synergy-address.ts` in `web`) follows the same
rules. The page is the path: `/synergy` (the picker), `/synergy/<traitId>` (the trait ids of §5) and `/synergy/kw/<slug>`
(`keywordSlug` of a key that can be a dependency: a buff, a debuff or an effect; an event has no page). What is left in the query
is `mat=yes` (only traits with a material, as the search's flag: read whatever the case and the blanks around it) and `section=`
(the part a narrow screen shows: `enabled-by`, `enables`, `alternatives`, `related` for a trait, `appliers`, `users` for a keyword;
a name that is none is no section), then the party and the target of §8.2. Both are written only when they differ from the initial
state, and what else the address carries stays. An id or a slug that nothing answers to is a state of the page, not an error:
a trait page says "Trait not found" with the traits whose name is like the id's (`lostTraitSearch`) and a search, a keyword page
the list of keywords. A link from one page to another carries the party (`carriedSearch`): the address is the source of truth, and
a page that arrives at an address with no party takes that for an empty one, except for a visit that opens the app (a typed address,
a reload), which starts from the party of the last visit and writes it into the address, as Explore does. GitHub Pages has no file
for `/synergy/<id>` and answers with `404.html`, which boots the app from any depth of the path (an e2e checks that every file it
names is under the base path).

**The party codec** (`decodePartyState` / `encodePartyState`, `party-url.ts`) follows the same rules and shares the list
helpers (`url/url-params.ts`). `party` is a list: the dataset version, then the trait id of each of the 18 slots in reading
order (creature by creature, Innate, Fused, Artifact), an empty item for an empty slot; the empty slots at the end are left
out, and an empty party writes no `party`. `target` is `<creature 1–6>-<innate|fused|artifact>` and is written only when it
is not the first empty slot (the first slot when the party is full), which is also what it is when the address names none or
names something that is no slot. Reading trims the blanks around an item, ignores whatever is beyond the 18th slot and keeps
every id, known to the dataset or not. `SharedParty.datasetVersion` is the version the link was made on, `null` when it
states none; the page compares it with the dataset it has (6.7). Eighteen of the longest ids of v2.0 stay below 1,000
characters, commas escaped (`party-acceptance.test.ts`).

**The page and its address** (`page-address.ts`, `address-writer.ts`). The page reads the address when it opens and
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
- the writes are made one after another, and an arrival by back or forward drops the text that was waiting, as does a move to
  another page (a link to the Synergies of a trait): written later it would call the person back, or take the place of the move
  in flight. Back then finds the search as the address last had it, which is behind the text if the link was followed within
  the 400 ms after the last key;
- a link is written to be read: the colon of `a:vulnerable` and the comma between two items are not escaped;
- a party is written under the version of the dataset in use, or while the data loads under the one the address stated, so
  that a link opened before the data arrives is written back as it was; arriving at an address with the same party keeps
  what can be undone, another party starts a new history;
- the Synergy pages have a writer of their own (`createAddressWriter` over `synergyAddress`, in the layout of the routes): a change
  of the party made there is written to the page in front, in the place it is, and one that finds the person gone to another
  page is dropped.

Back and forward bring back the state and start the list over; they do not restore the scroll position (the list is another
one). Going back to a tab with the same search finds the page where that tab was left (§ 8.2, *The tabs*).

The URL is the source of truth; local storage keeps only conveniences (recent searches, saved searches, last party).

## 8. Features

### 8.1 Explore (Phase 1)
Query bar (QUERY_LANGUAGE), facets (class: any-of; keywords: per keyword "applies"/"uses" toggles with match all/any;
events; mechanics; flags: artifact-eligible, does-not-stack), result list with keyword tokens styled by kind and role,
match highlighting, and click-a-keyword → counterpart jump (applies ↔ uses). Facet counts reflect the current results
(class counts ignore the class filter itself). An "effective query" line shows the full query the UI state stands for, and a
"Reads as" line under it says the same query in plain language (QUERY_LANGUAGE §7).
The terms of the query bar are shown as chips, each with a toggle-NOT and a remove button that edit the text of the bar in
place (QUERY_LANGUAGE §4, *Chips*).

`SearchService.search(state)` gives, for an `ExploreState`, the traits in the order of the sort, the effective query, its
reading in words (`effectiveReading`) and the facets (`Facets`); any state can be searched, since the parser repairs the query bar and a name nobody has finds nothing.
The service also lists what it loaded (`traits`, in the order of the dataset; `vocabulary`, the entries a person can type after
`class:`, `family:`, `creature:` and `trait:`) and answers `countMatches(state, query)`, the number of traits that `query` finds
among those the filters of `state` leave, which is what a search would list if `query` were in the bar (QUERY_LANGUAGE §3, §5).
- **The filters are a query.** `filterQuery` writes the class, keyword and flag filters as text of the query language and
  the search runs that very text, so the effective query is not a description of the filters but what they are: the filters
  as `class:… (applies:… OR uses:…) mat:yes stack:no`, then the query bar (an OR of its own in parentheses). Typed in the
  query bar, it finds the same traits (tested on the real sheet).
- **Classes** are any-of, written `(class:life OR class:nature)`. `class:` looks for a name inside the class, so
  `class:boss` would find Nether Boss too: a chosen class is written with the classes whose name contains it left out,
  `class:boss -class:"nether boss"`.
- **Keywords** are `applies:`, `uses:` or `kw:` terms, joined by AND (match all) or OR (match any). They use the key prefix of
  those fields, which the taxonomy keeps exact (no key is the start of another). A `KeywordFilter` is a field, a key and, for
  an event, an optional `actor`: `{ field: 'uses', key: 'attack', actor: 'self' }` is `uses:attack/self`, in the effective
  query, the chip and the address. The event by one actor and by anyone are two filters (`hasKeywordFilter` tells them apart),
  and both can be on. The panel sets it with one control for all the events (below, *The Events section*); the address and the
  query bar carry it too. **The filters on one side of one keyword that differ only in the actor are alternatives**, in both
  modes: they are one operand of the AND, an OR of their own (`keywordSides`), so `uses:attack/self` and `uses:attack/enemy`
  find a trait that reacts to attacks by either, and the event by anyone beside an actor finds what anyone finds (anyone
  includes the actor). The effective query writes them in parentheses, `(uses:attack/self OR uses:attack/enemy) uses:weak`, and
  the chip row keeps them together, in that order.
- **Counts.** A class is counted among the traits the other filters and the query bar find, so choosing a class does not
  empty the others. A keyword is counted among the traits shown: how many apply it, rely on it, or mention it in any role
  (`kw:`); a mechanic has `mentions` only. An event has, besides, the same two counts for every combination of actors
  (`byActors`, keyed by `actorSetKey`: the traits whose text names at least one of them, each once, as the alternatives
  `applies:attack/self` and `applies:attack/enemy` find them; a trait that names two is not counted twice, so the count for
  two actors is not the sum of the counts for each; `facetCount(facet, side, actors)` picks one). The facets
  list the classes of the dataset and the buffs, debuffs, effects, events and mechanics of the taxonomy, with the counts they
  have, 0 included.
- **The order of the classes** is fixed when the dataset is loaded (`facetVocabulary`), so the list does not move as the
  filters change: the five classes of a creature first (Chaos, Death, Life, Nature, Sorcery, from A to Z; GAME_RULES R7),
  then the others by the number of traits they have in the dataset, the largest first and from A to Z among equals. In
  v2.0: Rodian Master, Backer, Nether Boss, Boss, Pandemonium, Nether Room. `ClassFacet.standard` says which group a class
  is in, for the panel to draw a rule between the two.
- **Clear filters** (`clearFilters`) takes off the classes, the keywords and the two flags, and leaves the query bar, the
  sort and the match mode, which are settings of the search and not filters of it. It gives back the same state when no
  filter is on. It is one step of the history, like any other change of the filters.
- **Sections.** The classes, each kind of keyword (debuffs, buffs, effects, events, mechanics) and the flags are sections of
  the panel that open and close (`FILTER_SECTIONS`); *Match all / Match any* stays in view above the kinds. All are open to
  begin with, so nothing moves on load. Which are shut is a state of the page (it outlives the panel, which is built again
  whenever the window crosses 700 px, and the sheet being closed), and no part of the address or of the local storage: a
  new visit finds them open. A shut section says how many filters are on inside (`activeFilterCounts`: one per class, per
  side of a keyword and per flag, as the chips count; a keyword the panel does not list is in no section). Opening or
  shutting one is no step of the history, and *Clear filters* takes the filters off in shut sections as in open ones.
- **The Events section** (GAME_RULES R12) has one *Who* control and then the events in their five groups (`EventEntry.group`),
  each with two buttons, *Causes* (`applies:`) and *Reacts* (`uses:`). A press turns the filter on with the actors the control
  names (`toggleKeywordSide`: one filter for each, one that names nobody when there is none), or, if the side is on, takes off
  every filter of it, whoever it names: the button is pressed for the event by anyone and by an actor alike.
  - **The control takes several actors at once** (decided 2026-10-18): *This creature* (`self`), *Your creatures* (`ally`) and
    *Enemies* (`enemy`) are toggle buttons that go on and off on repeated taps, and the filters of the actors on are
    alternatives (above). *Any* (no actor: the event whoever acts) is pressed exactly when no actor is, since anyone includes
    every actor and an actor beside it would change nothing: pressing it takes the actors off, pressing an actor puts it in
    beside the others and so takes *Any* off, and taking the last one off leaves *Any* pressed. Pressing *Any* while it is
    pressed changes nothing. "Any creature" (`any`) is something a text says, not a choice.
  - It follows the filters (`eventActors`: for each side the actors of its filters, none if one of them names nobody): with
    event filters on it shows the actors they all name, and nothing pressed, *Any* included, when the sides differ (a click on
    a keyword makes a filter that names no actor, beside others that do). A press gives every event side the actors the press
    leaves (`toggleActor`, `setEventActors`; from nothing pressed, the actor alone; a press on *Any* from there, none): a filter
    that is right stays where it stands, one that is not goes, and what is missing follows the last filter of its side that
    stays, or takes the place of the first that went; two filters that become the same are one. It is one step of the history,
    none when nothing changes.
  - With no event filter on it shows the last choice, which is what the next filter turned on gets; that choice is a state of
    the page like the shut sections (not in the address, not in the local storage), and *Clear filters* leaves it, as it
    leaves the match mode.
  - The counts of the buttons are those of the actors shown (`facetCount`): the traits whose text names at least one of
    them, so a button says how many traits it would show. A filter turned on by a click on a keyword names no actor. Each
    actor of a side is a filter, one chip and one in the count of a shut section.
- **The description of a result** is cut by `descriptionParts(description, keywords, marks)` into the keywords of the trait
  (spans of the dataset, in order and apart: tested on the real sheet) and the plain text between them, each with the
  pieces that the query marks (`SearchOutcome.highlight`); a mark that crosses the edge of a keyword is one piece in each
  part, and joining the pieces gives the description back. The page asks for it only for the rows it draws.
- **A click on a keyword** of a description (`clickGoal`, `isClickOn`, `clickKeyword`) turns one filter on or off and leaves
  the query bar alone. A keyword a trait applies leads to the traits that rely on it (`uses:key`), one it relies on to the
  traits that apply it (`applies:key`): the two are sides of one keyword, so turning one on takes the other off
  (`applies:vulnerable` becomes `uses:vulnerable`, and the click shows the counterpart, not the traits that are both).
  An event has its two sides like a buff (a trait that causes an attack leads to those that react to attacks, and the other
  way round), whoever the text says acts: the filter a click makes names no actor. The start of a battle is the exception
  (`EventEntry.moment`): nobody causes it, so a click on it shows the traits that mention it. A keyword with no side (a
  mechanic; a mention that only `resists`, GAME_RULES R9) is `kw:key`; the flag "does not stack" is `doesNotStack`.
  A side is on when a filter of its field and keyword is, by anyone or by an actor (`hasKeywordSide`), so the token is pressed
  as the panel's button is. A second click on a token whose side is on turns it off, every filter of it (`toggleKeywordSide`),
  which leaves the other side as it was. The page then shows the new list from its first trait and moves the focus to the
  results heading, since the row clicked may be gone.
- **Sort** is a strategy per key: `book` keeps the order of the dataset (by family, then trait name, since the dataset is
  sorted by id, §6), `class` and `az` compare ignoring letter case, and traits that tie keep the order of the dataset.
- **The facet panel** turns the filters on and off with the same state-in, state-out functions as the click on a keyword
  (`toggleClass`, `toggleKeywordFilter`; `hasClass`, `hasKeywordFilter` tell what is on). Classes are toggles with the count of
  traits each would show; a buff, a debuff or an effect has two, *Applies* and *Relies on* (`applies:` and `uses:`), an event
  two, *Causes* and *Reacts* (the same fields), and a mechanic one (`kw:`), counted by the traits that mention it. Unlike a
  click in a description, the panel does what it is told: both sides of a keyword can be on at once (traits that give it *and* rely on it with *Match all*, either
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
  refuses, the text is on the page to select), and is absent while there is no filter and no query. Under it, **Reads as** shows
  `SearchOutcome.effectiveReading`: the effective query, filters included, in plain language (D19), as plain text of the page (no
  live region: it follows the query, which the result count already announces).
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
  sentence under a result's "add" button when the target slot refuses the trait. `allowedSlots(trait, rules = slotRules)`
  gives the slots of a creature that take a trait, in the order of the creature (empty for a mastery, backer or special trait
  with no material). A new rule of the game is a new entry.
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
  It does not look at the rules or at the trait that comes next: a target the next trait cannot use is an "Add to…" that
  offers the other slots (see *Add from the results*), not a skipped slot.
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
  one. `addTrait` puts the trait in the target and moves the target on with the strategy; `addTraitAt(planner, trait, at)`
  puts it in any slot instead, and moves the target on only when that slot is the target (the player is still filling the
  target otherwise). Both give `{ ok: true, planner, replaced }`, `replaced` being the id the slot held (`null` when it was
  empty or held the trait already); a refusal is returned with its reason, and a trait already in the slot changes nothing.
  Clearing a slot makes it the target, clearing the party puts the
  target on the first slot, and undo returns the target to the slot of the edit so that the next trait refills it; choosing a
  target is no edit (it is not undone and keeps what can be redone). Every operation that changes nothing returns the very
  same planner.
- **The party panel** (web). Six creatures of three slots; the name of a creature is the creature of its Innate trait. A slot is
  a toggle that makes it the target (`aria-pressed`, a ring and the word *Target*, named "Target slot: Creature 2 · Fused,
  *name*"), with a button to clear it; a trait the dataset does not know is shown by its id and "Not found in vX". Undo,
  Redo and Clear party are `aria-disabled` when there is nothing to do, so that the focus stays on them; clearing a slot
  moves the focus to the slot's button. Ctrl/Cmd+Z undoes and Ctrl/Cmd+Shift+Z (or Ctrl+Y) redoes anywhere but in a text
  field. A polite live region says what changed ("Added X to Creature 1 · Innate.", "Added X to Creature 1 · Artifact,
  replacing Y.", "Undid: …") and, when a refused add that has no slot to offer is pressed, why. The coverage (SPEC above) sits under the creatures: a missing dependency is a button that shows the traits
  that apply it, a covered one says so; duplicates are a warning with the places of the copies.
- **Add from the results.** Every result has "Add to *target*" (the creature and slot named), which replaces what the slot
  holds, and says so in the announcement. When the slot rules refuse the trait for the target slot, the reason is on the page
  under the button and is its accessible description (acceptance criterion 5), and the button reads "Add to…": it stays
  active and opens a modal sheet (`SlotChooser`, on the page and not in the row, since the rows are virtualised) titled "Add X
  to Creature N" with the sentence and one button for each slot of the target's creature that takes the trait (`slotChoices`):
  "Add to Artifact (empty)", "Replace Y in Artifact" (Y by name, or by id when the dataset does not know it) or "Already in
  Artifact" (a press changes nothing). A press puts the trait there with `addTraitAt` and leaves the target where the player
  had it; Esc, Cancel and the dimmed page close the sheet, and the focus returns to the "Add to…" button. The player is told
  once the sheet has closed, since the live region behind a modal sheet is inert. The undo of such an add puts the target on
  that slot, as every undo does. A trait that no slot takes (a mastery, backer or special trait with no material; none in
  v2.0) keeps today's `aria-disabled` add, in the tab order, and a press announces the reason. A trait that is in the party
  is marked "In party: …" with where.
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

**Search history** (`core/src/history/`, used by the field as *In the field* below says). `SearchHistory { recent, saved }` is immutable data,
and two searches are the same when their trimmed text is exactly the same, letter case included.
- *Recent:* the newest 10, newest first; a search already there moves to the front. *Saved:* up to 50 `{name, query}` in the order they were
  saved (the name is the query until a search can be renamed); toggling a saved search takes it off, and a 51st is refused (`full`), never
  swapped for one the person chose to keep. A blank search is neither remembered nor saved, nor is one over 2,000 characters (a pasted text,
  the length at which the lint stops too).
- *The file* (`exportHistory`, `importHistory`) is JSON: `{ "app": "trait-atlas", "kind": "search-history", "version": 1, "recent": [query…],
  "saved": [{ "name", "query" }…] }`. An import **merges by query**: what the history has stays first and in its place (a search that is there
  keeps its name), the file adds the rest as far as the lists have room, so a second import adds nothing; it says how many it added and how many
  it left out for want of room. It never throws: a text that is not JSON (`not-json`), not a file of this app (`foreign`), of another version
  (`wrong-version`), with a list that is not a list of searches (`malformed`) or with more than the app keeps (`too-large`: over 10 recent or 50
  saved searches, a search over 2,000 characters, a text over 2,000,000 characters) is refused whole and changes nothing. A file is read
  leniently otherwise: a byte order mark, blanks around a search, a blank search, a search listed twice and properties it does not know are of
  no matter.

**In the field** (PLAN 11.4; `search-history-session.ts`, `search-history-store.ts`, `query-input.svelte`, `searches-sheet.svelte`).
- *Remembering* is done by the first script, whether or not the assist layer arrives: a search becomes the newest recent one when **Enter** is
  pressed in the field (not the Enter that took a suggestion, nor the one that ends an IME composition), when the field is **left with its text
  changed** since it was entered (a query that arrived with the address and was not touched is not remembered), when it is **saved**, and when it
  is **taken from the list or the sheet**. Esc then Enter is how a search is sent while the list of suggestions is open: with a suggestion
  active, Enter takes it (QUERY_LANGUAGE §6).
- *Keeping.* One `localStorage` key, `trait-atlas:search-history`, holds the text of the file Export writes, so that a damaged value is
  refused like a damaged file and read as an empty history; a browser that keeps nothing costs the convenience and nothing else (the history of
  the visit is held in memory). Every change is made to what the browser keeps **now** and not to what the page last saw, so that a second
  tab's saved search is not lost to the first tab's next change.
- *The list of an empty field.* A blank field (blanks only count as blank) that has a history lists it: the newest recent searches (up to five
  that are not saved), then the saved ones in the order they were saved, nine rows at most (the room one list leaves is the other's); a saved
  search is listed once, as saved. It is a list to browse, not a completion: it opens on a press in the field and on ↓ / Alt+↓, never on a plain
  focus; **nothing is active** until the arrows choose (also when typing has just emptied the field), so Tab and Enter are the field's own;
  taking a row writes the whole search over the text and remembers it again. With no history a blank field offers what it always did.
- *The star* sits inside the field while it holds something to keep: a toggle button ("Save this search": the name never changes, `aria-pressed`
  says the state, and it is pressed whenever the text in the field is saved, however it came there). It does not take the focus from the field.
  A search that is saved is also remembered as a recent one. When it cannot save, the field says why in a line under it, said aloud as well, which
  goes when the text changes: the field is empty, the search is over 2,000 characters, or the fifty places are taken (`full`), with a
  *Manage searches* button beside the sentence: a saved search is never swapped for the new one.
- *The sheet* (*Manage searches*, a button inside the field beside the star, always there so that Import is within reach when the history is
  empty) is a `BottomSheet` of the `choice` kind: **Saved (N of 50)** and **Recent (N)**, each search a button that writes it in the field and
  shuts the sheet (the focus goes back to the button that opened it, as the keyboard of a phone must not be raised), each with a button that
  forgets it (the focus goes to the search that takes its place, or to the heading of the list); **Export searches** hands the file over as a
  download (`trait-atlas-searches.json`); **Import searches** reads a file chosen by the person and merges it, saying "Imported 3 saved, 5
  recent." (and how many did not fit), "Nothing new in this file…" or why nothing was imported, in words that stay on the sheet and are said
  politely. A file over three times the limit in bytes is refused without being read.

**The search sheet** (PLAN 11.5; `search-sheet.svelte`, `query-input.svelte`, `search-sheet.ts`; DESIGN § Search sheet). On a narrow screen that is touched
(`(max-width: 699px) and (pointer: coarse)`) a **press** on the search field opens a full-screen dialog with the same editor in it, instead of the editor in the page.
- *What opens it.* A click on the field, once the assist layer and the dataset are there: the press takes no focus in the page (the page behind would raise its keyboard) and the
  sheet is shown, with the focus in its own field, in the task of the press itself (a phone raises its keyboard for no other focus). A press before the layer has arrived, the
  keyboard (Tab, a hardware keyboard on a tablet), the `/` shortcut and a mouse edit in the page, at any width: that field is complete (the issues, the list, the star, *Manage searches*).
- *One editor.* `QueryInput` owns the state (the caret, the active option, the counts, the history) and works on whichever of the two fields is being typed in; the sheet is a view
  of it and raises the same events. Typing in the sheet opens no list of issues in the page behind. The text is the page's: the address follows it as it does when typing in the page.
- *What it holds.* The back arrow, the field with its clear button, the first issue with its fix and “+N more”, “Reads as” (the effective reading), the list (suggestions, or the
  recent and saved searches for a blank field), the star and *Manage searches*, the button *Show N traits* and the syntax toolbar (QUERY_LANGUAGE §8).
- *Leaving.* The back arrow, *Show N traits*, Escape and the system's back close it. Enter closes it too when no option is active (Escape lets go of an active one first); the search
  is remembered as it is on leaving the field, and the focus goes to the Results heading and not to the field of the page.
- *Where the keyboard is.* The sheet is as tall as the visual viewport and starts at its top (`fitToVisualViewport`), so that the button and the toolbar stay above the keyboard of
  Safari (which pans the page) and of Chrome on Android (which shrinks only the visual viewport). That can be judged only on the devices: the owner's check (PLAN).

### 8.4 Synergy explorer (Phase 2)
Three routes under `/synergy` (§7, ADR-0011) that share the party with Explore: the picker (`/synergy`), a trait
(`/synergy/<traitId>`) and a keyword (`/synergy/kw/<slug>`). The relations come from `createRelationService` in `core`
(M12); the pages draw what it returns and decide nothing. **A dependency is a buff, debuff or effect** (42 keys in v2.0): an event
is no dependency (GAME_RULES R12), so it ties traits together only in *Same trigger*. Everything a trait says counts **by name**:
a source that is random (R5) or conditional (R10) is listed among the sources but enables nobody (PLAN D27). Every trait is listed
unless *Artifact-eligible only* (`mat=yes`) is ticked: it leaves the traits that cannot be a material (R1) out of every list and
every count of the page.

- **By trait.** The focus card gives the description (its buffs, debuffs and effects are links to their keyword's page), *Relies on*,
  *Applies*, *Guards against* (the role `resists`, R9), *Triggers* and *Material*, the add button and a link that opens Explore on
  that trait.
  - **Enabled by** is the traits that apply a key the focus relies on, **Enables** the traits that rely on a key the focus applies.
    A trait is on a side **once** (PLAN D17): when it ties through two keys or more it is in the first lane, *Several keys*, marked
    "×N links" and naming the keys; otherwise it is in the lane of its key, and the lanes follow in the order the focus names its
    keys. In a lane the traits that give the key by name come first, then those that give it under a condition, then the random
    sources (labelled "random", folded above 3); within each, more links first, then by name. A key that nobody gives (or relies on) is
    a note, not a lane.
  - **Alternatives** are the traits that apply a key the focus applies or rely on a key it relies on, ranked by how many keys they
    share, then by name; protection makes no tie. **Same trigger** is the traits that rely on an event the focus relies on with an
    actor that can be the same (equal, or one side names none or says any creature; *this creature* and *an ally* are different
    actors, D28), ranked by the events shared. A trait that waits for no event has no *Same trigger* and says so. **Same family**
    is the others of the focus's family, the mastery first, then creatures, avatars, backers and the rest, each by name. A name that
    files several traits together and has no mastery trait (Exotic, Backer, Avatar and Zantai in v2.0) is a *grouping*, not a family,
    and lists nobody (D36).
  - Each of those three shows 6 cards and a button for the rest, up to 200. The trail is the last six traits the person centred on in
    this session; a card or a step re-centres the page on its trait (a link, so Back and Forward work).
- **By keyword.** The summary counts the traits that apply the key by name (*Appliers*) and those that rely on it (*Rely on it*), says
  how many more give it under a condition or at random, gives the **verdict** and lists the keys its appliers also apply
  ("Often applied together with"). These counts are the ones of Explore's facet panel for the same key, with or without
  `mat:yes` (ROADMAP criterion 11), and each list has a link that opens Explore on exactly its traits. The verdict asks about the
  sources first, then the payoff (D22, D29):

  | Verdict | When |
  |---|---|
  | *No source* | nothing applies the key by name, at random or under a condition |
  | *Only by chance* | nothing applies it by name, and a trait afflicts a random debuff on enemies (a conditional source beside it changes nothing) |
  | *Only under a condition* | nothing applies it by name or at random, and a trait gives it under a condition |
  | *No payoff yet* | something applies it, and nothing relies on it |
  | *Scarce enabler* | appliers × 2 < users |
  | *Well supported* | anything else |

  Only *Well supported* is good and only *No source* bad; the other four ask for care, and each verdict has an icon so that colour
  is never alone. The picker of the other keywords shows the two counts of each.
- **The picker** (`/synergy`) finds a trait by name (the name begins with the text, then a word, then anywhere; then the creature or the
  family), starts from the filled slots of the party, and lists the keywords. A trait id or keyword slug the dataset does not
  know is a page that says so and offers similar names, not an error (ROADMAP criterion 9).
- **Under 700 px** the lists are tabs (`section=` in the address, a history step), the focus card folds its description to 3 lines, and
  the pickers are sheets (DESIGN § Synergy pages, *On a phone*).

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
| Performance | Initial JS ≤ 150 KB gzip; data ≤ 300 KB gzip; search + facet recount ≤ 16 ms per keystroke on the full dataset on a mid-range phone; result list virtualised. The search is timed by the page (`timeSearches`, a User Timing measure) and checked by an e2e on the production build with the CPU slowed down 4×: p95 of a typed query under 16 ms. Redrawing the list is not in the budget: virtualisation bounds it. The sizes are checked by `pnpm size-budget` on the production build (KB = 1000 bytes; initial JS is the scripts the page preloads, data is every file under `data/`, both gzipped as GitHub Pages serves them; the lazy and the total JS have budgets of their own, 50 and 200 KB, and no route has one: a first visit to any page fetches at most the total). Lighthouse CI, on a phone profile, browses Explore, the Synergy picker, a trait's page and a keyword's page (`tools/serve-build` serves the build as Pages does) and fails the build below performance 0.85 (0.8 for the last two, which are drawn after the dataset is there), accessibility 1, best practices 0.95 or SEO 0.95, or above a cumulative layout shift of 0.1 (`apps/web/lighthouserc.cjs`) |
| Accessibility | WCAG 2.2 AA; axe clean; full keyboard use; see DESIGN § Accessibility |
| Browsers | Last 2 versions of Chrome, Firefox, Safari, Edge; iOS Safari 16+ |
| Offline | Phase 1: none required. By end of Phase 3: PWA, data cached, works offline |
| Reliability | App keeps working with the last good dataset if the sheet changes shape |
| Privacy | No tracking, no cookies; local storage only for user conveniences |
| Legal | "Unofficial" label; credit and link to the compendium and its authors; ask the authors' permission before launch |
