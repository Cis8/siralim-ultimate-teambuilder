import {
  createLintContext,
  createMemoryTraitRepository,
  createSearchService,
  DATASET_SCHEMA_VERSION,
  lintQuery,
  type LintContext,
} from '@atlas/core';
import { beforeAll, test } from 'vitest';
import { buildRealSheet } from '../testing/real-build';

// ADR-0010: the query assist (lint, suggestions and counts) takes at most 16 ms per keystroke on a mid-range phone. This
// times the lint on the pinned snapshot of the compendium, v2.0, on the machine that runs it (`pnpm bench`). It holds no
// budget, like `search.bench.ts`: the e2e `assist-latency.test.ts` of 9.6 does, in the page and with the CPU slowed down 4×.
// The counts the lint asks for are remembered by the context, so a keystroke that leaves a term as it was pays for it once:
// the first run of each scenario fills them, and the table shows the steady state a person types in.

const SIX_TERMS = '(applies:vulnerable OR uses:weak/self) class:life -mat:no trait:"flesh rot" stack:yes';
const SIX_TERMS_WITH_FAULTS =
  '(applies:vulnrable OR uses:weak/selff) class:lfe -mat:maybe trait:"flesh rotz" vulnrable';

const scenarios: Record<string, string> = {
  'six terms, nothing wrong': SIX_TERMS,
  'six terms, five faults with an offer each (a keyword, an actor, a class, a choice, a trait name, free text)':
    SIX_TERMS_WITH_FAULTS,
  'a name that is a trait, creature and family at once, misspelled': 'trait:"flesh rotz" cr:"clutcher bruser"',
  'a word in no trait': 'vulnrable',
  'a long query of 40 terms': Array.from(
    { length: 40 },
    (_, at) => `applies:vulnerable class:life t:x${String(at)}`,
  ).join(' '),
};

let context: LintContext;

beforeAll(async () => {
  const built = await buildRealSheet();
  const service = await createSearchService(
    createMemoryTraitRepository({
      schemaVersion: DATASET_SCHEMA_VERSION,
      datasetVersion: built.datasetVersion,
      traits: built.traits,
    }),
  );
  context = createLintContext(service);
});

for (const [name, query] of Object.entries(scenarios)) {
  test(`lint: ${name}`, async ({ bench }) => {
    await bench(name, () => {
      lintQuery(query, context);
    }).run();
  });
}

test(`lint: typing ${SIX_TERMS_WITH_FAULTS}, one lint per key, the caret at the end`, async ({ bench }) => {
  const typing = Array.from(SIX_TERMS_WITH_FAULTS, (_, length) => SIX_TERMS_WITH_FAULTS.slice(0, length + 1));

  await bench(`typing ${String(typing.length)} keys`, () => {
    for (const text of typing) lintQuery(text, context, { caret: text.length });
  }).run();
});
