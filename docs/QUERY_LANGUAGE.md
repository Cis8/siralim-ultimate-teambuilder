# Query language

Phase 1 needs §1–§4 (parse + evaluate + highlight). Phase 2 adds §5–§8 (diagnostics, autocomplete, explain, editor).
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
- **The parser never throws.** It returns `{ ast, tokens, diagnostics }`; every token and node carries its source span.

## 2. Fields

| Field (aliases) | Matches | Semantics |
|---|---|---|
| *(none)* | creature, family, class, trait name, description, material | substring |
| `class:` (`c:`) | class | substring |
| `family:` (`fam:`, `f:`) | family | substring |
| `creature:` (`cr:`) | creature name | substring |
| `trait:` (`t:`) | trait name | substring |
| `desc:` (`d:`) | description only | substring |
| `applies:` (`a:`) | buff, debuff or effect the trait applies (`a:sealed`, `a:zombies`) | keyword key prefix |
| `uses:` (`u:`) | buff, debuff or effect the trait relies on | keyword key prefix |
| `kw:` (`k:`) | any keyword (any kind, any role, including a mention that only guards against it: `kw:silenced` finds "immune to Silenced", `applies:` and `uses:` do not; GAME_RULES R9) | keyword key prefix |
| `mat:` | `yes` = has material (artifact-eligible), `no`/`none` = no material | exact |
| `stack:` | `yes` = stacks, `no` = "does not stack" | exact |

Fields are a **registry** (`FieldDefinition { name, aliases, match(trait, value), suggestValues?(prefix), describe(value) }`).
An unknown field makes the whole token a free-text term (and a diagnostic in Phase 2).

## 3. Evaluation
Visitor over the AST against `Trait`. Precompute per trait a lower-cased haystack and keyword key sets at load time.
For the full dataset (1,780 traits in v2.0) a straightforward evaluation is fast enough; add an index (inverted index + keyword
bitsets) only if the 16 ms budget is missed.

## 4. Highlighting
Positive free-text and `desc:` terms (not under NOT) are highlighted in descriptions; keyword tokens are always styled by
kind and role (DESIGN § Keyword tokens). Highlight computation is a Visitor that returns spans, never HTML.

## 5. Diagnostics (Phase 2)
Each diagnostic: `{ severity: 'error'|'warning', span, message, fix?: { label, edit: TextEdit } }`. Lint rules are a registry.

| Rule | Severity | Message | Fix |
|---|---|---|---|
| Unmatched `)` | error | Unmatched “)” | remove it |
| Unclosed `(` | error | N unclosed “(” | append `)` × N |
| Dangling `AND`/`OR` | error | “OR” needs a term on both sides | remove operator |
| `NOT` without operand | error | “NOT” needs a term after it | remove |
| Unclosed quote | error | Unclosed quote | close it |
| Unknown field | error | Unknown field “clas:”. Did you mean “class:”? | replace (Levenshtein ≤ max(2, ⌊len/3⌋)) |
| Empty value | warning | “applies:” has no value yet | — |
| Role on a non-role keyword | warning | Timeline has no applies/uses role | use `kw:timeline` |
| Unknown buff/debuff | error | No buff or debuff called “vulnrable”. Did you mean Vulnerable? | replace |
| Bad `mat:`/`stack:` value | error | “mat:” takes yes or no | replace |
| Unknown class | error | No class “lif”. Did you mean Life? | replace |
| Free term with zero hits | warning | “vulnrable” appears in no trait. Did you mean “vulnerable”? | replace from vocabulary |

## 6. Autocomplete (Phase 2)
Context = token at the caret (prefix up to caret) and the previous token.

| Context | Suggestions |
|---|---|
| Empty token after a term or `)` | `OR`, `AND`, `NOT`, then fields |
| Empty token otherwise | fields with one-line help |
| `field:` + partial value | values for that field: keywords (role fields only offer buffs/debuffs), classes, families, trait/creature names, yes/no |
| Unknown `fiel:` | closest field |
| Free partial | matching fields, `applies:`/`uses:` per matching keyword, triggers as phrases, `kw:` mechanics, `trait:` names, `family:` names, the raw text |

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
