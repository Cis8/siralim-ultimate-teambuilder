# Screen reader checklist

A smoke test for a person with a screen reader, because no automated check hears what a screen reader says. axe and the
keyboard e2e (`keyboard.test.ts`) already prove that every control has a name, can be reached with Tab and shows a focus ring;
this list checks that what is *said* makes sense. Twenty minutes, once per release that touches the UI.

**Set-up.** Desktop: NVDA (free) with Firefox or Chrome on the live site. Phone: VoiceOver on an iPhone, in Safari
(Settings → Accessibility → VoiceOver; or triple-click the side button once it is a shortcut). TalkBack is covered only for the search sheet (the last section).
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
| 27 | Open `/synergy/abomination--flesh-rot` (by its address, or pick Flesh Rot in Synergies), then `H` through the headings | the title "Flesh Rot — Synergies — Trait Atlas"; "Flesh Rot" (1); then "Enabled by 36 traits" (2), "Several keys 28 traits" (3), "Random sources · 27" (4, a button), "Applies Weak 1 trait" (3), "Applies Vulnerable 7 traits" (3); then "Enables 0 traits" (2), "Alternatives 6 traits" (2), "Same trigger 0 traits" (2), "Same family 8 traits" (2) |
| 28 | In the description of the focus, `Tab` to "Weak" | "Relies on Weak — see who applies it and who relies on it, link"; an event or a mechanic in a description is not a stop |
| 29 | `Tab` to a card of a lane and press `Enter` on its name | before: "Re-centre on *name*, link", then "Add to Creature 1 · Innate — *name*, button". After the press: the new page's title and then "*name*, heading level 1", once each. If you hear the name more than twice, or nothing, report it: a line that says "Now centred on …" was left out on purpose, on the belief that the two above are enough |
| 30 | On Flesh Rot, `Tab` to "Random sources · 27", press `Space` | "Random sources · 27, button, collapsed", then "expanded"; the cards follow, each with "random" among its tags; the 27 are a list |
| 31 | Re-centre on two traits in a row, then go to the trail with `D` or `N` | "Exploration trail, navigation", a list of 3 items: the first two "Re-centre on …, link", the last "…, current location" (the wording of the last varies with the reader) |
| 32 | Press the checkbox "Artifact-eligible only" | "Artifact-eligible only, checkbox, checked", then once "Only traits with a material are listed. Enabled by 35 traits. Enables 0 traits. Alternatives 6 traits. Same trigger 0 traits. Same family 7 traits." (the numbers are the page's, for Flesh Rot); pressing again says "Every trait is listed. …" |
| 33 | On Flesh Rot, `Tab` to "Show all 8 — Same family" and press `Space`; then `Tab` once | "Show all 8 — Same family, button, collapsed", then "Show fewer — Same family, button, expanded"; the focus stays on the button, and the next `Tab` goes into the cards (the first is "Re-centre on Master of Abominations, link"). If you land anywhere else, report it |
| 34 | On a trait of the Exotic family (Iron Maiden's "Agonizing Entrapment"), go to the heading "Same family" | "Same family, heading level 2" with no number, then "Exotic is a grouping in the compendium, not a family", then the sentence that no mastery trait is named for it; no list follows |
| 35 | Open `/synergy/kw/vulnerable`, then `H` through the headings | the title “Vulnerable — Synergies — Trait Atlas”; “Vulnerable” (1); “Appliers 8 traits” (2), “Rely on it 6 traits” (2), “Keywords” (2) with “Debuffs”, “Buffs” and “Effects” (3) |
| 36 | Read the head of the page with the arrow keys | “Debuff”, “8 apply it”, “6 rely on it” (the dot between them is silent), the verdict as words: “Well supported” and its reason (the icon is silent), “Often applied together with”, then a list of links each followed by “, applied by 1 of its appliers” |
| 37 | `Tab` to “See in Explore — Appliers” and press `Enter` | “See in Explore — Appliers, link”; Explore opens with “applies:vulnerable” as its only filter and “8 of N traits” |
| 38 | Back, then `Tab` to a card of Appliers and to a chip of Keywords | the card: “Open *name*, link” (not “Re-centre on”); the chip: “Weak, 2 appliers, 3 users, link” (the arrows and the numbers beside it are not read); the keyword you are on adds “current page” |
| 39 | Press Enter on that chip | the new page's title and “Weak, heading level 1” once each, then once, politely: “Weak: 2 apply it, 3 rely on it. Well supported. Enough traits apply it for the ones that rely on it.” If you hear the title twice or the line twice, report it |
| 40 | On Weak, `Tab` to “Random sources · 27”, then press the checkbox “Artifact-eligible only” | the group is folded as in 30 (and the heading above it says “Appliers 2 traits”: the 27 are counted apart); the checkbox is followed once by “Only traits with a material are listed. Appliers 2 traits. Rely on it 3 traits. Well supported.” |
| 41 | On Explore, search `trait:"Flesh Rot"`, `Tab` from the card's plus button through its description to the end of the card, press `Enter` | the last stop is “Synergies of Flesh Rot, link” (its icon is silent); then the page's title and “Flesh Rot, heading level 1”, once each. Press Back: the field holds the search and the card is there. In the party, a filled slot has the same link between “Target slot: …” and “Clear …” |
| 42 | In the field type `clas:life (weak OR snared`, then leave it with `Shift+Tab` and arrow back to it in browse mode (or ask for its text with `NVDA+Up`) | the query is read once, “clas:life (weak OR snared”, as the field's value: the coloured copy of it that is drawn under the field is hidden from the reader, so no second reading of the same text, no “wavy line” or colour is spoken (the badge and the issues say what is wrong, in words: 19–21) |
| 43 | Windows high-contrast theme on (`Alt+Left Shift+PrtScn`), then look at the field with a query in it | the text of the field is drawn once, in the theme's colours, with no colour per piece and no line under it; the badge and the issues still say what is wrong (this one is for the eyes, not the reader) |
| 44 | Search for something, `Escape`, `Tab` out of the field; come back to the empty field and press `Down` | "expanded"; the list is “Recent and saved searches”; `Down` reads “Recent *search*” (or “Saved *search*”), the first `Down` the first row; nothing was active before it, and `Tab` from a field that was only focused or emptied leaves it without taking a row |
| 45 | Type `uses:weak`, `Escape`, then `Tab` to the star and press `Space` twice | “Save this search, toggle button, not pressed” → “pressed” (the name stays the same, only the state changes), and politely “Search saved.”; the second press: “not pressed” and “Search removed from the saved ones.” |
| 46 | `Tab` on to “Manage searches, button” and press `Enter` | “Manage searches, dialog”, the focus on its title; the headings “Saved (N of 50)” and “Recent (N)”; each search is a button read as its text, with “Remove “…” from the saved searches, button” beside it; nothing of the page behind is reached |
| 47 | Press one of the Remove buttons, then `Escape` | politely “Removed “…” from the saved searches.”, the focus on the search that took its place (the heading when none is left); `Escape` closes and the focus is back on “Manage searches, button”. If the focus falls to the top of the page, report it |
| 48 | Press “Export searches”, then “Import searches” and choose a file | after Export, “Exported N saved and M recent searches.” (and the browser's download); after choosing a file, politely “Imported N saved, M recent.”, or the reason nothing was imported (try a file that is not JSON) |
| 49 | With fifty saved searches (import a file with fifty), type a new one and press the star | the sentence “You have 50 saved searches already. Remove one to save this one.” is said once, politely, and shown under the field with a “Manage searches, button” beside it |

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
| 9 | Open `/synergy/abomination--flesh-rot` and swipe from the name "Flesh Rot, heading level 1" to what follows the card | the description (and, if it is long, "Show more, button, collapsed"), then "Relations, tab list"; "Enabled by 36 traits, tab, selected, 1 of 4" · "Enables 0 traits, tab, 2 of 4" · "Alternatives 6 traits, tab, 3 of 4" · "Related 8 traits, tab, 4 of 4" |
| 10 | Double-tap "Alternatives", then swipe right | "Alternatives 6 traits, tab, selected, 3 of 4"; the next swipes read the sentence "Traits that apply or rely on the same keys as Flesh Rot" and the cards, with no other list in between. The heading "Alternatives" is read though it is not drawn: if it sounds like the tab said twice, report it |
| 11 | Double-tap "Related" | the tab selected, then "Same trigger, heading level 2" with its count and "Same family, heading level 2": both lists, one after the other |
| 12 | On a trait with a long description (say Sleepwalking), double-tap "Show more", swipe on, double-tap again | "Show less, button, expanded" and the rest of the text follows in reading order; then "Show more, button, collapsed" |
| 13 | Swipe up to "Find a trait, button, has pop-up" and double-tap; type `vuln` | "Find a trait, dialog", the focus in the field with the keyboard up; the list of matches is read as in step 8; a double-tap on one: the new page's title and the name as "heading level 1", once each, and the sheet is gone. Esc does not exist on a phone: the two-finger scrub closes the sheet and the focus is back on "Find a trait, button" |
| 14 | Open `/synergy/kw/vulnerable` | "Appliers 8 traits, tab, selected, 1 of 2" · "Rely on it 6 traits, tab, 2 of 2"; "Other keywords, button, has pop-up"; a double-tap opens "Keywords, dialog" with the chips read as in step 38 of the desktop list |
| 15 | On Explore, swipe from a trait's plus button through its description, then on | after the material: “Synergies of *name*, link”, 44 px tall (a double-tap opens the page; the tab bar then shows Synergies as the current page). On the Party tab, a filled slot reads “Target slot: …, toggle button”, “Synergies of *name*, link”, “Clear …, button” |
| 16 | With `clas:life (weak OR snared` in the field, swipe to the field | “Search traits, text field, clas:life (weak OR snared” once; the next swipe goes to “2 issues, button”, not to a second copy of the text. Also look: the text is coloured piece by piece, and the letters of the text are where you tap (select a word with a long press: the highlight is on the word, not beside it) |
| 17 | Search for something and leave the field; double-tap the empty field | “Search, dialog”, the keyboard rises with the focus in “Search traits, text field” and, under it, the heading “Recent and saved searches” and the list (the same list as 8: say what you hear); a double-tap on a row writes the whole search into the field and the sheet stays open; nothing of the page behind is reached. A press is what opens it: the field in the page is still there for a keyboard |
| 18 | With text in the field swipe to “Save this search, toggle button” and double-tap, then to “Manage searches, button, has pop-up” and double-tap | “pressed”, the keyboard stays up; “Manage searches, dialog”, the searches as buttons with a Remove beside each; “Export searches” hands the file to Safari (it asks where to keep it), “Import searches” opens the file chooser; the two-finger scrub closes the sheet and the focus is on “Manage searches, button” |
| 19 | In the sheet type `clas:life (weak`; swipe back from the field | the field as “Search traits, text field, invalid entry”; “Error”, the first issue and “+1 more” as one line; “Change to “class:”, button”. A double-tap on the fix mends it, the keyboard stays up and the caret is where it was |
| 20 | Swipe on to the foot of the sheet | “Show N traits, button”, then “Insert query syntax, toolbar” with “Open a group (”, “Close a group )”, “Phrase in quotes "”, “OR: either term”, “AND: both terms”, “NOT: leave out the next term”, “applies: …”, “uses: …”, “class: …”, “mat:yes: …”. A double-tap on OR writes it at the caret with a blank on each side and **the keyboard stays up**; the quote writes two with the caret between them |
| 21 | Type a few more letters and wait a moment | politely “N of M traits” (once the typing pauses); “Show N traits, button” has the same N. A double-tap on it closes the sheet and the focus is on “Results, heading level 2”, with no keyboard |
| 22 | Open the sheet again and do the two-finger scrub | the sheet closes, the search stays in the field of the page, and the focus is on “Results” again |

## Android (TalkBack, Chrome): the search sheet

| # | Do | You should hear and see |
|---|---|---|
| 1 | Double-tap the search field on Explore | “Search, dialog”; the keyboard rises and the field is in the sheet, **not hidden by the keyboard**; the button “Show N traits” and the toolbar sit just above the keyboard, with nothing between them and it |
| 2 | Type, then double-tap “OR: either term” and “"” in the toolbar | the text is written where the caret was, the keyboard stays up, and the quote leaves the caret between the two marks |
| 3 | Press the system's back button (or gesture) | the sheet closes and does not leave the page; a second press leaves as it always did |
| 4 | Rotate the phone with the sheet open | the sheet is still the size of what the keyboard leaves, the field, the button and the toolbar all in sight; scroll the list with the keyboard up |

(On iPhone the same things are rows 17–22 above, and the keyboard docking is the one to look at: the foot of the sheet must be above the keyboard in Safari and in Chrome for iOS.)

## Anything, anywhere

- No stop is read as just "button", "link", "clickable" or "graphic": every control has a name.
- Colour is never the only thing said: a missing source is "missing", a target slot is "pressed", an excluded term offers
  "include it again".
- The wording of the role and state ("toggle button", "pressed", "tab, 1 of 2") varies with the reader and its version; what
  must be there is the name, the role and the state, in a sensible order.
- A change you make is told once. If the same sentence is read twice, report it.
- After an action that removes what you were on (Remove chip, Clear a slot, Undo), the focus is still somewhere sensible.
