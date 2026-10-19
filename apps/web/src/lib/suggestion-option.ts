import type { CountedSuggestion, SuggestionKind } from '@atlas/core';
import type { ComboboxOption, ComboboxTone } from './combobox-option';
import { copy } from './copy';

/** The kinds whose badge takes the colour of that kind of keyword elsewhere on the page; the rest are neutral. */
const TONES: Partial<Record<SuggestionKind, ComboboxTone>> = {
  buff: 'buff',
  debuff: 'debuff',
  mechanic: 'mechanic',
  event: 'event',
};

/** The row of the list that a suggestion is: its kind in words, what is written, what it means, and how many traits it finds. */
export function suggestionOption({ kind, insert, detail, complete, count }: CountedSuggestion): ComboboxOption {
  const finds = count === undefined ? undefined : copy.suggestionFinds(count);
  return {
    badge: copy.suggestionKinds[kind],
    tone: TONES[kind] ?? 'neutral',
    label: insert,
    detail,
    ...(finds === undefined ? {} : { trailing: finds.number, trailingUnit: finds.unit }),
    continues: !complete,
  };
}
