import {
  createMemoryTraitRepository,
  createRelationIndex,
  createRelationService,
  DATASET_SCHEMA_VERSION,
  taxonomy,
  type RelationService,
  type Trait,
} from '@atlas/core';
import { beforeAll, test } from 'vitest';
import { buildRealSheet } from '../testing/real-build';

// What the Synergy pages (Phase 2, M13) cost on the pinned snapshot of the compendium, v2.0 (1,780 traits), on the machine
// that runs this (`pnpm bench`, which prints a table per scenario). It holds no budget; the aim is about 0.15 ms for the
// sections of one trait, so a re-centre never waits on them: divide the time of a scenario by 1,780. This is for finding out
// where the time goes when a page feels slow. Each scenario asks the sections of every trait of the sheet, in the dataset's
// order, on a fresh index (the service remembers its answers, which would time a lookup).

const TYPED = 'jungle boogie';

let traits: readonly Trait[];
let service: RelationService;

beforeAll(async () => {
  const built = await buildRealSheet();
  traits = built.traits;
  service = await createRelationService(
    createMemoryTraitRepository({
      schemaVersion: DATASET_SCHEMA_VERSION,
      datasetVersion: built.datasetVersion,
      traits,
    }),
  );
});

test('the index: built from the traits and the taxonomy, once when the dataset loads', async ({ bench }) => {
  await bench('build the index', () => {
    createRelationIndex(traits, taxonomy);
  }).run();
});

test('Enabled by and Enables: every trait', async ({ bench }) => {
  const index = createRelationIndex(traits, taxonomy);

  await bench('relationsOf, 1,780 traits', () => {
    for (const { id } of traits) index.relationsOf(id);
  }).run();
});

test('Enabled by and Enables: every trait, artifact filter on', async ({ bench }) => {
  const index = createRelationIndex(traits, taxonomy);

  await bench('relationsOf, 1,780 traits, artifactOnly', () => {
    for (const { id } of traits) index.relationsOf(id, { artifactOnly: true });
  }).run();
});

test('Alternatives, Same trigger and Same family: every trait', async ({ bench }) => {
  const index = createRelationIndex(traits, taxonomy);

  await bench('alternativesOf, 1,780 traits', () => {
    for (const { id } of traits) index.alternativesOf(id);
  }).run();
  await bench('sameTriggerOf, 1,780 traits', () => {
    for (const { id } of traits) index.sameTriggerOf(id);
  }).run();
  await bench('sameFamilyOf, 1,780 traits', () => {
    for (const { id } of traits) index.sameFamilyOf(id);
  }).run();
});

test('the keyword view: all 42 keys, and the counts of their chips', async ({ bench }) => {
  const index = createRelationIndex(traits, taxonomy);

  await bench('keywordView, 42 keys', () => {
    for (const key of index.keys) index.keywordView(key);
  }).run();
  await bench('keywordStats, 42 keys', () => {
    index.keywordStats();
  }).run();
});

test('the service: the sections of a trait it remembers', async ({ bench }) => {
  const { id } = traits[0] ?? { id: '' };

  await bench('relationsOf, the same trait again', () => {
    service.relationsOf(id);
  }).run();
});

test(`the focus picker: one search per key of "${TYPED}"`, async ({ bench }) => {
  const typing = Array.from(TYPED, (_, length) => TYPED.slice(0, length + 1));

  await bench(`typing ${String(typing.length)} keys`, () => {
    for (const text of typing) service.findTraits(text, 8);
  }).run();
});
