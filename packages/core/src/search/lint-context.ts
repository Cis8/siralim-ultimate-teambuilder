import { initialExploreState } from '../explore/explore-state';
import type { FieldRegistry } from '../query/field-registry';
import { fieldRegistry } from '../query/fields';
import type { LintContext } from '../query/lint-rule';
import { serialiseTerm } from '../query/serialise';
import type { Taxonomy } from '../taxonomy/registry';
import { taxonomy as appTaxonomy } from '../taxonomy/taxonomy';
import type { SearchService } from './search-service';

/** What the context takes of the search service: the lists a person types from and the count of a query. */
export type LintSource = Pick<SearchService, 'vocabulary' | 'countMatches'>;

/**
 * What the lint rules know besides the term: the language, the taxonomy and the dataset the service loaded. Make one for each
 * dataset: the counts it remembers are the ones of that dataset.
 */
export function createLintContext(
  service: LintSource,
  { fields = fieldRegistry, taxonomy = appTaxonomy }: { fields?: FieldRegistry; taxonomy?: Taxonomy } = {},
): LintContext {
  const counts = new Map<string, number>();

  return {
    fields,
    taxonomy,
    vocabulary: service.vocabulary,
    hits(term) {
      // Under the name the registry gives the field, so that `c:life` and `class:Life` are one question.
      const written = term.field?.name;
      const text = serialiseTerm(
        written === undefined ? undefined : (fields.resolve(written)?.name ?? written),
        term.value,
      );
      const key = text.toLowerCase();
      const known = counts.get(key);
      if (known !== undefined) return known;

      // "In no trait" is about the dataset, so the filters of the page are not applied.
      const found = service.countMatches(initialExploreState, text);
      counts.set(key, found);
      return found;
    },
  };
}
