import { KEYWORD_ACTORS } from '../model/trait';
import type { FieldDefinition } from '../query/field';
import { serialiseTerm } from '../query/serialise';
import { canHaveActor } from '../taxonomy/entry';
import { bestFits } from './best-fits';
import type { FitTier } from './match-tier';
import { KIND_OF_COLUMN, type Candidate, type SuggestionKind } from './suggestion';
import { suggestionProvider, type SuggestionEnvironment } from './suggestion-registry';

/**
 * A finished term: `value` written after the field as the person wrote its name (`a`, `Class`), in quotes only where the lexer
 * needs them, and what the term means in words.
 */
export function valueCandidate(
  kind: SuggestionKind,
  field: FieldDefinition,
  written: string,
  value: string,
  tier: FitTier,
): Candidate {
  return { kind, insert: serialiseTerm(written, value), detail: field.describe(value), complete: true, tier };
}

/**
 * What the field takes after its colon that the letters typed fit, read from the one description of its values the evaluation
 * and the lint read too (`FieldDefinition.values`): a short list, a column of the dataset, or the keys of the keywords of the
 * kinds it takes. Nothing for a field whose value is text. `typed` is lower case.
 */
export function valueCandidates(
  field: FieldDefinition,
  written: string,
  typed: string,
  { taxonomy, vocabulary }: SuggestionEnvironment,
): Candidate[] {
  const domain = field.values;
  switch (domain?.kind) {
    case undefined:
      return [];
    case 'choices':
      return bestFits(domain.choices, typed, ({ value }) => value).map(({ entry, tier }) =>
        valueCandidate('value', field, written, entry.value, tier),
      );
    case 'vocabulary':
      return bestFits(vocabulary[domain.column], typed, (entry) => entry.toLowerCase()).map(({ entry, tier }) =>
        valueCandidate(KIND_OF_COLUMN[domain.column], field, written, entry, tier),
      );
    case 'keyword':
      return bestFits(
        taxonomy.entries.filter(({ kind }) => domain.accepts(kind)),
        typed,
        ({ key }) => key,
      ).map(({ entry, tier }) => valueCandidate(entry.kind, field, written, entry.key, tier));
  }
}

/** After the colon of a field the registry knows: what the field takes, that the letters typed fit. */
export const fieldValueProvider = suggestionProvider('field-value', ({ field, written, prefix }, environment) =>
  valueCandidates(field, written, prefix.toLowerCase(), environment),
);

/**
 * After the slash of a keyword: who acts, for an event. Nobody does a buff, a debuff, an effect, a mechanic or a flag, nor starts
 * a battle, so there are no actors to offer after those (the lint rule `keyword-without-actor` says the same). The key is read as
 * the search reads it, the start of a key, so `start/` offers them because `start of turn` has an actor.
 */
export const actorProvider = suggestionProvider('actor', ({ field, written, key, prefix }, { taxonomy }) => {
  const domain = field.values;
  if (domain?.kind !== 'keyword') return [];
  const start = key.toLowerCase();
  const someoneActs = taxonomy.entries.some(
    (entry) => domain.accepts(entry.kind) && canHaveActor(entry) && entry.key.startsWith(start),
  );
  if (!someoneActs) return [];
  return bestFits(KEYWORD_ACTORS, prefix.toLowerCase(), (actor) => actor).map(({ entry: actor, tier }) =>
    valueCandidate('actor', field, written, `${key}/${actor}`, tier),
  );
});
