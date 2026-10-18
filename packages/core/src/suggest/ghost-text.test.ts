import { describe, expect, it } from 'vitest';
import { fieldRegistry } from '../query/fields';
import type { QueryVocabulary } from '../query/query-vocabulary';
import { taxonomy } from '../taxonomy/taxonomy';
import { ghostText } from './ghost-text';
import { suggestQuery } from './suggest-query';
import type { SuggestionEnvironment } from './suggestion-registry';

const vocabulary: QueryVocabulary = {
  class: ['Chaos', 'Death', 'Life', 'Nature', 'Sorcery'],
  family: ['Clutcher', 'Dire Wolf', 'Rodian Master'],
  creature: ['Clutcher Bruiser', 'Dire Wolf', 'Mindweaver'],
  name: ['Aegis of Life', "Mother's Love", 'Weakness Exploit', 'Wolf Pack'],
};
const environment: SuggestionEnvironment = { fields: fieldRegistry, taxonomy, vocabulary };

const CARET = '‸';

/** The ghost for the top suggestion at the caret marked in the text. */
function ghostAt(marked: string): string {
  const caret = marked.indexOf(CARET);
  const source = marked.replace(CARET, '');
  const [top] = suggestQuery(source, caret, environment);
  return ghostText(source, caret, top);
}

describe('ghostText', () => {
  describe('shows the rest of the top suggestion, in grey, after what was typed', () => {
    it('for a field, a value and an actor', () => {
      expect(ghostAt('cla‸')).toBe('ss:');
      expect(ghostAt('applies:vul‸')).toBe('nerable');
      expect(ghostAt('uses:attack/se‸')).toBe('lf');
    });

    it('for a name that is quoted, whether the quote is open or not', () => {
      expect(ghostAt('trait:"Aegis o‸')).toBe('f Life"');
      expect(ghostAt('trait:"Aegis ‸')).toBe('of Life"');
      expect(ghostAt('trait:"Wolf‸')).toBe(' Pack"');
    });

    it('after a negation or an operator, which are not part of what was typed', () => {
      expect(ghostAt('-cla‸')).toBe('ss:');
      expect(ghostAt('weak OR (applies:vul‸')).toBe('nerable');
    });

    it('whatever the letter case of what was typed: the text that Tab writes is the suggestion', () => {
      expect(ghostAt('a:VUL‸')).toBe('nerable');
      expect(ghostAt('CLA‸')).toBe('ss:');
    });

    it('with the field the person wrote', () => {
      expect(ghostAt('a:vul‸')).toBe('nerable');
      expect(ghostAt('Applies:vul‸')).toBe('nerable');
    });
  });

  describe('shows nothing', () => {
    it('when the top suggestion does not begin with what was typed: it is another word, not the rest of this one', () => {
      // `applies:weak` is the top suggestion for `we`, and the person has not typed a field.
      expect(ghostAt('we‸')).toBe('');
      // The name is offered in quotes, the typed text has none.
      expect(ghostAt('trait:aegis‸')).toBe('');
      // The fix of a field takes the place of the name, it does not go on from it.
      expect(ghostAt('clas:‸')).toBe('');
    });

    it('when the suggestion is what was typed', () => {
      expect(ghostAt('applies:vulnerable‸')).toBe('');
      expect(ghostAt('zz‸')).toBe('');
    });

    it('when nothing was typed: after a blank, an operator or a parenthesis', () => {
      for (const marked of [CARET, ' ‸', 'weak ‸', '(‸', 'weak OR ‸', 'weak -‸']) {
        expect(ghostAt(marked), marked).toBe('');
      }
    });

    it('when the caret is not at the end of the text, where the grey text would stand over what follows', () => {
      expect(ghostAt('applies:vul‸ OR weak')).toBe('');
      expect(ghostAt('cla‸ss:life')).toBe('');
      expect(ghostAt('applies:vu‸l')).toBe('');
    });

    it('when there is no suggestion', () => {
      expect(ghostText('applies:vul', 11, undefined)).toBe('');
      expect(ghostText('', 0, undefined)).toBe('');
    });
  });

  it('is what is missing from the typed text to make the top suggestion', () => {
    for (const marked of ['cla‸', 'applies:vul‸', 'u:att‸', 'trait:"Wolf‸', 'family:"Dire‸', 'class:l‸', 'kw:ch‸']) {
      const caret = marked.indexOf(CARET);
      const source = marked.replace(CARET, '');
      const [top] = suggestQuery(source, caret, environment);
      const ghost = ghostText(source, caret, top);
      const typed = source.slice(top?.replace[0], caret);

      expect(ghost, marked).not.toBe('');
      expect((typed + ghost).toLowerCase(), marked).toBe(top?.insert.toLowerCase());
    }
  });

  it('keeps the caret inside the text and does not throw for a suggestion of another text', () => {
    const [top] = suggestQuery('cla', 3, environment);

    expect(ghostText('cla', 99, top)).toBe('ss:');
    expect(ghostText('cla', -1, top)).toBe('');
    expect(ghostText('', 0, top)).toBe('');
  });
});
