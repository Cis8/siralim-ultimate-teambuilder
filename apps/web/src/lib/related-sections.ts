import {
  traitFacts,
  type Alternative,
  type KeywordKey,
  type SameFamily,
  type SameTrigger,
  type SharedKey,
  type Trait,
} from '@atlas/core';
import { copy } from './copy';

/** Cards a list shows before the person asks for all of it. */
export const PREVIEW_CARDS = 6;
/** The most a list draws, plain DOM: Same trigger of the longest trait is 548 and nobody reads that far (PLAN 13.4). */
export const LISTED_AT_MOST = 200;

/** A trait of one of the three lists, with what ties it to the focus. */
export interface RelatedCard {
  readonly trait: Trait;
  /** "×2 in common", once the trait shares more than one key or event. */
  readonly badge?: string | undefined;
  /** The line under its origin: the keys or events it shares. */
  readonly detail?: string | undefined;
}

/** One of the lists under the sides of the page of a trait, worded and ready to draw. */
export interface RelatedSectionModel {
  readonly id: 'alternatives' | 'same-trigger' | 'same-family';
  readonly title: string;
  /** The sentence under the heading. */
  readonly hint: string;
  /** Every card, best first: the page draws a few of them, or as many as `LISTED_AT_MOST`. */
  readonly cards: readonly RelatedCard[];
  /** What the section says in place of the cards when it has none. */
  readonly empty: string;
  /** Whether the number of cards is a fact worth a heading: a grouping that is no family has none. */
  readonly counted: boolean;
}

/** What core says about the focus, for the three lists. */
export interface RelatedLists {
  readonly trait: Trait;
  readonly alternatives: readonly Alternative[];
  readonly sameTrigger: SameTrigger;
  readonly sameFamily: SameFamily;
  readonly artifactOnly: boolean;
}

/** The lists of SPEC §8.4 that sit under Enabled by and Enables, in the order of the page. */
export function relatedSections(
  { trait, alternatives, sameTrigger, sameFamily, artifactOnly }: RelatedLists,
  labelOf: (key: KeywordKey) => string,
): readonly RelatedSectionModel[] {
  const facts = traitFacts(trait);
  const keyless = facts.applies.length === 0 && facts.relies.length === 0;
  const events = sameTrigger.triggers.map(labelOf);
  const badgeOf = (shared: number): string | undefined => (shared > 1 ? copy.inCommon(shared) : undefined);
  const family = sameFamily.family;

  return [
    {
      id: 'alternatives',
      title: copy.alternatives,
      hint: copy.alternativesHint(trait.name),
      cards: alternatives.map(({ trait: card, shared }) => ({
        trait: card,
        badge: badgeOf(shared.length),
        detail: sharedText(shared, labelOf),
      })),
      empty: keyless ? copy.alternativesWithoutKeys(trait.name) : copy.noAlternatives(trait.name, artifactOnly),
      counted: true,
    },
    {
      id: 'same-trigger',
      title: copy.sameTrigger,
      hint: events.length > 0 ? copy.sameTriggerHint(events.join(', ')) : copy.sameTriggerHintNone(trait.name),
      cards: sameTrigger.entries.map(({ trait: card, shared }) => ({
        trait: card,
        badge: badgeOf(shared.length),
        detail: copy.alsoReacts(shared.map(labelOf).join(', ')),
      })),
      empty: events.length > 0 ? copy.noSameTrigger(artifactOnly) : copy.noTrigger(trait.name),
      counted: true,
    },
    sameFamily.grouping
      ? {
          id: 'same-family',
          title: copy.sameFamily,
          hint: copy.groupingHint(family),
          cards: [],
          empty: copy.groupingNote,
          counted: false,
        }
      : {
          id: 'same-family',
          title: copy.sameFamily,
          hint: copy.sameFamilyHint(family),
          cards: sameFamily.entries.map((card) => ({ trait: card })),
          empty: copy.noSameFamily(family, artifactOnly),
          counted: true,
        },
  ];
}

/** What an alternative shares with the focus, split by what both do with the key and in the order the focus names them. */
function sharedText(shared: readonly SharedKey[], labelOf: (key: KeywordKey) => string): string {
  const labelsOf = (role: SharedKey['role']) =>
    shared.filter((tie) => tie.role === role).map(({ key }) => labelOf(key));
  return copy.alsoShares(labelsOf('applies'), labelsOf('uses'));
}

/** The cards a list draws now, how many there are in all, and whether the page had to cut the list short. */
export interface ShownCards {
  readonly cards: readonly RelatedCard[];
  readonly total: number;
  readonly capped: boolean;
}

/** A few cards until the list is opened, then all of them up to `LISTED_AT_MOST`. */
export function shownCards(cards: readonly RelatedCard[], open: boolean): ShownCards {
  const total = cards.length;
  return {
    cards: cards.slice(0, open ? LISTED_AT_MOST : PREVIEW_CARDS),
    total,
    capped: open && total > LISTED_AT_MOST,
  };
}
