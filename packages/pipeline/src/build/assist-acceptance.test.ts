import {
  createMemoryTraitRepository,
  createSearchService,
  DATASET_SCHEMA_VERSION,
  fieldRegistry,
  hasActor,
  hasRole,
  initialExploreState,
  KEYWORD_ACTORS,
  KEYWORD_MODES,
  serialiseTerm,
  taxonomy,
  type ExploreState,
  type KeywordFilter,
  type QueryVocabulary,
  type SearchService,
} from '@atlas/core';
import fc from 'fast-check';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildRealSheet } from '../testing/real-build';

// What the query assist (Phase 2, ADR-0010) reads from the loaded dataset, on the pinned snapshot of the compendium, v2.0.

describe('the query assist on the compendium v2.0', () => {
  let service: SearchService;

  beforeAll(async () => {
    const built = await buildRealSheet();
    service = await createSearchService(
      createMemoryTraitRepository({
        schemaVersion: DATASET_SCHEMA_VERSION,
        datasetVersion: built.datasetVersion,
        traits: built.traits,
      }),
    );
  });

  describe('the vocabulary', () => {
    it('lists the 11 classes, 166 families, 1,399 creatures and 1,780 trait names of the compendium', () => {
      const sizes = Object.entries(service.vocabulary).map(([column, entries]) => [column, entries.length]);

      expect(Object.fromEntries(sizes)).toEqual({ class: 11, family: 166, creature: 1399, name: 1780 });
    });

    it('lists only entries that a term of the field finds a trait with, written as the field takes them', () => {
      const fields = fieldRegistry.fields.flatMap((field) => (field.values?.kind === 'vocabulary' ? [field] : []));

      expect(fields.map(({ name }) => name)).toEqual(['class', 'family', 'creature', 'trait']);
      for (const { name, values } of fields) {
        if (values?.kind !== 'vocabulary') continue;
        for (const entry of service.vocabulary[values.column]) {
          // A value holds no double quote, since no term can (`serialiseTerm`).
          expect(entry, `${name}:${entry}`).not.toContain('"');
          expect(
            service.countMatches(initialExploreState, serialiseTerm(name, entry)),
            `${name}:${entry}`,
          ).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('countMatches', () => {
    it('is the number of traits that a search finds, over 200 sampled queries with filters', () => {
      const samples = fc.sample(fc.tuple(filtersLike(service.vocabulary), queriesLike(service.vocabulary)), {
        numRuns: 200,
        seed: 20261018,
      });

      const counts = samples.map(([filters, query]) => {
        const found = service.search({ ...filters, query }).traits.length;

        expect(service.countMatches(filters, query), query).toBe(found);
        return found;
      });

      // The sample must ask real questions: some find nothing, many find something, some find a lot, and the counts differ.
      expect(counts.filter((count) => count === 0).length).toBeGreaterThan(0);
      expect(counts.filter((count) => count > 0).length).toBeGreaterThan(80);
      expect(counts.filter((count) => count > 100).length).toBeGreaterThan(20);
      expect(new Set(counts).size).toBeGreaterThan(40);
    });
  });
});

const keywordsWithRole = taxonomy.entries.filter(({ kind }) => hasRole(kind));

/** A keyword of the taxonomy that a role field takes, and for an event who does it, or nobody. */
const keywordReference = fc.constantFrom(...keywordsWithRole).chain(({ key, kind }) =>
  fc.record({
    key: fc.constant(key),
    actor: hasActor(kind) ? fc.option(fc.constantFrom(...KEYWORD_ACTORS), { nil: undefined }) : fc.constant(undefined),
  }),
);

/** The filters of an Explore state, as the panel sets them: classes of the dataset, keywords of the taxonomy, two flags. */
function filtersLike(vocabulary: QueryVocabulary): fc.Arbitrary<ExploreState> {
  const keywordFilter = fc
    .tuple(fc.constantFrom('applies', 'uses', 'kw'), keywordReference)
    .map(([field, { key, actor }]): KeywordFilter => ({ field, key, ...(actor === undefined ? {} : { actor }) }));
  return fc
    .record({
      classes: fc.uniqueArray(fc.constantFrom(...vocabulary.class.map((name) => name.toLowerCase())), { maxLength: 2 }),
      keywords: fc.array(keywordFilter, { maxLength: 1 }),
      keywordMode: fc.constantFrom(...KEYWORD_MODES),
      artifactEligible: fc.boolean(),
      doesNotStack: fc.boolean(),
    })
    .map((filters) => ({ ...initialExploreState, ...filters }));
}

/** Queries the way people write them: real words and fields of the language, and the faults they leave in between. */
function queriesLike(vocabulary: QueryVocabulary): fc.Arbitrary<string> {
  const startOf = (entries: readonly string[], field: string) =>
    fc.constantFrom(...entries).map((entry) => serialiseTerm(field, entry.toLowerCase().slice(0, 5)));
  const term = fc.oneof(
    fc.constantFrom('weak', 'heal', 'damage', 'turn', 'ally', 'enemy', 'dire', 'does not stack'),
    fc.constantFrom(...vocabulary.name).map((name) => name.toLowerCase().split(' ')[0] ?? ''),
    fc.constantFrom('weak', 'turn', 'stack').map((word) => `desc:${word}`),
    startOf(vocabulary.class, 'class'),
    startOf(vocabulary.family, 'family'),
    startOf(vocabulary.creature, 'cr'),
    startOf(vocabulary.name, 't'),
    fc
      .tuple(fc.constantFrom('applies', 'uses', 'kw', 'a', 'u', 'k'), keywordReference)
      .map(([field, { key, actor }]) => serialiseTerm(field, actor === undefined ? key : `${key}/${actor}`)),
    fc.constantFrom('mat:yes', 'mat:no', 'stack:yes', 'stack:no', 'mat:maybe'),
    fc.constantFrom('clas:life', 'applies:', '""', '"unclosed', ')', '(', 'OR', 'AND', 'NOT', '-'),
  );
  const written = fc.tuple(
    fc.constantFrom('', '-', '-', 'NOT '),
    term,
    fc.constantFrom(' ', ' ', ' OR ', ' AND ', ' | '),
  );
  const grouped = fc.constantFrom(
    (text: string) => text,
    (text: string) => `(${text})`,
    (text: string) => `(${text}`,
  );
  return fc.tuple(fc.array(written, { minLength: 1, maxLength: 3 }), grouped).map(([parts, group]) =>
    group(
      parts
        .map(([not, each, joiner]) => `${not}${each}${joiner}`)
        .join('')
        .trim(),
    ),
  );
}
