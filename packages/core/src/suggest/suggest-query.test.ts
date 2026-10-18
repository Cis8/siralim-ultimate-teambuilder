import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { KEYWORD_ACTORS } from '../model/trait';
import { fieldRegistry } from '../query/fields';
import { lintQuery } from '../query/lint-query';
import type { QueryVocabulary } from '../query/query-vocabulary';
import { serialiseTerm } from '../query/serialise';
import { applyEdit } from '../query/text-edit';
import { tokenize } from '../query/lexer';
import type { Token } from '../query/token';
import { createLintContext } from '../search/lint-context';
import { taxonomy } from '../taxonomy/taxonomy';
import { suggestionContext } from './context';
import { MAX_SUGGESTIONS } from './rank-candidates';
import type { Suggestion } from './suggestion';
import { suggestQuery } from './suggest-query';
import { suggestionRegistry } from './suggestion-providers';
import type { SuggestionEnvironment } from './suggestion-registry';

const vocabulary: QueryVocabulary = {
  class: ['Chaos', 'Death', 'Life', 'Nature', 'Sorcery'],
  family: ['Clutcher', 'Dire Wolf', 'Rodian Master'],
  creature: ['Clutcher Bruiser', 'Dire Wolf', 'Mindweaver'],
  name: ['Aegis of Life', "Mother's Love", 'Weakness Exploit', 'Wolf Pack'],
};
const environment: SuggestionEnvironment = { fields: fieldRegistry, taxonomy, vocabulary };

/** `‸` marks the caret in the text of a case; it is not part of the query. */
const CARET = '‸';

function suggestAt(marked: string): { source: string; caret: number; suggestions: readonly Suggestion[] } {
  const caret = marked.indexOf(CARET);
  if (caret < 0) throw new Error(`${JSON.stringify(marked)} has no caret`);
  const source = marked.replace(CARET, '');
  return { source, caret, suggestions: suggestQuery(source, caret, environment) };
}

const insertsAt = (marked: string): string[] => suggestAt(marked).suggestions.map(({ insert }) => insert);

/** What the text becomes when the suggestion takes the place of what it replaces. */
const accept = (source: string, { replace, insert }: Suggestion): string =>
  applyEdit(source, { span: replace, text: insert });

describe('suggestQuery', () => {
  describe('where no word is being typed (QUERY_LANGUAGE §6)', () => {
    const FIELDS = ['class:', 'family:', 'creature:', 'trait:', 'desc:', 'applies:', 'uses:', 'kw:', 'mat:'];

    it('offers the fields with the line that says what each looks for, as many as are listed', () => {
      const { suggestions } = suggestAt(CARET);

      expect(suggestions.map(({ insert }) => insert)).toEqual(FIELDS);
      expect(suggestions[0]).toEqual({
        kind: 'field',
        insert: 'class:',
        detail: 'the class of the creature',
        complete: false,
        replace: [0, 0],
      });
      for (const { kind, complete, detail } of suggestions) {
        expect([kind, complete]).toEqual(['field', false]);
        expect(detail).not.toBe('');
      }
    });

    it('offers the operators first, and then the fields, after a term or a closing parenthesis', () => {
      for (const marked of ['weak ‸', '(weak) ‸', 'class:life ‸', '"two words" ‸', '-weak ‸', '(weak OR snared)‸']) {
        expect(insertsAt(marked), marked).toEqual(['OR', 'AND', 'NOT', ...FIELDS.slice(0, 6)]);
      }
      const [or, and, not] = suggestAt('weak ‸').suggestions;

      expect(or).toEqual({ kind: 'operator', insert: 'OR', detail: 'either side', complete: false, replace: [5, 5] });
      expect(and?.detail).toBe('both sides (also implicit)');
      expect(not?.detail).toBe('exclude the next term');
    });

    it('offers no operator where a term must come: at the start, after a parenthesis, an operator or a negation', () => {
      for (const marked of [
        '‸',
        '   ‸',
        '(‸',
        'weak OR ‸',
        'weak AND ‸',
        'weak | ‸',
        'weak -‸',
        'NOT ‸',
        '(weak OR ‸',
      ]) {
        expect(insertsAt(marked), marked).toEqual(FIELDS);
      }
    });

    it('replaces nothing, at the caret', () => {
      expect(suggestAt('weak ‸ snared').suggestions.map(({ replace }) => replace)).toEqual(Array(9).fill([5, 5]));
    });
  });

  describe('a word with no field', () => {
    it('offers the keyword under applies: and uses:, a name under trait:, and the text itself last', () => {
      const { suggestions } = suggestAt('wea‸');

      expect(suggestions.map(({ insert }) => insert)).toEqual([
        'applies:weak',
        'uses:weak',
        'trait:"Weakness Exploit"',
        'wea',
      ]);
      expect(suggestions[0]).toEqual({
        kind: 'debuff',
        insert: 'applies:weak',
        detail: 'applies “weak”',
        complete: true,
        replace: [0, 3],
      });
      expect(suggestions[1]?.detail).toBe('relies on “weak”');
      expect(suggestions[2]).toMatchObject({ kind: 'trait', complete: true });
      expect(suggestions[3]).toEqual({
        kind: 'text',
        insert: 'wea',
        detail: 'found anywhere in a trait',
        complete: true,
        replace: [0, 3],
      });
    });

    it('offers an event under applies: and uses: by its key, the key itself before a word of another', () => {
      const { suggestions } = suggestAt('atta‸');

      expect(suggestions.map(({ insert }) => insert)).toEqual([
        'applies:attack',
        'uses:attack',
        'applies:"being attacked"',
        'uses:"being attacked"',
        'atta',
      ]);
      expect(suggestions.slice(0, 4).map(({ kind }) => kind)).toEqual(['event', 'event', 'event', 'event']);
    });

    it('offers a mechanic and a flag, which have no role, under kw:', () => {
      expect(insertsAt('timel‸')).toEqual(['kw:timeline', 'timel']);
      expect(insertsAt('nost‸')).toEqual(['kw:nostack', 'nost']);
      expect(suggestAt('timel‸').suggestions[0]).toMatchObject({ kind: 'mechanic', detail: 'has keyword “timeline”' });
      expect(suggestAt('nost‸').suggestions[0]?.kind).toBe('flag');
    });

    it('offers the family and the trait name that hold the word, a prefix before a word start', () => {
      expect(insertsAt('wolf‸')).toEqual(['trait:"Wolf Pack"', 'family:"Dire Wolf"', 'wolf']);
    });

    it('offers the field the letters begin, by its name or one of its aliases', () => {
      expect(insertsAt('cl‸')).toEqual(['class:', 'family:Clutcher', 'cl']);
      expect(insertsAt('fam‸')).toEqual(['family:', 'fam']);
      expect(suggestAt('fam‸').suggestions[0]).toMatchObject({ kind: 'field', complete: false });
    });

    it('lists nine at most, all of the best fit that came first', () => {
      expect(insertsAt('a‸')).toEqual([
        'applies:',
        'applies:agile',
        'uses:agile',
        'applies:arcane',
        'uses:arcane',
        'applies:attack',
        'uses:attack',
        'applies:"any buff"',
        'uses:"any buff"',
      ]);
    });

    it('takes the letter case out of the match and writes the field in lower case', () => {
      expect(insertsAt('WEA‸')).toEqual(['applies:weak', 'uses:weak', 'trait:"Weakness Exploit"', 'WEA']);
    });

    it('offers a phrase typed so far, written back closed, and replaces it to the end of the text', () => {
      const { suggestions } = suggestAt('"wolf p‸');

      expect(suggestions.map(({ insert }) => insert)).toEqual(['trait:"Wolf Pack"', '"wolf p"']);
      expect(suggestions.map(({ replace }) => replace)).toEqual([
        [0, 7],
        [0, 7],
      ]);
    });

    it('writes a text that the lexer would read as something else in quotes', () => {
      expect(insertsAt('"and‸').at(-1)).toBe('"and"');
    });

    it('offers nothing in the place of an operator typed whole, so that Tab on `weak OR` does not make a trait of it', () => {
      for (const marked of [
        'weak or‸',
        'weak OR‸',
        'weak O‸R',
        'weak NOT‸',
        'weak AND‸ snared',
        'weak |‸',
        'weak &‸',
      ]) {
        expect(insertsAt(marked), marked).toEqual([]);
      }
      // Not whole, or not an operator: a word like any other.
      expect(insertsAt('weak ord‸').at(-1)).toBe('ord');
      expect(insertsAt('weak "or‸').at(-1)).toBe('"or"');
    });

    it('offers nothing for a quote with nothing in it yet', () => {
      expect(insertsAt('"‸')).toEqual([]);
      expect(insertsAt('"   ‸')).toEqual([]);
    });

    it('replaces the word whole whatever stands after the caret in it, and keeps the negation', () => {
      const { suggestions } = suggestAt('we‸ak');

      expect(suggestions[0]).toMatchObject({ insert: 'applies:weak', replace: [0, 4] });
      expect(suggestAt('-wea‸').suggestions[0]).toMatchObject({ insert: 'applies:weak', replace: [1, 4] });
      expect(suggestAt('weak OR (-sn‸ared)').suggestions[0]).toMatchObject({
        insert: 'applies:snared',
        replace: [10, 16],
      });
    });
  });

  describe('after the colon of a field', () => {
    it('offers the keywords a role field takes, and a field that takes every kind offers them all', () => {
      expect(insertsAt('applies:vul‸')).toEqual(['applies:vulnerable']);
      expect(insertsAt('uses:spell‸')).toEqual(['uses:"cast spell"']);
      expect(insertsAt('kw:spell‸')).toEqual(['kw:"spell gems"', 'kw:spells', 'kw:"cast spell"']);
      expect(suggestAt('applies:vul‸').suggestions[0]).toEqual({
        kind: 'debuff',
        insert: 'applies:vulnerable',
        detail: 'applies “vulnerable”',
        complete: true,
        replace: [0, 11],
      });
    });

    it('offers exactly the keys the field takes, whatever its kind, written as the field is', () => {
      for (const field of fieldRegistry.fields) {
        const domain = field.values;
        if (domain?.kind !== 'keyword') continue;
        for (const { key, kind } of taxonomy.entries) {
          // A key of several words is typed in quotes: past the blank, the lexer reads another word.
          const inserts = insertsAt(`${field.name}:${key.includes(' ') ? '"' : ''}${key}‸`);

          expect(inserts.includes(serialiseTerm(field.name, key)), `${field.name}:${key}`).toBe(domain.accepts(kind));
        }
      }
    });

    it('keeps the name of the field as it was typed', () => {
      expect(insertsAt('a:vul‸')).toEqual(['a:vulnerable']);
      expect(insertsAt('KW:timel‸')).toEqual(['KW:timeline']);
      expect(insertsAt('Class:li‸')).toEqual(['Class:Life']);
    });

    it('lists a prefix of a key before the start of one of its words, and that before a substring', () => {
      expect(insertsAt('applies:att‸')).toEqual([
        'applies:attack',
        'applies:"being attacked"',
        'applies:"start of battle"',
      ]);
      expect(insertsAt('uses:ulner‸')).toEqual(['uses:vulnerable']);
    });

    it('writes a key of several words in quotes', () => {
      expect(insertsAt('uses:start‸')).toEqual(['uses:"start of battle"', 'uses:"start of turn"']);
    });

    it('offers the values a field takes by name, with what each means', () => {
      const { suggestions } = suggestAt('mat:‸');

      expect(suggestions).toEqual([
        { kind: 'value', insert: 'mat:yes', detail: 'has a material', complete: true, replace: [0, 4] },
        { kind: 'value', insert: 'mat:no', detail: 'has no material', complete: true, replace: [0, 4] },
      ]);
      expect(suggestAt('stack:n‸').suggestions).toEqual([
        { kind: 'value', insert: 'stack:no', detail: 'does not stack', complete: true, replace: [0, 7] },
      ]);
    });

    it('offers the entries of the dataset a field looks in, as the dataset spells them', () => {
      expect(suggestAt('class:li‸').suggestions).toEqual([
        { kind: 'class', insert: 'class:Life', detail: 'class contains “Life”', complete: true, replace: [0, 8] },
      ]);
      expect(insertsAt('class:LI‸')).toEqual(['class:Life']);
      expect(insertsAt('t:wolf‸')).toEqual(['t:"Wolf Pack"']);
      expect(insertsAt('trait:love‸')).toEqual([`trait:"Mother's Love"`]);
      expect(insertsAt('family:wolf‸')).toEqual(['family:"Dire Wolf"']);
      expect(insertsAt('creature:‸')).toEqual([
        'creature:"Clutcher Bruiser"',
        'creature:"Dire Wolf"',
        'creature:Mindweaver',
      ]);
      expect(suggestAt('creature:min‸').suggestions[0]?.kind).toBe('creature');
    });

    it('offers all the entries of a short list for nothing typed yet', () => {
      expect(insertsAt('class:‸')).toEqual(vocabulary.class.map((name) => `class:${name}`));
    });

    it('offers nothing for a field whose value is text', () => {
      expect(insertsAt('desc:fo‸')).toEqual([]);
    });

    it('replaces the term whole, a negation excluded, and a phrase to its end', () => {
      expect(suggestAt('class:li‸fe').suggestions[0]).toMatchObject({ insert: 'class:Life', replace: [0, 10] });
      expect(suggestAt('-class:li‸').suggestions[0]).toMatchObject({ insert: 'class:Life', replace: [1, 9] });
      expect(suggestAt('trait:"wolf p‸').suggestions[0]).toMatchObject({
        insert: 'trait:"Wolf Pack"',
        replace: [0, 13],
      });
    });
  });

  describe('who acts', () => {
    it('offers the four actors after the slash of an event, each written into the term', () => {
      const { suggestions } = suggestAt('uses:attack/‸');

      expect(suggestions).toEqual([
        {
          kind: 'actor',
          insert: 'uses:attack/self',
          detail: 'relies on “attack” by this creature',
          complete: true,
          replace: [0, 12],
        },
        {
          kind: 'actor',
          insert: 'uses:attack/ally',
          detail: 'relies on “attack” by your creatures',
          complete: true,
          replace: [0, 12],
        },
        {
          kind: 'actor',
          insert: 'uses:attack/enemy',
          detail: 'relies on “attack” by an enemy',
          complete: true,
          replace: [0, 12],
        },
        {
          kind: 'actor',
          insert: 'uses:attack/any',
          detail: 'relies on “attack” by any creature',
          complete: true,
          replace: [0, 12],
        },
      ]);
      expect(suggestions.map(({ insert }) => insert.split('/')[1])).toEqual([...KEYWORD_ACTORS]);
    });

    it('offers none after a keyword that nobody does: a buff, a debuff, an effect, a mechanic, a flag or the start of a battle', () => {
      for (const marked of [
        'uses:weak/‸',
        'applies:shelled/‸',
        'kw:sealed/‸',
        'kw:timeline/‸',
        'kw:nostack/‸',
        'kw:"start of battle/‸',
        'uses:nonsense/‸',
      ]) {
        expect(insertsAt(marked), marked).toEqual([]);
      }
    });

    it('lists the actors the letters typed fit, a prefix before the rest', () => {
      expect(insertsAt('uses:attack/e‸')).toEqual(['uses:attack/enemy', 'uses:attack/self']);
      expect(insertsAt('uses:attack/a‸')).toEqual(['uses:attack/ally', 'uses:attack/any']);
      expect(insertsAt('uses:attack/nobody‸')).toEqual([]);
    });

    it('offers the actors after the start of a key an event begins, and when no key is typed', () => {
      expect(insertsAt('uses:start/‸')).toHaveLength(4);
      expect(insertsAt('uses:/‸')).toEqual(KEYWORD_ACTORS.map((actor) => `uses:/${actor}`));
    });

    it('writes a key of several words in quotes, and keeps the field as typed', () => {
      expect(insertsAt('kw:"start of turn/e‸')[0]).toBe('kw:"start of turn/enemy"');
      expect(insertsAt('-A:death/an‸')).toEqual(['A:death/any']);
    });

    it('replaces the term whole, also when the caret is before the end of the actor', () => {
      expect(suggestAt('uses:attack/se‸lf').suggestions).toMatchObject([
        { insert: 'uses:attack/self', replace: [0, 16] },
      ]);
    });
  });

  describe('a field nobody knows', () => {
    it('offers the closest field, and replaces only its name and colon', () => {
      expect(suggestAt('clas:‸').suggestions).toEqual([
        { kind: 'field', insert: 'class:', detail: 'Instead of “clas:”', complete: false, replace: [0, 5] },
      ]);
      expect(suggestAt('Clas:li‸').suggestions).toEqual([
        { kind: 'field', insert: 'class:', detail: 'Instead of “Clas:”', complete: true, replace: [0, 5] },
      ]);
    });

    it('counts the fix as a term only when a value follows the colon', () => {
      expect(suggestAt('clas:‸').suggestions[0]?.complete).toBe(false);
      expect(suggestAt('clas:life‸').suggestions[0]?.complete).toBe(true);
    });

    it('offers nothing when no field is close', () => {
      expect(insertsAt('zzzzz:x‸')).toEqual([]);
    });

    it('mends the field of a term and leaves its value, so that the query lints clean', () => {
      const { source, suggestions } = suggestAt('weak clas:life‸');
      const mended = suggestions.map((suggestion) => accept(source, suggestion));

      expect(mended).toEqual(['weak class:life']);
      expect(lintQuery('weak class:life', createLintContext({ vocabulary, countMatches: () => 1 }))).toEqual([]);
    });
  });

  describe('soundness: what is accepted is one term of the field it stands for, and the query lints clean', () => {
    const context = createLintContext({ vocabulary, countMatches: () => 1 });
    /** What the field of an accepted term must be able to take. */
    const takes = (suggestion: Suggestion, term: Token | undefined): boolean => {
      if (term?.kind !== 'term') return false;
      const domain = term.field === undefined ? undefined : fieldRegistry.resolve(term.field.name)?.values;
      switch (suggestion.kind) {
        case 'text':
          return term.field === undefined;
        case 'class':
        case 'family':
        case 'creature':
        case 'trait':
          return domain?.kind === 'vocabulary';
        case 'value':
          return domain?.kind === 'choices';
        case 'actor':
          return domain?.kind === 'keyword' && term.value.includes('/');
        case 'operator':
        case 'field':
          return false;
        default:
          return domain?.kind === 'keyword' && domain.accepts(suggestion.kind);
      }
    };

    /** What is typed after the field: the start and the whole of every word the language and the dataset have, and who acts. */
    const typed = [
      ...taxonomy.entries.flatMap(({ key }) => [key.slice(0, 3), key, `${key}/`, `${key}/e`]),
      ...Object.values(vocabulary).flatMap((entries) => entries.flatMap((entry) => [entry.slice(0, 2), entry])),
      ...fieldRegistry.fields.flatMap(({ name }) => [name.slice(0, 2), name]),
      'a',
      '',
    ];
    const heads = ['', ...fieldRegistry.fields.map(({ name }) => `${name}:`), 'a:', 'U:'];
    /** Where in a query the word is: alone, after a negation, and inside a group between two terms. */
    const places = [
      (word: string) => `${word}‸`,
      (word: string) => `-${word}‸`,
      // A quote left open runs to the end of the text, the closing parenthesis too: the group is left open.
      (word: string) => (word.includes('"') ? `weak OR ${word}‸` : `weak OR (${word}‸) -snared`),
    ];

    it('holds for what is typed of every word of the language and the dataset, after every field, in three places', () => {
      let accepted = 0;
      for (const place of places) {
        for (const prefix of typed) {
          for (const head of heads) {
            const marked = place(`${head}${/\s/.test(prefix) ? `"${prefix}` : prefix}`);
            const { source, suggestions } = suggestAt(marked);
            for (const suggestion of suggestions.filter(({ complete }) => complete)) {
              const applied = accept(source, suggestion);
              const term = tokenize(applied).find((token) => token.span[0] === suggestion.replace[0]);

              expect(takes(suggestion, term), `${marked} → ${applied}`).toBe(true);
              // One term: the token is exactly what was inserted.
              expect(term?.text, `${marked} → ${applied}`).toBe(suggestion.insert);
              expect(lintQuery(applied, context), `${marked} → ${applied}`).toEqual([]);
              accepted += 1;
            }
          }
        }
      }
      expect(accepted).toBeGreaterThan(3000);
    });

    it('holds for the fields and operators: a field is a bare term that asks for nothing yet, an operator is not a term', () => {
      for (const marked of ['‸', 'weak ‸', 'cl‸', 'fam‸', 'clas:‸', '(‸']) {
        const { source, suggestions } = suggestAt(marked);
        for (const suggestion of suggestions.filter(({ complete }) => !complete)) {
          const term = tokenize(accept(source, suggestion)).find((token) => token.span[0] === suggestion.replace[0]);

          expect(['field', 'operator'], marked).toContain(suggestion.kind);
          expect(term?.text, marked).toBe(suggestion.insert);
          if (suggestion.kind === 'field') {
            expect(term?.kind === 'term' && term.field !== undefined && term.value === '', marked).toBe(true);
          } else {
            expect(term?.kind, marked).not.toBe('term');
          }
        }
      }
    });
  });

  describe('for any text and any caret', () => {
    const pieces = fc.constantFrom(
      'weak',
      'we',
      'class:',
      'uses:',
      'a:',
      'clas:',
      'attack/',
      '/',
      ':',
      ' ',
      '"',
      '(',
      ')',
      '-',
      '|',
      'OR',
      'NOT',
      'é',
      '😀',
    );
    const text = fc.array(pieces, { maxLength: 12 }).map((parts) => parts.join(''));
    const anyCaret = fc.integer({ min: -3, max: 60 });

    it('never throws, lists nine at most, a text once, and all of them in the place the context says', () => {
      fc.assert(
        fc.property(text, anyCaret, (source, caret) => {
          const suggestions = suggestQuery(source, caret, environment);
          const { replace } = suggestionContext(source, caret);

          expect(suggestions.length).toBeLessThanOrEqual(MAX_SUGGESTIONS);
          expect(new Set(suggestions.map(({ insert }) => insert.toLowerCase())).size).toBe(suggestions.length);
          for (const suggestion of suggestions) {
            expect(suggestion.replace).toEqual(replace);
            expect(suggestion.insert).not.toBe('');
            // Nothing is counted that is not a term: an operator never is.
            expect(suggestion.kind === 'operator' && suggestion.complete).toBe(false);
          }
        }),
      );
    });
  });

  describe('the providers of the app', () => {
    it('answer every kind of context there is', () => {
      const kinds = ['‸', 'weak ‸', 'we‸', 'class:li‸', 'uses:attack/‸', 'clas:‸'].map(
        (marked) => suggestionContext(marked.replace(CARET, ''), marked.indexOf(CARET)).kind,
      );

      expect(new Set(kinds)).toEqual(
        new Set(['field', 'operator-or-field', 'free', 'field-value', 'actor', 'unknown-field']),
      );
      expect(suggestionRegistry.providers.map(({ kind }) => kind).toSorted()).toEqual([...new Set(kinds)].toSorted());
    });
  });
});
