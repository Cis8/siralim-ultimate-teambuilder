import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { insertAtCaret, SYNTAX_INSERTION_IDS, type SyntaxInsertionId } from './insert-at-caret';
import { tokenize } from './lexer';
import type { Span } from './span';
import { applyEdit } from './text-edit';

/** Marks the caret with `|` (and a selection with `[` `]`) in a text, as the tests below write them. */
function parse(marked: string): { source: string; selection: Span } {
  const open = marked.indexOf('[');
  if (open >= 0) {
    const close = marked.indexOf(']');
    const source = marked.slice(0, open) + marked.slice(open + 1, close) + marked.slice(close + 1);
    return { source, selection: [open, close - 1] };
  }
  const caret = marked.indexOf('|');
  return { source: marked.slice(0, caret) + marked.slice(caret + 1), selection: [caret, caret] };
}

/** What the person is left with after pressing the button: the text, with the caret marked. */
function press(marked: string, id: SyntaxInsertionId): string {
  const { source, selection } = parse(marked);
  const { edit, caret } = insertAtCaret(source, selection, id);
  const text = applyEdit(source, edit);
  return `${text.slice(0, caret)}|${text.slice(caret)}`;
}

const WORD_IDS = ['or', 'and', 'not', 'applies', 'material'] as const satisfies readonly SyntaxInsertionId[];

describe('insertAtCaret', () => {
  describe('the blank before', () => {
    it('is added after a word, a closing parenthesis and a closing quote, which the new word would run into', () => {
      expect(press('weak|', 'or')).toBe('weak OR |');
      expect(press('(weak)|', 'and')).toBe('(weak) AND |');
      expect(press('"two words"|', 'not')).toBe('"two words" -|');
    });

    it('is not added at the start of the text, after a blank, after an opening parenthesis or after a negation', () => {
      expect(press('|', 'or')).toBe('OR |');
      expect(press('weak |', 'or')).toBe('weak OR |');
      expect(press('(|', 'applies')).toBe('(applies:|');
      expect(press('-|', 'open-group')).toBe('-(|');
    });

    it('is added after a colon, where the word would become the value of a field with no value, but not for a quote', () => {
      expect(press('class:|', 'material')).toBe('class: mat:yes |');
      expect(press('class:|', 'quote')).toBe('class:"|"');
    });

    it('is never added before a closing parenthesis', () => {
      expect(press('(weak|', 'close-group')).toBe('(weak)|');
      expect(press('weak OR |', 'close-group')).toBe('weak OR )|');
    });
  });

  describe('the blank after', () => {
    it('follows an operator and a finished term, so that the next word starts from there', () => {
      expect(press('weak|', 'or')).toBe('weak OR |');
      expect(press('weak|', 'and')).toBe('weak AND |');
      expect(press('weak|', 'material')).toBe('weak mat:yes |');
    });

    it('is not added when a blank follows already, and the caret steps over it', () => {
      expect(press('weak| snared', 'or')).toBe('weak OR |snared');
      expect(press('weak|\tsnared', 'material')).toBe('weak mat:yes\t|snared');
    });

    it('is not added after what leaves the word to be typed: an opening parenthesis, a negation, a field, a quote', () => {
      expect(press('|', 'open-group')).toBe('(|');
      expect(press('weak|', 'not')).toBe('weak -|');
      expect(press('|', 'uses')).toBe('uses:|');
      expect(press('weak|', 'class')).toBe('weak class:|');
    });
  });

  describe('the quote', () => {
    it('writes a pair and puts the caret between, so that the phrase is never left open', () => {
      expect(press('|', 'quote')).toBe('"|"');
      expect(press('weak|', 'quote')).toBe('weak "|"');
      expect(press('weak |', 'quote')).toBe('weak "|"');
      expect(press('-|', 'quote')).toBe('-"|"');
    });

    it('closes a phrase that is open before the caret instead of opening another', () => {
      expect(press('"start of battle|', 'quote')).toBe('"start of battle"|');
      expect(press('kw:"start of|', 'quote')).toBe('kw:"start of"|');
      expect(press('"|', 'quote')).toBe('""|');
    });

    it('opens a new phrase after one that is closed', () => {
      expect(press('"a b"|', 'quote')).toBe('"a b" "|"');
      expect(press('"a b" |', 'quote')).toBe('"a b" "|"');
    });

    it('does not take a phrase that starts after the caret for one that the caret is in', () => {
      expect(press('|"abc', 'quote')).toBe('"|""abc');
    });

    it('wraps a selection even where a phrase is open, as it does anywhere else', () => {
      expect(press('"two [wo]rds', 'quote')).toBe('"two "wo"|rds');
    });

    it('puts a selection inside the quotes', () => {
      expect(press('[start of battle]', 'quote')).toBe('"start of battle"|');
      expect(press('weak [start of battle] x', 'quote')).toBe('weak "start of battle"| x');
    });
  });

  describe('a selection', () => {
    it('is replaced by what is inserted, as typing over it does', () => {
      expect(press('[weak]', 'applies')).toBe('applies:|');
      expect(press('a [weak] b', 'or')).toBe('a OR |b');
      expect(press('a[ weak] b', 'not')).toBe('a -| b');
    });

    it('decides the blanks from the text around it and not from the text it hides', () => {
      expect(press('weak[ snared]', 'or')).toBe('weak OR |');
      expect(press('(a[b])', 'or')).toBe('(a OR |)');
    });
  });

  describe('the edit', () => {
    it('is a text edit of the selection and leaves every other character as it was', () => {
      const { edit } = insertAtCaret('weak snared', [4, 5], 'or');
      expect(edit.span).toEqual([4, 5]);
      expect(applyEdit('weak snared', edit)).toBe('weak OR snared');
    });

    it('keeps a selection inside the text, in order, whatever it is given', () => {
      expect(press('weak|', 'or')).toBe('weak OR |');
      const past = insertAtCaret('weak', [10, 20], 'or');
      expect(applyEdit('weak', past.edit)).toBe('weak OR ');
      expect(past.caret).toBe(8);
      const reversed = insertAtCaret('weak snared', [9, 4], 'or');
      expect(applyEdit('weak snared', reversed.edit)).toBe('weak OR ed');
    });

    it('counts UTF-16 units, as every span of the query does', () => {
      const source = '😀';
      const { edit, caret } = insertAtCaret(source, [2, 2], 'or');
      expect(applyEdit(source, edit)).toBe('😀 OR ');
      expect(caret).toBe(6);
    });
  });

  describe('what the lexer reads in the text afterwards', () => {
    const reads: Record<SyntaxInsertionId, (source: string) => boolean> = {
      'open-group': (source) => tokenize(source).some((token) => token.kind === 'open'),
      'close-group': (source) => tokenize(source).some((token) => token.kind === 'close'),
      quote: (source) => tokenize(source).some((token) => token.kind === 'term' && token.quote === 'closed'),
      or: (source) => tokenize(source).some((token) => token.kind === 'or'),
      and: (source) => tokenize(source).some((token) => token.kind === 'and'),
      not: (source) => tokenize(source).some((token) => token.kind === 'not'),
      applies: (source) => tokenize(source).some((token) => token.kind === 'term' && token.field?.name === 'applies'),
      uses: (source) => tokenize(source).some((token) => token.kind === 'term' && token.field?.name === 'uses'),
      class: (source) => tokenize(source).some((token) => token.kind === 'term' && token.field?.name === 'class'),
      material: (source) =>
        tokenize(source).some((token) => token.kind === 'term' && token.field?.name === 'mat' && token.value === 'yes'),
    };

    it.each(SYNTAX_INSERTION_IDS)('is the %s the button stands for, after any word, group or phrase', (id) => {
      for (const marked of ['weak|', '(weak)|', '"two words"|', 'weak OR|', '-|', '|', 'a| b']) {
        const { source, selection } = parse(marked);
        const { edit } = insertAtCaret(source, selection, id);
        expect(reads[id](applyEdit(source, edit)), `${id} after ${marked}`).toBe(true);
      }
    });

    it('does not turn the word before it into something else', () => {
      for (const id of SYNTAX_INSERTION_IDS) {
        const { source, selection } = parse('weak snared|');
        const { edit } = insertAtCaret(source, selection, id);
        const before = tokenize(applyEdit(source, edit)).filter(
          (token) => token.text === 'weak' || token.text === 'snared',
        );
        expect(before.map((token) => token.text)).toEqual(['weak', 'snared']);
      }
    });
  });

  describe('for any text and any selection', () => {
    const anyText = fc.string({ unit: fc.constantFrom('a', 'b', ' ', '(', '-', ')', '"', ':', '\t'), maxLength: 12 });

    it('keeps the text outside the selection byte for byte and puts the caret inside the result', () => {
      fc.assert(
        fc.property(anyText, fc.nat(14), fc.nat(14), fc.constantFrom(...SYNTAX_INSERTION_IDS), (source, a, b, id) => {
          const start = Math.min(a, b, source.length);
          const end = Math.min(Math.max(a, b), source.length);
          const { edit, caret } = insertAtCaret(source, [a, b], id);
          const result = applyEdit(source, edit);
          expect(result.startsWith(source.slice(0, start))).toBe(true);
          expect(result.endsWith(source.slice(end))).toBe(true);
          expect(edit.span).toEqual([start, end]);
          expect(caret).toBeGreaterThanOrEqual(start);
          expect(caret).toBeLessThanOrEqual(result.length);
        }),
      );
    });

    it('never leaves the inserted word glued to the word before it', () => {
      fc.assert(
        fc.property(anyText, fc.nat(14), fc.constantFrom(...WORD_IDS), (source, at, id) => {
          const caret = Math.min(at, source.length);
          const { edit } = insertAtCaret(source, [caret, caret], id);
          const before = source.charAt(caret - 1);
          const written = edit.text;
          if (before !== '' && !/[\s(-]/u.test(before)) expect(written.startsWith(' ')).toBe(true);
          else expect(written.startsWith(' ')).toBe(false);
        }),
      );
    });
  });
});
