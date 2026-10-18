import type { KeywordKind } from '../model/trait';
import type { FieldDefinition } from '../query/field';
import type { FieldRegistry } from '../query/field-registry';
import { serialiseTerm } from '../query/serialise';
import { bestFits } from './best-fits';
import { fieldCandidates } from './field-providers';
import type { Candidate } from './suggestion';
import { suggestionProvider, type SuggestionEnvironment } from './suggestion-registry';
import { valueCandidate, valueCandidates } from './value-providers';

/**
 * Where a keyword is offered for a word with no field: under the fields of the first of these groups that takes its kind. A
 * buff, a debuff, an effect or an event is offered as what a trait applies and as what it relies on, side by side, since the
 * word does not say which; a mechanic or a flag has no role, and `kw:` is the only field that finds it.
 */
const KEYWORD_FIELD_GROUPS: readonly (readonly string[])[] = [['applies', 'uses'], ['kw']];

/** The names of the dataset that are offered for a word with no field: a trait by its name, a family. */
const VOCABULARY_FIELDS: readonly string[] = ['trait', 'family'];

function keywordFieldsFor(kind: KeywordKind, fields: FieldRegistry): FieldDefinition[] {
  for (const names of KEYWORD_FIELD_GROUPS) {
    const taking = names.flatMap((name) => {
      const field = fields.resolve(name);
      return field?.values?.kind === 'keyword' && field.values.accepts(kind) ? [field] : [];
    });
    if (taking.length > 0) return taking;
  }
  return [];
}

function keywordCandidates(typed: string, { fields, taxonomy }: SuggestionEnvironment): Candidate[] {
  return bestFits(taxonomy.entries, typed, ({ key }) => key).flatMap(({ entry, tier }) =>
    keywordFieldsFor(entry.kind, fields).map((field) => valueCandidate(entry.kind, field, field.name, entry.key, tier)),
  );
}

function vocabularyCandidates(typed: string, environment: SuggestionEnvironment): Candidate[] {
  return VOCABULARY_FIELDS.flatMap((name) => {
    const field = environment.fields.resolve(name);
    return field === undefined ? [] : valueCandidates(field, field.name, typed, environment);
  });
}

/**
 * A word with no field, `we` or `"two wo`: it may become a field, and it may be a keyword, a trait, a family, or only the text
 * to look for. Every one is offered, and the ranking puts what the word begins first. The text itself comes last, written back as
 * the lexer needs it (`"and"`), and is always possible: it finds what the word is in. A quote with nothing in it yet offers nothing,
 * and neither does an operator typed whole.
 */
export const freeProvider = suggestionProvider('free', ({ prefix, operator }, environment) => {
  const word = prefix.trim();
  // An operator is not replaced by a term: Tab on `weak OR` must not turn the OR into a trait.
  if (word === '' || operator) return [];
  const typed = prefix.toLowerCase();
  return [
    ...fieldCandidates(environment.fields, typed),
    ...keywordCandidates(typed, environment),
    ...vocabularyCandidates(typed, environment),
    {
      kind: 'text',
      insert: serialiseTerm(undefined, word),
      detail: 'found anywhere in a trait',
      complete: true,
      tier: 'fallback',
    },
  ];
});
