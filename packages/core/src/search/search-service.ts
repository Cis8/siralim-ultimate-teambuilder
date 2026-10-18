import { effectiveQuery, filterQuery } from '../explore/effective-query';
import type { ExploreState } from '../explore/explore-state';
import { countFacets, facetVocabulary, type Facets } from '../explore/facets';
import { sortTraits } from '../explore/sort-traits';
import type { Trait, TraitId } from '../model/trait';
import type { QueryNode } from '../query/ast';
import { compileQuery } from '../query/evaluate';
import { createHighlighter, type Highlighter } from '../query/highlight';
import { parseQuery, type ParseResult } from '../query/parser';
import { createQueryVocabulary, type QueryVocabulary } from '../query/query-vocabulary';
import { createTraitIndex } from '../query/trait-index';
import type { TraitRepository } from '../repository/trait-repository';
import type { Taxonomy } from '../taxonomy/registry';
import { taxonomy as appTaxonomy } from '../taxonomy/taxonomy';

/** What a search came to. */
export interface SearchOutcome {
  /** How the query bar was read: the tree, the tokens, and what had to be repaired. */
  readonly query: ParseResult;
  /** The traits the query and the filters find, in the order of the sort. */
  readonly traits: readonly Trait[];
  /** Marks, in a description, the text the query bar looks for. */
  readonly highlight: Highlighter;
  /** The query the whole state stands for, which finds the same traits when typed in the query bar. */
  readonly effectiveQuery: string;
  readonly facets: Facets;
}

/** Searches the traits of the dataset that was loaded. What the app calls: it never reads a query or a trait itself. */
export interface SearchService {
  readonly datasetVersion: string;
  readonly traitCount: number;
  /** Every trait of the dataset, in its order. */
  readonly traits: readonly Trait[];
  /** What the dataset gives to type after `class:`, `family:`, `creature:` and `trait:`. */
  readonly vocabulary: QueryVocabulary;
  /** The trait an id stands for, `undefined` when the dataset does not know it: a `TraitLookup` for the party. */
  trait(id: TraitId): Trait | undefined;
  /** Any state is searchable: whatever the query bar holds that does not make a query is reported in `query.diagnostics`. */
  search(state: ExploreState): SearchOutcome;
  /**
   * How many traits `search` finds when `query` is what the query bar holds: the traits that it finds among those the
   * filters of `state` leave, so that a suggestion is counted as what Enter would show. The `query` and the sort of `state`
   * are not read, so a caller can ask about text that is not in the bar yet. No facets, no sort and no highlight are worked out.
   */
  countMatches(state: ExploreState, query: string): number;
}

/**
 * Loads the dataset once and indexes it; each search after that reads the index. The facets list the keywords of
 * `taxonomy`, which is the one of the app unless a test brings its own.
 */
export async function createSearchService(
  repository: TraitRepository,
  taxonomy: Taxonomy = appTaxonomy,
): Promise<SearchService> {
  const { datasetVersion, traits } = await repository.load();
  const index = createTraitIndex(traits);
  const facetWords = facetVocabulary(index, taxonomy);
  const classNames = facetWords.classes.map(({ name }) => name);
  const byId = new Map(traits.map((trait) => [trait.id, trait]));

  /** The traits `ast` and the filters of `state` find, and those that all but the class filter leave (the class facet counts them). */
  function narrow(state: ExploreState, ast: QueryNode | undefined) {
    const filters = filterQuery(state, classNames);
    const matchesQuery = compileQuery(ast);
    const matchesFilters = compileText(filters.rest);
    const matchesClasses = compileText(filters.classes);

    const withoutClassFilter = index.entries.filter((entry) => matchesQuery(entry) && matchesFilters(entry));
    return { filters, withoutClassFilter, found: withoutClassFilter.filter(matchesClasses) };
  }

  return {
    datasetVersion,
    traitCount: traits.length,
    traits,
    vocabulary: createQueryVocabulary(index),
    trait: (id) => byId.get(id),
    search: (state) => {
      const query = parseQuery(state.query);
      const { filters, withoutClassFilter, found } = narrow(state, query.ast);
      return {
        query,
        traits: sortTraits(
          found.map(({ trait }) => trait),
          state.sort,
        ),
        highlight: createHighlighter(query.ast),
        effectiveQuery: effectiveQuery(filters, query.ast),
        facets: countFacets(facetWords, withoutClassFilter, found),
      };
    },
    countMatches: (state, query) => narrow(state, parseQuery(query).ast).found.length,
  };
}

/** The test a query that the app wrote (so, with nothing to repair) is on a trait. */
const compileText = (text: string) => compileQuery(parseQuery(text).ast);
