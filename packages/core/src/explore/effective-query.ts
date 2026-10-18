import type { ClassName } from '../model/trait';
import type { QueryNode } from '../query/ast';
import { writeKeywordReference } from '../query/keyword-reference';
import { serialise, serialiseTerm } from '../query/serialise';
import type { ExploreState, KeywordFilter } from './explore-state';

/**
 * The filters of an Explore state as a query of the language (SPEC §8.1). The state stands for the text: typed in the
 * query bar, it finds the same traits, so the effective-query line can be copied and shared.
 */
export interface FilterQuery {
  /** The classes. The class facet counts the traits without them. */
  readonly classes: string;
  /** The keywords and the flags. */
  readonly rest: string;
}

/** The terms the two flags of an Explore state stand for (QUERY_LANGUAGE §2). */
export const FLAG_TERMS = {
  artifactEligible: { field: 'mat', value: 'yes' },
  doesNotStack: { field: 'stack', value: 'no' },
} as const;

const flagTerm = ({ field, value }: { readonly field: string; readonly value: string }): string =>
  serialiseTerm(field, value);

/**
 * `knownClasses` are the classes of the dataset. `class:` looks for a name inside the class, so `class:boss` finds the
 * traits of Nether Boss too; the query leaves those classes out again, to find the traits of the classes chosen and no
 * others. A class left out takes with it every class whose name contains its own, which matters only if one of those is
 * chosen too (A is part of B, B of C, A and C chosen); no class of the compendium is like that.
 */
export function filterQuery(state: ExploreState, knownClasses: readonly ClassName[]): FilterQuery {
  const flags = [
    state.artifactEligible ? flagTerm(FLAG_TERMS.artifactEligible) : '',
    state.doesNotStack ? flagTerm(FLAG_TERMS.doesNotStack) : '',
  ];
  return {
    classes: classesQuery(state.classes, knownClasses),
    rest: joined([keywordsQuery(state), ...flags]),
  };
}

/** The query bar as it is read, with the filters in front of it: classes, keywords, flags, then what was typed. */
export function effectiveQuery(filters: FilterQuery, ast: QueryNode | undefined): string {
  const filtered = joined([filters.classes, filters.rest]);
  const typed = serialise(ast);
  // An OR is the weakest operator: beside a filter it needs its own parentheses to stay one operand of the AND.
  return joined([filtered, ast?.kind === 'or' && filtered !== '' ? `(${typed})` : typed]);
}

function classesQuery(chosen: readonly ClassName[], known: readonly ClassName[]): string {
  if (chosen.length === 0) return '';
  const terms = chosen.map((name) => serialiseTerm('class', name));
  const anyOf = terms.length === 1 ? terms : [`(${terms.join(' OR ')})`];
  const leftOut = classesNamedInside(chosen, known).map((name) => `-${serialiseTerm('class', name)}`);
  return joined([...anyOf, ...leftOut]);
}

/** The classes, not chosen, that a chosen one is part of the name of. */
function classesNamedInside(chosen: readonly ClassName[], known: readonly ClassName[]): ClassName[] {
  const wanted = chosen.map((name) => name.toLowerCase());
  const candidates = [...new Set(known.map((name) => name.toLowerCase()))];
  return candidates.filter((name) => !wanted.includes(name) && wanted.some((part) => name.includes(part)));
}

/**
 * The filters on one side of a keyword (the same field and key) are alternatives, whichever mode: an event can be filtered
 * by several actors at once, and a trait that has it by either is what is asked for (SPEC §8.1). Match all joins what is
 * left, one operand for each side.
 */
function keywordsQuery({ keywords, keywordMode }: ExploreState): string {
  const bySide = keywordSides(keywords).map((side) =>
    side.map(({ field, ...reference }) => serialiseTerm(field, writeKeywordReference(reference))),
  );
  return keywordMode === 'any' ? anyOf(bySide.flat()) : joined(bySide.map(anyOf));
}

/**
 * The keyword filters by side, the sides in the order of their first filter and each side's filters in the order they were
 * chosen: the order the query writes them in, which the chip row follows.
 */
export function keywordSides(keywords: readonly KeywordFilter[]): KeywordFilter[][] {
  const sides = new Map<string, KeywordFilter[]>();
  for (const filter of keywords) {
    const side = `${filter.field}:${filter.key}`;
    sides.set(side, [...(sides.get(side) ?? []), filter]);
  }
  return [...sides.values()];
}

/** The terms that are not empty, apart by a blank: an AND. */
const joined = (parts: readonly string[]): string => parts.filter((part) => part !== '').join(' ');

/** One term as it is, several as an OR in parentheses to stand as one operand of an AND. */
const anyOf = (terms: readonly string[]): string => (terms.length > 1 ? `(${terms.join(' OR ')})` : joined(terms));
