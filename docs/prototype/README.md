# Prototypes

Interactive design prototypes exported from the owner's design canvas. Each `.dc.html` is one screen: markup inside
`<x-dc>` plus a `<script type="text/x-dc">` with the logic. They need the design tool's runtime (`support.js`) to run,
so read them as source; ask the owner for screenshots or a live link when you need to see them rendered.

| File | Phase | Screen |
|---|---|---|
| `Main.dc.html` | 1 | Desktop Explore + party planner |
| `Mobile.dc.html` | 1 | Mobile Explore, filters sheet, party tab (prop `startView`) |
| `SearchBar.dc.html` | 2 | Desktop smart search (autocomplete, diagnostics, explain, saved) |
| `MobileSearch.dc.html` | 2 | Mobile smart search with syntax toolbar |
| `Synergy.dc.html` | 2 | Desktop synergy explorer (by trait, by keyword) |
| `MobileSynergy.dc.html` | 2 | Mobile synergy explorer |
| `PartyLab.dc.html` | 3 | Desktop party analysis |
| `MobileParty.dc.html` | 3 | Mobile party analysis (prop `startView`) |

**Use them for:** layout, hierarchy, copy, states, interaction flows, and the behaviour of the reference functions
(`tokPos`, `parseTokens`, `lint`, `suggest`, `explain`, `analyze`, `suggestions`, `pickSlot`).

**Do not use them for:** data (33-row sample, some descriptions truncated with “…”), code structure (duplicated, global
`var`s), share links (index-based), or rules where they differ from `GAME_RULES.md`. Known gaps vs the spec:
- Composition by class honours GAME_RULES R2 only in `PartyLab`; elsewhere class = innate class.
- Random-debuff sources (R5) are only modelled in `PartyLab` / `MobileParty`, not in Synergy.
- Caret position after accepting a suggestion mid-query jumps to the end.
- Synergy add-to-party is local to the screen; in the app it must use the shared party store.
