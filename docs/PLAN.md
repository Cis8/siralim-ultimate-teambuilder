# Implementation plan

Claude Code's working file: where we are, what comes next, how each step is tested. Read it at the start of every
session (after `CLAUDE.md`), update it before ending one.

**Keeping this file small**
- *Resume here* is **overwritten** every session, never appended (≤ 12 lines).
- Tick a slice when it is on `main` with all checks green. When a milestone closes, collapse its slices into one line
  (what shipped + deviations worth knowing). Git history is the changelog: no step-by-step logs here.
- *Notes* holds only what a future session would otherwise rediscover the hard way. Delete notes that stop being true.
- Owner decisions on game rules go to `GAME_RULES.md`, on behaviour to `SPEC.md`, on architecture to an ADR, not here.
- Target size: under ~250 lines, not counting the slices of the phase being built (Phase 2 adds about 190 while it is open). When a
  phase closes, replace its plan with a 3-line summary.

## Resume here
- **Phase 2 (D14–D65, *Phase 2 — slices* below): M9, M10, M12 and M13 are done, and 11.1–11.5 of M11 (Explain, the mirror, the history in
  `core` and in the field, the search sheet of a phone); the next slice is 11.6, which closes M11 and Phase 2** (D15): budgets and
  Lighthouse, QUERY_LANGUAGE §7–8 / SPEC §8.3 / DESIGN read once more against what shipped, the Phase 2 criteria-to-tests table, ROADMAP
  ticks, this file collapsed; then ask the owner before Phase 3. Lighthouse after 11.5: `/` 0.90 with a layout shift of 0.035, as before. Sizes: initial JS 94.2 kB of 150, lazy 37.3 of 50, total 131.5
  of 200 (**the lazy 50 kB has 12 kB left: revisit the limits at 11.6**). **On a phone a press on the search field now opens the sheet**
  (D58); the owner's check on a real iPhone (Safari, Chrome) and an Android is the first thing that matters: keyboard docking and the
  caret (checklist iPhone 17–22, Android 1–4), also that the first press after a cold load (the layer not there yet) edits in the page.
  Phase 1 stays open for slice 8.4 only: credits (ask the owner to confirm the authors' names first), README, the criteria-to-tests
  table, ROADMAP ticks. The owner deferred it on 2026-10-18; it is not dropped (D25).
- For the owner to veto, none blocking: D18–D65 (chosen by Claude), above all **D36: Exotic, Backer, Avatar and Zantai are groupings of
  the sheet, not families, so their Same family lists nobody and says so — tell me if one of them is a real family**; D44–D48 (the phone:
  a tab press is a history step, the focus card folds only its description, the pickers are sheets); D49–D50 (the Synergies link of a
  result and of a slot; a search typed a moment before a link is followed is dropped); 8b.10 made "immune to debuffs" a mention (SPEC
  §4); 8b.11 chose that *Any* is pressed exactly when no actor is, that the actors of one event side are an OR and that each is a chip;
  D58–D65 (the sheet: a press opens it, one editor in two fields, the focus after it, Enter and Escape, the toolbar); D53–D57 (the history: what is remembered and when, the list of an empty field that has nothing active, the star only while the field
  holds something, *Manage searches* always in the field, two tabs not erasing each other).
  **Needs an answer:** `/` is a character-key shortcut that works from anywhere, and WCAG 2.1.4 (level A) wants one to be switchable
  off or remappable. Proposal: a "Keyboard shortcut: /" switch in the footer, remembered in `localStorage` (about one slice); or drop
  the shortcut. Until then it ships as QUERY_LANGUAGE §6 says. **D26 is live now:** after typing, Tab and Enter take the first suggestion, so
  leaving the field with text in it takes Esc first (Shift+Tab always leaves). If that feels wrong in use, the alternative is no active
  option until ↓ (a one-line change in `combobox-state.ts`' `typed()`), at the price of Tab not taking what the ghost text will show. It
  also means that Enter rarely *sends* a search (11.4): most searches are remembered on leaving the field.
- Waiting on the owner, none blocking: run `docs/SCREEN_READER_CHECKLIST.md` (NVDA, VoiceOver) and report what sounded wrong; on a real
  iPhone (Safari and Chrome) check that focusing the search field and the sort no longer zooms the page (8b.1), and that pressing a Fix
  of the issues list (type `clas:life (weak OR snared`) keeps the keyboard up and the caret where it was (9.6); that on the same
  phone the coloured text of the field lies exactly under the caret and the selection, also once a long query has scrolled (11.2:
  checklist iPhone 16; desktop 42–43 for the reader and a Windows high-contrast theme); that the star, *Manage searches*, the list of an
  empty field, Export and Import work in the search sheet of the phone and leave room to type (11.4–11.5: checklist iPhone 17–22, desktop 44–49);
  the search sheet itself on iOS Safari and Chrome Android (11.5: keyboard docking, caret, no zoom; checklist iPhone 17–22, Android 1–4). GAME_RULES open questions 1-5 (allies vs enemies; "afflicted with" as a
  trigger; when a mastery is active; Diabolic Horde; Dusty Struggle's wording).
- Every green commit on `main` is deployed to Pages (D2). Before coding: `git pull`, `gh run list --branch main -L 3` (main must be
  green; `gh` may be missing, see Notes), `gh pr list` (read a data-refresh PR's report before merging it).

## Owner decisions (2026-10-16 unless dated)
| # | Decision | Recorded in |
|---|---|---|
| D1 | Repo `Cis8/siralim-ultimate-teambuilder`, public, Pages base path `/siralim-ultimate-teambuilder` | here |
| D2 | The compendium authors agreed (2026-10-16): deploy every commit on `main` once CI is green | `deploy.yml` |
| D3 | Node 24 LTS, pnpm via corepack | ADR-0002 |
| D4 | No PRs: direct commits to `main`, quality guaranteed by gates and `CLAUDE.md` rules | ADR-0007 |
| D5 | Slots per kind; Avatar innate-only; special kinds artifact-only; fallback colour `#8fa1b3` | GAME_RULES R1, R6, R7 |
| D6 | `masteryFamily` ≠ `partyRequirement`; all masteries are potential sources in Phase 1 | GAME_RULES R3 |
| D7 | Random debuffs: regex + overrides, `target` + `activation`, enemy-only set | GAME_RULES R5 |
| D8 | Buff/debuff lists from canonical sources; `canBeRandomlyApplied`; v2.0 wins | GAME_RULES R8, SPEC §4 |
| D14 | (2026-10-18) Phase 2 autocomplete/diagnostics/editor (M9–M11) live in the existing Explore search bar, no new page. Build it as a reusable component, logic in `core`, rich editor lazy-loaded (150 kB budget), mobile per `MobileSearch.dc.html`. Only Synergy (M13) is a new page | here, ADR-0010 |
| D15 | (2026-10-18) Phase 2 build order **M9 → M10 → M12 → M13 → M11**: the editor goes last, it is the riskiest and needs the owner's iPhone. Milestone numbers do not change | ROADMAP |
| D16 | (2026-10-18) Synergy lanes use buffs, debuffs and effects only (R12: no event is a dependency). Events appear only in *Same trigger*; there is no "event links" section in Phase 2 | GAME_RULES R12, here |
| D17 | (2026-10-18) A trait appears **once per side**, as ROADMAP Phase 2 criterion 4 says (not once per lane, as the prototype does): traits that cover several of the focus's keys sit in a top lane with "×N links", the single-key lanes follow | ROADMAP, here |
| D18 | (default) The count shown beside a suggestion includes the active filters: it is what Enter would show | here |
| D19 | (default) "Reads as" explains the *effective* query (the one searched, filters included), not only the text typed | here |
| D20 | (default) Warnings and unknown-value errors are hidden for the term still being typed (caret inside it, no blank after it); syntax errors are not | here |
| D21 | (default) A `family:`, `creature:` or `trait:` value that matches nothing is a warning. QUERY_LANGUAGE §5 lists only the class (an error) | here |
| D22 | (default) The keyword verdict gains `only-random` and `only-conditional` (R5, R10: such a source never fully covers a dependency). SPEC §8.4 lists four verdicts | here |
| D23 | (default) The bottom bar keeps its ARIA tablist (Explore, Party) and gets a *Synergies link* beside it, not a third tab; the Synergy pages are routes (`/synergy/…`) with a shared party session. DESIGN and SPEC §7 speak of a third tab: they were changed in 13.2 | ADR-0011 |
| D24 | (default) No new dependency in Phase 2: own Levenshtein, own narrowing of the imported JSON | here |
| D25 | (default) Slice 8.4 stays open while Phase 2 starts early on the owner's go-ahead; Phase 1 closes when 8.4 lands | here |
| D26 | (default) Typing makes the first suggestion active, so Tab and Enter accept it (what the ghost text shows); after an accept, a caret move, Esc or a blur nothing is active and Tab leaves the field. A hover does not activate | QUERY_LANGUAGE §6 |
| D27 | (default) The Enables side lists only what the focus applies **by name**: a random or conditional source appears in Enabled by (SPEC §8.4) but enables nobody, so Pandemic has an empty Enables. The other way is one table in `trait-relations.ts` and 18 lanes for Pandemic | here |
| D28 | (default) Alternatives compare what traits say by name, as D27 does: a random or conditional source is nobody's alternative for *applies*, and a mention that only guards (`resists`) makes no tie. Same trigger compares `self` with `ally` as different actors (the plan's rule: equal, or one side says none or `any`) | here |
| D29 | (default) The keyword verdict asks about the sources first, in GAME_RULES' order (*Dependency statuses*: random before conditional): no applier by name → `only-random` if a random source exists (a conditional one beside it changes nothing), else `only-conditional`, else `no-source`; then the payoff: `no-payoff`, `scarce` (appliers × 2 < users), `supported`. `scarce` and the co-applied keys count the specific appliers only, and the artifact filter acts on all four lists. SPEC §8.4 lists four verdicts (rewritten in 13.8) | here |
| D30 | (default) The bar at the foot of a narrow screen is Explore · Party · Synergies: the link comes after the tab list (a tab list may hold only tabs), on Explore and on the Synergy pages alike, so that the items do not move when the page changes | DESIGN § Layout |
| D31 | (default) "Party n/18" in the header (wide screens) is a link to Explore with `tab=party`: the party is a column of Explore there, so it is the place the party is | DESIGN § Layout |
| D32 | (default) 13.2's trait page shows the description as plain text under the head, and the "not found" page offers up to 8 traits whose name is like the id's (`lostTraitSearch`) with the picker pre-filled; 13.3 replaces the first by the focus card | DESIGN § Synergy pages |
| D33 | (default) On the trait page a card and a step of the trail are *links* named “Re-centre on X” (an address: middle-click, Back and Forward work); they carry the party and `mat`, never `section`. After a move to another trait the focus is on the new `h1`. No polite “Now centred on X” (the plan had one): SvelteKit's announcer says the new title and the focus says the name, a third line would be noise; checklist row 29 asks the owner to confirm | DESIGN § Synergy pages |
| D34 | (default) The trail is session memory: empty when the app opens (so a deep link has none), emptied by the picker page, cut back by a step, not drawn for one step | DESIGN § Synergy pages |
| D35 | (default) Random sources are a group at the end of their lane, folded behind a button above 3 (v2.0 has 26–27 in every lane that has any); the focus card's rows are the by-name mentions of D27, plus *Guards against* when there is one; the artifact filter says the new counts in a polite line | DESIGN § Synergy pages |
| D36 | (default) A name that files several traits together and has no mastery trait (Exotic, Backer, Avatar and Zantai in v2.0; every real family has exactly one mastery) is a *grouping*, not a family: `SameFamily.grouping` (core, whatever the filter), and the page's *Same family* has no count and no card there, only the reason. A trait alone under its name (six) is no grouping: it says nobody else is in its family. If one of the four is a real family, `grouping` becomes a list of names | DESIGN § Synergy pages |
| D37 | (default) *Alternatives*, *Same trigger* and *Same family* show 6 cards; a longer list has a button in its heading row, before the cards (the focus stays on it and Tab goes into what opened), "Show all N", or "Show the first 200" above 200 with a note; plain DOM (200 cards: 23 ms, 118 ms at 4× CPU); each trait starts with them shut; a card says what it shares ("Also applies … · relies on …", "Also reacts to …", "×N in common") | DESIGN § Synergy pages |
| D38 | (default) The polite line of the artifact filter says the count of every list the page counts (the two sides and the lists under them), not only the two sides | DESIGN § Synergy pages |
| D39 | (default) On a keyword's page the picker of the other keywords is the last section, not the first: 42 chips with counts take ~300 px and as many stops of Tab before the lists. The counts show on that page's picker only (`stats` is opt-in: the picker page keeps plain links) | DESIGN § Synergy pages |
| D40 | (default) *Appliers* lists and counts the traits that apply by name, as the chip, the summary, the verdict and Explore's `kw=a:` do (D29); the traits that give the key under a condition (R10) or at random (R5) follow as groups of their own with their own counts (the random one folded above 3, as in the lanes), and the summary says “N more …” in a sentence | DESIGN § Synergy pages |
| D41 | (default) A card of a keyword's page is named “Open X” (no trait is at the centre to re-centre on). A move to another keyword puts the focus on the new `h1` and says the counts, the verdict and its reason in the polite line; a turn of the artifact filter says the two counts and the verdict's title; a page opened by its address says nothing | DESIGN § Synergy pages |
| D42 | (default) The six verdicts are worded in `copy.verdicts` (Well supported · Scarce enabler · No payoff yet · Only by chance · Only under a condition · No source); only *supported* is good and only *no-source* bad, the rest ask for care; each has an icon (check, warning triangle, crossed circle) so that colour is never alone | DESIGN § Synergy pages |
| D43 | (default) “See in Explore” is a link in the heading row of each list, `kw=a:key` or `kw=u:key` with `mat=yes` when the filter is on and the party carried: Explore then lists exactly the traits of the list (criterion 11) | DESIGN § Synergy pages |
| D44 | (default) Under 700 px the lists of a Synergy page are tabs and the tab is in the address as `section=` (`enabled-by`, `enables`, `alternatives`, `related`, `appliers`, `users`): a history step like the tabs of Explore (Back goes to the tab before), nothing written for the first tab, never carried by a link to another page (the next trait starts on its first tab). From 700 px `section=` changes nothing | DESIGN § Synergy pages |
| D45 | (default) The fourth tab, *Related*, holds Same trigger over Same family and counts the traits of both together, one that is in both once, and none of a grouping that is no family (D36). A tab's name says the count in words, as a heading does | DESIGN § Synergy pages |
| D46 | (default) The heading of a list that has a tab to itself is not drawn on a phone (the tab says it) and stays for a screen reader; *Related* keeps both headings, since its tab is not their name | DESIGN § Synergy pages |
| D47 | (default) The focus card of a phone folds the description to 3 lines with "Show more" and keeps the facts (*Relies on*, *Applies*, *Triggers*, *Material*) in view; a text that fits has no button; another trait starts folded; the focus on a keyword in the cut part opens the text (Chrome scrolls the folded box to it, Safari leaves it and the keyword lies below it: `revealFocus` reads both) | DESIGN § Synergy pages |
| D48 | (default) Under 700 px the picker of a trait page is a button "Find a trait" that opens a sheet with the focus in its field, and a keyword page's picker is a button "Other keywords" that opens the sheet of the 42 chips (the page has no Keywords section then). A pick closes the sheet and the page puts the focus on its `h1`; put away by hand it gives the focus to its button. The picker page and the pages of what is not found keep theirs inline | DESIGN § Synergy pages |
| D49 | (default) The Synergies link of a result is the last stop of its card (after the description's keywords), drawn in words in the foot beside the material; it wraps under it on a narrow card. A slot's link is an icon square with the words as its name and its `title`. Neither carries the search, only the party: Back returns to the Explore entry, which has the search | DESIGN § Result list |
| D50 | (default) Leaving Explore for another route drops the text waiting to be written to the address (`abandon`), it does not flush it into the entry: a flush would be a second navigation racing the link's. So a link followed within 400 ms of the last key leaves Back with the search as the address last had it. A person takes longer to reach a link; the e2e waits for the address | SPEC §7 |
| D51 | (default) The Synergy route has no size budget of its own: `lazyJs` (50 kB) and `totalJs` (200 kB) bound it, and a first visit to any page fetches at most the total, under the 150 kB of the first page; a route's chunks cannot be told apart without SvelteKit's internals. Lighthouse CI measures four URLs (`/`, `/synergy`, a trait, a keyword) behind `tools/serve-build`; the trait and the keyword page, drawn after the dataset arrives, need performance 0.8 where the others need 0.85 (measured 0.87 and 0.89, a slower runner would fall under 0.85 for no fault of the code); all four hold to a layout shift of 0.1 | `budgets.ts`, `lighthouserc.cjs`, SPEC §9 |
| D52 | (default) Saved searches: a 51st is **refused** (`full`), never swapped for one the person chose to keep, and the field will say so (11.4); recent searches are the opposite, the oldest of ten simply goes. An import **merges** with what is there (current first, a repeat keeps its name) and refuses a file that is not this app's whole, leaving everything as it was | SPEC §8.3 |
| D53 | (default) The history is *remembered* by the first script and *used* by the lazy layer. A search is remembered on Enter (not the Enter that took a suggestion or ended an IME composition), on leaving the field with its text changed since it was entered, on saving, and on taking one from the list or the sheet; a query that came with the address and was not touched is not | SPEC §8.3 |
| D54 | (default) A blank field with a history lists it in place of the fields: five recent searches that are not saved at most, then the saved ones, nine rows; a saved search once. It opens on a press and on ↓ / Alt+↓, never on a plain focus; **nothing is active**, also when typing has just emptied the field, so Tab and Enter stay the field's own (WCAG 2.1.2) | SPEC §8.3, QUERY_LANGUAGE §6 |
| D55 | (default) The star is there only while the field holds something; its name is fixed and `aria-pressed` is the state; saving also remembers the search as recent; a refusal is a line under the field, said aloud, that goes when the text changes (for `full`, with a *Manage searches* button) | SPEC §8.3, DESIGN § Recent and saved searches |
| D56 | (default) *Manage searches* is a button in the field, always there, that opens a `choice` `BottomSheet`: the two lists (use, forget), Export (a download) and Import (a merge; a file over 6 MB is refused unread). A search taken from it is set through the page and the focus goes back to the button, so that a phone's keyboard does not rise | SPEC §8.3 |
| D57 | (default) A change is made to what the browser keeps now, not to what the page last saw, so that two tabs do not erase each other's saved searches; a browser that keeps nothing leaves the history of the visit in memory | SPEC §8.3 |
| D58 | (default) **A press on the search field opens the sheet** on a screen under 700 px that is touched (`(max-width: 699px) and (pointer: coarse)`, `SEARCH_SHEET_MEDIA`); a keyboard (Tab, a hardware one), the `/` shortcut, a mouse, a field filled in and a press before the assist layer has arrived edit in the page, which stays a complete editor (its star, *Manage searches* and badge too: the page's field is not cut down on a phone). A press takes no focus in the page (the `mousedown` is held) and shows the sheet in the task of the press, with the content drawn first (`flushSync`), because an iPhone raises its keyboard only for a focus given while a press is handled | SPEC §8.3, DESIGN § Search sheet |
| D59 | (default) The sheet is its own `<dialog>`, not a `BottomSheet` variant (the plan said `full`): that one is a title, a body and one button, and an `open` prop opened in an effect; the sheet is a head with a field, a banner, a list that scrolls and a foot. Its content exists only while it is open. It is as tall as `visualViewport` and starts at its top (`fitToVisualViewport`: `--sheet-top`, `--sheet-height`) | DESIGN § Search sheet |
| D60 | (default) **One editor, two fields.** `QueryInput` still owns the state (caret, active option, counts, history) and works on `field`, the field in the sheet while it is open and the one in the page otherwise; the sheet is a view that raises the same events. Typing in the sheet opens no list of issues in the page behind; the text of the field is shared by `QueryTextInput`, and the list by the `Combobox` with `flow` | SPEC §8.3 |
| D61 | (default) When the sheet shuts, whatever shut it, the search is remembered and the focus goes to the Results heading, not to the field of the page (a phone would raise its keyboard: as for the button of searches in D56 and Back to top) | SPEC §8.3 |
| D62 | (default) In the sheet the list is permanent (`flow`: expanded whenever it has options). Escape lets go of an active option and otherwise closes the sheet; Enter takes the active option and otherwise closes the sheet, as *Show N traits* does. A phone's "search" key therefore takes the first suggestion before it sends | QUERY_LANGUAGE §6, DESIGN § Search sheet |
| D63 | (default) The toolbar writes by `insertAtCaret` (core): a blank before where the word would run into the one before, a blank after an operator and a finished term, `NOT` is the dash, a quote is a pair with the caret between, wraps a selection, or closes an open phrase. The buttons are the ten of the plan, each a 44 px target with a name that holds its face (a word) | QUERY_LANGUAGE §8 |
| D64 | (default) The banner shows the first issue only (errors first) with "+N more"; "Reads as" is the *effective* reading and the button's count the one within the filters (D18, D19), both from the page's outcome; the count is told politely 400 ms after the typing stops, in the sheet's own live line (the page behind is inert) | DESIGN § Search sheet |
| D65 | (default) The star and *Manage searches* are in the heading row of the sheet's list; the sheet of searches opens over the search sheet and gives the focus back to its button | DESIGN § Search sheet |
| D9–D13 | Defaults accepted: Phase 1 coverage = covered/missing only; free text is substring; overrides need `reason:`; data-refresh PR runs its own checks; GAME_RULES open questions don't block Phase 1 | SPEC, here |

D18–D65 are defaults Claude chose while building Phase 2 (2026-10-18/20). None blocks; the owner may veto or change any, and the
slice that builds it then follows.

## Notes (toolchain gotchas)
- Guards a new control meets: it needs `min-height: var(--target-min)` under `pointer: coarse`, or `touch-targets.test.ts` fails and
  names it; one that draws an outline of its own needs a `:focus-visible` rule, or `keyboard.test.ts` names it (no 2 px ring).
  Anything that changes the layout between the prerendered page and the loaded one (a line that appears, a layout JS decides)
  counts as a layout shift: Lighthouse CI fails above 0.1. Decide it in CSS, or hold the room.
- Node 24 via nvm (`nvm use` reads `.nvmrc`); pnpm 12 via corepack. pnpm enforces a minimum release age, so versions
  published in the last day are skipped. That is expected.
- TypeScript is pinned `~6.0`: typescript-eslint and svelte-check do not support TS 7 yet.
- SvelteKit 3: config in `apps/web/vite.config.ts`; there is no `svelte.config.js`. tsconfig extends `$app/tsconfig`.
  `$lib` is gone (use relative imports or `#lib/*` subpath imports).
- `ssr.noExternal: ['cookie']` in the Vite config: without it the prerender step cannot resolve `cookie` under pnpm.
- Internal links need `resolve()` from `$app/paths`; external links use `lib/components/external-link.svelte`.
- The RTK hook compacts command output: vitest prints nothing useful through it, and `cat` of a long file can drop lines
  (a test file seemed to lack its `vitest` import). Use `rtk proxy <command>` for the raw output, or Read.
- A data-refresh PR shows a `pull_request` CI run with conclusion failure, no jobs and no log (opened by the bot). Ignore
  it; judge `main` with `gh run list --branch main`.
- pnpm in CI fails on unapproved dependency build scripts (`ERR_PNPM_IGNORED_BUILDS`), locally it only warns:
  `allowBuilds` in `pnpm-workspace.yaml` must list every package that has one.
- Pipeline scripts run with `tsx` (the sources use extensionless imports, which plain Node cannot load).
- Prettier skips Markdown on purpose (hand-wrapped prose, tables).
- Windows clone: `.gitattributes` makes every checkout LF. Git for Windows sets `core.autocrlf=true`, which gave a CRLF tree
  where `.editorconfig`, Prettier and so `pnpm check` (the pre-push hook) failed on every file. Node 24 is not the default
  there: `fnm install 24`, put `%APPDATA%\fnm\node-versions\v24.22.0\installation` on PATH (from PowerShell: Git Bash does not
  expand `%APPDATA%`), `corepack prepare pnpm@12.14.0 --activate`. `gh` may be missing: read CI from
  `https://api.github.com/repos/Cis8/siralim-ultimate-teambuilder/actions/runs?branch=main&per_page=3` (a full SHA, not a short one;
  60 requests an hour without a token, then it answers 403). Without the API: `github.com/Cis8/siralim-ultimate-teambuilder/actions?query=branch%3Amain`
  has the state of each run in an `aria-label` ("failed: Run 85 of CI. …"), and the page of a run's job lists the failing step and the
  errors of the log in its *Annotations*. A run that is `in_progress` is not a green `main`: wait for it before starting.
- `asset()` from `$app/paths` is typed with the names of the files in `static/`, and the dataset file is renamed whenever the
  data changes, so a literal name would break the typecheck of the next data-refresh: find the dataset next to
  `data/manifest.json` (`lib/composition-root.ts`). `base` is no longer exported.
- CI: the e2e step is the slow one: 16 min 25 s at 3988d6a (4.5 minutes here), about 18 at the 11.5 commit, which hit the 20 minutes of the job and was
  *cancelled* (not failed: `03e111e`'s first run, everything before the e2e step green). The limit of the `verify` job is 30 minutes now. A run that ends
  `cancelled` after about 20 minutes is the timeout: read the duration of its steps (the API of the run's jobs) before suspecting the code.
- Playwright browsers are not part of `pnpm install`: once per machine, `pnpm exec playwright install chromium webkit` (in
  `apps/web`), or every e2e fails with "Executable doesn't exist".
- typescript-eslint cannot see the props of an imported `.svelte` component (svelte-check can): a callback passed to one
  needs its parameters typed (`onchange={(query: string) => …}`), or `no-unsafe-assignment` fires.
- Changing what the pipeline emits does not change `apps/web/static/data` by itself: run `pnpm pipeline:fetch && pnpm pipeline:build`
  and commit the result (`chore(data)`), or the app keeps showing the old shape (the dataset lacked keywords until M5.6).
- `playwright test` reuses whatever answers on port 4173: a `vite preview` left running serves the old build. Stop it first
  (on Windows one is often left behind after a run: stop the process that listens on the port).
- `virtual-list`: `@tanstack/virtual-core` rebuilds what it measured from the last row that changed and keeps the keys of
  the rows above it, so a key function that reads the `keys` prop when called, or a list that changes under a pending
  measure, draws a trait twice (`each_key_duplicate`, a 500 page). `options()` snapshots the keys and `measure()` runs when
  the list is another one. The e2e that proves it is the chain of filters taken off one by one (`draws no trait twice…`).
- `virtual-list` and scrolling: `@tanstack/virtual-core` corrects the scroll (a `scrollTo` with no behaviour) whenever it measures
  a row above the window, which cancels any native smooth scroll the page starts: one from six screens down stopped 35 px in. Only the
  library's own `scrollToOffset(…, { behavior: 'smooth' })` is exempt (`scrollState`). The page therefore jumps
  (`window.scrollTo({ top: 0 })`, as "Back to top" does). A scroll test must go far down (20 screens): near the top the rows
  are measured already.
- e2e: the address follows the typing 400 ms late (`TYPING_PAUSE_MS`). A test that fills the search and then leaves Explore, or reads
  the address, waits for `paramOf(page, 'q')` first (a person never clicks that fast; D50). The estimated height of a row
  (`results-list.svelte`) is the mean of the rows drawn: when a card grows or shrinks, measure it again (a throwaway e2e that prints the
  mean of `li[data-index]` heights at 0, 5 and 40 screens) or "scrolls on to the last trait" takes seconds on a phone.
- e2e: wait for the first row before typing or clicking (`openExplore`): the traits load after hydration, and a field filled
  earlier is lost (WebKit gets there last). Safari does not focus a button that is clicked: to test focus, use the keyboard.
- SvelteKit 3 navigation: `pushState` / `replaceState` are deprecated and a shallow entry keeps `page.url` on the page
  underneath, so the address is written with `goto(resolve('/?…'), { replace, reset: false })`: a real navigation on the same
  route, with no load to run. `reset: false` leaves scroll and focus alone, also on back/forward. `afterNavigate` tells the
  page's own write (`type: 'goto'`, ignored: reading it back would put the text of the last pause over what was typed since)
  from `enter` / `popstate` / `link` (read). A navigation started while another is in flight drops the first one's history
  entry, hence the writer's queue. The lint rule `no-navigation-without-resolve` accepts `resolve()` only with `'/'` or
  `` `/?${string}` ``, and `page.url` is a read-only type: build a `URL` from its `href`.
- e2e, the announced count (`announcedCount`, the live region): it is empty until the count has stood still for 400 ms, then it says the
  whole list until the search's count has stood still as long. Reading it right after a `fill` gives either, depending on the speed of the
  machine (a fast one passes, the CI runner failed): wait for `toContainText('of')` **and** `not.toContainText('<total> of')` first.
- e2e, live regions: `getByRole('status')` is the result count and nothing else, and `.query > [aria-live]` / `.query .field [aria-live]` are the
  field's two polite lines, all strict locators: a new live region needs `aria-live="polite"` without a role and a place outside those two
  boxes, or a message goes through the one that is there (`announced` in `query-input.svelte`). Adding a stop to the field (the star, Manage
  searches) lengthens the Tab walks that count presses (`keyboard.test.ts` › "can skip the filters").
- e2e: `rows` is the list items of the *Results* region (the party panel has lists too). Playwright will not click a button
  that says `aria-disabled="true"`: `click({ force: true })` is the person pressing it. A poll that waits for an address
  parameter can be satisfied by an earlier write: wait for the value the step just wrote.
- `rtk` is not on every machine: run `pnpm exec vitest …` directly; in PowerShell prefix `$env:PATH` with the Node 24 folder.
- `.visually-hidden` is `position: absolute`: inside a scroll area that is not itself positioned it escapes the scroller and
  makes the nearest positioned ancestor scrollable (the bottom sheet's title slid out of view); the area gets `position: relative`.
- e2e, filters on a narrow screen: they are in the sheet, so `facet` / `side` / `mode` / `flag` read their state shut or open
  (`includeHidden`), a press needs `openFilters`, and anything on the page behind needs `closeFilters` first (a modal dialog
  blocks it). `explore-page.ts` is the one place that knows the 700 px breakpoint, as `FiltersRegion` and `+page.svelte` are
  for the app.
- e2e, tabs: under 1100 px the party is on its own tab, so a test shows it (`showParty` in `party-page.ts`) before it reads or
  presses anything in it, and `findRow` / `addToParty` bring the search forward; both do nothing on a wide screen.
  `explore-page.ts` knows the 1100 px breakpoint as well as the 700 px one. A `toHaveCount(0)` on a locator inside `partyPanel`
  passes without the tab (the region is not in the page then): show it first. A `click({ force: true })` does not look at what
  covers the element: under the fixed bars it hits a bar (scroll the element to the middle first).
- Performance (criterion 9): the budget is the search itself, which the page times (`timeSearches`, User Timing `atlas:search`,
  read by `typing-latency.test.ts` under a 4× CPU): p95 4.3 ms, so no inverted index. The whole keystroke is dearer: median
  7 ms, p95 35–45 ms at 4×, on the keys that swap the list (profile: Svelte creating ~10 rows, and the layout that
  `measureElement` forces by reading `offsetHeight`). If that ever needs to come down, it is the cost of a row, not the search.
  `countFacets` runs inside every timed search: working out the keys of the 15 actor sets on each call cost +15% on `pnpm bench`'s
  typing run (and failed the 16 ms e2e once under load), so they are built once at load. Compare `pnpm bench` before and after.
- `pnpm bench`'s "typing 30 keys" run is bimodal on this machine: 16 ms in one process, 20 ms in the next, whatever the code (an A/B
  always run in the same order blamed 11.1 for +25% and was wrong; reversed, the sign flipped). To price a change, time the piece on
  its own (a `tsx` loop of 200k calls) and run the A/B in both orders.
- `typing-latency` and `assist-latency` (p95 of `atlas:search` / `atlas:assist` at 4× CPU) can fail when the whole e2e suite runs on
  many workers at once: rerun them alone (`playwright test typing-latency assist-latency --workers=1`) before suspecting the code.
  Alone: search p95 4.5–5.4 ms; assist p95 6.4 ms with the suggestions and their counts, on a text with eight faults of every kind (the budget
  is 16 ms: 40% of it, under the 60% that the slower runner of CI allows). With the nine counts made in the key it was 16–17 ms, a count being 0.3 ms
  here: see M10.
  The assist sat at 13–14 ms here before `lint-term.ts` (2026-10-18) and went red on CI at 20–23 ms, on two runs in a row: the Linux
  runner is ~1.5× slower than this machine, so **a budget used past ~60% locally will fail there** (no Windows run can show it).
  The cost was the offer for a finished word that no trait has (a search of the vocabulary, 1.5 ms), paid again by every later key.
- e2e and the assist layer: `searchBox` is `getByRole('combobox', …)` and so waits for the layer; the sort `<select>` is a combobox too, so
  never ask for a bare `combobox`. `openExplore` hovers the field to bring the layer in at once (left alone, it comes 500 ms after the data:
  the one test that does not is in `query-suggestions.test.ts`). The list of suggestions covers the chips and the first results while it
  is open, so a test that goes on to click there puts it away first (`Escape`), as a pointer user would have to.
- `pnpm lint` runs dependency-cruiser over `apps/web/src` as well. The rule `assist-stays-lazy` lets only `query-assist-loader.ts` import
  `query-assist.ts`, with `import()`; what the loaded layer needs goes through `query-assist.ts`. Anything that `query-input.svelte` or the
  page imports statically is in the first script, which the rule cannot see: after touching imports run `pnpm build && pnpm size-budget`
  (lazy JS 19.3 kB now, initial 85.4) or look for `aria-autocomplete` in the chunks. The relation code is the same kind of thing: a
  module the first script imports (the header does, through `composition-root.ts`) brings along everything it exports, so the relation
  service is built in `relation-composition.ts` and the rule `relations-stay-lazy` lets only `routes/synergy/` import it (2 kB otherwise).
- Lighthouse: fetching the assist chunk while the first results were being drawn cost 150 ms of LCP (0.92 → 0.90): Lantern counts a
  request that starts before the LCP paint. `FETCH_AFTER_DATA_MS` (500) in `query-input.svelte` keeps it out (back to 0.91–0.92).
- On this Windows machine `keyboard.test.ts` › "reaches every control of the Party tab" fails about half the time on `mobile-webkit`
  with one stop instead of more than ten, also on a tree without the Phase 2 work (checked 2026-10-18). CI (Linux) is green: if it
  is the only failure, it is this.
- Lighthouse (`pnpm lighthouse`, phone profile, simulated slow 4G, 4 URLs × 3 runs, ~3 min): `tools/serve-build` serves
  `apps/web/build` from the root with gzip, so the build must not have a `BASE_PATH`; Chromium comes from Playwright
  (`playwright install chromium`). Lighthouse CI's own static server cannot be used: it falls back to `index.html` and has no
  `/synergy` for `synergy.html`. The server answers a missing *page* with `404.html` and status 200 (Lighthouse refuses a 404
  document) but a missing *file* with 404: a 200 for `/robots.txt` made SEO 0.91 ("46 errors found"). A report is in
  `apps/web/.lighthouseci/lhr-*.json`; `audits['layout-shifts']` names the element that moved. What is left to gain: the LCP
  (3.3 s on `/`, 3.5 s on the Synergy pages) is the waterfall HTML → scripts → manifest → dataset, which starts in `onMount`; and
  0.035 of layout shift on Explore is the meta line, 32 px before the traits and 71 px after on a phone (the sort wraps). A page
  that fills in after the data arrives must hold the height of the window meanwhile, or the footer (visible at first) jumps
  out of view and counts: that was 0.07–0.12 on the Synergy pages until `LoadStatus` (13.8).
- Keyboard e2e (`support/keyboard.ts`): Safari's tab key skips links (a setting), so WebKit does not count a link as missed;
  WebKit scrolls a focused control into view after the key press, so the walk waits two frames before it measures; start
  a walk on a page that was only opened (a field filled earlier is where the tab key starts from).
- Vitest does not process CSS: an import of a stylesheet, `?raw` too, is an empty string. The web project lists `tokens.css` in
  `css.include` (`vitest.config.ts`); web code may not import `node:fs` (boundary rule), so a test cannot read it that way.
- `vitest bench` (Vitest 5): `bench` is a fixture of `test` in a `*.bench.ts` file (`test.each` does not hand it over: loop);
  `vitest` alone ignores those files; `pnpm bench` needs `--reporter=verbose` to print the table.
- Svelte templates: `{@render localSnippet(args)}` trips `no-confusing-void-expression` (a rendered `children()` does not): use
  a component. `hidden` loses to any `display` rule on the same element, so a section hides a plain wrapper around its flex box.
- SvelteKit 3.1 runs `reset_focus` *before* the `afterNavigate` callbacks (`finish_navigation`), so a page that moves the focus after a
  move (the trait page: the new `h1`) does it there and wins; the router's own `aria-live="assertive"` announcer says `document.title` after
  each navigation whose title changed.
- e2e, the page of a trait: a folded group of random sources draws no card, so a test looks for cards among `drawn(side)` (the entries that
  are not random) and counts the “no material” tags only for a focus with no random source. v2.0 has no lane with 1–3 random sources and no
  focus for which `mat=yes` leaves a key with nobody: those two branches are covered by `lane-groups.test.ts` and `copy.test.ts` only.
  `touch-targets.test.ts` skips a control scrolled above the window: take the page back to its top (`scrollTo(0, 0)`) after opening
  something that scrolls it.
- e2e, the Synergy pages on a phone (under 700 px): the lists are tabs, so `getByRole` finds nothing in the lists that are not on show, nor in a
  closed sheet. A test brings a list forward first (`showSection`, `shownSide`, `shownListing`, `shownKeywordList`: they do nothing from
  700 px) and opens a picker through `openTraitPicker` / `openKeywordChips`. A tab press is a history step (Back goes to the tab before), so
  a test that counts Backs reads the lists it is not on with `includeHidden`, or opens the page with `?section=`. A page opened on a
  phone starts on its first tab, also after a card or a chip took the person to another trait.
- `bind:this` hands back `null` (not `undefined`) when the element goes away, and an effect that read it again then crashed the page
  (a 500 on Back): test an element with `instanceof HTMLElement`, not `!== undefined`.
- A link whose name ends in a `.visually-hidden` span (position: absolute) gets a space before it in its accessible name: the chip of a keyword is
  “Bleeding , 10 appliers, 20 users”, so a test matches `\s*,` (`chipName` in `support/keyword-page.ts`). Run `vitest` from the repository root:
  from `apps/web` the contrast tests lack the CSS include of the root config and fail (93 tests) with nothing wrong in the code.
- The search field is `label > .editor > (QueryMirror, input)`: the label's `textContent` holds the text of the mirror (`aria-hidden`, so
  a reader's name for the field is still "Search traits"). A helper that names a control from `textContent` must skip `[aria-hidden]`
  (as `touch-targets.test.ts` does), or the name becomes "Search traits wea". To check an alignment, compare pictures (`pictures` and
  `offsetBetween` in `query-mirror.test.ts`): no two pictures are pixel for pixel alike, since the copy is rasterised in grey, so
  count the best shift, not the differing pixels (that gave 5–8% on text that lined up).
- e2e, the search sheet (11.5): on the phone projects (a touch screen under 700 px) a **click** on the page's field opens the sheet, while `fill`,
  `focus`, `pressSequentially` and the keyboard edit in the page, so a test about the field of the page does not click it (`openHistoryList`: focus and Alt+Down).
  A test of the sheet opens it with `openSearchSheet` (a tap) and looks only through `searchSheet(page)`: **Playwright does not leave out what is behind a modal
  dialog** (`inert` is not hidden to it), so a role query on the whole page finds the field and the list of the page as well, and is a strict-mode failure. The first
  Tab walk of a sheet starts from its first control (`backButton(page).focus()`): the field is the second, and the walk ends where the focus leaves the page.
  `walkTabOrder` does not count the options of a combobox as missed (the arrows reach them).
- Do not rewrite files with Python's text mode on Windows: it writes CRLF into an LF tree (use the Edit tool).
- The Write and Edit tools turn the escape for the byte order mark (backslash, u, F, E, F, F) in what they are given into the invisible
  character itself: a regex or a string that looks right in the diff and is not. Write `String.fromCharCode(0xfeff)`. Other escapes
  (`\u0001`, `\n`) arrive as written.
- `packages/core` and `pipeline` export TypeScript source (`exports: ./src/index.ts`); there is no build step.
- The 8b.5 research lives in `packages/pipeline/.cache/research/events-v2.0/` (git-ignored, this machine only):
  `findings.records.json` (the sweep: 4,400 records of id, quote, span, use, actor, event, qualifier), `findings.md`, the
  prototypes and `scripts/` (`extract`, `census`, `merge`, `prompt.md` for the agents, `proto2.ts`, and `measure.ts`: it runs
  `extractKeywords` over the dataset and lists, beside the sweep, the records no mention covers, the mentions the sweep did not
  record, and the disagreements in role and actor; run from `packages/pipeline` with `pnpm exec tsx scripts/measure.ts
  <dataset.json> <records.json> <out.md> [<lines.txt>]`). It is a review aid, never a fixture. Without it, read every new
  snapshot line. A Haiku agent on 75 rows costs ~110k tokens and needs no prompt changes; output to a file, one line back.
- Bash tool: a heredoc with apostrophes and quotes mixed can fail with "unexpected EOF" before anything runs; write the script
  with the Write tool and run it. Node 24 is not on Git Bash's PATH either: `export PATH=/c/Users/<user>/AppData/Roaming/fnm/node-versions/v24.22.0/installation:$PATH`.

## Phase 1 — slices
One slice = one commit (or a few) on `main`. *T:* = tests written with or before the code (TDD for `core`).

### M1 Scaffold — done
Monorepo, strict TS, ESLint with package-boundary rules (tested in `tools/boundaries.test.ts`) + dependency-cruiser,
Prettier, Vitest projects, Playwright (desktop Chromium, Pixel 7, iPhone 14 WebKit) + axe, CI, Pages deploy,
app shell with tokens, self-hosted fonts and footer credits.

### M2 Pipeline v1 — done
`pnpm pipeline:fetch` (retries, one `SheetSource` per tab) and `pnpm pipeline:build` run parse → clean and validate → ids →
base enrichment (kind, stacks, R3 requirement, R5 random debuff) → dataset + manifest + Markdown report with a diff against
the previous build; the nightly `data-refresh.yml` opens a PR when the data changes. Real v2.0: 1,780 traits, 704 KB
(~100 KB gzip). Deviations: an id collision fails the build instead of getting a suffix (SPEC §5/§6); the pinned snapshot
(`pipeline/fixtures/traits-v2.0.csv`) and the GAME_RULES counts test (`build/real-sheet.test.ts`) landed with 2.4; nothing is
rewritten when the hash is unchanged.

### M3 Keyword extraction — done (with its follow-up)
`core`: a `taxonomy` registry (20 debuffs and 18 buffs from the wiki, cross-checked with the Codex Reference; mechanics,
triggers with a battle phase, the no-stack flag), `createKeywordMatcher` (spans), `assignRoles`, one `extractKeywords`
used by `enrichTraits`. `pipeline`: `overrides.yaml` with a schema, keywords in the dataset (2,174 mentions; 275 applies /
262 uses), committed snapshots in `packages/pipeline/snapshots/`, and a *Taxonomy* section in the report (candidates,
differences with the canonical lists). Deviations: Barrier is a buff, not a mechanic (both sources and the compendium say
so); buffs and debuffs match only as capitalised names (25 false positives otherwise); an opening condition makes a
status `uses`, which refines SPEC §4. All 537 role mentions were read by hand; 11 are overridden.
Owner decisions of 2026-10-16 added three things (3.8-3.10): the role `resists` for protective mentions (GAME_RULES R9),
`Trait.conditionalSources` for the "whichever of these debuffs" pair traits (R10), and the `effect` keyword kind with
Seal/Sealed, Dire Wolves, Zombies and Mega Magic, plus Charges, Cascading and Fused as mechanics (R11). Dataset v2.0 now
has 2,299 mentions: 311 applies, 270 uses, 21 resists.

### M4 Query core — done
`core/src/query/`: lexer with spans, error-tolerant parser (`{ast, tokens, diagnostics}`, never throws, repairs reported),
field registry (`FieldDefinition` with `highlightsDescription`), per-trait index and `evaluate`, `createHighlighter` and
`serialise`, all folds over `visitQuery`. Deviations: a term under two NOTs (`--weak`) is highlighted (QUERY_LANGUAGE §4);
the serialiser quotes a value exactly when the lexer would read it otherwise (it asks the lexer), and writes `-`, a space and
` OR `.

### M5 Explore UI — done
`core`: `ExploreState` + URL codec, `search(state)` with facets and sort strategies, chip operations on the query text,
`clickKeyword`, `descriptionParts`. `web`: three columns (filters | results | party), query input, chip row, result count in
`aria-live`, virtualised results against the window (`@tanstack/virtual-core`), keyword tokens by role shape, `<mark>`
highlights, facet panel (`aria-pressed`), effective query + copy, empty state, and the URL kept in step with the state
(`page-address`, `address-writer`; SPEC §7). Deviations worth knowing: the filters are written as a query and that
text is what is searched (`filterQuery`); a click on a token turns the other side of the keyword off, the panel does not;
filter chips are remove-only; a pressed token is a ring, not a fill (contrast of a highlight); narrow screens stack the
panel above the list until the bottom sheet (M7.1); back and forward bring back the state and start the list over.

### M6 Party planner — done
`core`: immutable `Party` + `SLOT_POSITIONS`, slot-rule registry (R1, R6), `PartyCommand` + `PartyHistory`, the `Planner`
(history + target slot), `nextEmptySlot` / `firstEmptySlot`, `partyCoverage` (applies, relies on, covered / missing,
non-stacking duplicates), the address codec, `lostTraitSearch`. `web`: party panel with coverage, target toggle per slot,
Undo / Redo / Clear / Ctrl+Z, "Add to" on every result with the rule's reason when refused, "In party" marker, copy link,
"not found in vX" slots with a search, the last party in `localStorage`, one writer for the search and the party in the
address. Deviations worth knowing: the party is a comma list in the address, not base64url (ADR-0008); choosing a target
replaces the history entry instead of pushing one; undo returns the target to the slot of the edit; a trait that applies and
relies on the same keyword covers itself (as in the prototype); the last party is used only when the address names none.

### M7 Mobile — done
The filters are a modal bottom sheet under 700 px (`BottomSheet`, `FiltersRegion`, a fixed "Filters" bar); Explore and Party are
ARIA tabs under 1100 px (`TabBar`, `tab=party` in the address, the page scrolled back to where each tab was left; the view not
shown is `visibility: hidden; height: 0`, not `display: none`, or the virtual list would measure its rows as 0 px); the bars at the
foot leave room (`--bars-height`). The result is a card: under 700 px its add button is a 44 px square beside the name, and the
DOM puts it before the description. `touch-targets.test.ts` measures every control of Explore, the open sheet and the Party tab
in the two phone projects. Deviations worth knowing: keywords inside a description and the footer link stay line-high (WCAG 2.5.8
Inline, DESIGN § Accessibility); a bordered control is 44 px *inside* its border (chip 46, segmented 50).

### M8 Hardening
- [x] **8.1** Performance: `pnpm bench` (Vitest bench of `search` on the snapshot) + `typing-latency.test.ts` (Chromium
      projects, 4× CPU, p95 of the search < 16 ms; criterion 9). Deviation: the e2e times the search through a User Timing
      measure the page emits (`apps/web/src/lib/search-timing.ts`), not the whole keystroke, as SPEC §9 words the budget;
      no inverted index was needed.
- [x] **8.2** Size budgets and Lighthouse CI. `pnpm size-budget` (`tools/size-budget`, a step of `ci.yml` after the build) fails
      over 150 kB of initial JS or 300 kB of data, gzipped: now 69.9 and 120.4. Lighthouse CI (`@lhci/cli`, the `lighthouse` job
      of `ci.yml`, thresholds in `apps/web/lighthouserc.cjs`). Deviation: its first run found performance 0.69 and a layout shift
      of 0.75, so the slice fixed them: the stylesheets are inlined (`inlineStyleThreshold`), the results hold their room while
      the traits load, the filters column is dropped by CSS under 700 px, and the fonts are `font-display: optional`
      (`styles/fonts.css`; DESIGN § Typography). Now 0.93 and 0.035. The runner (Linux) measured 0.139 where Windows said 0.036:
      the fallback font there is wider than Plex and the swap moved the page three times, so judge a layout shift on CI.
- [x] **8.3** `keyboard.test.ts` (criterion 8): Tab walks of Explore, the Party tab and the open sheet (every control reached,
      a 2 px ring, nothing under a fixed bar) and two flows with no pointer. `contrast.test.ts`: every text token on every
      surface, under the match highlight, and the 3:1 lines. `docs/SCREEN_READER_CHECKLIST.md` for the owner. Deviations: the
      walks found three faults and the slice fixed them: a keyword that relies on or guards against something lost its focus
      ring (its role outline outranked the page's ring), the sheet opened with the focus on an unnamed scrolled `div` in Chrome
      (now its title), and the filters took 124 presses of Tab to pass (new "Skip filters" link, from 700 px).
- [ ] **8.4** Final credits (authors confirmed with the owner), README, docs, table mapping acceptance criteria to tests.
      Deferred by the owner on 2026-10-18 while Phase 2 starts (D25); nothing else blocks it.

### M8b The owner's notes — done
Phase 1 refinements from the owner's play-testing (2026-10-17/18), slices 8b.1–8b.11. Mobile: the search field and the sort are 16 px
under `pointer: coarse`; a "Back to top" that jumps (the virtual list cancels a smooth scroll, see Notes). Filters: "Clear filters (N)"
keeps the query, sort and Match all/any; the five classes first; collapsible sections with "· N on", remembered only while the page
lives. Party: "Add to…" opens `SlotChooser` for a trait the target refuses but another slot takes (`allowedSlots`). Events (GAME_RULES
R12, ADR-0009): the triggers became 18 events plus Spells and Stats, each mention with a role and an actor (`uses:attack/self`; the 11
old phrases are aliases); the Events filters have *Who acts* as a toggle for each actor (the actors of one side are an OR: `ActorSet`,
`KeywordFacet.byActors`); the report lists the event forms no keyword covers (`REVIEWED_EVENT_FORMS`; `real-sheet.test.ts` fails on a
new one). 8b.10 made a buff or debuff no name gives, and protection from them ("immune to debuffs"), an event: it reversed a decision
of 8b.6, and if the owner vetoes it the 7 protective patterns and the cue rule in `readEvent` go.

## Phase 2 — slices
Opened early on the owner's go-ahead (D25), in the order of D15. Decisions D14–D25; architecture in ADR-0010 (query assist) and
ADR-0011 (Synergy routes). Prototypes: `SearchBar.dc.html`, `MobileSearch.dc.html`, `Synergy.dc.html`, `MobileSynergy.dc.html`
(behaviour only; where the plan departs from them it says so). QUERY_LANGUAGE, SPEC and DESIGN change in the slice that makes
them true, never ahead of it. Every new `core` module must be reachable from `core/src/index.ts` (dependency-cruiser `no-orphans`).
- *Unchanged, reused:* lexer, parser (never throws), `evaluate`, `visitQuery`, `queryChips`, `serialise`, the URL codecs (`q` stays the
  bar exactly as typed), facets, `ExploreState`, slot rules, the planner, `TraitRepository`.
- *Extended:* `QueryDiagnostic` (+`severity`, +`fix`), `FieldDefinition` (+`help`, +`values`, +`describe`), `SearchService` (+`vocabulary`,
  +`traits`, +`countMatches`), `timeSearches` (it times `.search` only today), `core/index.ts` (must export `compileQuery`; `serialiseTerm` is), `query-input.svelte` (stays the one `<input>`), `composition-root.ts` (one load, two services), `+page.svelte` (party and
  address logic move to a shared session), `support/keyboard.ts` `CONTROLS` (+`[role=option]`, `[role=combobox]`), `tools/size-budget`
  (+`lazyJs`, +`totalJs`: a lazy chunk is invisible to it today), `lighthouserc.cjs`.
- *Watch while building:* the mirror must line up across engines (same font stack on both layers, `forced-colors`, selection); IME and
  predictive keyboards (`isComposing`); iOS keyboard docking (owner device check); layout shift from the lazy chunk (the input never
  swaps, the badge sits inside the field); `no-navigation-without-resolve` with dynamic routes; GitHub Pages serves `404.html` with
  status 404 (no previews or SEO for `/synergy/…`: accepted, ADR-0001); 13.1 refactors a 776-line page (the Phase 1 e2e is the net);
  assist latency (budget first, then defer the counts); the volume of *Same trigger* (ranked and capped).

### M9 Diagnostics — done
`core`: `TextEdit` + `applyEdit` + `caretAfterEdit`; `QueryDiagnostic<Code>` with `severity` and `fix?`; `withSyntaxFixes` (a fix only if
the query means the same after it; none past 50 problems); `closestMatch` (own Levenshtein, bounded); `FieldDefinition` +`help`,
+`values` (`choices` | `vocabulary` | `keyword`), +`describe`; `createQueryVocabulary` and `SearchService` +`vocabulary`, +`traits`,
+`countMatches`; the lint registry (`LintRule`, `createLintRegistry`, `lintRegistry`: 12 rules, only `unknown-field` has
`reportsWhileTyping`, D20) and `lintQuery(source, context, {caret})` (`MAX_LINTED_LENGTH` 2,000). Soundness is tested on the real sheet
(`assist-acceptance.test.ts`: every finding of the value rules is a query that finds nothing, every fix lints clean). `web`: the badge
inside the field, the list under it (`QueryIssues`), `applyFieldEdit` (native undo kept), the polite line (`issue-announcer`),
`atlas:assist` (`timeAssist`), tokens `--issue-*`. Deviations worth knowing: D21 (a `family:`, `creature:` or `trait:` that matches
nothing is a warning; only the class is an error); the keywords are not in the vocabulary (the taxonomy has them); a value has at most
one fault; "did you mean" compares whole entries; a selection is no caret (the Tab key selects the whole text of a field); the list
opens by itself only for a query that was typed, never for one that arrives with the address (nothing moves on load: Lighthouse CLS
unchanged); `aria-invalid` for errors only; the list shows five issues, errors first. The findings of a term are remembered per text,
`typing` flag and context (`lint-term.ts`; a text that stands elsewhere gets them moved). If suggestions push `atlas:assist` up,
defer the counts (ADR-0010).

### M10 Autocomplete — done
`core`: `suggestionContext` (six kinds, each with the `replace` span an accept takes the place of), `suggestQuery` over a registry of providers
(one per kind; `rankCandidates` by tier, cut at nine; `bestFits` before anything is written out), `acceptSuggestion` (a `TextEdit`, like a fix),
`ghostText`, `withCounts` (within the filters, D18); soundness tested on the real sheet (`assist-acceptance`). `web`: `combobox-state.ts` (the
key table is a table of tests), `Combobox` (APG editable combobox attached to the host's `<input>`; `keyPressOf` reads key code 229 as an IME,
Safari), `list-announcer`, `search-shortcut` (`/`), and the wiring of 10.5: `query-input.svelte` keeps the plain `<input>` and fetches
`query-assist.ts` (`import()` in `query-assist-loader.ts`, on first idle, focus or pointer) which brings `analyseQuery` (issues and suggestions of a key
in one call, timed `atlas:assist`), `Combobox`, `IssueBadge`, `QueryIssues`. Deviations worth knowing: the ghost text is written but drawn with the
mirror of 11.2 (until then the active option in the list is what Tab takes); the `Combobox` takes the `input` as a prop; an option that continues
keeps the list open; the list does not scroll (axe: a scroll area is a tab stop); **the counts are not all made with the key**: nine searches at 4×
CPU took 16–17 ms, so the first suggestion is counted with the list (it is the active one, read at once) and the rest three at a time, each step in
a task of its own after a paint (`countNext`, `afterNextPaint`): assist p95 6.4 ms; **the list sits under the list of issues** (over it, it covered
the fixes) **and under the fixed bars** (z-index 4; on a phone the Filters button was covered); `applyFieldEdit` marks its own `input` events
(`isBeingEdited`) so a fix or an accept neither opens the list nor makes an option active. The size budget has `lazyJs` (50 kB; 9.2 now) and `totalJs`
(200 kB), and dependency-cruiser runs over `apps/web/src` with the rule `assist-stays-lazy`. e2e: `searchBox` is a combobox (it waits for the layer),
`query-suggestions.test.ts`, the option targets in `touch-targets.test.ts`.

### M12 Relations engine (core) — done
`core/src/relations/`: `createRelationIndex(traits, taxonomy)` over the 42 keys that can be a dependency (buffs, debuffs, effects; no event,
mechanic or flag: R12, D16). `get(key)` → the traits that apply, apply conditionally or at random, and rely on it (a trait is listed once per
key among the sources, under the strongest); `relationsOf(id)` → Enabled by / Enables (one trait per side, a `several` lane first, `unmet`
keys, ranked by tier, links, name: D17; Enables lists only what the focus applies by name: D27); `alternativesOf`, `sameTriggerOf`,
`sameFamilyOf` (D28); `keywordView(key)` / `keywordStats()` (lists, counts, verdict D29, co-applied keys). Each takes `artifactOnly`, returns
the whole ranked list (the UI caps) and `undefined` for an unknown id or key. `createRelationService(repository)` is the web's entry: the four
sections of a trait are remembered for the last 32 questions (`memoiseRecent`), beside `trait(id)`, `datasetVersion` and `findTraits(text,
limit)` for the focus picker (the name begins with the text, has a word that does, has it inside; then the creature or the family). `keywordSlug` /
`keywordFromSlug(slug, keys)` write and read `/synergy/kw/<slug>` (`createTaxonomy` refuses two keys with one slug or none, as it does a key
that starts another; the slug is read exactly, and the caller gives `index.keys`, because an event's key has no page). `loadOnce(repository)`:
the composition root fetches the dataset once for both services; the relation service is built in `relation-composition.ts` (13.2), so that
its code stays out of the first script. Tested on the real sheet (`relation-acceptance`, `keyword-view-acceptance`: the counts
equal Explore's facet panel for all 42 keys, with and without `mat:yes`, and the committed `keyword-verdicts-v2.0.txt`;
`relation-service-acceptance`) and with hand-made traits and fast-check oracles, all mutation-checked. `pnpm bench` (`relations.bench.ts`):
the index builds in 0.55 ms; the four sections of all 1,780 traits cost 2 µs (Enabled by / Enables), 1 µs (Alternatives), 44 µs (Same
trigger) and 7 µs (Same family) a trait on average, 0.3 ms at worst for all four (Squirmies); all 42 keyword views 0.17 ms; one key of the
focus picker 0.25 ms. Data worth knowing: the lanes are small (Poisoned 14 appliers, Burning 11, Vulnerable 8); events are huge (`attack`: 97
cause, 370 react), hence D16; 27 enemy-only random sources and 4 conditional-source traits exist.

### M13 Synergy UI — done
Three routes under `/synergy` (ADR-0011; `ssr = false` for a trait and a keyword, which 404.html boots on Pages) that share the party with
Explore through `partySession` (`party-session.ts`; the Phase 1 e2e passed untouched through the refactor of 13.1) and write it to the address
with a writer of their own (`synergy-address.ts`: `mat=yes`, `section=`, the party). `web`: the picker (`TraitPicker` is the `Combobox` of 10.4
over `relations.findTraits`; `KeywordPicker`; "Start from your party"), the trait page (`FocusCard`, `RelationSide` and `TraitLane` with the
random group folded above 3, `TraitCard`, `RelatedSection` for Alternatives, Same trigger and Same family, `ExplorationTrail`,
`ArtifactFilter`), the keyword page (`KeywordSummary` with the six verdicts, `RelatedSection` for Appliers and Rely on it with the conditional
and random groups, "See in Explore"), the phone under 700 px (`SectionTabs` with `section=` as a history step, the folding focus card, the
trail as a row of pills, `PickerSheet`), and the links from Explore (`SynergiesLink` in a result's foot and in a filled slot). `core`:
`traitFacts`, `SameFamily.grouping`. Docs: SPEC §7 and §8.4, DESIGN § Synergy pages, § Result list, § Party panel, § Layout, checklist rows
27–41 and iPhone 9–15. Deviations worth knowing: D23 and D30–D31 (the Synergies link sits beside the tab list, Party in the header goes to
Explore); D33–D35 (a card and a step are links, no "Now centred" line, the trail is session memory); D36 (Exotic, Backer, Avatar and Zantai
are groupings, not families); D37–D38 (6 cards and a button, up to 200); D39–D43 (a keyword's page); D44–D48 (the phone); D49–D50 (the links
from Explore; a search typed a moment before a link is followed is dropped, `AddressWriter.abandon()`, a bug that was already there).
Found by the e2e: `bind:this` hands back `null` when an element goes, not `undefined`; and (13.8) `SectionTabs` went along from `selected`,
which follows the address, so keys that outran the navigation (a held arrow) landed on the wrong tab: a key now goes from the tab it
was pressed on, with a test that sends three arrows in one task. Found by Lighthouse (13.8): a layout shift of
0.07–0.12 on the three pages (the footer, jumping out of view when the lists arrived), prevented by `LoadStatus` holding the height of the
window, and a `/robots.txt` answered with a page. 13.8 also added `tools/serve-build` and the three Synergy URLs to `lighthouserc.cjs`
(D51). **Data:** the biggest lists in v2.0 are 67 alternatives (Jungle Boogie), 548 same trigger (Furor; the median is 35) and 147 same
family (Numerical Nightmare); 531 of 1,780 traits rely on no event; a keyword has at most 18 appliers and 26 users and 27 random sources,
so nothing of a keyword's page is cut. Sizes: initial JS 89.6 kB, lazy 32.1 (the Synergy routes about 23), total 121.7.

### M11 Editor — colours, explanation, saved searches, mobile sheet (last, D15)
- [x] **11.1** Explain. `explainQuery(ast, registry)` (a visitor shaped like `serialise`; QUERY_LANGUAGE §7) and a "Reads as" line in the
      effective-query component (D19). Deviations worth knowing: the reading of a term lives on the registry (`describeTerm`, beside
      `matcherFor`, so that the two read an empty value, an unknown field and letter case the same way), not in the visitor; a term with no
      value says "asks for nothing" (the words `describe` already used for `uses:/`); `SearchOutcome.effectiveReading` is worked out with
      every search (a second `parseQuery` of the effective text: 14 µs for a long one, under the noise of `pnpm bench`).
- [x] **11.2** Syntax colours and the mirror. `syntaxSegments(source, tokens, diagnostics)` (core; a segment is cut where a diagnostic
      starts or ends, so a line is drawn under the text at fault and no more) and `QueryMirror` (`aria-hidden`, in the lazy chunk) under
      the transparent input, with the ghost text of the active suggestion (`Combobox` gained `onactive`), a `forced-colors` fallback and
      `--syntax-*`, `--underline-*`, `--field-selection` in `contrast.test.ts` (`.query-text` is the one place of the shared metrics).
      Deviations worth knowing: **a warning is a dotted line and an error a wavy one** (the plan said wavy for both: two shapes, so
      that the red and the amber are not told apart by colour alone); the mirror draws from the same `analysis` as the badge, in the
      same flush, not from the lexer first (the lint was synchronous already, and no frame shows a text and colours that disagree);
      the copy follows the field's scroll with a transform fed by `scrollLeft` every frame while the field has the focus (events alone
      are not enough in every engine); the ghost text lies beyond the caret, so in a field that is full it is out of view (the list is
      what is left); the field's name had to be read without `aria-hidden` text in `touch-targets.test.ts`, since the mirror lies in
      its label. e2e: the text of the copy equals the field's, the pieces and the severities, the ghost, the scroll, forced colours
      (Chromium), and **the alignment as a picture**: the field's own text in white against the copy in white must have a best shift
      of under half a CSS pixel each way (the field and the copy round to the screen on their own: CI found one pixel down on a Pixel 7,
      a PC one across); a mutant that moves the copy 2 px fails it. A text of 10,000 characters costs the mirror
      ~80 ms and 48,000 about a second, beside 1 s and 5.6 s for the rest of the keystroke: no cap.
- [x] **11.3** Search history (core). `core/src/history/`: an immutable `SearchHistory {recent, saved}`, `recordRecent`, `toggleSaved`,
      `isSaved`, `removeRecent`, `removeSaved`, `exportHistory`, `importHistory(text, current)`; the rules and the file are in SPEC §8.3,
      D52. Deviations worth knowing: `exportHistory` gives the **text** of the file (not an object), so that the format stays in `core`;
      `toggleSaved` gives `{ok, history}` or a refusal (`empty` | `too-long` | `full`), like `executeCommand`, because the field has to say
      why a star did nothing; `importHistory` also says how many it `added` and how many it `leftOut` for want of room (the message
      "Imported 3 saved, 5 recent" needs both); the limits are 2,000 characters a search (`MAX_SEARCH_LENGTH`, not the lint's constant,
      so that tuning the lint never changes what a file may hold) and 2,000,000 for a file (a test writes the biggest one the app can and
      reads it back). Mutation-checked (18 mutants, none survived) and property-tested (limits hold after any steps; any file imports
      without throwing and idempotently; export then import is the identity).
- [x] **11.4** History UI. `search-history-store.ts` (the text of the file Export writes under one `localStorage` key; a damaged value is
      refused as a damaged file would be and reads as empty; `undefined` when the storage cannot be read), `search-history-session.ts`
      (reactive, made once in `composition-root` like the party's), `history-options.ts` (the rows of a blank field); in the lazy layer
      `HistoryButtons` (the star and *Manage searches*), `SearchesSheet` (a `BottomSheet` `choice` with `SearchRow`) and the `browsable`
      mode of the `Combobox`. The rules are in SPEC §8.3 *In the field*, D53–D57. Deviations worth knowing: **Enter rarely sends a search**:
      with the list of suggestions open it takes the active one (D26), so a search is sent by Esc then Enter, and most searches are
      remembered on leaving the field; the star is there only while the field holds something (so `empty` cannot happen in the page); the
      Manage button is always in the field (Import has to be within reach of an empty history) and the two buttons take 88 px of it:
      **on a 320 px phone the text has about 150 px, 46 with the issues badge: 11.5 takes the phone out of this field**; no `role="status"`
      and no second live region in `.query` / `.field` (the e2e locators are strict about both): the words of the star and of a refusal
      go through the field's one polite line. e2e (`search-history.test.ts`, 37 × 3 projects): remembering, the list of an empty field
      (no active option, Tab leaves), the star, the full refusal, the sheet, export → remove all → import restores, five refused files,
      a storage that throws; axe on the list, the star, the refusal and the sheet; the Tab walk of the sheet; the targets of the sheet.
      Mutation-checked: `typed(browsing())` made `typed()` fails "stays so when the typing has just emptied the field".
- [x] **11.5** Mobile search sheet. `core`: `insertAtCaret(source, selection, id)` and `SYNTAX_INSERTION_IDS` (QUERY_LANGUAGE §8 *The toolbar*; 31 tests with
      property tests against the lexer, mutation-checked: 6 mutants, none survived). `web`: `SearchSheet` (a native `<dialog>` with the head, the issue banner, "Reads as",
      the list, the star and *Manage searches*, the button *Show N traits* and `SyntaxToolbar`), `QueryTextInput` (the field and its mirror box, now shared by the page
      and the sheet), `IssueBanner`, `SaveRefusal`, `fitToVisualViewport`, `search-sheet.ts`, and in `Combobox` two modes (`flow`: always showing, Escape is the
      sheet's; `suspended`: the page's list stays shut behind the sheet). The rules are in SPEC §8.3 *The search sheet*, DESIGN § Search sheet, D58–D65. Deviations worth
      knowing: **a press opens it, a focus does not** (D58: the plan said "the field opens"; a keyboard, `/`, `fill` and a press before the layer arrives edit in the page, so
      the page's field stays complete and the 252 uses of `searchBox` in the e2e on the phone projects kept working); it is not a `BottomSheet` variant (D59); the
      focus after it goes to the Results heading (D61); **Enter with nothing active closes it** and so a phone's "search" key takes the first suggestion before it sends (D62).
      Found on the way: `bind:this` hands back `null` when the sheet's field goes, which crashed the mirror's effect and took the sheet with it (the mirror and the combobox
      now test `instanceof HTMLInputElement`); the press that opens the sheet also reached the page's `Combobox`, which opened its list behind the sheet and left it open
      after it (hence `suspended`). e2e (`search-sheet.test.ts`, 24 × 2 phone projects): open, text, count, closing and where the focus goes, Escape and Enter, a suggestion
      pressed keeps the focus, the banner and its fix, the mirror, each button of the toolbar, history, star, Manage, axe, the visual viewport (Chromium, page scale 2),
      and the mouse leaving the sheet shut; plus the Tab walk of the sheet (`keyboard.test.ts`), its 44 px targets, 16 px field and a 320 px window
      (`touch-targets.test.ts`), contrast of the sheet's surfaces. Adapted: the tests of the page's list use `openHistoryList` (focus, Alt+Down) where a press would open the
      sheet. **Owner device check** (iOS Safari and Chrome Android: keyboard docking, caret, zoom): not done, see *Resume here*.
- [ ] **11.6** Close M11 and Phase 2. Budgets, Lighthouse, QUERY_LANGUAGE §7–8 and SPEC §8.3 rewritten to what shipped, DESIGN components,
      the Phase 2 criteria-to-tests table, ROADMAP ticks, PLAN collapse; ask the owner before Phase 3.
