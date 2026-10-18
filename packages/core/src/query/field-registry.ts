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
  /**
   * The text, in lower case, that the term looks for in the description, which the results mark: the value of a field
   * that `highlightsDescription`, and the word of a term that is read as free text. `undefined` for a term that looks
   * elsewhere (`class:life`), and for one with no value yet.
   */
  highlightedText(term: TermToken): string | undefined;
}

const matchEveryTrait: TraitMatcher = () => true;

/**
 * Checks the fields (their spellings, their line of help and their lists of choices) and wraps them. Adding a field is
 * adding a definition; the lexer, the parser and the evaluator do not change. `freeText` is what a word with no field,
 * and one with a field nobody knows, is looked for with.
 *
 * @throws FieldRegistryError listing every violation.
 */
export function createFieldRegistry(
  fields: readonly FieldDefinition[],
  freeText: (value: string) => TraitMatcher,
): FieldRegistry {
  const violations = [
    ...spellingViolations(fields),
    ...nameViolations(fields),
    ...helpViolations(fields),
    ...choiceViolations(fields),
  ];
  if (violations.length > 0) {
    throw new FieldRegistryError(`The fields are not valid:\n- ${violations.join('\n- ')}`);
  }

  const bySpelling = new Map(fields.flatMap((field) => [field.name, ...field.aliases].map((name) => [name, field])));
  const resolve = (name: string) => bySpelling.get(name.toLowerCase());

  return {
    fields,
    resolve,
    matcherFor(term) {
      const field = fieldOf(term);
      return field === undefined ? matcherOf(freeText, wordOf(term)) : matcherOf(field.matcher, term.value);
    },
    highlightedText(term) {
      const field = fieldOf(term);
      const text = field === undefined ? wordOf(term) : field.highlightsDescription === true ? term.value : '';
      return text === '' ? undefined : text.toLowerCase();
    },
  };

  /** The field the term names, if the registry knows it. */
  function fieldOf({ field: written }: TermToken): FieldDefinition | undefined {
    return written === undefined ? undefined : resolve(written.name);
  }
}

/** What a term is looked for as when no field reads it: its value, or the whole token if it names a field nobody knows. */
const wordOf = ({ field, value }: TermToken): string => (field === undefined ? value : `${field.name}:${value}`);

const matcherOf = (matcher: (value: string) => TraitMatcher, value: string): TraitMatcher =>
  value === '' ? matchEveryTrait : matcher(value.toLowerCase());

function spellingViolations(fields: readonly FieldDefinition[]): string[] {
  return fields
    .flatMap((field) => [field.name, ...field.aliases])
    .filter((spelling) => !/^[a-z]+$/.test(spelling))
    .map((spelling) => `${JSON.stringify(spelling)} must be lower case letters only, as the lexer reads a field name`);
}

function nameViolations(fields: readonly FieldDefinition[]): string[] {
  return repeats(fields.flatMap((field) => [field.name, ...field.aliases])).map(
    ([spelling, count]) => `${JSON.stringify(spelling)} names ${count} fields`,
  );
}

/** The help is shown on one line beside the name of the field. */
function helpViolations(fields: readonly FieldDefinition[]): string[] {
  return fields
    .filter(({ help }) => help === '' || help !== help.trim() || /[\r\n]/.test(help))
    .map(({ name }) => `field "${name}" needs one line of help: not empty, no padding, no line break`);
}

/** The matcher of a choice is asked for the value as the registry reads it from a term: lower case, trimmed and not empty. */
function choiceViolations(fields: readonly FieldDefinition[]): string[] {
  return fields.flatMap(({ name, values }) => {
    if (values?.kind !== 'choices') return [];
    const spellings = values.choices.flatMap(({ value, aliases }) => [value, ...aliases]);
    return [
      ...(values.choices.length === 0 ? [`field "${name}" has no choice`] : []),
      ...spellings
        .filter((spelling) => spelling === '' || spelling !== spelling.trim().toLowerCase())
        .map(
          (spelling) =>
            `field "${name}" lists the choice ${JSON.stringify(spelling)}, which must be lower case, trimmed and not empty`,
        ),
      ...repeats(spellings).map(
        ([spelling]) => `field "${name}" lists the choice ${JSON.stringify(spelling)} more than once`,
      ),
    ];
  });
}

/** The texts that come up more than once, with how many times. */
function repeats(texts: readonly string[]): [text: string, count: number][] {
  const counts = new Map<string, number>();
  for (const text of texts) counts.set(text, (counts.get(text) ?? 0) + 1);
  return [...counts].filter(([, count]) => count > 1);
}
