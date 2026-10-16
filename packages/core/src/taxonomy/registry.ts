import type { KeywordKey, KeywordKind } from '../model/trait';
import type { TaxonomyEntry } from './entry';

/** The entries break a rule that would make keyword matching ambiguous or impossible. */
export class TaxonomyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TaxonomyError';
  }
}

export interface Taxonomy {
  /** In the order they were given. */
  readonly entries: readonly TaxonomyEntry[];
  get(key: KeywordKey): TaxonomyEntry | undefined;
  ofKind<K extends KeywordKind>(kind: K): readonly Extract<TaxonomyEntry, { kind: K }>[];
}

/**
 * Checks the entries and wraps them: keys are unique and lower case, every entry has a label and plain-text
 * patterns, and no pattern names two entries. Adding a keyword is adding an entry; nothing else changes.
 *
 * @throws TaxonomyError listing every violation.
 */
export function createTaxonomy(entries: readonly TaxonomyEntry[]): Taxonomy {
  const violations = [...keyViolations(entries), ...entryViolations(entries), ...patternViolations(entries)];
  if (violations.length > 0) {
    throw new TaxonomyError(`The taxonomy is not valid:\n- ${violations.join('\n- ')}`);
  }

  const byKey = new Map(entries.map((entry) => [entry.key, entry]));
  return {
    entries,
    get: (key) => byKey.get(key),
    ofKind: <K extends KeywordKind>(kind: K) =>
      entries.filter((entry): entry is Extract<TaxonomyEntry, { kind: K }> => entry.kind === kind),
  };
}

function keyViolations(entries: readonly TaxonomyEntry[]): string[] {
  const counts = new Map<string, number>();
  for (const { key } of entries) counts.set(key, (counts.get(key) ?? 0) + 1);
  return [...counts].filter(([, count]) => count > 1).map(([key, count]) => `key "${key}" is used by ${count} entries`);
}

function entryViolations(entries: readonly TaxonomyEntry[]): string[] {
  return entries.flatMap((entry) => {
    const problems: string[] = [];
    if (entry.key === '' || entry.key !== entry.key.trim().toLowerCase()) {
      problems.push(`key "${entry.key}" must be lower case and trimmed`);
    }
    if (entry.label.trim() === '') problems.push(`"${entry.key}" needs a label`);
    if (entry.patterns.length === 0) problems.push(`"${entry.key}" has no pattern`);
    if (entry.kind === 'effect') {
      const patterns = new Set(entry.patterns.map((pattern) => pattern.toLowerCase()));
      for (const active of entry.activePatterns ?? []) {
        if (!patterns.has(active.toLowerCase())) {
          problems.push(`"${entry.key}" lists the active form "${active}", which is not one of its patterns`);
        }
      }
    }
    for (const pattern of entry.patterns) {
      if (!isPlainText(pattern)) {
        problems.push(
          `pattern ${JSON.stringify(pattern)} of "${entry.key}" must be plain text: not empty, no padding, double spaces, line breaks or curly quotes`,
        );
      }
    }
    return problems;
  });
}

function patternViolations(entries: readonly TaxonomyEntry[]): string[] {
  const owners = new Map<string, string[]>();
  const problems: string[] = [];
  for (const entry of entries) {
    const seenHere = new Set<string>();
    for (const pattern of entry.patterns.map((text) => text.toLowerCase())) {
      if (seenHere.has(pattern)) problems.push(`"${entry.key}" lists the pattern "${pattern}" twice`);
      seenHere.add(pattern);
    }
    for (const pattern of seenHere) owners.set(pattern, [...(owners.get(pattern) ?? []), entry.key]);
  }
  for (const [pattern, keys] of owners) {
    if (keys.length > 1) problems.push(`pattern "${pattern}" belongs to ${describeOwners(keys)}`);
  }
  return problems;
}

function describeOwners(keys: readonly string[]): string {
  const quoted = keys.map((key) => `"${key}"`);
  if (quoted.length === 2) return `both ${quoted.join(' and ')}`;
  return `${quoted.slice(0, -1).join(', ')} and ${quoted.at(-1)}`;
}

/** The same shape the pipeline gives the text it matches against: trimmed, single spaces, straight quotes. */
function isPlainText(pattern: string): boolean {
  return pattern !== '' && pattern === pattern.trim().replace(/\s+/g, ' ') && !/[‘’“”]/.test(pattern);
}
