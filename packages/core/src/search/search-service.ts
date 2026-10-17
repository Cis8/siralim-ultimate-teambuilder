import { effectiveQuery, filterQuery } from '../explore/effective-query';
import type { ExploreState } from '../explore/explore-state';
import { countFacets, facetVocabulary, type Facets } from '../explore/facets';
import { sortTraits } from '../explore/sort-traits';
import type { Trait, TraitId } from '../model/trait';
import { compileQuery } from '../query/evaluate';
import { createHighlighter, type Highlighter } from '../query/highlight';
import { parseQuery, type ParseResult } from '../query/parser';
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
  /** The trait an id stands for, `undefined` when the dataset does not know it: a `TraitLookup` for the party. */
  trait(id: TraitId): Trait | undefined;
  /** Any state is searchable: whatever the query bar holds that does not make a query is reported in `query.diagnostics`. */
  search(state: ExploreState): SearchOutcome;
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
  const vocabulary = facetVocabulary(index, taxonomy);
  const byId = new Map(traits.map((trait) => [trait.id, trait]));
  return {
    datasetVersion,
    traitCount: traits.length,
    trait: (id) => byId.get(id),
    search: (state) => {
      const query = parseQuery(state.query);
      const filters = filterQuery(
        state,
        vocabulary.classes.map(({ name }) => name),
      );
      const matchesQuery = compileQuery(query.ast);
      const matchesFilters = compileText(filters.rest);
      const matchesClasses = compileText(filters.classes);

      const withoutClassFilter = index.entries.filter((entry) => matchesQuery(entry) && matchesFilters(entry));
      const found = withoutClassFilter.filter(matchesClasses);
      return {
        query,
        traits: sortTraits(
          found.map(({ trait }) => trait),
          state.sort,
        ),
        highlight: createHighlighter(query.ast),
        effectiveQuery: effectiveQuery(filters, query.ast),
        facets: countFacets(vocabulary, withoutClassFilter, found),
      };
    },
  };
}

/** The test a query that the app wrote (so, with nothing to repair) is on a trait. */
const compileText = (text: string) => compileQuery(parseQuery(text).ast);
