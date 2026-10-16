import type { Trait } from '../model/trait';
import { createHighlighter, type Highlighter } from '../query/highlight';
import { evaluate } from '../query/evaluate';
import { parseQuery, type ParseResult } from '../query/parser';
import { createTraitIndex } from '../query/trait-index';
import type { TraitRepository } from '../repository/trait-repository';

/** What a search came to. */
export interface SearchOutcome {
  /** How the text was read: the tree, the tokens, and what had to be repaired. */
  readonly query: ParseResult;
  /** The traits the query finds, in the order of the dataset. */
  readonly traits: readonly Trait[];
  /** Marks, in a description, the text the query looks for. */
  readonly highlight: Highlighter;
}

/** Searches the traits of the dataset that was loaded. What the app calls: it never reads a query or a trait itself. */
export interface SearchService {
  readonly datasetVersion: string;
  readonly traitCount: number;
  /** Any text is a query: whatever does not make one is reported in `query.diagnostics` and left out. */
  search(text: string): SearchOutcome;
}

/** Loads the dataset once and indexes it; each search after that reads the index. */
export async function createSearchService(repository: TraitRepository): Promise<SearchService> {
  const { datasetVersion, traits } = await repository.load();
  const index = createTraitIndex(traits);
  return {
    datasetVersion,
    traitCount: traits.length,
    search: (text) => {
      const query = parseQuery(text);
      return { query, traits: evaluate(query.ast, index), highlight: createHighlighter(query.ast) };
    },
  };
}
