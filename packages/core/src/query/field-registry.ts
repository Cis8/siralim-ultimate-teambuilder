import type { FieldDefinition, TraitMatcher } from './field';
import type { TermToken } from './token';

/** The fields break a rule that would make a field name ambiguous or unreadable for the lexer. */
export class FieldRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FieldRegistryError';
  }
}

export interface FieldRegistry {
  /** In the order they were given. */
  readonly fields: readonly FieldDefinition[];
  /** The field a name or an alias stands for, whatever the letter case. */
  resolve(name: string): FieldDefinition | undefined;
  /**
   * What the term asks for. A term whose field is not in the registry is read as a word to look for, colon included:
   * `clas:life` finds `clas:life`, not a class. A term with no value yet (`applies:`, `""`) asks for nothing, so it
   * matches every trait and does not empty the results while the query is being typed.
   */
  matcherFor(term: TermToken): TraitMatcher;
}

const matchEveryTrait: TraitMatcher = () => true;

/**
 * Checks the fields and wraps them. Adding a field is adding a definition; the lexer, the parser and the evaluator do
 * not change. `freeText` is what a word with no field, and one with a field nobody knows, is looked for with.
 *
 * @throws FieldRegistryError listing every violation.
 */
export function createFieldRegistry(
  fields: readonly FieldDefinition[],
  freeText: (value: string) => TraitMatcher,
): FieldRegistry {
  const violations = [...spellingViolations(fields), ...nameViolations(fields)];
  if (violations.length > 0) {
    throw new FieldRegistryError(`The fields are not valid:\n- ${violations.join('\n- ')}`);
  }

  const bySpelling = new Map(fields.flatMap((field) => [field.name, ...field.aliases].map((name) => [name, field])));
  const resolve = (name: string) => bySpelling.get(name.toLowerCase());

  return {
    fields,
    resolve,
    matcherFor({ field: written, value }) {
      if (written === undefined) return matcherOf(freeText, value);
      const field = resolve(written.name);
      return field === undefined ? freeText(`${written.name}:${value}`.toLowerCase()) : matcherOf(field.matcher, value);
    },
  };
}

const matcherOf = (matcher: (value: string) => TraitMatcher, value: string): TraitMatcher =>
  value === '' ? matchEveryTrait : matcher(value.toLowerCase());

function spellingViolations(fields: readonly FieldDefinition[]): string[] {
  return fields
    .flatMap((field) => [field.name, ...field.aliases])
    .filter((spelling) => !/^[a-z]+$/.test(spelling))
    .map((spelling) => `${JSON.stringify(spelling)} must be lower case letters only, as the lexer reads a field name`);
}

function nameViolations(fields: readonly FieldDefinition[]): string[] {
  const counts = new Map<string, number>();
  for (const spelling of fields.flatMap((field) => [field.name, ...field.aliases])) {
    counts.set(spelling, (counts.get(spelling) ?? 0) + 1);
  }
  return [...counts]
    .filter(([, count]) => count > 1)
    .map(([spelling, count]) => `${JSON.stringify(spelling)} names ${count} fields`);
}
