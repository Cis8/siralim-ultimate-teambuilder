import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createFieldRegistry } from '../query/field-registry';
import { fieldRegistry } from '../query/fields';
import { suggestionContext, type SuggestionContext } from './context';

/** `‸` marks the caret in the text of a case; it is not part of the query. */
const CARET = '‸';

function contextAt(marked: string): { source: string; caret: number; context: SuggestionContext } {
  const caret = marked.indexOf(CARET);
  if (caret < 0) throw new Error(`${JSON.stringify(marked)} has no caret`);
  const source = marked.replace(CARET, '');
  return { source, caret, context: suggestionContext(source, caret) };
}

/** The text that accepting a suggestion would take out. */
function replacedIn(marked: string): string {
  const { source, context } = contextAt(marked);
  return source.slice(...context.replace);
}

const field = (name: string) => {
  const found = fieldRegistry.resolve(name);
  if (found === undefined) throw new Error(`no field ${name}`);
  return found;
};

describe('suggestionContext', () => {
  describe('where no word is being typed', () => {
    it.each([
      // Nothing before, or something that asks for a term next.
      ['‸'],
      ['   ‸  '],
      ['(‸'],
      ['(‸weak)'],
      ['‸weak'],
      ['‸"two words"'],
      ['-‸'],
      ['weak -‸'],
      ['weak - ‸'],
      ['weak --‸'],
      ['weak OR ‸'],
      ['weak or ‸'],
      ['weak | ‸'],
      ['weak AND ‸'],
      ['weak & ‸'],
      ['NOT ‸'],
      ['(weak OR ‸'],
    ])('offers fields in %j', (marked) => {
      const { caret, context } = contextAt(marked);

      expect(context).toEqual({ kind: 'field', replace: [caret, caret] });
    });

    it.each([
      // Something that is a term already: an operator may follow.
      ['weak ‸'],
      ['weak ‸ snared'],
      ['weak ‸snared'],
      ['class:life ‸'],
      ['"two words" ‸'],
      ['"two words"  ‸ -stack:no'],
      ['(weak) ‸'],
      ['(weak)‸'],
      ['(weak OR snared) ‸'],
      ['-weak ‸'],
    ])('offers operators and fields in %j', (marked) => {
      const { caret, context } = contextAt(marked);

      expect(context).toEqual({ kind: 'operator-or-field', replace: [caret, caret] });
    });
  });

  describe('a word being typed', () => {
    it.each([
      ['weak‸', 'weak', 'weak'],
      ['we‸ak', 'weak', 'we'],
      ['weak snar‸', 'snar', 'snar'],
      ['weak sn‸ared OR life', 'snared', 'sn'],
      ['(we‸', 'we', 'we'],
      ['(weak OR sn‸)', 'sn', 'sn'],
      ['well-kn‸own', 'well-known', 'well-kn'],
      ['a|b‸', 'a|b', 'a|b'],
    ])('is %j: the word whole is replaced, the prefix is what is before the caret', (marked, replaced, prefix) => {
      const { context } = contextAt(marked);

      expect(context).toMatchObject({ kind: 'free', prefix });
      expect(replacedIn(marked)).toBe(replaced);
    });

    it.each([
      ['-we‸', 'we', 'we'],
      ['--we‸ak', 'weak', 'we'],
      ['- we‸', 'we', 'we'],
      ['NOT we‸', 'we', 'we'],
      ['(-we‸', 'we', 'we'],
    ])('leaves the negation of %j alone: it is not part of what is replaced', (marked, replaced, prefix) => {
      const { context } = contextAt(marked);

      expect(context).toMatchObject({ kind: 'free', prefix });
      expect(replacedIn(marked)).toBe(replaced);
    });

    it.each([
      ['weak or‸', 'or', 'or'],
      ['weak O‸R', 'OR', 'O'],
      ['weak NOT‸', 'NOT', 'NOT'],
      ['weak AND‸ snared', 'AND', 'AND'],
      ['weak |‸', '|', '|'],
    ])(
      'takes an operator with the caret at its end or in it (%j) for a word that is not finished',
      (marked, replaced, prefix) => {
        const { context } = contextAt(marked);

        expect(context).toMatchObject({ kind: 'free', prefix });
        expect(replacedIn(marked)).toBe(replaced);
      },
    );

    it.each([
      ['cla‸ss:life', 'class:life', 'cla'],
      ['class‸:life', 'class:life', 'class'],
      ['-cl‸ass:', 'class:', 'cl'],
    ])('is the letters typed when the caret is in the name of a field (%j)', (marked, replaced, prefix) => {
      const { context } = contextAt(marked);

      expect(context).toMatchObject({ kind: 'free', prefix });
      expect(replacedIn(marked)).toBe(replaced);
    });

    it('is not a field without its colon, and a slash is just text', () => {
      expect(contextAt('weak/‸').context).toMatchObject({ kind: 'free', prefix: 'weak/' });
      expect(contextAt('class‸').context).toMatchObject({ kind: 'free', prefix: 'class' });
    });
  });

  describe('a phrase', () => {
    it.each([
      ['"two wo‸', '"two wo', 'two wo'],
      ['"two wo‸rds"', '"two words"', 'two wo'],
      ['"two words"‸', '"two words"', 'two words'],
      ['"‸', '"', ''],
      ['"‸"', '""', ''],
      ['" two‸"', '" two"', 'two'],
      ['"two ‸', '"two ', 'two '],
      ['weak OR "two wo‸', '"two wo', 'two wo'],
      // The lexer reads an open quote to the end of the text, parentheses included.
      ['"two wo‸) weak', '"two wo) weak', 'two wo'],
    ])('is a word typed without its quotes, with its blanks at the end (%j)', (marked, replaced, prefix) => {
      const { context } = contextAt(marked);

      expect(context).toMatchObject({ kind: 'free', prefix });
      expect(replacedIn(marked)).toBe(replaced);
    });
  });

  describe('a field and its value', () => {
    it.each([
      ['class:‸', 'class:', 'class', 'class', ''],
      ['Class:li‸fe', 'Class:life', 'class', 'Class', 'li'],
      ['a:vul‸', 'a:vul', 'applies', 'a', 'vul'],
      ['-mat:y‸', 'mat:y', 'mat', 'mat', 'y'],
      ['desc:fo‸o', 'desc:foo', 'desc', 'desc', 'fo'],
      ['weak (cr:clu‸', 'cr:clu', 'creature', 'cr', 'clu'],
      ['class:"two wo‸', 'class:"two wo', 'class', 'class', 'two wo'],
      ['class:"two words"‸', 'class:"two words"', 'class', 'class', 'two words'],
      ['class:‸"two words"', 'class:"two words"', 'class', 'class', ''],
      ['t:" fl‸', 't:" fl', 'trait', 't', 'fl'],
      // Only a keyword field has an actor: elsewhere a slash is part of the value.
      ['class:a/b‸', 'class:a/b', 'class', 'class', 'a/b'],
      ['mat:yes/‸', 'mat:yes/', 'mat', 'mat', 'yes/'],
      // The caret before the slash is still in the key.
      ['uses:att‸ack/self', 'uses:attack/self', 'uses', 'uses', 'att'],
    ])('is the value typed so far (%j)', (marked, replaced, name, written, prefix) => {
      const { context } = contextAt(marked);

      expect(context).toEqual({
        kind: 'field-value',
        replace: context.replace,
        field: field(name),
        written,
        prefix,
      });
      expect(replacedIn(marked)).toBe(replaced);
    });
  });

  describe('who acts', () => {
    it.each([
      ['uses:attack/‸', 'uses:attack/', 'uses', 'uses', 'attack', ''],
      ['uses:attack/se‸', 'uses:attack/se', 'uses', 'uses', 'attack', 'se'],
      ['kw:attack/s‸elf', 'kw:attack/self', 'kw', 'kw', 'attack', 's'],
      ['-A:death/an‸', 'A:death/an', 'applies', 'A', 'death', 'an'],
      ['U:"start of turn/e‸', 'U:"start of turn/e', 'uses', 'U', 'start of turn', 'e'],
      ['uses:"attack / se‸"', 'uses:"attack / se"', 'uses', 'uses', 'attack', 'se'],
      ['uses:/‸', 'uses:/', 'uses', 'uses', '', ''],
      ['uses:weak/‸', 'uses:weak/', 'uses', 'uses', 'weak', ''],
    ])('is the word after the slash of a keyword field (%j)', (marked, replaced, name, written, key, prefix) => {
      const { context } = contextAt(marked);

      expect(context).toEqual({
        kind: 'actor',
        replace: context.replace,
        field: field(name),
        written,
        key,
        prefix,
      });
      expect(replacedIn(marked)).toBe(replaced);
    });
  });

  describe('an unknown field', () => {
    it.each([
      ['clas:‸', 'clas:', 'clas'],
      ['clas:li‸fe', 'clas:', 'clas'],
      ['-FIEL:x‸', 'FIEL:', 'FIEL'],
      ['weak (uze:att‸', 'uze:', 'uze'],
      ['clas:"two wo‸', 'clas:', 'clas'],
    ])(
      'is named for the closest field to offer, and only its name and colon are replaced (%j)',
      (marked, replaced, written) => {
        const { context } = contextAt(marked);

        expect(context).toMatchObject({ kind: 'unknown-field', written });
        expect(replacedIn(marked)).toBe(replaced);
      },
    );

    it('is a field of the registry it is asked with, and an unknown one in another', () => {
      const withoutClass = createFieldRegistry(
        fieldRegistry.fields.filter(({ name }) => name !== 'class'),
        () => () => true,
      );

      expect(suggestionContext('class:li', 8).kind).toBe('field-value');
      expect(suggestionContext('class:li', 8, withoutClass).kind).toBe('unknown-field');
    });
  });

  describe('the caret', () => {
    it('is kept inside the text', () => {
      expect(suggestionContext('weak', 99)).toEqual(suggestionContext('weak', 4));
      expect(suggestionContext('weak', -3)).toEqual(suggestionContext('weak', 0));
      expect(suggestionContext('', 5)).toEqual({ kind: 'field', replace: [0, 0] });
    });

    it('counts UTF-16 units, as every span of the query does', () => {
      expect(contextAt('😀 we‸').context).toMatchObject({ kind: 'free', prefix: 'we', replace: [3, 5] });
    });
  });

  describe('for any text and any caret', () => {
    const pieces = fc.constantFrom(
      'weak',
      'class:',
      'uses:',
      'a:',
      'u:',
      'clas:',
      '/',
      ':',
      ' ',
      '  ',
      '"',
      '(',
      ')',
      '-',
      '|',
      '&',
      'OR',
      'AND',
      'NOT',
      'é',
      '😀',
    );
    const text = fc.array(pieces, { maxLength: 14 }).map((parts) => parts.join(''));
    const anyCaret = fc.integer({ min: -3, max: 60 });

    it('never throws, and replaces a span of the text', () => {
      fc.assert(
        fc.property(text, anyCaret, (source, caret) => {
          const [start, end] = suggestionContext(source, caret).replace;

          expect(0 <= start && start <= end && end <= source.length).toBe(true);
        }),
      );
    });

    it('replaces the word the caret is in or at the end of, or nothing, at the caret', () => {
      fc.assert(
        fc.property(text, anyCaret, (source, caret) => {
          const at = Math.min(Math.max(caret, 0), source.length);
          const {
            kind,
            replace: [start, end],
          } = suggestionContext(source, caret);

          if (kind === 'field' || kind === 'operator-or-field') expect([start, end]).toEqual([at, at]);
          else if (kind === 'unknown-field') expect(start < end && end <= at).toBe(true);
          else expect(start < at && at <= end).toBe(true);
        }),
      );
    });

    it('has a prefix no longer than what stands before the caret in the word', () => {
      fc.assert(
        fc.property(text, anyCaret, (source, caret) => {
          const at = Math.min(Math.max(caret, 0), source.length);
          const context = suggestionContext(source, caret);

          if ('prefix' in context) expect(context.prefix.length).toBeLessThanOrEqual(at - context.replace[0]);
        }),
      );
    });
  });
});
