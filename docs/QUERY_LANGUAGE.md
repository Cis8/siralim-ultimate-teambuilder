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
  with the reported text removed (which is also what the Phase 2 fixes will do): a `)` that closes nothing is skipped; a
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

Fields are a **registry** (`createFieldRegistry`; the fields of the app are in `query/fields.ts`). Phase 1 gives a
`FieldDefinition` `{ name, aliases, matcher(value), highlightsDescription? }`; Phase 2 adds `suggestValues?(prefix)` and
`describe(value)`. `matcher` is asked once per term, with the value lower-cased, and returns the test to run on each
trait, so a field parses its value (`yes`, `no`) once, not once per trait. Names and aliases are lower-case ASCII letters (what the lexer reads before a colon)
and unique across the registry; the field name in a query is matched whatever its letter case.
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
  (`u:"start of turn/enemy"`). The lexer does not know the slash: the value is split afterwards, by `parseKeywordReference`.
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

## 5. Diagnostics (syntax: Phase 1, the rest: Phase 2)
The parser already returns the syntax diagnostics (the first seven rows), as `{ code, severity: 'error', span,
message }` with the `message` of the table, the operator as written in it. Phase 2 adds `fix?: { label, edit: TextEdit }`, the
`warning` severity and the other rows, as a registry of lint rules. One diagnostic per unclosed `(`, where it was opened.

| Rule | Severity | Message | Fix |
|---|---|---|---|
| Unmatched `)` | error | Unmatched “)” | remove it |
| Unclosed `(` | error | Unclosed “(” | append `)` |
| Dangling `AND`/`OR` | error | “OR” needs a term on both sides | remove operator |
| `NOT` without operand | error | “NOT” needs a term after it | remove |
| Unclosed quote | error | Unclosed quote | close it |
| Empty `()` | error | Nothing between “(” and “)” | remove it |
| Nesting past the limit | error | Nested too deeply: “(” is ignored | remove it |
| Unknown field | error | Unknown field “clas:”. Did you mean “class:”? | replace (Levenshtein ≤ max(2, ⌊len/3⌋)) |
| Empty value | warning | “applies:” has no value yet | — |
| Role on a non-role keyword | warning | Timeline has no applies/uses role | use `kw:timeline` |
| Unknown buff/debuff | error | No buff or debuff called “vulnrable”. Did you mean Vulnerable? | replace |
| Unknown actor | error | No actor called “nobody”. Use self, ally, enemy or any | replace |
| Actor on a keyword that has none | warning | Weak is not done by anyone, so “/self” finds nothing | remove the actor |
| Bad `mat:`/`stack:` value | error | “mat:” takes yes or no | replace |
| Unknown class | error | No class “lif”. Did you mean Life? | replace |
| Free term with zero hits | warning | “vulnrable” appears in no trait. Did you mean “vulnerable”? | replace from vocabulary |

## 6. Autocomplete (Phase 2)
Context = token at the caret (prefix up to caret) and the previous token.

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
