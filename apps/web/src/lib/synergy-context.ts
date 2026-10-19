import type { RelationService } from '@atlas/core';
import { getContext, setContext } from 'svelte';

/**
 * What the layout of the Synergy pages gives the pages under it: the relations of the dataset once it is loaded, and whether
 * loading it failed. The layout stays while the person goes from one Synergy page to another, so the data is loaded once and a
 * page never waits for it again.
 */
export interface SynergyContext {
  readonly relations: RelationService | undefined;
  readonly failed: boolean;
}

const KEY = Symbol('synergy');

export const provideSynergy = (context: SynergyContext): SynergyContext => setContext(KEY, context);

export function useSynergy(): SynergyContext {
  const context = getContext<SynergyContext | undefined>(KEY);
  if (context === undefined) throw new Error('A Synergy page is used outside the layout of the Synergy pages.');
  return context;
}
