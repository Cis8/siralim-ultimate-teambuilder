import { describe, expect, it } from 'vitest';
import { DATASET_SCHEMA_VERSION, type TraitDataset } from '../model/dataset';
import { loadOnce } from './load-once';
import { DatasetLoadError, type TraitRepository } from './trait-repository';

const dataset: TraitDataset = { schemaVersion: DATASET_SCHEMA_VERSION, datasetVersion: '2.0', traits: [] };

/** A repository that answers with the next of `outcomes` each time it is asked, and counts the times. */
function repositoryAnswering(...outcomes: (TraitDataset | Error)[]) {
  const state = { loads: 0 };
  const repository: TraitRepository = {
    load: () => {
      const outcome = outcomes[Math.min(state.loads, outcomes.length - 1)];
      state.loads += 1;
      return outcome instanceof Error ? Promise.reject(outcome) : Promise.resolve(outcome ?? dataset);
    },
  };
  return { state, repository };
}

describe('loadOnce', () => {
  it('reads the dataset once however many ask, and gives each the same one', async () => {
    const { state, repository } = repositoryAnswering(dataset);
    const shared = loadOnce(repository);

    const [first, second] = await Promise.all([shared.load(), shared.load()]);
    const third = await shared.load();

    expect(first).toBe(dataset);
    expect(second).toBe(dataset);
    expect(third).toBe(dataset);
    expect(state.loads).toBe(1);
  });

  it('reads nothing until it is asked', () => {
    const { state, repository } = repositoryAnswering(dataset);

    loadOnce(repository);

    expect(state.loads).toBe(0);
  });

  it('fails every caller that was waiting with the same failure', async () => {
    const failure = new DatasetLoadError('Could not reach it.');
    const { state, repository } = repositoryAnswering(failure);
    const shared = loadOnce(repository);

    const outcomes = await Promise.allSettled([shared.load(), shared.load()]);

    expect(outcomes.map(({ status }) => status)).toEqual(['rejected', 'rejected']);
    expect(state.loads).toBe(1);
  });

  it('tries again after a failure, so that a connection that came back is used', async () => {
    const { state, repository } = repositoryAnswering(new DatasetLoadError('Offline.'), dataset);
    const shared = loadOnce(repository);

    await expect(shared.load()).rejects.toBeInstanceOf(DatasetLoadError);
    await expect(shared.load()).resolves.toBe(dataset);
    await shared.load();

    expect(state.loads).toBe(2);
  });
});
