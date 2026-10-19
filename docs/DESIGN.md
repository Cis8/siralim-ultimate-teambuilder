# Design

Direction: **dense, dark power-user tool**. Information first, quiet chrome, colour reserved for meaning.
Visual references: the prototypes in `docs/prototype/` (also on the owner's design canvas, rows v1–v3).

## Tokens

Define as CSS custom properties; never hard-code hex values in components.

| Token | Value | Use |
|---|---|---|
| `--bg` | `#0e1014` | page |
| `--bg-bar` | `#0b0d10` | header, bottom nav |
| `--surface-1` | `#12161b` | inputs, panels |
| `--surface-2` | `#151a20` | cards, slots, chips |
| `--surface-3` | `#1a1f26` | buttons |
| `--border` | `#1f252d` / `#2e3741` (strong) | dividers / controls |
| `--text` | `#e4e7eb` | body |
| `--text-strong` | `#f1f3f5` | names, headings |
| `--text-muted` | `#a0a8b3` | secondary |
| `--text-faint` | `#8a94a1` | labels, counts (≥ 4.5:1 on surfaces) |
| `--accent` | `#8ab4ff` | focus ring, links, primary action |
| `--accent-surface` | `#1d2b3e` / border `#4a76b0` | selected / pressed |
| `--status-good` | `#74dbb0` | covered, ok |
| `--status-warn` | `#f3c969` | conditional, random, conflicts |
| `--status-crit` | `#ff9b87` | missing, invalid |
| `--scrim` | `rgb(4 6 9 / 0.62)` | the page behind a modal sheet |
| `--issue-error-surface` / `-border` | `#2a1816` / `#6e3a33` | a row of the issues list that is an error (text `--text`, the word and icon `--status-crit`) |
| `--issue-warn-surface` / `-border` | `#2a2412` / `#5a4a22` | the same for a warning (the word and icon `--status-warn`) |

Keyword kinds: debuff `#ff9b87`, buff `#74dbb0`, mechanic `#a9c1ff`, event `#f3c969` (the role shapes of a buff), flag muted italic.
Class identity dots: Chaos `#ef6b5b`, Death `#b49cf5`, Life `#e9c46a`, Nature `#63c98a`, Sorcery `#5fb0f5`,
Rodian Master `#d98fc4`, Backer `#8fa1b3`, Nether Boss `#f08c4a`. Boss, Pandemonium, Nether Room and any unknown class
use the fallback `#8fa1b3`.

**Colour rules.**
- Class colours fail colour-vision checks (Nature vs Life are too close for protan/tritan readers). They may only appear
  as a small dot **next to the class name or a trait name**, never alone and never as chart fills.
- Charts (composition bars) use a single hue (`#4a76b0`) with direct labels.
- Status always ships with an icon **and** a text label.

## Typography
- UI: **IBM Plex Sans** 400/500/600. Code/query/counts: **JetBrains Mono** 400/500. Self-host (no third-party requests).
- `font-display: optional`: a face that has not arrived as the page is first drawn waits for the next visit (the system font
  is shown meanwhile). Swapping it in re-flows the text and moves the page, much on Linux and Android (layout shift 0.4 in a
  test with a wide fallback); a first visit on a slow link may therefore not show Plex. A page must not depend on Plex metrics.
  The owner accepted this (2026-10-17): the system font on a first visit is fine, a page that jumps is not.
- Base 14 px desktop, 14–15 px mobile; trait names 15 px semibold; descriptions 13.5–14.5 px, line-height 1.6.

## Components (build once, reuse)
`QueryInput` (combobox), `Chip` (field + value, toggle NOT, remove), `KeywordToken` (kind + role, button),
`FacetButton`, `SectionToggle`, `RoleToggle` (applies / uses with counts), `Segmented`, `ResultRow`, `TraitCard` (compact),
`AddButton` and `PartyNotes` (what a card does with the party), `FocusCard`, `RelationSide`, `TraitLane`, `KeyPill`,
`ExplorationTrail`, `ArtifactFilter`, `SlotRow`, `MemberCard`, `StatTile`, `IssueRow`, `SuggestionCard`, `CoverageMatrix`,
`TimelinePhase`, `BottomSheet`, `TabBar`, `BackToTop`, `Toast`.

### Keyword tokens
Role is encoded by **shape**, not colour: *applies* = solid underline bar; *uses* = dashed outline; *resists* (GAME_RULES
R9) = solid outline. Colour is the kind: an *effect* (Dire Wolves, Mega Magic) takes the mechanic colour, since it is not
a status, and an *event* (attack, start of battle) its own, with the same shapes (it is caused, waited for or prevented). Search matches add a yellow highlight (`<mark>`, 22 % of `--status-warn`, which keeps every token colour above
4.5:1), also inside a token. The token is a toggle `button`: its accessible name says what the trait does with the keyword
(a shape cannot be heard) and what a click shows ("Applies Vulnerable — show traits that rely on it"), and `title` says the
same to the pointer. An event says it in the words of its filters, and who acts where the text names who: "Reacts to attacks
(this creature) — show traits that cause it" (*Causes*, *Reacts to*, *Prevents*; the colour and the shape say neither the role's
name nor the actor to a screen reader). `aria-pressed` and a 2 px ring in `--accent-border` mean its filter is on; a hover is a 1 px ring in
`--border-strong`. Never a fill: a match highlight over a lighter fill takes a debuff or the muted flag under 4.5:1, since
the token colours are only guaranteed on the page background. The look is one stylesheet (`styles/keyword.css`: the class
`keyword` with `data-kind` and `data-role`) that three things wear: the toggle button above, a **link** on the trait page
(`KeywordLink`, to the page of the keyword) and a plain `span` for a keyword that leads nowhere (the colour of its kind, no role shape).

### Facet panel and chips
- **Facet buttons** (`FacetButton`) are toggles: `aria-pressed`, a fill in `--accent-surface` with a `--accent-border` outline when
  on, and the count in mono, `--text-faint`, carrying its unit ("12 traits") for a screen reader. The two sides of a keyword
  (*Applies*, *Relies on*) sit in fixed columns so that the buttons of every keyword line up; each keyword is a `group` named
  after it (`KeywordRow`). Kind headings (Debuffs, Buffs, Effects, Events, Mechanics) take the kind colour and always say it in
  words.
- **Events** (`EventFacets`, the body of that section): first the **Who** control, a caption "Who acts" over a `Segmented` of four
  buttons in two columns (Any, This creature, Your creatures, Enemies; it is a `group` named "Who acts"). Each button is a toggle
  (`aria-pressed`): the three actors go on and off on their own and may be on together, *Any* is pressed while none of them is
  (pressing it turns them off), and none is pressed while the filters on name different actors. The chip row shows the
  actors of one event side side by side (`uses:attack/self` `uses:attack/enemy`) and the effective query reads them as an OR.
  Then five groups under small headings in `--text-faint`, 11 px
  (`h5`: Battle and turns, Actions, Hits, Life and death, Buffs and debuffs). Each event is a row like a buff's, with its two sides
  *Causes* and *Reacts* in columns 76 px wide. The caption and the headings are plain text, so a keyboard meets only the Who
  buttons and the sides, and the section is open to begin with like the others (nothing moves on load).
- **Clear filters** is the first control of the panel, a quiet button (as the party toolbar's) that says how many filters it takes
  off ("Clear filters (3)"). With none on it is `aria-disabled`, not `disabled`, and says "Clear filters": the focus stays on it
  when its own press clears the last filter, and a polite line says what was done ("Cleared 3 filters."). Under a coarse
  pointer it is 44 px high.
- **Sections** (`SectionToggle`): the heading of Class, of each kind of keyword (Debuffs … Mechanics) and of Flags holds a button
  with a chevron (down open, right shut, drawn the same way with or without motion), the heading's own text style and colour,
  and the inset of a facet button; the heading keeps its level (h3, h4 for the kinds) and the button is the disclosure
  pattern: `aria-expanded` and `aria-controls` the part below, which is `hidden` while shut (out of the tab order and of the
  reading order, still in the page). Shut, the button adds how many filters are on inside in mono, after a dot that a screen
  reader skips ("Debuffs · 2 on", read "Debuffs 2 on"); open, nothing is added. The hint "any of" is shown only while the
  classes are open. Under a coarse pointer the button is 44 px high.
- **Classes**: the five classes of a creature, then a 1 px rule (`--border`, decoration only: no role, no name), then the
  others, in the order SPEC §8.1 gives.
- **The panel stays in view** beside the long list: sticky, with a scroll of its own, as tall as the window leaves it
  (`trackViewportOffset` keeps `--viewport-offset`, the distance from the top of the window to the columns, so that at the top of
  the page it is not cut by the fold). Under 700 px it is a **bottom sheet** instead (`FiltersRegion` swaps the two): a
  `BottomSheet` is a native modal `<dialog>` as wide as the window and at most 720 px (88 % of its height) tall, on `--surface-1`
  with 16 px round top corners over a `--scrim` backdrop; a title (`h2`), the panel in a scroll area of its own, and a primary
  button in `--accent` that closes it and says what the filters now show ("Show 226 traits"). A button at the foot of the window,
  in a fixed bar (`--bg-bar`), opens it ("Filters", with the number of filters on in `--accent`, read "Filters 2 active"), so
  that it is at hand wherever the long list is scrolled to; the page leaves room for the bar. The sheet closes with Esc, with its
  button, and by a tap on the dimmed page; the focus then returns to the "Filters" button (set by the page: Safari does not
  focus a button that is clicked, so the dialog cannot be left to remember it). Opening it is no step of the history, and the
  page behind does not scroll. A polite line inside the sheet says the result count, since the live region behind it is inert.
- **Chips** are `Chip`: `field:` in `--text-muted` mono, then the value. A query term is a button named after what a press does
  ("weak — exclude it", "NOT weak — include it again": the name always holds the visible text, WCAG 2.5.3, so it is not an
  `aria-pressed` toggle), an excluded one says NOT in words and is tinted with `--status-crit` at 9 % (axe measured 4.38:1 for `--text-faint` over a
  14 % tint: the tint stays light enough for `--text-muted` over it to keep 4.5:1); a filter chip is plain text. The remove button is an icon with an accessible name.
- **Effective query**: `--text` mono, wrapping (no scroll area), a quiet *Copy query* button, and "Copied" in `--status-good`
  for 2.5 s in a polite live region (not `role="status"`: the result count owns that).

### Query issues
What is wrong with the query (QUERY_LANGUAGE §5), in the search field and under it. Never colour alone: an icon and a word say the severity.
- **Badge** (`IssueBadge`), inside the frame of the field at its right end: a mono pill, 24 px, with the icon and "2 issues" in `--status-crit`
  (any error among them) or `--status-warn`, outlined in the same colour. It is a button (`aria-expanded`, `aria-controls` the list) as tall
  as the field (44 px over the frame, where the pill is 24). A query that arrives with the address moves nothing: the badge takes room from the
  text inside the field, not from the page. It has a 2 px ring of its own around the pill when focused, besides that of the field.
- **List** (`QueryIssues`), under the field, shut or open by the badge: a `list` named "Query issues", a row for each issue (at most five, then
  "and N more" in `--text-muted`) on `--issue-error-surface` or `--issue-warn-surface` with a 1 px border of the matching `--issue-*-border`
  (decoration: the icon and the word carry the severity). A row is the icon (a crossed circle for an error, a triangle for a warning), the word in
  bold, the message in `--text` and, to its right (under the message on a phone), the fix: a quiet button as the party's (`--surface-3`,
  `--border-strong`), 44 px under a coarse pointer, named by what it does ("Change to “class:”", "Add the missing “)”"). The page scrolls: the
  list pushes the chips down.
- **Focus.** Pressing a fix with a pointer leaves the focus in the field (the keyboard of a phone stays up); from the keyboard the focus goes to
  the field after the fix, with the caret after the edit. The order of the tab key is the field, the badge, the fixes, the chips.
- **Said aloud.** `aria-invalid` on the field for errors only; its description is the text of each issue listed; a polite line (a plain
  `aria-live`, not a `status`: the result count owns that) says the count after a pause and the result of a fix.

### Suggestions
What may be typed at the caret (QUERY_LANGUAGE §6), in a list under the search field. The field is a plain text field until the page is idle,
or the focus or a pointer arrives; then the assist layer (ADR-0010) attaches to the same `<input>` and it becomes an editable combobox (ARIA
APG). Nothing is swapped, so the focus is not lost and nothing moves; a layer that cannot be fetched leaves the plain field.
- **List** (`Combobox`): a `listbox` named "Suggestions", nine options at most, drawn over the page from the left to the right edge of the
  query box on `--surface-2` with a `--border-strong` line and `--shadow-popup`. It sits under the list of issues when that is open, not over it:
  the fixes stay in reach of a pointer. It is under the bars fixed to the foot of the window (`z-index` 4, the bars 5 and 6): on a phone nine
  rows reach down to them, and the Filters button and the tabs stay pressable. The list does not scroll (a scroll area is a tab stop for axe);
  the page scrolls to the active option, clear of the bars (`scroll-padding-bottom`).
- **Option**: three columns. A badge in mono capitals with the kind in a word (Debuff, Field, Operator, Trait…; coloured as a keyword of the
  kind for a buff, a debuff, a mechanic and an event, `--text-muted` otherwise); what is written, in mono (`--text-strong`), with what it means
  beside it (under it on a narrow screen, `--text-faint`); and how many traits it finds, right-aligned in a column of 3.5 rem that is held while
  the count is not there yet. 44 px tall under a coarse pointer. The active option is `--accent-surface` with a 3 px bar of `--accent` at its
  left (forced colours: a 2 px `Highlight` outline); the pointer's hover is `--surface-3` and activates nothing.
- **Counts.** The first option is counted with the list, since it is the one that is active as the person types; the others follow, three at a
  time, each step after a paint, so that a keystroke is never held up by nine searches. A count is the number of traits that Enter would show,
  filters included (D18).
- **Said aloud.** The field has `role="combobox"`, `aria-autocomplete="list"`, `aria-expanded`, `aria-controls` the list and
  `aria-activedescendant` the active option, whose name is all of its text: "Debuff applies:vulnerable applies “vulnerable” 42 traits". A polite
  line inside the frame of the field says the size of the list ("9 suggestions") once it has kept it for half a second.
- **Focus** never leaves the field. Typing makes the first option active, so Tab and Enter take it; ↑ ↓ move (and wrap), Esc puts the list away.
  After an accept, a caret move, Esc or a blur nothing is active and Tab is the browser's again.

### Party panel
- **Slots** (`party-slot`): a row per slot, `--surface-2`, with the slot name in mono capitals (`--text-faint`), a class dot and
  the trait name. The slot is a toggle that makes it the target: `aria-pressed`, filled `--accent-surface` with a
  `--accent-border` outline, and the word *Target* in `--accent` (not colour alone). An empty slot says "Empty" in `--text-faint`;
  a trait the dataset does not know shows its id in `--status-warn` and "Not found in vX", with a button under the slot,
  "Search for “name”". The clear button is an icon with
  an accessible name; the accessible name of the slot says which slot and what it holds ("Target slot: Creature 2 · Fused, …").
- **Synergies link** of a slot (`SynergiesLink`, variant `slot`): between the slot and its clear button, a square of the same size and
  look with the Synergies icon alone; its name, “Synergies of *trait*”, is also its `title`. A slot that is empty, or whose id the dataset
  does not know (it offers the search for the name), has none. It carries the party to `/synergy/<id>`.
- **Toolbar**: the count (`3/18 slots`, mono), *Undo*, *Redo*, *Clear party*, *Copy link* (`CopyButton`, shared with the
  effective query: a quiet button and a polite line that says "Link copied", or in `--status-crit` that it could not, and then the
  link is shown to select). They are `aria-disabled`, not `disabled`, when there
  is nothing to do, so that the focus is not lost when the last undo is done.
- **Add button** (`AddButton`, with `PartyNotes` for the sentences under it; a result, a lane card and the focus card share them, each
  in its variant: the words from 700 px and a square under it; a square with the plus always, 30 px, 44 under a coarse pointer; always the
  words): `--accent-surface` with `--accent-border`, a plus and "Add to Creature 1 · Innate"; its accessible
  name ends with the trait's name (the plus is decoration; under 700 px the plus is all that is drawn, § Result list). Refused for
  the target slot, the reason sits under it in `--status-crit` with an icon, tied to it with `aria-describedby`, and the button
  changes with what else the trait can do: when another slot of the creature takes it, it stays `--accent-surface` and reads
  "Add to…" (`aria-haspopup="dialog"`, named "Add to… — *trait*"; under 700 px three dots stand where the plus was) and opens the
  slot sheet; when no slot takes it, it is `--surface-2` with `--text-faint`, stays in the tab order (`aria-disabled`) and a
  press announces the reason. "In party: Creature 1 · Innate" below is `--status-good` with a check.
- **Slot sheet** (`SlotChooser`, the `choice` kind of `BottomSheet`): the title "Add *trait* to Creature 1", the rule's sentence in
  `--text-muted`, then one 44 px button per slot of that creature that takes the trait, in `--accent-surface` with an icon (a plus
  for an empty slot, two arrows for "Replace Y in Artifact", a check for "Already in Artifact") and a quiet "Cancel"
  (`--surface-3`, no fill in `--accent`: letting go is not what the sheet is for). It is as tall as its content, at the foot of the
  window under 700 px and a 440 px dialog in the middle from there. It has no live line of its own: the player is told on the
  page once it has closed.
- **Coverage**: chips in the colour of the keyword's kind; a dependency is a button with an icon and the word *covered*
  (`--status-good`) or *missing* (`--status-crit`, outlined); duplicates are `--status-warn` with an icon, one line per trait
  with the places of its copies.

### Result list
The page scrolls, not the list: results sit among other panels and stack under the filters on narrow screens. The list
is virtualised against the window (rows in the flow of the page between two spacers; `aria-setsize` / `aria-posinset` say
where a row stands in the whole). Rows are as tall as their text; the browser's find-in-page sees only the rows drawn.

A row is a **card**: the name and where the trait comes from (the *head*), the add button, the description, a *foot* and what
the party says about the trait. The button comes before the description in the page, so the keyboard reaches it first and the
keywords after it, as the eye does. The foot holds the material on the left and, on the right, the **Synergies link** (`SynergiesLink`,
PLAN 13.7): a small version of the Synergies icon and “Synergies of *name*” in `--accent`, underlined when pointed at, a link to
`/synergy/<id>` that carries the party (and not the search: the address of Explore, which Back returns to, has it). It is the last stop
of the card for the tab key. The foot wraps, the link going under the material on a narrow card; under a coarse pointer the link is
44 px high, so the foot is as tall as the link. The list estimates a row at 175 px from 700 px wide and 200 px under it (the means of
the rows drawn from the published sheet, `results-list.svelte`): an estimate far from the rows makes the scroll bar lie and the jump
to the end of the list take several rounds of measuring. From 700 px the party's notes (the reason for a refusal, "In party") sit in a column of their
own beside the text, with the button on top. **Under 700 px** the column is gone: the button is a 44 × 44 px square with a plus,
at the top right beside the name (as in `Mobile.dc.html`; its words are not drawn, but its name still says them and the trait:
"Add to Creature 1 · Innate — Flesh Rot"), and the notes go under the material, left-aligned.

### Back to top
A 44 px square, icon only (an arrow under a rule; the name "Back to top" is its `aria-label`), fixed 8 px from the top and the
right of the window, in `--surface-3` with a `--border-strong` outline and `--text-strong`. It is on the page only once the page is
scrolled more than a screen (`showsBackToTop`) and only while Explore is in view: not on the Party tab. A press takes the page to
its top **at once**, not smoothly (a smooth scroll is stopped within pixels by the virtual list, which corrects the scroll as it
measures the rows it passes), and moves the focus to the heading of the page, which is visually hidden and takes
`tabindex="-1"`. Never to the search field: on a phone that raises the keyboard. A person who asked for less motion loses nothing.
While it is there the root has `scroll-padding-top` (`--top-room`, base.css) larger than the button, so a control that takes the
focus from above is scrolled clear of it, as the bars at the foot are (§ Accessibility). The button is the last control of the
page's content in the document (the list is endless to a tab key going forward, and wide, the party is at the top of the page
and would scroll it away): Shift+Tab from the foot finds it, and the Home key is the quick way for a keyboard. The scroll and
size of the window are watched once for it and for `trackViewportOffset` (`page-scroll.ts`).

### Synergy pages (M13)
The pages under `/synergy` (ADR-0011) are a column of sections as wide as a line of text reads well (880 px at most, 16 px gutters on a
phone): the `h1` (24 px), then sections with an `h2` (15 px). The layout of the routes holds the relations and the party; a page that
waits for the dataset shows "Loading the traits…" (`role="status"`), or for good the alert of the failure (`LoadStatus`).
- **Trait picker** (`TraitPicker`): the frame of the search field (accent border, 44 px, the focus ring around the whole bar, 16 px
  text under coarse) and the same list under it (`Combobox`): a *Trait* badge, the name in the mono face, then "creature · family ·
  class" beside it, which tells two traits of one name apart. An empty field lists nothing; Enter takes the first match (it is
  active as the person types), a press takes any; taking one opens the trait's page as a step of the history and empties the field.
- **Keyword picker** (`KeywordPicker`): links, a group for each of Debuffs, Buffs and Effects (an `h3` in small capitals), each a 32 px
  pill (44 under coarse) with the name in the colour of its kind; the page's own keyword has the accent fill and ring and
  `aria-current="page"`. Given the counts of the keywords (`stats`: the page of a keyword gives them, the picker page does not), each pill
  also shows two numbers in mono, each after a small arrow (up and to the right: traits that apply it; down and to the right: traits that
  rely on it), and a line above the groups says what the arrows mean. The arrows and numbers are `aria-hidden`: the link's name carries
  the counts in words, "Weak, 2 appliers, 3 users".
- **Start from your party**: the filled slots in reading order, the slot in mono and the trait as a link; a slot whose id the dataset
  lacks shows the id in `--status-warn` and "Not found in vX". With an empty party it says so and links to Explore.
- **Not found**: a trait id the dataset does not know is a page, not an error: "Trait not found", the sentence that names the id and
  the version, the traits with a similar name as links (at most 8, "No trait has a similar name." when none), and the picker with the
  name the id kept already typed in. An unknown keyword slug says so and lists the keywords.
- **A trait page** (`/synergy/<id>`): the picker and the *Artifact-eligible only* checkbox in a row (`ArtifactFilter`: `mat=yes`, a step of the
  history; a polite line says the counts it leaves, in every list that has one: "Only traits with a material are listed. Enabled by 6 traits.
  Enables 12 traits. Alternatives 5 traits. Same trigger 40 traits. Same family 3 traits."), the trail, then three parts: from 1100 px in one
  row (Enabled by · the focus · Enables, the page up to 1280 px wide), below it in one column in the order of the page, the focus first,
  which is the order of the keyboard too; and under them, past a rule, the three lists of *The lists under the sides* below. **Under 700 px
  the page is another arrangement of the same parts** (*On a phone* below).
  - **The focus card** (`FocusCard`, a region named "Focused trait"): the caption "Focus", the `h1` with the class dot (`tabindex="-1"`: it
    takes the focus when the page moves to another trait), "creature · family · class", the description, a `dl` of *Relies on*, *Applies*,
    *Guards against* (only when the trait has one), *Triggers* (an event, with who acts where the text says: "Attack (this creature)") and
    *Material* ("—" where a row has nothing; "No material — not artifact-eligible" in `--status-crit`, with the cube), then the actions: the
    add button with words, and "Open in Explore", a link to Explore searching `trait:"Name" family:Family` (the party carried). The notes of
    the party sit under them. In the description a buff, a debuff or an effect is a link to its keyword (named "Relies on Weak — see who
    applies it and who relies on it"); an event, a mechanic and a flag are text in their kind's colour (R12: no event is a dependency).
  - **A side** (`RelationSide`): an `h2` ("Enabled by", "Enables") whose count a screen reader hears as "36 traits", a hint ("Traits that
    apply what X relies on"), then **lanes** (`TraitLane`, a region named by its `h3`, with the count): first *Several keys* (a trait that
    ties through two keys or more is there once, "×2 links", and says "through Weak · Vulnerable"; a key it gives in a weaker way than the
    rest is "Weak (random)"), then one lane for each key with traits of its own, whose `h3` is a `KeyPill` (a pill in the colour of the
    kind; the words say the rest: "Applies Weak" on the Enabled-by side, "Relies on Weak" on the other). A key that nobody gives (or relies
    on) is a dashed note after the lanes ("No trait applies X in the compendium.", in `--status-crit` on the Enabled-by side; "Nothing relies
    on X yet in the compendium."; with the filter on, "… among artifact-eligible traits."), and a side with no key at all says why
    ("Self-sufficient: X doesn’t rely on any buff, debuff or effect."; "X applies no buff, debuff or effect by name, so no trait is listed as
    relying on it.", D27).
  - **Random sources** are the last of their lane, as a group under an `h4` "Random sources · N" with a line that says they afflict a random
    debuff on enemies, so the key is not certain. Up to 3 are listed; more are behind the button inside the `h4` (`SectionToggle`:
    `aria-expanded`, `aria-controls`), and the cards of a folded group are not drawn (v2.0 has 27 for each debuff that can be random). Traits
    that give the key only under a condition (R10) stay with the others, tagged *conditional*.
  - **A card** (`TraitCard`, a list item on `--surface-1`): the class dot, the name as a **link** ("Re-centre on X": a step of the history that
    carries the party and the filter), "creature · class" (a mastery, backer or avatar trait: its kind and family), tags in mono (×N links on
    `--accent-surface`, *conditional*, *random*, "no material" with the cube in `--status-crit`), the compact add button, and the notes under
    the text. A trait is a card at most once on each side.
  - **The lists under the sides** (`RelatedSection`; the wording is `related-sections.ts`): *Alternatives*, *Same trigger* and *Same family*, in
    that order, side by side from 1100 px and in one column below it (the tabs of a phone are *On a phone* below). Each is a region named by its `h2` and the
    count ("Alternatives 6 traits"), with a sentence under it ("Traits that apply or rely on the same keys as X"), and **cards** of the same
    `TraitCard` as the lanes: an alternative says what it shares, "Also applies Weak, Vulnerable · relies on Burning" (the focus's keys, by
    what the trait does with them), a trait of the same trigger "Also reacts to Attack, Start of battle", and both carry "×2 in common" once
    they share more than one; a trait of the same family has no line of its own (its origin says the rest: the mastery first, "Mastery
    trait · Family"). Six cards show; a longer list has a button **in the heading row, before the cards** ("Show all 67", named "Show all
    67 — Alternatives"; `aria-expanded`, `aria-controls` the list, and "Show fewer" when open) so that it does not move when the list
    grows, the focus stays on it and the tab key goes on into the cards. Plain DOM: 200 cards cost 23 ms to open (118 ms at 4× CPU), so
    no virtual list. Above 200 (Same trigger has up to 548) the button says "Show the first 200" and a note under the list says "Showing the
    first 200 of 548. The artifact filter above narrows the list." A trait starts with every list shut. A list with nothing says why, in a
    dashed note: no key by name to compare ("X applies and relies on no buff, debuff or effect by name…"), no event ("X reacts to no
    event, so no trait is listed with it."), nobody else, in the words of the filter ("… in the compendium" / "… among artifact-eligible
    traits"). **A grouping is not a family** (PLAN D36): Exotic, Backer, Avatar and Zantai file traits together in the sheet but no mastery
    trait is named for them (every real family has exactly one), so their *Same family* has no count and no card, only "Exotic is a
    grouping in the compendium, not a family" and "No mastery trait is named for it, so its traits are not listed together."
  - **The trail** (`ExplorationTrail`, a `nav` named "Exploration trail", not drawn for one step): the last six traits centred on, oldest first,
    chevrons between (decoration); the steps before the last are links, the last is text with `aria-current="location"`. It is the memory of
    a session of exploring: a visit that opens the app (a deep link, a reload) starts it empty, the picker page empties it, a step cuts it
    back to there, and Back and Forward add the trait they arrive at as a click does.
  - **Moving the focus**: after a move to another trait (a card, a step, the picker, Back or Forward) the focus is on the new `h1`; a deep link
    and the writing of the party or the filter leave it alone. The document title follows the trait, and SvelteKit’s own announcer says it:
    no polite line of ours repeats it (a “Now centred on X” was left out on purpose, PLAN 13.3).
- **A keyword page** (`/synergy/kw/<slug>`, PLAN 13.5): the *Artifact-eligible only* box, the summary, two lists side by side from
  700 px (under it two tabs, *On a phone* below), and the picker of the other keywords last (D39; under 700 px a sheet). The party and the
  filter go with every link of the page.
  - **The summary** (`KeywordSummary`, a card on `--surface-1` with the accent border): the `h1` is the name as a pill in the colour of
    the kind (`KeyPill` at the size of the heading; `tabindex="-1"`, it takes the focus when the page moves to another keyword) and the
    kind in words beside it; the counts, "**8** apply it · **6** rely on it" (the verb agrees with the number: "1 applies it"); in muted
    text, when there are any, how many more give the key under a condition or at random ("27 more afflict a random debuff, which may
    be this one."), which the two counts leave out (D40); the verdict, an icon (a check in a circle, a warning triangle, a crossed
    circle: good, caution, bad), its title in the colour of that tone and its reason in muted text; and “Often applied together with”,
    the keywords its appliers also apply (at most 9 on v2.0, so none is cut) as pills in the colour of their kind, each followed by the
    number of appliers that apply it too (spoken “, applied by 4 of its appliers”). The verdicts (`copy.verdicts`): *Well supported*
    (good), *Scarce enabler*, *No payoff yet*, *Only by chance*, *Only under a condition* (caution), *No source* (bad). Only
    *supported*, *scarce* and *no-payoff* show on v2.0; the other three are held by unit tests.
  - **The lists** (`RelatedSection`, which the three lists under a trait's sides use too): *Appliers* and *Rely on it*, each an `h2` with
    the count, a sentence (“Traits that apply Weak by name”), 6 cards and the button that opens the rest (D37), and in the heading row,
    after the button, a link “See in Explore” (named “See in Explore — Appliers”) to Explore with `kw=a:key` or `kw=u:key`, the artifact
    filter (`mat=yes`) and the party: Explore then lists exactly the traits of the list (ROADMAP criterion 11). The card is a trait card
    whose link is named “Open X” (no trait is at the centre of the page to re-centre on). After the cards of *Appliers*, groups of the
    traits that give the key in a weaker way, each with its own count and sentence, whose cards say the same in a tag: *Under a
    condition · N* (R10), then *Random sources · N* (R5), folded behind a button above 3 as in the lanes (`CardGroup`, shared with
    them). A list with nothing says why in a dashed note (“No trait applies X by name …” when a weaker source gives it).
  - **Moving and saying** (D41): a move to another keyword (a chip, a keyword of the summary, Back) puts the focus on the new `h1` and
    says once, politely, the keyword, its counts, the verdict and its reason; a turn of the artifact filter says the counts of the two
    lists and the verdict's title; a page opened by its address says nothing and leaves the focus alone.
- **On a phone** (under 700 px, PLAN 13.6, D44–D48). The page scrolls, as a column of one list at a time: nothing is fixed at its top and no
  list scrolls within the page. The arrangement is decided by `MediaQuery('width < 700px')` in the two pages (they are not prerendered)
  and by the stylesheet's `width < 700px` for what only changes the look; the two meet at the same width.
  - **Tabs** (`SectionTabs`, a `tablist` named "Relations" on a trait, "Keyword lists" on a keyword): the four lists of a trait (Enabled by ·
    Enables · Alternatives · Related, the last holding Same trigger over Same family) and the two of a keyword (Appliers · Rely on it),
    one tab to a list, each 44 px tall with the label above its count in mono, the selected tab in `--accent-surface` with
    `--accent-border`. ARIA tabs pattern: the selected tab is the one stop of the tab key, ←/→ go round and select, Home and End go to the
    ends. A tab's name says the count in words ("Enabled by 36 traits"); *Related* counts the traits of Same trigger and Same family
    together, a trait in both once, and none of a grouping that is no family (D36). The panel of a tab is the box that holds its list
    (`role="tabpanel"`, named by its tab); the others are `hidden`, so their controls are out of the tab order. A list's own heading
    stays for a screen reader and is not drawn when the tab already says it (Related keeps both: its tab is not their name).
  - **The address** keeps the tab: `section=enables` (`enabled-by`, `enables`, `alternatives`, `related`, `appliers`, `users`), a step of the
    history like the tabs of Explore, nothing written for the first tab. A section the page does not have, or one named on a wide screen,
    changes nothing. A link to another trait or keyword carries the party and the filter, never the section: the next page starts on its first tab.
  - **The trail** is one row of 44 px pills that scrolls sideways (the one thing of the page that does), the chevrons and the caption left
    out, scrolled to its end so that the pill of the trait the person is on is in sight.
  - **The focus card** is tighter (no caption, less padding) and its description folds to 3 lines with a "Show more" button (`aria-expanded`,
    `aria-controls`) that opens it ("Show less"); a description that fits has no button. Another trait starts folded. A keyword in the part
    that is cut takes the focus → the text opens (Chrome scrolls the folded box to it, Safari does not: both are read), so that the focus
    is never on what cannot be seen.
  - **The pickers are sheets** (`PickerSheet`, the `panel` kind of `BottomSheet`): on a trait page a button "Find a trait" opens a sheet with
    the focus in its field (the list of matches has the room the keyboard leaves), on a keyword page a button "Other keywords" opens the
    42 chips with their counts, where from 700 px they are the last section of the page. A pick moves to the page and closes the sheet, and the
    page puts the focus on its `h1`; put away by hand (Esc, Close, a tap on the page behind), the sheet gives the focus back to its button.
    The picker page and the pages of what is not found keep their pickers in the page: they are what those pages are for.
  - **Touch**: every control is 44 px (`touch-targets.test.ts` measures each tab of both pages and the open sheets); the page is never wider
    than the window, at 320 px as at 390 (`synergy-mobile.test.ts`).

## Layout
- Desktop Explore: header · query section · three columns (facets 250–300 px | results fluid | party 340–400 px) that
  wrap on narrow widths.
- Narrow (under 1100 px, where the party has no room beside the list): one view at a time, picked by a bottom tab bar
  (`TabBar`: the Explore and Party tabs, and beside the tab list, not in it, the link to Synergies, a page of its own; 64 px, icon
  over name, the selected tab has a rule above it and an accent colour; the Party tab carries the count of filled slots). Explore
  is the header, search, chip row, facets (a column from 700 px) and results; Party is the planner alone, at most 520 px wide
  and centred.
- **Synergy pages**: a column of 880 px at most; the page of a trait is 1280 px at most from 1100 px, where it has three columns (§ Synergy pages).
- **Places of the app** (ADR-0011, PLAN D23). From 1100 px the header carries Explore · Synergies · Party n/18 (`SiteNav`, a `nav`
  named Pages); under 1100 px the same three are at the foot of the window (`BottomBar`, which is not there from 1100 px): on Explore
  the two tabs and the Synergies link, on the Synergy pages a `nav` named Sections of three links in the same places, so that the
  items do not move when the person changes page. Every link carries the party (the address is the source of truth), the page the
  person is on has `aria-current="page"` (a fill in the header, the rule and the heavier name at the foot), and Party goes to Explore
  with `tab=party`, where a wide screen has the party as a column. Tabs and links look alike (`.bar-item`).
- Mobile (under 700 px): header + search + chip row; results; the tab bar. Filters and fixes open as bottom sheets (§ Facet
  panel and chips), the Filters button in a bar of its own above the tab bar, on Explore only. No fake status bars or keyboards
  in mockups; the syntax toolbar docks above the system keyboard.

## Accessibility (WCAG 2.2 AA)
- Real elements: `button`, `a[href]`, `input` + `label`. No click handlers on `div`/`span`.
- Visible focus ring (`--accent`, 2 px). Bars fixed to the foot of the window must not hide a focused control: the root's
  `scroll-padding-bottom` is their height (`--bars-height`, base.css). A component that draws an outline of its own (the role of
  a keyword token) must put the ring back for `:focus-visible`, or its outline stands in for it.
- **Keyboard** (criterion 8). `keyboard.test.ts` presses Tab through Explore, the Party tab and the open filters sheet, and fails
  for a control the tab key never reaches (arrow keys reach the unselected tabs), one that shows no 2 px ring, or one under a
  fixed bar; and it does a search, an add, Undo / Redo / Clear and a filter without a pointer. It walks the Synergy pages too (the
  picker with a party, a trait, a trait with lanes and a party, a keyword, and the two pages of what is not found), and goes from
  Explore to the Synergies and back by the keyboard. The filters are over a hundred
  buttons, so a link after the query, "Skip filters" (visible on focus, from 700 px), moves to the head of the results. A sheet
  puts the focus on its title when it opens. Safari's tab key skips links unless its settings say otherwise: the test does not
  count a link as missed there.
- **Screen reader**: a person's check, `SCREEN_READER_CHECKLIST.md`.
- **Touch targets** (`pointer: coarse`, which the Pixel 7 and iPhone 14 e2e projects match): every `button`, `a`, `input`,
  `select` and tab is at least 44 × 44 px (WCAG 2.5.8 asks 24), a checkbox counting with its label. `touch-targets.test.ts`
  measures them on Explore (with a query and a filter on, and with the issues list and the list of suggestions open), in the open filters sheet, on the Party
  tab and on the Synergy pages (the picker with its list open, a trait, a keyword, the two pages of what is not found), and names the
  controls that must have been measured. A bordered control is as large as its *inner* button: the chip is 2 px taller than the
  target, the segmented frame 6 px. The one exception is a control **in a sentence** (the keywords of a description, the link of
  the footer's credit): it is as tall as its line, which WCAG 2.5.8 allows (Inline), and a taller hit area would cover the
  line beside it.
- **Text fields and selects** (the search field, the sort, the trait picker) are 16 px under `pointer: coarse`: iOS zooms the page in when a field
  with less takes the focus, and leaves it zoomed. The viewport meta stays as it is (`initial-scale=1`, no `maximum-scale`):
  stopping the zoom would stop a person from zooming (WCAG 1.4.4). `touch-targets.test.ts` reads the computed size of every text
  field and select on Explore, in the open sheet, on the Party tab and on the Synergy pages.
- Contrast: text ≥ 4.5:1 (≥ 3:1 at 24 px+). `contrast.test.ts` reads `tokens.css` and checks every text colour on every surface
  (`--bg`, `--bg-bar`, `--surface-1…3`, `--accent-surface`), the text of a description under the match highlight (on `--bg`, where
  the descriptions are: a text colour that passes there can fail on a lighter surface, as `--text-muted` does on `--surface-2`),
  the text of an issue (`--text`, and `--status-crit` or `--status-warn`) on its own surface, and the lines that show a state or frame the
  search field (`--accent`, `--accent-border`) at 3:1 (WCAG 1.4.11). `--border` and
  `--border-strong` are dividers and the frame of buttons that name themselves in words: they carry no information and are not
  held to 3:1. A new token or a new surface goes in that test's lists.
- Combobox per ARIA APG; result count in an `aria-live="polite"` region; bottom sheets are dialogs with focus trap and
  return focus on close; tabs use `tablist`/`tab`/`tabpanel`; the coverage matrix is a real table (or ARIA table roles).
- `aria-pressed` on toggles, `aria-current` on nav and breadcrumbs.
- Respect `prefers-reduced-motion`. No information by colour alone.

## Copy
English UI, short and literal ("Relies on", "Applies", "No source"). Game terms keep the game's capitalisation.
i18n-ready (strings in one module) though only English ships in Phase 1.
