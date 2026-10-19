import type { RelationService, TraitId } from '@atlas/core';
import { getContext, setContext } from 'svelte';
import type { SynergyView } from './synergy-address';

/**
 * What the layout of the Synergy pages gives the pages under it: the relations of the dataset once it is loaded, and whether
 * loading it failed. The layout stays while the person goes from one Synergy page to another, so the data is loaded once and a
 * page never waits for it again. It also holds what outlives a page: the trail of the traits looked at, and the writing of the
 * view to the address.
 */
export interface SynergyContext {
  readonly relations: RelationService | undefined;
  readonly failed: boolean;
  /** The view the address states (the artifact filter, the section a narrow screen shows). */
  readonly view: SynergyView;
  /** The traits the person has centred on this session, oldest first, ending with the one whose page they are on (if it is one). */
  readonly trail: readonly TraitId[];
  /** A choice of the view, written to the address as a step of the history of its own: Back takes it back. */
  choose(changes: Partial<SynergyView>): void;
}

const KEY = Symbol('synergy');

export const provideSynergy = (context: SynergyContext): SynergyContext => setContext(KEY, context);

export function useSynergy(): SynergyContext {
  const context = getContext<SynergyContext | undefined>(KEY);
  if (context === undefined) throw new Error('A Synergy page is used outside the layout of the Synergy pages.');
  return context;
}
