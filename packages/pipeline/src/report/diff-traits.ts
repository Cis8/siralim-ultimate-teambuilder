import { compareText } from '@atlas/core';

/** A trait as stored in a dataset file: only its id matters here, the rest is compared as plain data. */
export type TraitRecord = Readonly<Record<string, unknown>> & { readonly id: string };

export interface TraitDiff {
  readonly added: readonly string[];
  readonly removed: readonly string[];
  readonly changed: readonly { readonly id: string; readonly fields: readonly string[] }[];
}

/** What differs between two builds, by trait id, everything sorted. Fields are compared by content. */
export function diffTraits(previous: readonly TraitRecord[], current: readonly TraitRecord[]): TraitDiff {
  const before = new Map(previous.map((record) => [record.id, record]));
  const after = new Map(current.map((record) => [record.id, record]));

  const changed = [];
  for (const [id, now] of after) {
    const then = before.get(id);
    if (then === undefined) continue;
    const fields = changedFields(then, now);
    if (fields.length > 0) changed.push({ id, fields });
  }

  return {
    added: [...after.keys()].filter((id) => !before.has(id)).toSorted(compareText),
    removed: [...before.keys()].filter((id) => !after.has(id)).toSorted(compareText),
    changed: changed.toSorted((a, b) => compareText(a.id, b.id)),
  };
}

function changedFields(then: TraitRecord, now: TraitRecord): string[] {
  const fields = new Set([...Object.keys(then), ...Object.keys(now)]);
  return [...fields]
    .filter((field) => JSON.stringify(then[field]) !== JSON.stringify(now[field]))
    .toSorted(compareText);
}
