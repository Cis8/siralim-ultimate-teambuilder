import {
  applyEdit,
  canHaveActor,
  createLintContext,
  createMemoryTraitRepository,
  createSearchService,
  DATASET_SCHEMA_VERSION,
  fieldRegistry,
  hasActor,
  hasRole,
  initialExploreState,
  KEYWORD_ACTORS,
  KEYWORD_MODES,
  lintQuery,
  lintRegistry,
  parseQuery,
  serialiseTerm,
  taxonomy,
  tokenize,
  type ExploreState,
  type KeywordFilter,
  type LintContext,
  type QueryDiagnostic,
  type QueryVocabulary,
  type SearchService,
} from '@atlas/core';
import fc from 'fast-check';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildRealSheet } from '../testing/real-build';

// What the query assist (Phase 2, ADR-0010) reads from the loaded dataset, on the pinned snapshot of the compendium, v2.0.

describe('the query assist on the compendium v2.0', () => {
  let service: SearchService;
  let context: LintContext;

  beforeAll(async () => {
    const built = await buildRealSheet();
    service = await createSearchService(
      createMemoryTraitRepository({
        schemaVersion: DATASET_SCHEMA_VERSION,
        datasetVersion: built.datasetVersion,
        traits: built.traits,
      }),
    );
    context = createLintContext(service);
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

  describe('the lint rules of the fields and their values', () => {
    const lint = (source: string): QueryDiagnostic[] =>
      tokenize(source).flatMap((token) => (token.kind === 'term' ? lintRegistry.check(token, context) : []));

    /** The vocabulary fields with their entries; of the long lists every `every`th, so that the test stays quick. */
    const entriesOfFields = (every: Record<string, number>) =>
      fieldRegistry.fields.flatMap(({ name, values }) =>
        values?.kind === 'vocabulary'
          ? [
              {
                field: name,
                entries: service.vocabulary[values.column].filter((_, at) => at % (every[name] ?? 1) === 0),
              },
            ]
          : [],
      );
    // Offering the closest of 1,780 names costs about 2.6 ms, and the runner of CI is slower than a laptop: keep this under the 5 s of a test.
    const sampled = { creature: 25, trait: 25 };

    it('finds nothing wrong with any entry of the vocabulary written as a value of its field', () => {
      for (const { field, entries } of entriesOfFields({})) {
        for (const entry of entries) expect(lint(serialiseTerm(field, entry)), `${field}:${entry}`).toEqual([]);
      }
    });

    it('calls a value unknown exactly when the search finds no trait, and the fix it offers finds some', () => {
      let unknown = 0;
      let known = 0;
      let fixes = 0;
      for (const { field, entries } of entriesOfFields(sampled)) {
        for (const entry of entries) {
          // A letter missing near the start, a letter added at the end, and the first half of the entry: part of an entry is no fault.
          const lower = entry.toLowerCase();
          const half = lower.slice(0, Math.ceil(lower.length / 2));
          for (const value of [lower.slice(0, 1) + lower.slice(2), `${lower}z`, half]) {
            const source = serialiseTerm(field, value);
            const asked = lint(source).filter(({ code }) => code.startsWith('unknown-'));
            const found = service.countMatches(initialExploreState, source);

            expect(asked.length > 0, source).toBe(found === 0);
            if (found === 0) unknown += 1;
            else known += 1;
            const fix = asked[0]?.fix;
            if (fix === undefined) continue;
            fixes += 1;
            const mended = applyEdit(source, fix.edit);
            expect(service.countMatches(initialExploreState, mended), mended).toBeGreaterThan(0);
            expect(lint(mended), mended).toEqual([]);
          }
        }
      }
      // The sample must ask both questions, and the fixes must be tried.
      expect(unknown).toBeGreaterThan(150);
      expect(known).toBeGreaterThan(50);
      expect(fixes).toBeGreaterThan(100);
    });

    it('offers the class a misspelling of it stands for (QUERY_LANGUAGE §5)', () => {
      const [found] = lint('class:lfe');

      expect(found).toMatchObject({
        code: 'unknown-class',
        severity: 'error',
        message: 'No class “lfe”. Did you mean Life?',
        fix: { edit: { span: [6, 9], text: 'Life' } },
      });
    });
  });

  describe('the lint rules of keywords and free text, and lintQuery', () => {
    const lint = (source: string): QueryDiagnostic[] => lintQuery(source, context);
    const codesOf = (source: string): string[] => lint(source).map(({ code }) => code);
    const found = (source: string): number => service.countMatches(initialExploreState, source);
    const keywordFields = ['applies', 'uses', 'kw'];
    const keysOf = (field: string) => {
      const domain = fieldRegistry.resolve(field)?.values;
      if (domain?.kind !== 'keyword') throw new Error(`${field} is no keyword field`);
      return taxonomy.entries.filter(({ kind }) => domain.accepts(kind));
    };
    const KEYWORD_CODES = ['unknown-keyword', 'keyword-without-role', 'unknown-actor', 'keyword-without-actor'];

    it('finds nothing wrong with any key, old phrase or actor of the taxonomy that the search takes, a class, or a name', () => {
      for (const field of keywordFields) {
        for (const entry of keysOf(field)) {
          expect(lint(serialiseTerm(field, entry.key)), `${field}:${entry.key}`).toEqual([]);
          for (const actor of KEYWORD_ACTORS) {
            const source = serialiseTerm(field, `${entry.key}/${actor}`);
            expect(codesOf(source), source).toEqual(canHaveActor(entry) ? [] : ['keyword-without-actor']);
          }
        }
      }
      for (const { key, aliases = [] } of taxonomy.ofKind('event')) {
        for (const { key: alias } of aliases) {
          for (const field of keywordFields) {
            expect(lint(serialiseTerm(field, alias)), `${field}:${alias} (${key})`).toEqual([]);
          }
        }
      }
      for (const name of service.vocabulary.class) expect(lint(serialiseTerm('class', name)), name).toEqual([]);
      for (const name of service.vocabulary.name.filter((_, at) => at % 25 === 0)) {
        expect(lint(serialiseTerm('trait', name)), name).toEqual([]);
        expect(lint(serialiseTerm(undefined, name)), name).toEqual([]);
      }
    });

    it('finds a fault in a keyword only when the search finds nothing, and the fix it offers lints clean', () => {
      let faults = 0;
      let fixes = 0;
      for (const field of keywordFields) {
        for (const { key, kind } of keysOf(field)) {
          // A letter added, an actor nobody is, the start of a key with an actor, and a field that does not take the kind.
          for (const value of [`${key}z`, `${key}/nobody`, `${key}/selff`, `${key.slice(0, 4)}/enemy`]) {
            const source = serialiseTerm(field, value);
            const asked = lint(source).filter(({ code }) => KEYWORD_CODES.includes(code));
            if (asked.length === 0) continue;
            faults += 1;
            // Every code of these rules says that the search finds nothing.
            expect(found(source), source).toBe(0);
            const fix = asked[0]?.fix;
            if (fix === undefined) continue;
            fixes += 1;
            expect(
              lint(applyEdit(source, fix.edit)).filter(({ code }) => asked[0]?.code === code),
              `${source} (${kind})`,
            ).toEqual([]);
          }
        }
      }
      for (const field of ['applies', 'uses']) {
        for (const { key } of taxonomy.entries.filter(({ kind }) => kind === 'mechanic' || kind === 'flag')) {
          const source = serialiseTerm(field, key);
          expect(codesOf(source), source).toEqual(['keyword-without-role']);
          expect(found(source), source).toBe(0);
          faults += 1;
        }
      }
      expect(faults).toBeGreaterThan(300);
      expect(fixes).toBeGreaterThan(100);
    });

    it('offers the keyword a misspelling of it stands for (QUERY_LANGUAGE §5)', () => {
      expect(lint('applies:vulnrable')).toMatchObject([
        {
          code: 'unknown-keyword',
          severity: 'error',
          message: 'No keyword “vulnrable”. Did you mean Vulnerable?',
          fix: { edit: { span: [8, 17], text: 'vulnerable' } },
        },
      ]);
      expect(found('applies:vulnerable')).toBeGreaterThan(0);
    });

    it('calls a word in no trait unknown, and offers the closest word of the compendium that is in some', () => {
      expect(lint('vulnrable')).toMatchObject([
        {
          code: 'text-in-no-trait',
          severity: 'warning',
          message: '“vulnrable” appears in no trait. Did you mean “vulnerable”?',
          fix: { edit: { span: [0, 9], text: 'vulnerable' } },
        },
      ]);
      expect(found('vulnerable')).toBeGreaterThan(0);
    });

    it('calls free text unknown exactly when the search finds no trait, and the fix it offers finds some', () => {
      let unknown = 0;
      let known = 0;
      let fixes = 0;
      for (const column of ['class', 'family', 'creature', 'name'] as const) {
        for (const entry of service.vocabulary[column].filter((_, at) => at % (column === 'class' ? 1 : 25) === 0)) {
          const lower = entry.toLowerCase();
          // A letter added at the end, a letter missing near the start, and the first half of the entry (part of an entry is no fault).
          for (const text of [
            `${lower}z`,
            lower.slice(0, 1) + lower.slice(2),
            lower.slice(0, Math.ceil(lower.length / 2)),
          ]) {
            const source = serialiseTerm(undefined, text);
            const asked = lint(source).filter(({ code }) => code === 'text-in-no-trait');

            expect(asked.length > 0, source).toBe(found(source) === 0);
            if (asked.length > 0) unknown += 1;
            else known += 1;
            const fix = asked[0]?.fix;
            if (fix === undefined) continue;
            fixes += 1;
            const mended = applyEdit(source, fix.edit);
            expect(found(mended), mended).toBeGreaterThan(0);
            expect(lint(mended), mended).toEqual([]);
          }
        }
      }
      expect(unknown).toBeGreaterThan(80);
      expect(known).toBeGreaterThan(20);
      expect(fixes).toBeGreaterThan(50);
    });

    it('shows two errors in `clas:life (weak OR snared`, and after both fixes the query is read without a repair (criterion 1)', () => {
      const source = 'clas:life (weak OR snared';
      const errors = lint(source);

      expect(errors.map(({ code, severity }) => [code, severity])).toEqual([
        ['unknown-field', 'error'],
        ['unclosed-open', 'error'],
      ]);
      const mended = errors.reduceRight(
        (text, { fix }) => (fix === undefined ? text : applyEdit(text, fix.edit)),
        source,
      );

      expect(mended).toBe('class:life (weak OR snared)');
      expect(lint(mended)).toEqual([]);
      expect(parseQuery(mended).diagnostics).toEqual([]);
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
