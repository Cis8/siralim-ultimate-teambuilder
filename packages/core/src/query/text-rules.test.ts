import { describe, expect, it } from 'vitest';
import { taxonomy } from '../taxonomy/taxonomy';
import type { QueryDiagnostic } from './diagnostic';
import { fieldRegistry } from './fields';
import { createLintRegistry } from './lint-registry';
import type { LintContext } from './lint-rule';
import { tokenize } from './lexer';
import { textRules } from './text-rules';
import { applyEdit } from './text-edit';

/** The traits the pretend dataset finds for a text; any other text finds none. */
const FOUND: Readonly<Record<string, number>> = {
  weak: 4,
  vulnerable: 8,
  'clutcher bruiser': 1,
  'flesh rot': 1,
  life: 90,
};

const asked: string[] = [];

const context: LintContext = {
  fields: fieldRegistry,
  taxonomy,
  vocabulary: {
    class: ['Chaos', 'Death', 'Life'],
    family: ['Abomination', 'Clutcher'],
    creature: ['Abomination Brute', 'Clutcher Bruiser'],
    name: ['Flesh Rot', 'Last Stand'],
  },
  hits(term) {
    asked.push(`${term.field?.name ?? ''}:${term.value}`);
    return FOUND[term.value.toLowerCase()] ?? 0;
  },
};

const registry = createLintRegistry(textRules);

/** What the rules find in the terms of `source`, in the order of the text. */
function lint(source: string): QueryDiagnostic[] {
  return tokenize(source).flatMap((token) => (token.kind === 'term' ? registry.check(token, context) : []));
}

describe('the rule of a free term in no trait', () => {
  it.each(['', 'weak', 'WEAK', '"flesh rot"', '-weak', '(weak OR life)'])('finds nothing in %j', (source) => {
    expect(lint(source)).toEqual([]);
  });

  it('is a warning that says so, with the closest keyword offered (QUERY_LANGUAGE §5)', () => {
    expect(lint('vulnrable')).toEqual([
      {
        code: 'text-in-no-trait',
        severity: 'warning',
        span: [0, 9],
        message: '“vulnrable” appears in no trait. Did you mean “vulnerable”?',
        fix: { label: 'Change to “vulnerable”', edit: { span: [0, 9], text: 'vulnerable' } },
      },
    ]);
  });

  it('points at the term wherever it stands, and replaces it with the offer', () => {
    const source = '-(life OR vulnrable) weak';
    const [found] = lint(source);

    expect(found?.span).toEqual([10, 19]);
    expect(found?.fix && applyEdit(source, found.fix.edit)).toBe('-(life OR vulnerable) weak');
  });

  it('replaces a phrase with its quotes, and says what was typed as it was typed', () => {
    const [found] = lint('"Vulnrable"');

    expect(found?.message).toBe('“Vulnrable” appears in no trait. Did you mean “vulnerable”?');
    expect(found?.fix?.edit).toEqual({ span: [0, 11], text: 'vulnerable' });
  });

  it('offers the entry of the dataset closest to what was typed, written as the lexer needs it', () => {
    expect(lint('"clutcher bruser"')[0]?.fix?.edit.text).toBe('"Clutcher Bruiser"');
    expect(lint('fleshrot')[0]?.fix?.edit.text).toBe('"Flesh Rot"');
  });

  it('offers nothing when nothing is close, and says so without a fix', () => {
    expect(lint('zzzz')).toEqual([
      { code: 'text-in-no-trait', severity: 'warning', span: [0, 4], message: '“zzzz” appears in no trait' },
    ]);
  });

  it('offers nothing that would find no trait either', () => {
    // "last stand" is a name of the dataset, but the pretend dataset finds no trait for it as text.
    expect(lint('last stnd')[0]?.fix).toBeUndefined();
  });

  it('leaves a term with a field to the rules of the field, known or not', () => {
    expect(lint('clas:zzzz')).toEqual([]);
    expect(lint('desc:zzzz')).toEqual([]);
    expect(lint('class:zzzz')).toEqual([]);
    expect(lint('applies:zzzz')).toEqual([]);
  });

  it('leaves a term with no text to the rule of empty values', () => {
    expect(lint('""')).toEqual([]);
    expect(lint('"')).toEqual([]);
  });

  it('asks the dataset about the term with no field, as it was typed', () => {
    asked.length = 0;
    lint('weak clas:zzzz');

    expect(asked).toEqual([':weak']);
  });
});
