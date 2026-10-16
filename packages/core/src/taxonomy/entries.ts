import type { BuffEntry, DebuffEntry, FlagEntry, MechanicEntry, TriggerEntry, TriggerPhase } from './entry';

// Short ways to write the entries of the lists. The key is the lower-cased label unless said otherwise, and a
// label is also its own pattern unless `patterns` lists the phrases (which then must include it).

interface CanonicalOptions {
  readonly patterns?: readonly string[];
  readonly canonicalName?: string;
}

const canonicalName = (options: CanonicalOptions) =>
  options.canonicalName === undefined ? {} : { canonicalName: options.canonicalName };

export function debuff(
  label: string,
  options: CanonicalOptions & { readonly canBeRandomlyApplied?: boolean } = {},
): DebuffEntry {
  return {
    kind: 'debuff',
    key: label.toLowerCase(),
    label,
    patterns: options.patterns ?? [label],
    canBeRandomlyApplied: options.canBeRandomlyApplied ?? true,
    ...canonicalName(options),
  };
}

export function buff(label: string, options: CanonicalOptions = {}): BuffEntry {
  return {
    kind: 'buff',
    key: label.toLowerCase(),
    label,
    patterns: options.patterns ?? [label],
    ...canonicalName(options),
  };
}

export function mechanic(key: string, label: string, patterns: readonly string[]): MechanicEntry {
  return { kind: 'mechanic', key, label, patterns };
}

export function trigger(
  key: string,
  label: string,
  phase: TriggerPhase,
  extraPatterns: readonly string[] = [],
): TriggerEntry {
  return { kind: 'trigger', key, label, patterns: [key, ...extraPatterns], phase };
}

export function flag(key: string, label: string, patterns: readonly string[]): FlagEntry {
  return { kind: 'flag', key, label, patterns };
}
