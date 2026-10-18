import type { QueryDiagnostic } from './diagnostic';
import type { LintContext } from './lint-rule';
import { checkTerm } from './lint-term';
import { parseQuery } from './parser';
import { withSyntaxFixes } from './syntax-fixes';
import type { TermToken } from './token';

/**
 * Past this many characters a text is not linted, only read: the rules work out their offers over the whole vocabulary for
 * every term, and the fixes of the parser's diagnostics read the text again for each one (100 kB with 50 problems took 0.9 s).
 * A query of this length is a pasted text, not a search.
 */
export const MAX_LINTED_LENGTH = 2000;

export interface LintOptions {
  /** Where the caret is, in the code units of the text. The findings about the term it is in wait until it is finished (D20). */
  readonly caret?: number;
}

/** Whether the caret is in the term or at either end of it, and no blank follows it: the person has not finished typing it. */
function isBeingTyped(term: TermToken, source: string, caret: number | undefined): boolean {
  if (caret === undefined) return false;
  const [start, end] = term.span;
  return start <= caret && caret <= end && !/\s/.test(source.charAt(end));
}

/**
 * Everything worth telling a person about a query (QUERY_LANGUAGE §5): what the parser had to repair, with the fix of each
 * (`withSyntaxFixes`), and what the lint rules find in each term, in the order of the text. A diagnostic that has a fix
 * has one edit that mends it; fixing the first one that has, again and again, ends with none left.
 *
 * The term the caret is in, with no blank after it, is still being typed, and `class:li` is not wrong yet: the findings of
 * the rules about it are not given (and not worked out), but those about a field that does not exist, and those of the
 * parser, are (D20).
 */
export function lintQuery(source: string, context: LintContext, { caret }: LintOptions = {}): QueryDiagnostic[] {
  const parsed = parseQuery(source);
  if (source.length > MAX_LINTED_LENGTH) return [...parsed.diagnostics];

  const found: QueryDiagnostic[] = [...withSyntaxFixes(source, parsed)];
  for (const token of parsed.tokens) {
    if (token.kind !== 'term') continue;
    found.push(...checkTerm(token, context, isBeingTyped(token, source, caret)));
  }
  // Array.sort is stable: findings that start together stay in the order they were found, syntax first.
  return found.sort((a, b) => a.span[0] - b.span[0]);
}
