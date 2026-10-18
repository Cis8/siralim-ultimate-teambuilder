import { describe, expect, it } from 'vitest';
import { fieldRegistry } from '../query/fields';
import type { QueryVocabulary } from '../query/query-vocabulary';
import { applyEdit, caretAfterEdit } from '../query/text-edit';
import { taxonomy } from '../taxonomy/taxonomy';
import { acceptSuggestion } from './accept-suggestion';
import type { Suggestion } from './suggestion';
import { suggestQuery } from './suggest-query';
import type { SuggestionEnvironment } from './suggestion-registry';

const vocabulary: QueryVocabulary = {
  class: ['Chaos', 'Death', 'Life', 'Nature', 'Sorcery'],
  family: ['Clutcher', 'Dire Wolf', 'Rodian Master'],
  creature: ['Clutcher Bruiser', 'Dire Wolf', 'Mindweaver'],
  name: ['Aegis of Life', "Mother's Love", 'Weakness Exploit', 'Wolf Pack'],
};
const environment: SuggestionEnvironment = { fields: fieldRegistry, taxonomy, vocabulary };

/** `‸` marks the caret, in the text a case starts from and in the text it comes to; it is not part of the query. */
const CARET = '‸';

/**
 * The text with the caret marked after the suggestion that starts with `insert` (the first one when none is named) is accepted
 * where the caret is marked: the text the field comes to, and where the caret stands, as `applyFieldEdit` leaves them.
 */
function accepted(marked: string, insert?: string): string {
  const caret = marked.indexOf(CARET);
  const source = marked.replace(CARET, '');
  const suggestions = suggestQuery(source, caret, environment);
  const suggestion = insert === undefined ? suggestions[0] : suggestions.find((each) => each.insert === insert);
  if (suggestion === undefined)
    throw new Error(`${JSON.stringify(marked)} offers ${JSON.stringify(insert ?? 'anything')}`);
  const edit = acceptSuggestion(source, suggestion);
  const text = applyEdit(source, edit);
  const at = caretAfterEdit(caret, edit);
  return text.slice(0, at) + CARET + text.slice(at);
}

/** A suggestion of the kind that is given, replacing `replace`, for the cases that no query offers. */
const suggestion = (
  insert: string,
  replace: Suggestion['replace'],
  overrides: Partial<Suggestion> = {},
): Suggestion => ({
  kind: 'buff',
  insert,
  detail: '',
  complete: true,
  replace,
  ...overrides,
});

describe('acceptSuggestion', () => {
  describe('a term being typed', () => {
    it('finishes it and leaves the caret after it, with a blank to go on from (criterion 2)', () => {
      expect(accepted('applies:vul‸')).toBe('applies:vulnerable ‸');
    });

    it('writes the field as the person wrote it', () => {
      expect(accepted('a:vul‸')).toBe('a:vulnerable ‸');
      expect(accepted('APPLIES:vul‸')).toBe('APPLIES:vulnerable ‸');
    });

    it('keeps a negation in front of the term, and what stands before it', () => {
      expect(accepted('-a:vul‸')).toBe('-a:vulnerable ‸');
      expect(accepted('weak OR -a:vul‸')).toBe('weak OR -a:vulnerable ‸');
      expect(accepted('(snared AND a:vul‸')).toBe('(snared AND a:vulnerable ‸');
    });

    it('turns a word with no field into the term that was chosen', () => {
      expect(accepted('wea‸')).toBe('applies:weak ‸');
      expect(accepted('wea‸', 'uses:weak')).toBe('uses:weak ‸');
      expect(accepted('wea‸', 'trait:"Weakness Exploit"')).toBe('trait:"Weakness Exploit" ‸');
    });

    it('turns it into the text to look for, quoted where the lexer needs it', () => {
      expect(accepted('zz‸')).toBe('zz ‸');
      expect(accepted('"zz yy‸')).toBe('"zz yy" ‸');
    });

    it('closes the quote of a phrase that was left open', () => {
      expect(accepted('trait:"Aegis o‸')).toBe('trait:"Aegis of Life" ‸');
      expect(accepted('weak -trait:"Wolf‸')).toBe('weak -trait:"Wolf Pack" ‸');
    });

    it('offers the actor of an event after the slash', () => {
      expect(accepted('uses:attack/se‸')).toBe('uses:attack/self ‸');
    });
  });

  describe('in the middle of the text', () => {
    it('takes the place of the whole word, also what stands after the caret in it', () => {
      expect(accepted('applies:vu‸lnerable OR weak')).toBe('applies:vulnerable‸ OR weak');
      expect(accepted('applies:vu‸zzz OR weak')).toBe('applies:vulnerable‸ OR weak');
      expect(accepted('trait:"Aegis o‸f L" OR weak')).toBe('trait:"Aegis of Life"‸ OR weak');
    });

    it('adds no blank where one stands already, and leaves the rest of the text as it was', () => {
      expect(accepted('applies:vul‸ OR weak')).toBe('applies:vulnerable‸ OR weak');
      expect(accepted('a OR we‸  snared')).toBe('a OR applies:weak‸  snared');
    });

    it('adds a blank where another term follows without one, so that it stays a term of its own', () => {
      expect(accepted('applies:vul‸"two words"')).toBe('applies:vulnerable ‸"two words"');
      expect(accepted('applies:vul‸(weak)')).toBe('applies:vulnerable ‸(weak)');
    });

    it('adds no blank before the parenthesis that closes the group', () => {
      expect(accepted('(applies:vul‸)')).toBe('(applies:vulnerable‸)');
      expect(accepted('(weak OR a:vul‸) snared')).toBe('(weak OR a:vulnerable‸) snared');
    });
  });

  describe('where no word is being typed', () => {
    it('adds an operator between terms, with a blank after it', () => {
      expect(accepted('weak ‸')).toBe('weak OR ‸');
      expect(accepted('weak ‸', 'NOT')).toBe('weak NOT ‸');
      expect(accepted('weak AND snared ‸', 'AND')).toBe('weak AND snared AND ‸');
    });

    it('puts a blank in front of a word that follows without one, so that the operator is a word of its own', () => {
      expect(accepted('weak ‸snared')).toBe('weak OR ‸snared');
    });

    it('adds the blank after an operator that comes before the closing parenthesis, which nothing can end with', () => {
      expect(accepted('(weak ‸)')).toBe('(weak OR ‸)');
    });

    it('adds a blank before what is added after a closing parenthesis, which would run into it', () => {
      expect(accepted('(weak)‸')).toBe('(weak) OR ‸');
      expect(accepted('(weak OR snared)‸', 'class:')).toBe('(weak OR snared) class:‸');
    });

    it('adds a field right after the opening parenthesis or the negation that stand before it', () => {
      expect(accepted('(‸')).toBe('(class:‸');
      expect(accepted('weak -‸')).toBe('weak -class:‸');
      expect(accepted('weak OR ‸')).toBe('weak OR class:‸');
    });
  });

  describe('a bare field', () => {
    it('leaves the caret after the colon, with no blank: the value is typed there', () => {
      expect(accepted('cla‸')).toBe('class:‸');
      expect(accepted('weak OR cr‸')).toBe('weak OR creature:‸');
      expect(accepted('-t‸')).toBe('-trait:‸');
    });

    it('is not followed by a blank also where a word follows: that word becomes its value', () => {
      expect(accepted('weak ‸snared', 'applies:')).toBe('weak applies:‸snared');
    });

    it('takes the value of the word it replaces away with it, as the person chose another word', () => {
      expect(accepted('weak OR cla‸ss:life')).toBe('weak OR class:‸');
    });
  });

  describe('the field of a term that has none that is known', () => {
    it('mends the name and leaves the value, and the caret where it was in the text', () => {
      expect(accepted('clas:li‸fe')).toBe('class:li‸fe');
      expect(accepted('clas:life‸ OR weak')).toBe('class:life‸ OR weak');
      expect(accepted('weak -clas:‸')).toBe('weak -class:‸');
    });

    it('adds no blank between the field and its value, though the term is finished', () => {
      const fix = suggestion('class:', [0, 5], { kind: 'field' });

      expect(acceptSuggestion('clas:life', fix)).toEqual({ span: [0, 5], text: 'class:' });
    });
  });

  describe('what it leaves as it was', () => {
    it('is an edit of exactly the span that the suggestion replaces', () => {
      expect(acceptSuggestion('applies:vul', suggestion('applies:vulnerable', [0, 11]))).toEqual({
        span: [0, 11],
        text: 'applies:vulnerable ',
      });
      expect(acceptSuggestion('weak ', suggestion('OR', [5, 5], { kind: 'operator', complete: false }))).toEqual({
        span: [5, 5],
        text: 'OR ',
      });
    });

    it('keeps every character outside the span, any blank or parenthesis among them', () => {
      for (const [source, replace] of [
        ['  a  ', [2, 3]],
        ['(a)b', [1, 2]],
        ['a\tb', [0, 1]],
        ['"x"y', [3, 4]],
        ['', [0, 0]],
      ] as const) {
        const edit = acceptSuggestion(source, suggestion('applies:weak', replace));

        expect(edit.span).toEqual(replace);
        expect(applyEdit(source, edit).startsWith(source.slice(0, replace[0]))).toBe(true);
        expect(applyEdit(source, edit).endsWith(source.slice(replace[1]))).toBe(true);
      }
    });

    it('puts the blank in front of a word that follows a closing quote, not inside the phrase', () => {
      expect(acceptSuggestion('"abc"we', suggestion('applies:weak', [5, 7]))).toEqual({
        span: [5, 7],
        text: ' applies:weak ',
      });
    });

    it('reads a tab or any other blank as a blank', () => {
      expect(acceptSuggestion('a\tb', suggestion('applies:weak', [0, 1])).text).toBe('applies:weak');
      expect(acceptSuggestion('a b', suggestion('applies:weak', [0, 1])).text).toBe('applies:weak');
      expect(acceptSuggestion('\ta', suggestion('applies:weak', [1, 2])).text).toBe('applies:weak ');
    });

    it('does not throw for a span at the edges of the text or past them', () => {
      expect(() =>
        acceptSuggestion('', suggestion('class:', [0, 0], { kind: 'field', complete: false })),
      ).not.toThrow();
      expect(() => acceptSuggestion('ab', suggestion('applies:weak', [5, 9]))).not.toThrow();
    });
  });
});
