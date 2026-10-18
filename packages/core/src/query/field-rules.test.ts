import { describe, expect, it } from 'vitest';
import { taxonomy } from '../taxonomy/taxonomy';
import type { QueryDiagnostic } from './diagnostic';
import { fieldRules } from './field-rules';
import { fieldRegistry } from './fields';
import { createLintRegistry } from './lint-registry';
import type { LintContext } from './lint-rule';
import { tokenize } from './lexer';
import { applyEdit } from './text-edit';

const context: LintContext = {
  fields: fieldRegistry,
  taxonomy,
  vocabulary: {
    class: ['Chaos', 'Death', 'Life', 'Nature', 'Rodian Master', 'Sorcery'],
    family: ['Abomination', 'Clutcher', 'Zombie'],
    creature: ['Abomination Brute', 'Clutcher Bruiser'],
    name: ['Flesh Rot', 'Last Stand'],
  },
  // These rules read the vocabulary: what the dataset finds is for the rules of free text.
  hits: () => {
    throw new Error('A field rule does not count hits');
  },
};

const registry = createLintRegistry(fieldRules);

/** What the rules find in the terms of `source`, in the order of the text. */
function lint(source: string): QueryDiagnostic[] {
  return tokenize(source).flatMap((token) => (token.kind === 'term' ? registry.check(token, context) : []));
}

const codes = (source: string): string[] => lint(source).map(({ code }) => code);

/** The text after the one fix that `source` has is made. */
function fixed(source: string): string {
  const [only, ...others] = lint(source);
  if (only?.fix === undefined || others.length > 0) throw new Error(`${JSON.stringify(source)} has not one fix`);
  return applyEdit(source, only.fix.edit);
}

describe('the field and value rules', () => {
  it.each([
    '',
    'weak',
    '"two words"',
    'class:life',
    'C:Life',
    'FAMILY:clutcher',
    'cr:"abomination brute"',
    't:"flesh rot"',
    'desc:anything at all',
    'applies:whatever',
    'mat:yes',
    'stack:no',
    '-(weak OR class:death) "clas:life"',
  ])('finds nothing in %j', (source) => {
    expect(lint(source)).toEqual([]);
  });

  describe('unknown-field', () => {
    it('is an error with the closest field offered (QUERY_LANGUAGE §5)', () => {
      expect(lint('clas:life')).toEqual([
        {
          code: 'unknown-field',
          severity: 'error',
          span: [0, 4],
          message: 'Unknown field “clas:”. Did you mean “class:”?',
          fix: { label: 'Change to “class:”', edit: { span: [0, 4], text: 'class' } },
        },
      ]);
    });

    it('points at the name of the field only, wherever it stands', () => {
      const [found] = lint('-(weak OR clas:life)');

      expect(found?.span).toEqual([10, 14]);
      expect(fixed('-(weak OR clas:life)')).toBe('-(weak OR class:life)');
    });

    it('says the field as it was written, and offers it in the case of the registry', () => {
      expect(lint('CLAS:life')[0]?.message).toBe('Unknown field “CLAS:”. Did you mean “class:”?');
      expect(fixed('CLAS:life')).toBe('class:life');
    });

    it('mends the name and keeps the value as typed, quotes too', () => {
      expect(fixed('creatur:"Abomination Brute"')).toBe('creature:"Abomination Brute"');
      expect(fixed('clas:')).toBe('class:');
    });

    it.each([
      ['famly:clutcher', 'family'],
      ['classs:life', 'class'],
      ['aplies:weak', 'applies'],
      ['fm:clutcher', 'fam'],
      ['use:weak', 'uses'],
    ])('offers the closest spelling for %s: %s', (source, field) => {
      expect(fixed(source).startsWith(`${field}:`)).toBe(true);
    });

    it('offers nothing when no field is close, and says so without a fix', () => {
      expect(lint('zzzz:life')).toEqual([
        { code: 'unknown-field', severity: 'error', span: [0, 4], message: 'Unknown field “zzzz:”' },
      ]);
    });

    it('lints clean after its fix', () => {
      for (const source of ['clas:life', 'famly:"a b"', 'Aplies:weak OR uses:x']) {
        expect(lint(fixed(source)).filter(({ code }) => code === 'unknown-field')).toEqual([]);
      }
    });

    it('reports an unknown field once, not again as an empty or unknown value', () => {
      expect(codes('clas:')).toEqual(['unknown-field']);
      expect(codes('mta:maybe')).toEqual(['unknown-field']);
      expect(codes('clas:zzz')).toEqual(['unknown-field']);
    });
  });

  describe('empty-value', () => {
    it('is a warning with no fix: nothing says what the value should be (QUERY_LANGUAGE §5)', () => {
      expect(lint('applies:')).toEqual([
        { code: 'empty-value', severity: 'warning', span: [0, 8], message: '“applies:” has no value yet' },
      ]);
    });

    it.each([
      ['class:""', [0, 8]],
      ['kw:" "', [0, 6]],
      ['mat:', [0, 4]],
      ['-(stack: OR x)', [2, 8]],
    ])('finds the field with no text to look for in %j', (source, span) => {
      expect(lint(source).map(({ code, span: at }) => [code, at])).toEqual([['empty-value', span]]);
    });

    it('says the field as it was written', () => {
      expect(lint('A:')[0]?.message).toBe('“A:” has no value yet');
    });

    it('is the only finding of a field whose value is empty, whatever the value would have to be', () => {
      expect(codes('class:')).toEqual(['empty-value']);
      expect(codes('mat:')).toEqual(['empty-value']);
    });

    it('warns of an empty phrase, which finds every trait, and not of a quote still open', () => {
      expect(lint('""')).toEqual([
        { code: 'empty-value', severity: 'warning', span: [0, 2], message: 'Nothing between the quotes' },
      ]);
      expect(lint('"')).toEqual([]);
    });
  });

  describe('invalid-choice', () => {
    it('is an error that says what the field takes (QUERY_LANGUAGE §5)', () => {
      expect(lint('mat:maybe')).toEqual([
        { code: 'invalid-choice', severity: 'error', span: [4, 9], message: '“mat:” takes yes or no' },
      ]);
      expect(lint('stack:nope')[0]?.message).toBe('“stack:” takes yes or no');
    });

    it('points at the value, quotes included, and says the field as it was written', () => {
      const [found] = lint('MAT:"maybe"');

      expect(found?.span).toEqual([4, 11]);
      expect(found?.message).toBe('“MAT:” takes yes or no');
    });

    it('offers the closest of the values, never one of the other spellings', () => {
      expect(lint('mat:non')[0]?.fix).toEqual({ label: 'Change to “no”', edit: { span: [4, 7], text: 'no' } });
      expect(fixed('stack:yess')).toBe('stack:yes');
      expect(fixed('mat:"yse"')).toBe('mat:yes');
    });

    it('lints clean after its fix', () => {
      for (const source of ['mat:non', 'stack:yess', 'mat:"yse"']) {
        expect(lint(fixed(source))).toEqual([]);
      }
    });

    it.each(['mat:yes', 'mat:no', 'mat:none', 'MAT:NONE', 'stack:yes', 'stack:No', 'mat:"none"'])(
      'accepts %j under every spelling of a value',
      (source) => {
        expect(lint(source)).toEqual([]);
      },
    );

    it('knows the spellings of the field it is asked about: none is a mat: value, not a stack: one', () => {
      expect(codes('stack:none')).toEqual(['invalid-choice']);
    });

    it.each(['mat:y', 'mat:true', 'mat:constructor', 'stack:__proto__'])('rejects %j', (source) => {
      expect(codes(source)).toEqual(['invalid-choice']);
    });
  });

  describe('a value of a list of the dataset', () => {
    it('is an error for a class (QUERY_LANGUAGE §5)', () => {
      expect(lint('class:lfe')).toEqual([
        {
          code: 'unknown-class',
          severity: 'error',
          span: [6, 9],
          message: 'No class “lfe”. Did you mean Life?',
          fix: { label: 'Change to “Life”', edit: { span: [6, 9], text: 'Life' } },
        },
      ]);
    });

    it.each([
      ['family:clutchr', 'unknown-family', 'No family “clutchr”. Did you mean Clutcher?', 'Clutcher'],
      [
        'creature:"clutcher bruser"',
        'unknown-creature',
        'No creature “clutcher bruser”. Did you mean Clutcher Bruiser?',
        'Clutcher Bruiser',
      ],
      ['trait:"flesh rotz"', 'unknown-trait', 'No trait “flesh rotz”. Did you mean Flesh Rot?', 'Flesh Rot'],
    ])('is a warning for %s (D21)', (source, code, message, entry) => {
      const [found] = lint(source);

      expect(found).toMatchObject({ code, severity: 'warning', message });
      expect(found?.fix?.edit.text).toBe(entry.includes(' ') ? `"${entry}"` : entry);
    });

    it('says what was typed, as it was typed, and offers the entry as the dataset spells it', () => {
      expect(lint('CLASS:LFE')[0]?.message).toBe('No class “LFE”. Did you mean Life?');
    });

    it('leaves out the offer when no entry is close, and gives no fix', () => {
      expect(lint('class:zzz')).toEqual([
        { code: 'unknown-class', severity: 'error', span: [6, 9], message: 'No class “zzz”' },
      ]);
      expect(lint('family:zzz')[0]?.message).toBe('No family “zzz”');
    });

    it('reads the field under every spelling', () => {
      expect(codes('c:lfe')).toEqual(['unknown-class']);
      expect(codes('fam:clutchr')).toEqual(['unknown-family']);
      expect(codes('cr:"clutcher bruser"')).toEqual(['unknown-creature']);
      expect(codes('t:"flesh rotz"')).toEqual(['unknown-trait']);
    });

    it('writes an entry of several words in quotes, over the quotes it replaces', () => {
      const [found] = lint('class:"rodian mastr"');

      expect(found?.message).toBe('No class “rodian mastr”. Did you mean Rodian Master?');
      expect(found?.span).toEqual([6, 20]);
      expect(fixed('class:"rodian mastr"')).toBe('class:"Rodian Master"');
      expect(fixed('class:rodian-mastr')).toBe('class:"Rodian Master"');
    });

    it('finds the entry by any part of it, as the search does, so a part is no fault', () => {
      expect(lint('class:lif')).toEqual([]);
      expect(lint('class:IFE')).toEqual([]);
      expect(lint('class:"dian ma"')).toEqual([]);
      expect(lint('creature:"ion bru"')).toEqual([]);
    });

    it('takes every part of every entry as known, and an entry with a letter added as unknown', () => {
      for (const field of fieldRegistry.fields) {
        if (field.values?.kind !== 'vocabulary') continue;
        for (const entry of context.vocabulary[field.values.column]) {
          const text = entry.toLowerCase();
          for (let start = 0; start < text.length; start += 1) {
            for (let end = start + 1; end <= text.length; end += 1) {
              const part = text.slice(start, end);
              // A part that is only blanks is no value at all: that is for the rule of empty values.
              if (part.trim() !== '') expect(lint(`${field.name}:"${part}"`), `${field.name}:${part}`).toEqual([]);
            }
          }
          expect(codes(`${field.name}:"${text}z"`), `${field.name}:${text}z`).toHaveLength(1);
        }
      }
    });

    it('lints clean after its fix', () => {
      for (const source of [
        'class:lfe',
        'family:clutchr',
        'cr:"clutcher bruser"',
        'trait:"flesh rotz"',
        'class:"rodian mastr"',
      ]) {
        expect(lint(fixed(source)), source).toEqual([]);
      }
    });

    it('has nothing to say of a field with no value yet: that is for the rule of empty values', () => {
      expect(codes('class:')).not.toContain('unknown-class');
      expect(codes('class:""')).not.toContain('unknown-class');
    });

    it('does not look at the description, whose words are not a list', () => {
      expect(lint('desc:zzz')).toEqual([]);
    });
  });
});
