import type { TraitDataset } from '../model/dataset';
import type { TraitRepository } from './trait-repository';

/**
 * A repository that reads the dataset from `repository` the first time it is asked, and gives that dataset to everyone who
 * asks after: the app builds more than one service from one dataset and fetches it once. A failure is not kept, so the next
 * call reads again.
 */
export function loadOnce(repository: TraitRepository): TraitRepository {
  let loading: Promise<TraitDataset> | undefined;
  return {
    load: () => {
      loading ??= repository.load().catch((failure: unknown) => {
        loading = undefined;
        throw failure;
      });
      return loading;
    },
  };
}
