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

Keyword kinds: debuff `#ff9b87`, buff `#74dbb0`, mechanic `#a9c1ff`, trigger `#f3c969` (dotted underline), flag muted italic.
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
- Base 14 px desktop, 14–15 px mobile; trait names 15 px semibold; descriptions 13.5–14.5 px, line-height 1.6.

## Components (build once, reuse)
`QueryInput` (combobox), `Chip` (field + value, toggle NOT, remove), `KeywordToken` (kind + role, button),
`FacetButton`, `RoleToggle` (applies / uses with counts), `Segmented`, `ResultRow`, `TraitCard` (compact),
`SlotRow`, `MemberCard`, `StatTile`, `IssueRow`, `SuggestionCard`, `CoverageMatrix`, `TimelinePhase`, `BottomSheet`,
`TabBar`, `Toast`.

### Keyword tokens
Role is encoded by **shape**, not colour: *applies* = solid underline bar; *uses* = dashed outline; *resists* (GAME_RULES
R9) = solid outline. Colour is the kind: an *effect* (Dire Wolves, Mega Magic) takes the mechanic colour, since it is not
a status. Search matches add a yellow highlight (`<mark>`, 22 % of `--status-warn`, which keeps every token colour above
4.5:1), also inside a token. The token is a toggle `button`: its accessible name says what the trait does with the keyword
(a shape cannot be heard) and what a click shows ("Applies Vulnerable — show traits that rely on it"), and `title` says the
same to the pointer. `aria-pressed` and a 2 px ring in `--accent-border` mean its filter is on; a hover is a 1 px ring in
`--border-strong`. Never a fill: a match highlight over a lighter fill takes a debuff or the muted flag under 4.5:1, since
the token colours are only guaranteed on the page background.

### Facet panel and chips
- **Facet buttons** (`FacetButton`) are toggles: `aria-pressed`, a fill in `--accent-surface` with a `--accent-border` outline when
  on, and the count in mono, `--text-faint`, carrying its unit ("12 traits") for a screen reader. The two sides of a keyword
  (*Applies*, *Relies on*) sit in fixed columns so that the buttons of every keyword line up; each keyword is a `group` named
  after it. Kind headings (Debuffs, Buffs, Effects, Triggers, Mechanics) take the kind colour and always say it in words.
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

### Party panel
- **Slots** (`party-slot`): a row per slot, `--surface-2`, with the slot name in mono capitals (`--text-faint`), a class dot and
  the trait name. The slot is a toggle that makes it the target: `aria-pressed`, filled `--accent-surface` with a
  `--accent-border` outline, and the word *Target* in `--accent` (not colour alone). An empty slot says "Empty" in `--text-faint`;
  a trait the dataset does not know shows its id in `--status-warn` and "Not found in vX", with a button under the slot,
  "Search for “name”". The clear button is an icon with
  an accessible name; the accessible name of the slot says which slot and what it holds ("Target slot: Creature 2 · Fused, …").
- **Toolbar**: the count (`3/18 slots`, mono), *Undo*, *Redo*, *Clear party*, *Copy link* (`CopyButton`, shared with the
  effective query: a quiet button and a polite line that says "Link copied", or in `--status-crit` that it could not, and then the
  link is shown to select). They are `aria-disabled`, not `disabled`, when there
  is nothing to do, so that the focus is not lost when the last undo is done.
- **Add button** on a result: `--accent-surface` with `--accent-border`, "Add to Creature 1 · Innate"; its accessible name ends
  with the trait's name ("+" is decoration). Refused for the target slot, it is `--surface-2` with `--text-faint`, stays in the
  tab order (`aria-disabled`), and the reason sits under it in `--status-crit` with an icon, tied to it with
  `aria-describedby`. "In party: Creature 1 · Innate" below is `--status-good` with a check.
- **Coverage**: chips in the colour of the keyword's kind; a dependency is a button with an icon and the word *covered*
  (`--status-good`) or *missing* (`--status-crit`, outlined); duplicates are `--status-warn` with an icon, one line per trait
  with the places of its copies.

### Result list
The page scrolls, not the list: results sit among other panels and stack under the filters on narrow screens. The list
is virtualised against the window (rows in the flow of the page between two spacers; `aria-setsize` / `aria-posinset` say
where a row stands in the whole). Rows are as tall as their text; the browser's find-in-page sees only the rows drawn.

## Layout
- Desktop Explore: header · query section · three columns (facets 250–300 px | results fluid | party 340–400 px) that
  wrap on narrow widths.
- Narrow (under 1100 px, where the party has no room beside the list): one view at a time, picked by a bottom tab bar
  (`TabBar`: Explore · Party, with Synergies in Phase 2; 64 px, icon over name, the selected tab has a rule above it and an
  accent colour; the Party tab carries the count of filled slots). Explore is the header, search, chip row, facets (a
  column from 700 px) and results; Party is the planner alone, at most 520 px wide and centred.
- Mobile (under 700 px): header + search + chip row; results; the tab bar. Filters and fixes open as bottom sheets (§ Facet
  panel and chips), the Filters button in a bar of its own above the tab bar, on Explore only. No fake status bars or keyboards
  in mockups; the syntax toolbar docks above the system keyboard.

## Accessibility (WCAG 2.2 AA)
- Real elements: `button`, `a[href]`, `input` + `label`. No click handlers on `div`/`span`.
- Visible focus ring (`--accent`, 2 px). Touch targets ≥ 44 px on mobile. Bars fixed to the foot of the window must not hide
  a focused control: the root's `scroll-padding-bottom` is their height (`--bars-height`, base.css).
- Contrast: text ≥ 4.5:1 (≥ 3:1 at 24 px+). Check `--text-faint` on every surface it is used on.
- Combobox per ARIA APG; result count in an `aria-live="polite"` region; bottom sheets are dialogs with focus trap and
  return focus on close; tabs use `tablist`/`tab`/`tabpanel`; the coverage matrix is a real table (or ARIA table roles).
- `aria-pressed` on toggles, `aria-current` on nav and breadcrumbs.
- Respect `prefers-reduced-motion`. No information by colour alone.

## Copy
English UI, short and literal ("Relies on", "Applies", "No source"). Game terms keep the game's capitalisation.
i18n-ready (strings in one module) though only English ships in Phase 1.
