import { describe, expect, it } from 'vitest';
import { DATASET_SCHEMA_VERSION } from '../model/dataset';
import type { KeywordHit, KeywordRole, Trait } from '../model/trait';
import { createMemoryTraitRepository } from '../repository/memory-trait-repository';
import { DatasetLoadError, type TraitRepository } from '../repository/trait-repository';
import { buff, debuff } from '../taxonomy/entries';
import { createTaxonomy } from '../taxonomy/registry';
import { createRelationIndex } from './relation-index';
import { createRelationService } from './relation-service';

const taxonomy = createTaxonomy([debuff('Poisoned'), debuff('Weak'), buff('Barrier')]);

function keyword(key: string, role: KeywordRole): KeywordHit {
  return { key, kind: 'debuff', role, span: [0, key.length] };
}

function trait(id: string, overrides: Partial<Trait> = {}): Trait {
  return {
    id,
    name: id,
    creature: 'Abomination Brute',
    family: 'Abomination',
    class: 'Death',
    kind: 'creature',
    description: 'Heals an ally.',
    material: 'Ferrous Ore',
    stacks: true,
    randomDebuff: null,
    masteryFamily: null,
    partyRequirement: null,
    keywords: [],
    conditionalSources: [],
    ...overrides,
  };
}

const traits = [
  trait('spitter', { keywords: [keyword('poisoned', 'applies')] }),
  trait('snake', { keywords: [keyword('poisoned', 'applies')], material: null }),
  trait('gloater', { keywords: [keyword('poisoned', 'uses')] }),
  trait('lone-wolf', { family: 'Wolf', creature: 'Wolf Alpha' }),
];

const repositoryOf = (list: readonly Trait[]): TraitRepository =>
  createMemoryTraitRepository({ schemaVersion: DATASET_SCHEMA_VERSION, datasetVersion: '9.9', traits: list });

describe('createRelationService: the dataset', () => {
  it('says which version of the compendium it holds', async () => {
    expect((await createRelationService(repositoryOf(traits), taxonomy)).datasetVersion).toBe('9.9');
  });

  it('finds a trait by id, and knows an id the dataset does not have for nothing', async () => {
    const service = await createRelationService(repositoryOf(traits), taxonomy);

    expect(service.trait('snake')).toBe(traits[1]);
    expect(service.trait('nobody')).toBeUndefined();
  });

  it('fails as the repository does when the dataset cannot be read', async () => {
    const failure = new DatasetLoadError('Could not reach it.');

    await expect(createRelationService({ load: () => Promise.reject(failure) }, taxonomy)).rejects.toBe(failure);
  });
});

describe('createRelationService: what it says about traits', () => {
  it('says what the index says: the keys, the views and the sections of a trait', async () => {
    const service = await createRelationService(repositoryOf(traits), taxonomy);
    const index = createRelationIndex(traits, taxonomy);

    expect(service.keys).toEqual(index.keys);
    expect(service.get('poisoned')).toEqual(index.get('poisoned'));
    expect(service.keywordView('poisoned')).toEqual(index.keywordView('poisoned'));
    expect(service.keywordStats()).toEqual(index.keywordStats());
    expect(service.relationsOf('gloater')).toEqual(index.relationsOf('gloater'));
    expect(service.alternativesOf('spitter')).toEqual(index.alternativesOf('spitter'));
    expect(service.sameTriggerOf('gloater')).toEqual(index.sameTriggerOf('gloater'));
    expect(service.sameFamilyOf('spitter')).toEqual(index.sameFamilyOf('spitter'));
  });

  it('answers the artifact filter, which it does not mix up with the unfiltered answer', async () => {
    const service = await createRelationService(repositoryOf(traits), taxonomy);

    const all = service.relationsOf('gloater');
    const artifactOnly = service.relationsOf('gloater', { artifactOnly: true });

    expect(all?.enabledBy.count).toBe(2);
    expect(artifactOnly?.enabledBy.count).toBe(1);
    expect(service.relationsOf('gloater', { artifactOnly: false })).toBe(all);
  });

  it('knows nothing of an id the dataset does not have', async () => {
    const service = await createRelationService(repositoryOf(traits), taxonomy);

    expect(service.relationsOf('nobody')).toBeUndefined();
    expect(service.alternativesOf('nobody')).toBeUndefined();
    expect(service.sameTriggerOf('nobody')).toBeUndefined();
    expect(service.sameFamilyOf('nobody')).toBeUndefined();
  });

  // The page asks again whenever it draws again, and Back walks to a trait it showed a moment ago: the answer is the
  // one it already has, not another worked out.
  it('answers the same question with the same answer', async () => {
    const service = await createRelationService(repositoryOf(traits), taxonomy);

    expect(service.relationsOf('gloater')).toBe(service.relationsOf('gloater'));
    expect(service.alternativesOf('spitter')).toBe(service.alternativesOf('spitter'));
    expect(service.sameTriggerOf('gloater')).toBe(service.sameTriggerOf('gloater'));
    expect(service.sameFamilyOf('spitter')).toBe(service.sameFamilyOf('spitter'));
  });

  it('remembers the last 32 traits it was asked about, and works out an older one again', async () => {
    const many = Array.from({ length: 34 }, (_, at) => trait(`t${String(at)}`, { family: `Family ${String(at)}` }));
    const service = await createRelationService(repositoryOf(many), taxonomy);

    const first = service.sameFamilyOf('t0');
    const second = service.sameFamilyOf('t1');
    for (const { id } of many.slice(2, 33)) service.sameFamilyOf(id);

    expect(service.sameFamilyOf('t1')).toBe(second);
    expect(service.sameFamilyOf('t0')).not.toBe(first);
    expect(service.sameFamilyOf('t0')).toEqual(first);
  });
});

describe('createRelationService: finding a trait', () => {
  it('finds traits by what was typed of their name, creature or family, as many as asked', async () => {
    const service = await createRelationService(repositoryOf(traits), taxonomy);

    expect(service.findTraits('spit', 5).map(({ id }) => id)).toEqual(['spitter']);
    expect(service.findTraits('wolf', 5).map(({ id }) => id)).toEqual(['lone-wolf']);
    expect(service.findTraits('abomination', 2).map(({ id }) => id)).toEqual(['gloater', 'snake']);
  });
});
