# Screen reader checklist

A smoke test for a person with a screen reader, because no automated check hears what a screen reader says. axe and the
keyboard e2e (`keyboard.test.ts`) already prove that every control has a name, can be reached with Tab and shows a focus ring;
this list checks that what is *said* makes sense. Twenty minutes, once per release that touches the UI.

**Set-up.** Desktop: NVDA (free) with Firefox or Chrome on the live site. Phone: VoiceOver on an iPhone, in Safari
(Settings → Accessibility → VoiceOver; or triple-click the side button once it is a shortcut). TalkBack is not covered.
Open the site fresh each time, with no `?party=` in the address.

**Reporting.** In the chat, give the step number and what you heard instead (or "nothing"). Claude turns each deviation into a
failing test and a fix. A step that sounds odd but is understandable is still worth reporting.

## Desktop (NVDA)

| # | Do | You should hear |
|---|---|---|
| 1 | Load the page | "Trait Atlas — Siralim Ultimate trait search and party planner" |
| 2 | `D` through the landmarks | banner · main · search · Filters region · Results region · Party region · footer (contentinfo) |
| 3 | `H` through the headings | "Explore traits" (1), then "Filters", "Results", "Party" (2), then one trait name per card (3) |
| 4 | `Tab` once, `Enter` | "Skip to content, link"; focus lands in the main area |
| 5 | `Tab` to the field, type `vulnerable`, wait a second | "Search traits", an editable combo box with autocomplete; the first suggestion read as it appears (see 23); then, once, "N suggestions" and "N of M traits" (no repeat on every key) |
| 6 | `Tab` to the chip | "vulnerable — exclude it, button"; `Enter` turns it into "vulnerable — include it again, button"; next "Remove vulnerable, button" |
| 7 | `Tab` until "Skip filters, link", `Enter`, `Tab` | "Results, heading level 2", then "Add to Creature 1 · Innate — *trait name*, button" |
| 8 | Back in the filters, `Tab` to a class and to a keyword | "Life 123 traits, toggle button, not pressed" (pressed after `Space`); the keyword is a group with "Applies N traits" and "Relies on N traits" |
| 9 | Arrow through a card | name as a level 3 heading; creature, family · class; the description with its keywords as buttons: "Applies Vulnerable — show traits that rely on it, toggle button"; the material, or "No material — not artifact-eligible" |
| 10 | Move the target to "Creature 1 · Artifact" and `Tab` to the add button of a trait with no material | the button is announced as unavailable and the reason is read as its description |
| 11 | Press "Add to …" on a trait | "Added *name* to Creature 1 · Innate." once; the card now reads "In party: Creature 1 · Innate" |
| 12 | In the Party region | "Target slot: Creature 1 · Fused, empty, toggle button, pressed" (the target moved on); toolbar "Party actions": Undo, Redo, Clear party, Copy link |
| 13 | Undo, then Redo | "Undid: added *name* to Creature 1 · Innate." then "Redid: …"; focus stays on the button just pressed |
| 14 | Copy link | "Link copied" |
| 15 | Add a creature that relies on a debuff nothing in the party applies | in Coverage: "*Debuff* — missing — show traits that apply it, button"; `Enter` moves to the Results with the search made |
| 16 | Remove the last chip with `Enter` | focus stays on the chips: "Filters and query terms, group", not back at the top of the page |
| 17 | In the filters, `Tab` into the Events section; press "This creature" and then "Enemies" in the group "Who acts", then `Tab` to "Attack" and `Space` on its second button | "Who acts, group", "Any, toggle button, pressed"; after the first press "This creature, pressed" and "Any" no longer pressed, after the second "Enemies, pressed" as well; then "Attack, group", "Causes N traits", "Reacts N traits" (N is the count for the two actors together); after the press "pressed", and the live line gives "N of M traits". Press "This creature" again: it is no longer pressed, "Enemies" is; press "Enemies": "Any" is pressed again |
| 18 | In a card, find an event in a description (for example "attacks" in "After this creature attacks, …") | "Reacts to attacks (this creature) — show traits that cause it, toggle button": the role in the words of the filters, then who acts |
| 19 | In the field, type `clas:life (weak OR snared`, then wait a second, press `Escape` and `Tab` | the field is "invalid entry"; once, "2 issues" (and "N suggestions", as in 23); `Escape` puts the suggestions away; `Tab` to "2 issues, button, expanded", then to "Change to “class:”, button" |
| 20 | Press `Enter` on that fix, then `Tab` twice and press the other fix | "Fixed. 1 issue left." and the focus is back in "Search traits, edit"; then "Fixed. No issues left." and the field is no longer invalid |
| 21 | Back in the field, with the issues there, ask for its description | each issue, the severity first: "Error Unknown field “clas:”. Did you mean “class:”?" (the severity is said, not only coloured) |
| 22 | Leave the field, press `/` (the slash key) | focus goes to "Search traits" and no slash is typed into it |
| 23 | In the empty field type `applies:vul`, wait a second | the first suggestion, read in full: "Debuff applies:vulnerable applies “vulnerable” N traits" (its kind, what it writes, what that means, how many traits it finds); once, "1 suggestion"; the list is "collapsed" before you type and "expanded" after |
| 24 | Clear the field, type `wea`, wait a second, then `Down` twice | "N suggestions"; each `Down` reads the next one in full, with its count (the last ones may say it a moment after the first words: the counts follow the list); at the end of the list `Down` goes back to the first |
| 25 | With a suggestion read out, press `Tab` | focus stays in the field; the text now holds what the suggestion wrote and a blank, and typing goes on from there; the list is gone ("collapsed") |
| 26 | Type `weak`, press `Escape`, then `Tab` | `Escape` collapses the list and leaves the text; `Tab` moves on to the next control and does not take a suggestion |

## iPhone (VoiceOver, Safari)

| # | Do | You should hear |
|---|---|---|
| 1 | Swipe to the foot of the page | "Explore, tab, selected, 1 of 2" · "Party 0 of 18 slots filled, tab, 2 of 2"; double-tap Party shows it |
| 2 | On Explore, find the bar "Filters, button" at the foot; double-tap | "Filters, dialog"; focus on the heading "Filters"; swiping never reaches the page behind |
| 3 | Swipe through the sheet, turn a class on | "Life 123 traits, toggle button, pressed"; the live line gives "N of M traits" |
| 4 | Two-finger scrub (the Z) | the sheet closes and focus returns to "Filters 1 active, button" |
| 5 | Swipe to a trait's plus button | the full name, not "plus": "Add to Creature 1 · Innate — *trait name*, button" |
| 6 | Press it, with the Explore tab still showing | "Added *name* to Creature 1 · Innate." (said although the party is on the other tab) |
| 7 | In the field type `clas:life (weak OR snared`; swipe to the badge inside the field and to the first fix | "2 issues, button, expanded", then "Change to “class:”, button"; a double-tap mends it, the keyboard stays up and the caret is where it was. (The suggestions are between the badge and the fixes in the order of the page: see 8) |
| 8 | In the empty field type `applies:vul` and listen; swipe right from the field | the first time a phone reads the list: say what you hear. Hoped for: the field as a combo box with a list, then "Debuff applies:vulnerable applies “vulnerable” N traits", and a double-tap on it writes it into the field with the keyboard still up. Safari does not always read the option that is active without being swiped to: that is worth reporting, not a surprise |

## Anything, anywhere

- No stop is read as just "button", "link", "clickable" or "graphic": every control has a name.
- Colour is never the only thing said: a missing source is "missing", a target slot is "pressed", an excluded term offers
  "include it again".
- The wording of the role and state ("toggle button", "pressed", "tab, 1 of 2") varies with the reader and its version; what
  must be there is the name, the role and the state, in a sensible order.
- A change you make is told once. If the same sentence is read twice, report it.
- After an action that removes what you were on (Remove chip, Clear a slot, Undo), the focus is still somewhere sensible.
