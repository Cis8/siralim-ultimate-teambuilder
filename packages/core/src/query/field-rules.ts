import { closestMatch } from './closest-match';
import type { DiagnosticFix, DiagnosticSeverity } from './diagnostic';
import { fitsValue, type ValueDomain, type VocabularyColumn } from './field';
import type { FieldRegistry } from './field-registry';
import type { LintRule } from './lint-rule';
import { serialiseTerm } from './serialise';
import type { Span } from './span';
import type { FieldName, TermToken } from './token';

const quoted = (text: string): string => `“${text}”`;

/** `a`, `a or b`, `a, b or c`. */
const listOf = (words: readonly string[]): string =>
  words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} or ${words.at(-1) ?? ''}`;

/** The button that puts `text` in place of `span`; `shown` is what it says the text is. */
const changeTo = (span: Span, text: string, shown: string): DiagnosticFix => ({
  label: `Change to ${quoted(shown)}`,
  edit: { span, text },
});

/** `value` as the lexer needs it after `field:`: in quotes only where it must be (`Rodian Master`). */
const writtenValue = (field: string, value: string): string => serialiseTerm(field, value).slice(field.length + 1);

/**
 * The field a term names as written, when the registry knows it, and where its values come from (`desc:` has no list).
 * Nothing for a term with no value yet: that is for the rule of empty values.
 */
function valuedField(
  term: TermToken,
  fields: FieldRegistry,
): { readonly field: FieldName; readonly domain: ValueDomain | undefined } | undefined {
  const { field } = term;
  if (field === undefined || term.value === '') return undefined;
  const definition = fields.resolve(field.name);
  return definition === undefined ? undefined : { field, domain: definition.values };
}

/** `clas:life`: a field nobody knows is looked for as text, so the person gets no filter they meant to have. */
const unknownField: LintRule = {
  id: 'unknown-field',
  check({ field }, { fields }) {
    if (field === undefined || fields.resolve(field.name) !== undefined) return undefined;
    const message = `Unknown field ${quoted(`${field.name}:`)}`;
    const spellings = fields.fields.flatMap(({ name, aliases }) => [name, ...aliases]);
    const suggestion = closestMatch(field.name, spellings);
    if (suggestion === undefined) return { severity: 'error', span: field.span, message };
    return {
      severity: 'error',
      span: field.span,
      message: `${message}. Did you mean ${quoted(`${suggestion}:`)}?`,
      fix: changeTo(field.span, suggestion, `${suggestion}:`),
    };
  },
};

/** `applies:` finds every trait, so that the results do not empty while the query is typed; the person is told it asks nothing yet. */
const emptyValue: LintRule = {
  id: 'empty-value',
  check({ field, value, quote, span }, { fields }) {
    if (value !== '') return undefined;
    if (field === undefined) {
      // A quote still open is a phrase being typed; one closed on nothing finds every trait.
      return quote === 'closed' ? { severity: 'warning', span, message: 'Nothing between the quotes' } : undefined;
    }
    return fields.resolve(field.name) === undefined
      ? undefined
      : { severity: 'warning', span, message: `${quoted(`${field.name}:`)} has no value yet` };
  },
};

/** `mat:maybe`: a field of a short list takes nothing else, and finds no trait for anything else. */
const invalidChoice: LintRule = {
  id: 'invalid-choice',
  check(term, { fields }) {
    const named = valuedField(term, fields);
    const domain = named?.domain;
    if (named === undefined || domain?.kind !== 'choices') return undefined;
    const value = term.value.toLowerCase();
    if (domain.choices.some((choice) => [choice.value, ...choice.aliases].includes(value))) return undefined;

    const values = domain.choices.map((choice) => choice.value);
    const suggestion = closestMatch(value, values);
    return {
      severity: 'error',
      span: term.valueSpan,
      message: `${quoted(`${named.field.name}:`)} takes ${listOf(values)}`,
      ...(suggestion === undefined ? {} : { fix: changeTo(term.valueSpan, suggestion, suggestion) }),
    };
  },
};

/** How a value of each list of the dataset is told about when no entry has it. D21: only a class is certain enough to be an error. */
const UNKNOWN_ENTRY = {
  class: { id: 'unknown-class', noun: 'class', severity: 'error' },
  family: { id: 'unknown-family', noun: 'family', severity: 'warning' },
  creature: { id: 'unknown-creature', noun: 'creature', severity: 'warning' },
  name: { id: 'unknown-trait', noun: 'trait', severity: 'warning' },
} as const satisfies Record<VocabularyColumn, { id: string; noun: string; severity: DiagnosticSeverity }>;

/** `class:lfe`: no entry of the column has the value, in the way the field compares them, so the search finds nothing. */
function unknownEntry(column: VocabularyColumn): LintRule {
  const { id, noun, severity } = UNKNOWN_ENTRY[column];
  return {
    id,
    check(term, { fields, vocabulary }) {
      const named = valuedField(term, fields);
      const domain = named?.domain;
      if (named === undefined || domain?.kind !== 'vocabulary' || domain.column !== column) return undefined;
      const entries = vocabulary[column];
      const value = term.value.toLowerCase();
      if (entries.some((entry) => fitsValue(domain.mode, entry.toLowerCase(), value))) return undefined;

      const message = `No ${noun} ${quoted(term.value)}`;
      const suggestion = closestMatch(term.value, entries);
      if (suggestion === undefined) return { severity, span: term.valueSpan, message };
      return {
        severity,
        span: term.valueSpan,
        message: `${message}. Did you mean ${suggestion}?`,
        fix: changeTo(term.valueSpan, writtenValue(named.field.name, suggestion), suggestion),
      };
    },
  };
}

/** The rules about a field and its value (QUERY_LANGUAGE §5). */
export const fieldRules: readonly LintRule[] = [
  unknownField,
  emptyValue,
  invalidChoice,
  unknownEntry('class'),
  unknownEntry('family'),
  unknownEntry('creature'),
  unknownEntry('name'),
];
