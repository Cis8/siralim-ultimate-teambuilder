import type { QueryDiagnostic } from './diagnostic';
import type { LintContext } from './lint-rule';
import { lintRegistry } from './lint-rules';
import type { Span } from './span';
import type { TermToken } from './token';

/** What the rules found about a text of a term, and where the term stood in the query then: the spans are positions in it. */
interface Remembered {
  readonly start: number;
  readonly findings: readonly QueryDiagnostic[];
}

/**
 * How many texts a context remembers before it forgets them all. A person types a few hundred in a sitting, and each is a few
 * lines of findings; the limit only keeps a page left open for days from growing without end.
 */
export const MAX_REMEMBERED_TEXTS = 1000;

/** One memory for each context, which is for one dataset: what the rules find in a text depends on nothing else. */
const memories = new WeakMap<LintContext, Map<string, Remembered>>();

const shifted = ([start, end]: Span, by: number): Span => [start + by, end + by];

/** The finding with every position in it moved `by` characters on, the span of its fix as well. */
function moved(finding: QueryDiagnostic, by: number): QueryDiagnostic {
  const { fix } = finding;
  return {
    ...finding,
    span: shifted(finding.span, by),
    ...(fix === undefined ? {} : { fix: { ...fix, edit: { ...fix.edit, span: shifted(fix.edit.span, by) } } }),
  };
}

/**
 * What the lint rules find wrong with a term (`lintRegistry.check`), worked out once for each text of a term and context.
 * Every key of the person's typing lints the whole query again, and a term that is finished does not change with the keys that
 * follow it: a word that is in no trait costs a search of the whole vocabulary for the word it may have been (1.5 ms, of the
 * 16 ms that a keystroke may take on a slow phone), and would be paid again for each key typed after it. The findings of the
 * rules depend on the text of the term, whether it is `typing`, and the context, never on where the term stands, so a text
 * that stands elsewhere gets the same findings, moved to where it stands.
 */
export function checkTerm(term: TermToken, context: LintContext, typing: boolean): readonly QueryDiagnostic[] {
  const memory = memories.get(context) ?? new Map<string, Remembered>();
  memories.set(context, memory);

  const key = `${typing ? 'typing' : 'finished'} ${term.text}`;
  const start = term.span[0];
  const known = memory.get(key);
  if (known !== undefined) return known.findings.map((finding) => moved(finding, start - known.start));

  const findings = lintRegistry.check(term, context, { typing });
  if (memory.size >= MAX_REMEMBERED_TEXTS) memory.clear();
  memory.set(key, { start, findings });
  return findings;
}
