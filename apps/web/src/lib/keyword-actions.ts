import type { KeywordHit } from '@atlas/core';

/** What the description of a result can do with a keyword it shows: tell whether its filter is on, and click it. */
export interface KeywordActions {
  isOn(keyword: KeywordHit): boolean;
  click(keyword: KeywordHit): void;
}
