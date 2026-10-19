import type { TraitId } from '@atlas/core';

/** Which page of the Synergy explorer an address is on (ADR-0011): the picker, a trait, or a keyword by the slug of its key. */
export type SynergyPlace =
  | { readonly page: 'picker' }
  | { readonly page: 'trait'; readonly traitId: TraitId }
  | { readonly page: 'keyword'; readonly slug: string };

/**
 * The place a route and its parameters stand for, `undefined` for a route that is none of them (a parameter that is missing or
 * empty makes it one too). The router names the route as its file path does: `/synergy/[traitId]`.
 */
export function synergyPlaceOf(
  routeId: string | null,
  params: Readonly<Record<string, string | undefined>>,
): SynergyPlace | undefined {
  const { traitId, slug } = params;
  if (routeId === '/synergy') return { page: 'picker' };
  if (routeId === '/synergy/[traitId]' && traitId !== undefined && traitId !== '') return { page: 'trait', traitId };
  if (routeId === '/synergy/kw/[slug]' && slug !== undefined && slug !== '') return { page: 'keyword', slug };
  return undefined;
}
