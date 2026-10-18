# Query language

Phase 1 needs §1–§4 (parse, evaluate, highlight, write back, edit by chip). Phase 2 adds §5–§8 (diagnostics, autocomplete,
explain, editor).
Reference behaviour: `docs/prototype/SearchBar.dc.html` (functions `tokPos`, `parseTokens`, `lint`, `suggest`, `explain`).

## 1. Grammar (EBNF)

```
query    = [ or ] ;
or       = and , { ( "OR" | "|" ) , and } ;
and      = unary , { [ "AND" | "&" ] , unary } ;        (* juxtaposition = AND *)
unary    = ( "NOT" | "-" ) , unary
         | "(" , or , [ ")" ]                            (* missing ")" is tolerated, see §5 *)
         | term ;
term     = field , ":" , value | value ;
value    = phrase | word ;
phrase   = '"' , { any char except '"' } , [ '"' ] ;     (* unclosed quote tolerated *)
word     = { any char except whitespace, "(", ")", '"' }- ;
field    = letter , { letter } ;
```

- Keywords `AND`, `OR`, `NOT` are case-insensitive. Precedence: NOT > AND > OR.
- `-` binds to the following unary (`-stack:no`, `-(weak OR snared)`).
- Matching is case-insensitive. Values are trimmed; quotes stripped.
- Lexing, which the grammar leaves open (`tokenize`): a word ends at a blank, a parenthesis or a quote, so `a|b` and `a&b`
  are one word and only a standalone `|` or `&` is an operator; `-` is a NOT only where a token starts (`-stack:no`,
  `--weak`, a lone `-`), never inside a word (`well-known`); a field is ASCII letters followed by a colon, and its value
  follows with no blank in between (`applies: weak` is `applies:` with no value, then `weak`); an unclosed quote runs to
  the end of the text, parentheses included. Letter case is kept as written; the field registry and the evaluator fold it.
- **The parser never throws** (`parseQuery`). It returns `{ ast, tokens, diagnostics }`; every token and node carries its
  source span. `ast` is `undefined` for a query with no term, which matches everything. A node's span is the text it was
  read from, its parentheses included (`(weak)` spans six characters, its `term` token four).
- **Repairs.** What does not make a query is reported and read as if it were not there, so the tree is the one of the query
  with the reported text removed (which is also what the fixes of §5 do): a `)` that closes nothing is skipped; a
  `(` left open is closed at the end; an `AND`/`OR` without a term on both sides, a `NOT` with nothing to negate and `()`
  are dropped. No term is ever dropped. Juxtaposition and `AND` build one n-ary node per chain; a group written inside a
  group of the same kind stays a node of its own (`a OR (b OR c)`).
- **Nesting** of `(` and `NOT` is limited to `MAX_NESTING` (32), so that any text, a pasted `?q=` included, gives a tree
  the visitors can recurse over. Past it, the `(` or `NOT` is dropped and reported; its `)` is then reported too.

## 2. Fields

| Field (aliases) | Matches | Semantics |
|---|---|---|
| *(none)* | creature, family, class, trait name, description, material | substring |
| `class:` (`c:`) | class | substring |
| `family:` (`fam:`, `f:`) | family | substring |
| `creature:` (`cr:`) | creature name | substring |
| `trait:` (`t:`) | trait name | substring |
| `desc:` (`d:`) | description only | substring |
| `applies:` (`a:`) | buff, debuff, effect or event the trait applies (`a:sealed`, `a:zombies`, `a:death/enemy`) | keyword key prefix, then `/actor` |
| `uses:` (`u:`) | buff, debuff, effect or event the trait relies on (`u:attack/self`) | keyword key prefix, then `/actor` |
| `kw:` (`k:`) | any keyword (any kind, any role, including a mention that only guards against it: `kw:silenced` finds "immune to Silenced", `applies:` and `uses:` do not; GAME_RULES R9) | keyword key prefix, then `/actor` |
| `mat:` | `yes` = has material (artifact-eligible), `no`/`none` = no material | exact |
| `stack:` | `yes` = stacks, `no` = "does not stack" | exact |

Fields are a **registry** (`createFieldRegistry`; the fields of the app are in `query/fields.ts`). A `FieldDefinition` is
`{ name, aliases, help, matcher(value), highlightsDescription?, values?, describe(value) }`. `matcher` is asked once per
term, with the value lower-cased, and returns the test to run on each trait, so a field parses its value (`yes`, `no`)
once, not once per trait. Names and aliases are lower-case ASCII letters (what the lexer reads before a colon)
and unique across the registry; the field name in a query is matched whatever its letter case.
- `help` is what the field looks for, in one line (no padding, no line break), for the person typing it.
- `values` says where the values of the field come from and how a value is compared with them (`mode`), and is absent where the
  value is free text (`desc:`). Evaluation, lint and suggestions read this one description, and the tests run each matcher
  against it. `choices`: a short list the field defines (`mat:`, `stack:`), compared exactly; each choice has its spellings
  (`none` is a spelling of `no`), the test it stands for and what it means in words. `vocabulary`: a column of the dataset
  (class, family, creature, trait name), any part of an entry. `keyword`: the keys of the taxonomy of the kinds the field can
  find (`applies:` and `uses:` take buffs, debuffs, effects and events, `kw:` every kind), the start of a key, and for an event
  `/actor`. The registry refuses a list of choices that is empty, a spelling that is not lower case, trimmed and not empty, and
  one that is given twice.
- `describe(value)` is the term in words, for the explanation of a query (§7): `class contains “life”`, `relies on “attack” by
  this creature`, `does not stack`. A value the field does not take is described as what was asked for (`mat is “maybe”`).
- **No field, or an unknown one.** A word with no field is looked for in the six columns of the table, one at a time, so a
  phrase never runs from the end of a column into the start of the next. An unknown field makes the whole token a free-text
  term: `clas:life` looks for the text `clas:life`, quotes stripped (and a diagnostic in Phase 2).
- **No value yet.** `applies:`, `class:""` and `""` match every trait: a term that asks for nothing does not empty the
  results while the query is being typed (Phase 2 warns about it).
- **Exact fields.** `mat:` and `stack:` take the values of the table and nothing else; any other value (`mat:maybe`)
  matches no trait (Phase 2 reports it as an error).
- **Keyword fields** compare the value with the start of the key (`a:dire` finds Dire Wolves; `a:wolves` does not).
  `applies:` and `uses:` read only the mentions of that role: a mention that `resists` is in neither (R9), and a
  conditional source (R10) is `uses`, not `applies`, so the two roles stay apart. A trait can be in both when it gives
  *and* relies on the same keyword (Cloudy Constitution: "always has Vulnerable … creatures with Vulnerable gain").
- **Who acts** (GAME_RULES R12, ADR-0009). An event is done by someone, and a keyword field takes that after a slash:
  `uses:provoke` finds the traits that rely on a provoke, whoever provokes; `uses:provoke/self` only those where this creature
  does. The actors are `self` (this creature), `ally` (your creatures, an ally), `enemy` and `any` (any creature), in any
  letter case. The key prefix still applies before the slash (`u:prov/self`), and a key of several words is quoted whole
  (`u:"start of turn/enemy"`). The lexer does not know the slash: the value is split afterwards, by `readKeywordValue` (which
  keeps the parts as written, for the diagnostics of §5) and read as a reference by `parseKeywordReference`.
  - The actor is exact: `/self` does not find a mention that says `any`. A mention that names nobody (the start of a battle:
    nobody makes it start) is found by no actor, and a buff, debuff or effect has none, so `weak/self` finds nothing.
  - A word after the slash that is no actor stays in the key and finds nothing (`provoke/nobody`). A slash with nothing after
    it asks for no actor yet, as the query is typed: `provoke/` is `provoke`, `/` is an empty value, and `/self` is every event
    that creature takes part in.
  - There is one actor to a term. Several actors are an OR of terms: `(uses:attack/self OR uses:attack/enemy)` is what the facet
    panel's *Who* control writes when two actors are on (SPEC §8.1), and the effective query line shows it.
- **Old trigger phrases** (the eleven of the first version, ADR-0009) are the whole value of a keyword field: `kw:"is killed"` is
  `kw:death` and `kw:"after this creature attacks"` is `kw:attack/self`. They are aliases of the taxonomy, read whole and alone:
  `kw:after` finds nothing, and an actor after one (`strike/enemy`) makes it the start of a key nobody has. A link or a saved
  query that carried one finds what it found, and possibly more: the event, not the phrase.
- A mastery has no creature and a trait may have no material: those columns are empty for it, and nothing matches them.

## 3. Evaluation
`createTraitIndex(traits)` indexes the dataset once, at load time (`IndexedTrait` per trait: columns lower-cased, keyword keys
listed by role, and `acted`: the same lists for the events that name an actor, as key and actor). `evaluate(ast, index)`
returns the matching `Trait`s in the order of the index; an `ast` of `undefined` (a query with no term) returns them all. It is a visitor (`visitQuery`, bottom-up; the same dispatch serves highlighting and
serialising) that turns the tree into one `TraitMatcher`: each term asks the field registry for its matcher once, NOT / AND / OR
combine them (`every`, `some`, short-circuiting), and the index is filtered with the result. Fields are read from the registry
passed in, the one of the app by default. `compileQuery(ast)` is that test on its own, for a caller that asks it of more than
one set of traits (the Explore facets count the traits twice, with and without the class filter).
For the full dataset (1,780 traits in v2.0) a straightforward evaluation is fast enough: a search with the recount of the facets
takes 0.1–0.8 ms natively and about 3 ms (p95 4.3 ms) in the page with the CPU slowed down 4×, against a 16 ms budget (SPEC §9).
Add an index (inverted index + keyword bitsets) only if that e2e misses the budget: `TraitIndex` is opaque to `evaluate`'s
callers, so it can change without them.
**Counting.** `SearchService.countMatches(state, query)` is the length of the list that `search` would give if `query` were
in the bar: the text is parsed (and repaired) and compiled like the bar, and it is asked of the traits that the filters of
`state` leave (classes, keywords, flags). The `query` and the sort of `state` are not read, and no facets are counted, no
trait sorted and no text highlighted. The counts beside suggestions (§6) include the filters, since that is what Enter would
show; a test compares it with `search(…).traits.length` over 200 sampled states and queries of the real sheet.

## 4. Highlighting, writing a query back and chips
**Highlighting.** `createHighlighter(ast)` works out once what the query marks, and returns a function from a text (the
description of a result) to its spans: `[start, end)` positions in that text, never HTML. Keyword tokens are not part of it:
they are always styled by kind and role (DESIGN § Keyword tokens), from the spans of the dataset.
- **What is marked.** The terms that look in the description: a word with no field, a field nobody knows (its whole token,
  as the search takes it) and `desc:`. A field says so with `highlightsDescription` on its definition, so the highlighter
  knows no field by name. A term with no value yet (`desc:`, `""`) marks nothing. The text is found wherever it is, in any
  letter case, as the search finds it; a character that means something in a pattern means itself.
- **Under a NOT.** A term under a NOT is not marked: a trait found has not got it. A term under two, `--weak`, **is**
  marked, since `--weak` is `weak`: the parity of the NOTs above the term decides, whatever the operators in between
  (`-(snared -weak)` marks `weak`).
- **The spans** are in the order of the text, never empty, and apart: the terms that overlap or touch are one span, so a
  result has one `<mark>` where two terms meet. They are positions in the text as it is (lower-casing it first would move
  them: the lower case of "İ" is two characters).

**Writing back.** `serialiseTerm(field, value)` writes one term, which the Explore filters use to write theirs; `serialise(ast)` is the canonical text of a query, the inverse of `parseQuery` on the meaning:
reading it gives the tree it was written from, spans aside (a property test on any text and on any tree). `-` for NOT, a
space for AND, ` OR `, and parentheses only where the tree needs them: around an `or` in an `and`, around a group in a
group of its own kind (that is a node of its own, §1), around an `and` or `or` under a NOT; `a OR b c` needs none. A term
keeps its field as written and loses its quotes unless the lexer would read something else without them (`"and"`,
`"-weak"`, `"a:b"`, `"two words"`; `class:or` needs none): the lexer itself decides, so the two cannot drift apart. A value
with no field and no text is `""`, a field with none is `class:`. A query read with repairs is written as repaired; a query
with no term is the empty text.

**Chips.** The chip row shows the terms of the query bar and edits the text of the bar, not a copy of it: the text outside
the edit stays as typed (spelling of the operators, quotes, blanks), which is why this is not `serialise`. `queryChips(text)`
lists one chip per term, in the order of the text, as `{ field, value, negated }` (`negated` = an odd number of NOTs above the
term, whatever stands between them, as in the highlighter); a term in a group is a chip like any other. `toggleChipNot(text, i)`
and `removeChip(text, i)` name a chip by its place in that list, so the caller asks the list again after each edit; a chip that
does not exist leaves the text as it is.
- **Toggle NOT** flips the term, never the group around it. A NOT written right in front of the term (`-`, `NOT`, and the blank
  after it) is taken away; otherwise a `-` is written in front of the term, inside the parentheses it may have. So `-(a OR b)`
  flips `a` with `-(-a OR b)` (`a` is included again, `b` is still excluded), and `(a)` becomes `(-a)`. A flip the parser
  would not read (a NOT nested past `MAX_NESTING`) leaves the text alone.
- **Remove** takes away the term, the NOTs written right in front of it, and one operator: the one that joined it to the next
  term, or to the one before if it is the last of its group. A group left with a single plain term is that term, so its
  parentheses and operator go too (`(a OR b) c` without `a` is `b c`, `-(a OR b)` is `-b`); a group left with more, or with
  something that is not a plain term, keeps its parentheses (`(a OR -b)` without `a` is `(-b)`). The only term of a query leaves
  the empty text. Reported junk between two terms (`a OR OR b`) goes with the operator.
- **Blanks.** Two tokens that become neighbours keep the blank that stood next to what went, and stay as close as they read as
  two tokens when there was none (`(a OR b OR c)` without `OR c` is `(a OR b)`; `-(a b)` without `a` is `-b`; `a(b)c` without
  `(b)` is `a c`, since `ac` would be one word). The other chips are never changed by the edit (a property test on any text).

## 5. Diagnostics (syntax: Phase 1 and the fixes of 9.1, the rest: Phase 2)
The parser already returns the syntax diagnostics (the first seven rows), as `{ code, severity: 'error', span,
message }` with the `message` of the table, the operator as written in it. `severity` is `'error' | 'warning'` and a
diagnostic may carry `fix?: { label, edit: TextEdit }` (`TextEdit` is `{ span, text }`, `applyEdit(source, edit)` makes it).
The parser gives no fix: `withSyntaxFixes(source, parseQuery(source))` adds the ones of the first seven rows, and the
other rows are lint rules (below); `lintQuery` puts the two together. One diagnostic per unclosed `(`, where it was
opened. `QueryDiagnostic<Code>` is generic in its code: the parser's are `SyntaxDiagnosticCode`, a rule's is its `id`.

| Rule (`id`) | Severity | Message | Fix |
|---|---|---|---|
| Unmatched `)` | error | Unmatched “)” | remove it |
| Unclosed `(` | error | Unclosed “(” | append `)` (a `(` with nothing in it: remove it) |
| Dangling `AND`/`OR` | error | “OR” needs a term on both sides | remove operator |
| `NOT` without operand | error | “NOT” needs a term after it | remove |
| Unclosed quote | error | Unclosed quote | close it (append `"`) |
| Empty `()` | error | Nothing between “(” and “)” | remove it |
| Nesting past the limit | error | Nested too deeply: “(” is ignored | remove it |
| Unknown field (`unknown-field`) | error | Unknown field “clas:”. Did you mean “class:”? | replace (Levenshtein ≤ max(2, ⌊len/3⌋)) |
| Empty value (`empty-value`) | warning | “applies:” has no value yet | — |
| Role on a non-role keyword (`keyword-without-role`) | warning | “timeline” has no applies/uses role, so “applies:” finds nothing | use `kw:` |
| Unknown keyword (`unknown-keyword`) | error | No keyword “vulnrable”. Did you mean Vulnerable? | replace |
| Unknown actor (`unknown-actor`) | error | No actor called “nobody”. Use self, ally, enemy or any | replace |
| Actor on a keyword that has none (`keyword-without-actor`) | warning | “weak” is not done by anyone, so “/self” finds nothing | remove the actor |
| Bad `mat:`/`stack:` value (`invalid-choice`) | error | “mat:” takes yes or no | replace |
| Unknown class (`unknown-class`) | error | No class “lfe”. Did you mean Life? | replace |
| Unknown family, creature or trait name (`unknown-family`, `unknown-creature`, `unknown-trait`; D21) | warning | No family “clutchr”. Did you mean Clutcher? | replace |
| Free term with zero hits (`text-in-no-trait`) | warning | “vulnrable” appears in no trait. Did you mean “vulnerable”? | replace from vocabulary |

**The vocabulary.** What the dataset gives a person to type is listed once, when it is loaded (`createQueryVocabulary(index)`,
on the service as `vocabulary`): for each column a `vocabulary` domain names (§2: class, family, creature, trait name) its
distinct entries as the dataset first spells them, from A to Z whatever the letter case. An entry is listed once however its
letter case varies, since a query compares them folded, and a trait without a value (a mastery has no creature) adds none.
The keywords are not in it: they come from the taxonomy, which does not depend on the dataset. In v2.0 the lists hold 11 classes,
166 families, 1,399 creatures and 1,780 trait names, and a term of the field with any entry finds a trait.

**Did you mean.** `closestMatch(input, candidates)` gives the candidate that a misspelling was most likely meant to be, or
nothing. It allows at most `max(2, ⌊length of the input / 3⌋)` edits (Levenshtein: a letter added, removed or changed, so a
swap of two letters is two edits) and does not count the letter case; the candidate is given as it was written. It also asks
for **fewer edits than the letters of the shorter text**, which the threshold alone does not: the match keeps a letter of the
input, or `x:` would be taken for `c:` and any two letters for a one-letter alias. Of the close candidates the one with the
fewest edits wins, then the one that shares the longer start with the input, then the first given.

**The lint rules.** A `LintRule` is `{ id, check(term, context) }`: it reads one term and returns what it finds wrong with it
(`severity`, `span`, `message` and perhaps a `fix`) or nothing. `createLintRegistry(rules)` refuses an `id` that is not lower-case
words joined by hyphens, or that two rules share (`LintRegistryError`, like the slot rules), and its `check(term, context)` gives
each finding as a `QueryDiagnostic` whose `code` is the id of its rule. The rules of the app are `lintRegistry`: a new rule is
written and listed there, and nothing else changes. `LintContext` is what a rule may ask besides the term: `fields`, `taxonomy`,
`vocabulary` and `hits(term)`, how many traits of the **whole dataset** (no filter of the page) the term finds, asked once for each
field and value however it is written (`createLintContext(service)`: one for each dataset).
- **Field and value rules** (`field-rules.ts`) read the `values` domain of the field, as the matcher does, so they cannot disagree
  with it. `unknown-field` (the span is the letters of the name, the fix replaces them; the candidates are every name and alias),
  `empty-value` (the whole term; also `""`, “Nothing between the quotes”, but not a quote still open), `invalid-choice` (the
  value; the message lists the values of the field, not the aliases, and the fix is the closest *value*), and `unknown-class`,
  `unknown-family`, `unknown-creature`, `unknown-trait` (the value). The last four fire when **no entry of the column fits the
  value in the way the field compares them** (`fitsValue(mode, entry, value)`: for these fields, any part of an entry), which is
  exactly when the search finds nothing; the real sheet tests it. A class is an error, the other three are warnings (D21).
- **What a finding says.** The field is quoted as written (`“CLAS:”`), the value as typed. The fix is one edit of the span, labelled
  *Change to “Life”*, with the replacement written as the lexer needs it (`"Rodian Master"` in quotes, `Life` not). It is given
  only when something is close; and once applied, the finding is gone. “Did you mean” compares with whole entries, so a mistyped
  part of one (`creature:bruser` for Clutcher Bruiser) is reported without an offer.
- **One finding for one fault.** A term whose field is unknown gets that finding alone (`clas:zzz` is not also an unknown value);
  a term with no value gets `empty-value` alone (not also an unknown class).
- **Keyword rules** (`keyword-rules.ts`) read the value of a keyword field as its matcher does (`readKeywordValue`: the start of a
  key, then `/actor`, or an old trigger phrase whole) and ask the taxonomy what the start finds. A value has at most one fault, the
  first of these, so that mending one never leaves another that was waiting behind it for the wrong reason:
  1. `unknown-keyword` (error): no key of the taxonomy starts with it, so the search finds nothing. The value is the span. The
     offer is the closest key *the field takes* (`applies:timlin` is not sent to a mechanic), shown by its label (*Did you mean
     Vulnerable?*) and written as a key; what followed the slash is kept as written (`vulnrable/self` → `vulnerable/self`).
  2. `keyword-without-role` (warning): the keys it starts are all of kinds the field does not take (a mechanic or the flag given to
     `applies:` / `uses:`), which no trait applies or relies on. The fault is the field, so the span is the field name, and the fix
     changes the field to the first one that takes them (`kw:`).
  3. `unknown-actor` (error): someone could do the keyword, but the word after the slash is none of `self`, `ally`, `enemy`, `any`
     (the search then takes the whole text as a key that nobody has). The offer is the closest actor, with the key kept as written.
  4. `keyword-without-actor` (warning): nobody does the keyword (a buff, debuff, effect, mechanic or flag, or the start of a battle,
     a moment nobody makes: `canHaveActor`), so a word after the slash, an actor or not, finds nothing. The fix takes it away
     (*Remove “/self”*). A start that some keys of an actor-taking event share (`start/self`) is no fault.
  A slash with nothing after it, an empty key and an old trigger phrase (also with its slash typed) are no fault. The span of 1, 3
  and 4 is the whole value: the fix is one edit of it, rewritten as the lexer needs it (quotes only where they must be).
- **Free text** (`text-rules.ts`): `text-in-no-trait` is a term with no field and some text that the dataset finds in no trait
  (`hits`). A term with a field belongs to its field's rules, known or not. The offer is the closest of the vocabulary (classes,
  families, creatures, trait names) and the keys of the taxonomy, and only one that finds some trait itself, so that the fix does
  not lead to the same warning (`nostack` is a key, and not a word of any description).
- **While a term is being typed (D20).** A rule says whether its finding is worth showing before the term is finished
  (`reportsWhileTyping`; absent: it waits). Only `unknown-field` speaks: `clas:` is wrong once the colon is typed. The others
  wait, and are not even worked out, so a caret in a long query does not cost the offers of the term being edited.
- **`lintQuery(source, context, { caret? })`** is the diagnostics of the parser with their fixes (`withSyntaxFixes`) and the
  findings of every term, in the order of the text (findings that start together keep the order they were found in, the parser's
  first). The term **still being typed** is the one the caret is in or at either end of, with no blank right after it: the
  findings of the rules about it wait (those of the parser never do). Without a caret every term is settled. A text of more than
  `MAX_LINTED_LENGTH` (2,000) characters gets the parser's diagnostics without fixes and no rule: a pasted text, and the work of
  the fixes grows with its square. Fixing the first diagnostic that has a fix, again and again, ends with none left (property test).

**In the field** (`query-input.svelte`, PLAN 9.6). Once the data is loaded the bar calls `lintQuery(text, context, { caret })` after every change of
the text or of the caret (`context` is `createLintContext(service)`, one for the dataset), and times each call as `atlas:assist` (criterion 7: p95
under 16 ms at 4×; a text with eight faults of every kind measures 9–10 ms).
- **The caret** is the field's own while it has the focus and nothing is selected (`caretToLint`). A selection is no caret: the person is choosing
  text and not finishing a term, and the Tab key selects the whole text of a field it enters. The caret is dropped when the focus leaves for
  something outside the field, its badge and its list, so that a text is judged as it stands once the person has gone elsewhere; while the focus
  moves between the three, the last caret is kept, so that a list does not grow under the finger that presses a fix. A fix is pressed without
  taking the focus from the field (`keepFieldFocus`: the keyboard of a phone stays up), or from the keyboard, where the focus is on the button.
- **What is shown.** A badge inside the field says "N issues", in the colour and with the icon of the worst one, and opens and shuts the list under the
  field (`aria-expanded`). The list shows errors first, then warnings, each in the order of the text, at most `MAX_ISSUES_SHOWN` (5) with "and N
  more" after them; a row is the icon and the word *Error* or *Warning*, the message and, when there is one, the fix as a button. The list
  opens by itself when the person types a query that has issues and had none, and shuts when none is left; a query that arrives with the address
  leaves it shut, so that nothing moves on load. The field is `aria-invalid` for errors only (a warning is a query the search takes as written) and
  is described by the text of every issue the list shows. A polite line says the count once typing has paused (600 ms: "2 issues", "No issues") and
  the result of a fix at once ("Fixed. 1 issue left.").
- **A fix** is one `TextEdit` made in the field by `applyFieldEdit` as typing would make it (`execCommand('insertText')`, or `delete` for an empty
  text), so that Ctrl+Z in the field takes it back; a browser that refuses gets `setRangeText` and an `input` event, with no undo. The caret goes
  where `caretAfterEdit(caret, edit)` says: before the edit, it stays; after it, it moves by what the edit added or took away (it stays in front of
  the same text, so a fix at the far end does not pull a caret from the start); in the replaced text, or at an insertion, it ends after the text
  written. It is put back once the framework has flushed, and the field has the focus. The query is linted again, so a fix that uncovers another
  issue shows it.

**The fixes of the syntax rows.** A fix is one `TextEdit`; the text outside it stays as typed, and after it the query means
what it meant, since it puts into the text the repair the parser had made (the property tests compare `serialise` before
and after). Its `label` says what the button does: *Remove “)”*, *Add the missing “)”*, *Close the quote*.
- **Blanks.** A removal takes the blanks after the text with it, or those before it when it ends the text or a group and none
  follow (`a OR b` without `OR` is `a b`, `(a OR)` is `(a)`); `b -() c` without `-` is `b () c`. Where that would run two
  words into one (`a)b` without `)`) the blanks stay, and failing that a space takes the place of the text (`a b`).
- **A fix that would change the meaning is not given yet.** `- AND a` reads as `a`: removing `AND` alone would hand `a` to the
  `-`, so the `-` (the first diagnostic) is fixed first and the `AND` gets its fix after. In the same way a `)` is not added
  to a text that ends in an open quote (the quote runs to the end, parentheses included, and would take it in): the quote
  is closed first.
- **Unclosed `(`.** A `)` at the end closes the innermost group still open, so only the innermost unclosed `(` has the fix
  that appends one; the outer ones follow as the inner ones are closed. A `(` with nothing after it but operators and
  parentheses is removed, not closed into an empty `()`.
- **Fixing the first diagnostic that has a fix, again and again, ends with none left** (property test). Past
  `MAX_FIXABLE_DIAGNOSTICS` (50) problems a text gets no fixes at all: each fix reads the whole text again, so the work
  grows with the square of its size (8,000 stray `)` took twenty seconds), and such a text is junk.

## 6. Autocomplete (Phase 2)
**Context.** `suggestionContext(source, caret, fields?)` (`suggest/context.ts`, PLAN 10.1) reads the tokens of the lexer and says
what the caret asks for, as one of six kinds, each with `replace`, the span that an accepted suggestion takes the place of. It never
throws; the caret is kept inside the text and counts UTF-16 units, like every span.
- **The word being typed** is the term the caret is in or at the end of (`start < caret ≤ end`), and so is an operator, written as a
  word or a symbol (`or` may be on its way to `order`, and `|a` is one word). At the start of a word, or between two, none is: `replace`
  is empty, at the caret. A `(`, a `)` and a `-` are tokens of their own and never continue a word, so a negation in front of the
  word is outside `replace` and stays (`-we|` replaces `we`).
- **No word.** `operator-or-field` when the token before the caret is a term or `)`; otherwise `field` (the start of the text, after `(`,
  after an operator, after a negation).
- **A word with no field**, and one whose caret is in the letters of a field's name (`cla|ss:life`, where the colon is still to come):
  `free`, with the `prefix` typed up to the caret. A phrase is typed without its quotes (`"two wo` has the prefix `two wo`) and keeps the
  blanks inside them (`"two ` has `two `); a leading blank does not count. A quote left open runs to the end of the text, and so does
  `replace` (the lexer's reading).
- **After the colon**, the field decides. A field of the registry is `field-value`, with the `field`, its name as `written` (`a`,
  `Class`) and the `prefix` typed of the value. For a keyword field, once the value up to the caret holds a slash, it is `actor`: the
  `key` before the last slash and the `prefix` of the actor after it (`uses:"start of turn/e|`); the caret before the slash is still in
  the key. A slash means nothing to another field (`class:a/b`). An unknown field is `unknown-field` with its name `written`; its
  `replace` is the name and the colon only, so the value stays when the field is mended.
- Whether the key before a slash is an event, and which fields, values and operators to offer, are for the providers (PLAN 10.2).

| Context | Suggestions |
|---|---|
| Empty token after a term or `)` | `OR`, `AND`, `NOT`, then fields |
| Empty token otherwise | fields with one-line help |
| `field:` + partial value | values for that field: keywords (role fields offer buffs, debuffs, effects and events), classes, families, trait/creature names, yes/no |
| Keyword value + `/` | the four actors (`self`, `ally`, `enemy`, `any`), for an event |
| Unknown `fiel:` | closest field |
| Free partial | matching fields, `applies:`/`uses:` per matching keyword, events by their keys, `kw:` mechanics, `trait:` names, `family:` names, the raw text |

Each complete suggestion shows the **result count** it would produce. Max 9 items. Accepting replaces the token
(adds a trailing space unless it is a bare field). Top suggestion is shown as ghost text after the caret; Tab accepts.
Keyboard: ↑/↓ move, Tab/Enter accept, Esc closes; `/` focuses search from anywhere (not while typing in another input).
ARIA: combobox pattern (`role=combobox` input, `listbox`/`option`, `aria-activedescendant`).

## 7. Explain (Phase 2)
A Visitor renders the AST as plain language, with parentheses only where precedence needs them:
`(mentions “vulnerable” OR mentions “weak”) AND NOT does not stack`.

## 8. Editor (Phase 2)
Syntax-coloured input = transparent `<input>` over a mirrored, coloured `<div>` with identical font metrics; errors get a
wavy underline on their span. Must keep caret position after accepting a suggestion mid-string (the prototype does not).
Mobile adds a toolbar with `(` `)` `"` `OR` `AND` `NOT` `applies:` `uses:` `class:` `mat:yes`, inserting at the caret.
