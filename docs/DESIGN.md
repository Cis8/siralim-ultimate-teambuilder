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
`Tabs`, `Toast`.

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
  the page it is not cut by the fold). Stacked above the list on a narrow screen it is part of the page, until the bottom sheet
  (M7).
- **Chips** are `Chip`: `field:` in `--text-muted` mono, then the value. A query term is a button named after what a press does
  ("weak — exclude it", "NOT weak — include it again": the name always holds the visible text, WCAG 2.5.3, so it is not an
  `aria-pressed` toggle), an excluded one says NOT in words and is tinted with `--status-crit` at 9 % (axe measured 4.38:1 for `--text-faint` over a
  14 % tint: the tint stays light enough for `--text-muted` over it to keep 4.5:1); a filter chip is plain text. The remove button is an icon with an accessible name.
- **Effective query**: `--text` mono, wrapping (no scroll area), a quiet *Copy query* button, and "Copied" in `--status-good`
  for 2.5 s in a polite live region (not `role="status"`: the result count owns that).

### Result list
The page scrolls, not the list: results sit among other panels and stack under the filters on narrow screens. The list
is virtualised against the window (rows in the flow of the page between two spacers; `aria-setsize` / `aria-posinset` say
where a row stands in the whole). Rows are as tall as their text; the browser's find-in-page sees only the rows drawn.

## Layout
- Desktop Explore: header · query section · three columns (facets 250–300 px | results fluid | party 340–400 px) that
  wrap on narrow widths.
- Mobile: header + search + chip row; results; bottom nav (Explore · Synergies · Party). Filters and fixes open as bottom
  sheets. No fake status bars or keyboards in mockups; the syntax toolbar docks above the system keyboard.

## Accessibility (WCAG 2.2 AA)
- Real elements: `button`, `a[href]`, `input` + `label`. No click handlers on `div`/`span`.
- Visible focus ring (`--accent`, 2 px). Touch targets ≥ 44 px on mobile.
- Contrast: text ≥ 4.5:1 (≥ 3:1 at 24 px+). Check `--text-faint` on every surface it is used on.
- Combobox per ARIA APG; result count in an `aria-live="polite"` region; bottom sheets are dialogs with focus trap and
  return focus on close; tabs use `tablist`/`tab`/`tabpanel`; the coverage matrix is a real table (or ARIA table roles).
- `aria-pressed` on toggles, `aria-current` on nav and breadcrumbs.
- Respect `prefers-reduced-motion`. No information by colour alone.

## Copy
English UI, short and literal ("Relies on", "Applies", "No source"). Game terms keep the game's capitalisation.
i18n-ready (strings in one module) though only English ships in Phase 1.
