import { taxonomy, type KeywordKey } from '@atlas/core';

/** The name a keyword is shown under; a key the taxonomy lacks (a fault of the dataset) shows as it is written. */
export const keyLabel = (key: KeywordKey): string => taxonomy.get(key)?.label ?? key;
