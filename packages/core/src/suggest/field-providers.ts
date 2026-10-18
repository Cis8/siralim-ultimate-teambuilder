import { closestMatch } from '../query/closest-match';
import type { FieldRegistry } from '../query/field-registry';
import { quoted } from '../query/finding-text';
import { bestMatchTier } from './match-tier';
import type { Candidate } from './suggestion';
import { suggestionProvider } from './suggestion-registry';

/** The words that join terms, with what each does (QUERY_LANGUAGE §1). */
const OPERATORS = [
  { insert: 'OR', detail: 'either side' },
  { insert: 'AND', detail: 'both sides (also implicit)' },
  { insert: 'NOT', detail: 'exclude the next term' },
] as const;

const operatorCandidates: readonly Candidate[] = OPERATORS.map(({ insert, detail }): Candidate => ({
  kind: 'operator',
  insert,
  detail,
  complete: false,
  tier: 'prefix',
}));

/**
 * The fields that the letters typed fit by their name or one of their aliases, each as a bare `name:` that waits for its value,
 * with the line that says what it looks for. `typed` is lower case; nothing typed fits every field.
 */
export function fieldCandidates(fields: FieldRegistry, typed: string): Candidate[] {
  return fields.fields.flatMap(({ name, aliases, help }) => {
    const tier = bestMatchTier(typed, [name, ...aliases]);
    return tier === undefined ? [] : [{ kind: 'field', insert: `${name}:`, detail: help, complete: false, tier }];
  });
}

/** Where a term must come: the start, after `(`, after an operator or a negation. Only a term can stand there, so only fields. */
export const fieldProvider = suggestionProvider('field', (_context, { fields }) => fieldCandidates(fields, ''));

/** Between terms: an operator may join them, and a term may follow (juxtaposition is AND). */
export const operatorOrFieldProvider = suggestionProvider('operator-or-field', (_context, { fields }) => [
  ...operatorCandidates,
  ...fieldCandidates(fields, ''),
]);

/**
 * `clas:`: the field the name was most likely meant to be, the way the lint rule offers it (same candidates, same distance), so
 * that the fix of the issue and the suggestion are one. It replaces the name and the colon, and counts as a term only when a
 * value follows.
 */
export const unknownFieldProvider = suggestionProvider('unknown-field', ({ written, valued }, { fields }) => {
  const spellings = fields.fields.flatMap(({ name, aliases }) => [name, ...aliases]);
  const closest = closestMatch(written, spellings);
  if (closest === undefined) return [];
  return [
    {
      kind: 'field',
      insert: `${closest}:`,
      detail: `Instead of ${quoted(`${written}:`)}`,
      complete: valued,
      tier: 'prefix',
    },
  ];
});
