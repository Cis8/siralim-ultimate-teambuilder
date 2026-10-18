import { closestMatch } from './closest-match';
import { changeTo, quoted } from './finding-text';
import { tokenize } from './lexer';
import type { LintContext, LintRule } from './lint-rule';
import { serialiseTerm } from './serialise';
import type { TermToken } from './token';

/** What a word with no field might have been meant to be: an entry of the dataset or the key of a keyword. */
function candidates({ vocabulary, taxonomy }: LintContext): string[] {
  const { class: classes, family, creature, name } = vocabulary;
  return [...classes, ...family, ...creature, ...name, ...taxonomy.entries.map(({ key }) => key)];
}

/** The term that `text` is when it is looked for as it is, with no field. */
function freeTerm(text: string): TermToken | undefined {
  const [only] = tokenize(serialiseTerm(undefined, text));
  return only?.kind === 'term' ? only : undefined;
}

/** The candidate closest to `text` that is worth offering: one that finds a trait, since a fix must not lead to the same warning. */
function offerFor(text: string, context: LintContext): string | undefined {
  const closest = closestMatch(text, candidates(context));
  const term = closest === undefined ? undefined : freeTerm(closest);
  return closest !== undefined && term !== undefined && context.hits(term) > 0 ? closest : undefined;
}

/** `vulnrable`: text with no field is looked for in the columns and the descriptions, and no trait has it. */
const textInNoTrait: LintRule = {
  id: 'text-in-no-trait',
  check(term, context) {
    // A term with a field is for the rules of its field, whether or not the field is known.
    if (term.field !== undefined || term.value === '' || context.hits(term) > 0) return undefined;

    const message = `${quoted(term.value)} appears in no trait`;
    const offer = offerFor(term.value, context);
    if (offer === undefined) return { severity: 'warning', span: term.valueSpan, message };
    return {
      severity: 'warning',
      span: term.valueSpan,
      message: `${message}. Did you mean ${quoted(offer)}?`,
      fix: changeTo(term.valueSpan, serialiseTerm(undefined, offer), offer),
    };
  },
};

/** The rules about text with no field (QUERY_LANGUAGE §5). */
export const textRules: readonly LintRule[] = [textInNoTrait];
