import type { Taxonomy } from '../taxonomy/registry';
import type { QueryDiagnostic } from './diagnostic';
import type { FieldRegistry } from './field-registry';
import type { QueryVocabulary } from './query-vocabulary';
import type { TermToken } from './token';

/** What a rule found wrong with a term. The registry gives it the `code` of the rule that found it. */
export type LintFinding = Omit<QueryDiagnostic, 'code'>;

/** What a rule may ask about besides the term: the language, the keywords and the dataset the query is written for. */
export interface LintContext {
  readonly fields: FieldRegistry;
  readonly taxonomy: Taxonomy;
  readonly vocabulary: QueryVocabulary;
  /**
   * How many traits of the whole dataset the term finds, whatever the filters of the page: "in no trait" is about the
   * dataset. Asked once for each field and value, however often the query is linted.
   */
  readonly hits: (term: TermToken) => number;
}

/** One thing worth telling a person about a term of the query (QUERY_LANGUAGE §5). */
export interface LintRule {
  /** Names the rule and is the `code` of what it finds: lower case and hyphenated, stable, so that tests and the page can tell findings apart. */
  readonly id: string;
  /**
   * Whether the finding is worth showing while the person is still typing the term (D20). Most are not: `class:li` is
   * unknown only because it is not finished, so they wait for a blank after the term or for the caret to leave it, and
   * are not even worked out until then. A field that does not exist (`clas:`) is complete once its colon is typed, and
   * waiting would not help it. Absent: the rule waits.
   */
  readonly reportsWhileTyping?: boolean;
  /** What is wrong with `term`, or `undefined` when this rule has nothing against it. The span is the part at fault only. */
  check(term: TermToken, context: LintContext): LintFinding | undefined;
}
