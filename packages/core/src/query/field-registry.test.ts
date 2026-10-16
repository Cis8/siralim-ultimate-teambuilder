import { describe, expect, it, vi } from 'vitest';
import { tokenize } from './lexer';
import type { FieldDefinition, TraitMatcher } from './field';
import { createFieldRegistry, FieldRegistryError } from './field-registry';
import type { IndexedTrait } from './indexed-trait';
import type { TermToken } from './token';

/** The matchers here read nothing from the trait; what they were asked to look for is the observation. */
const anyTrait = {} as IndexedTrait;

const definition = (name: string, aliases: string[] = [], matcher?: FieldDefinition['matcher']): FieldDefinition => ({
  name,
  aliases,
  matcher: matcher ?? (() => () => true),
});

function termOf(source: string): TermToken {
  const [token] = tokenize(source);
  if (token?.kind !== 'term') throw new Error(`"${source}" is not a term`);
  return token;
}

function problems(fields: FieldDefinition[]): string {
  try {
    createFieldRegistry(fields, () => () => true);
  } catch (error) {
    if (error instanceof FieldRegistryError) return error.message;
    throw error;
  }
  throw new Error('Expected createFieldRegistry to throw');
}

describe('createFieldRegistry', () => {
  describe('resolving a field name', () => {
    const class_ = definition('class', ['c']);
    const family = definition('family', ['fam', 'f']);
    const registry = createFieldRegistry([class_, family], () => () => true);

    it('keeps the fields in the order given', () => {
      expect(registry.fields).toEqual([class_, family]);
    });

    it.each([
      ['class', class_],
      ['c', class_],
      ['family', family],
      ['fam', family],
      ['f', family],
    ])('finds %j', (name, expected) => {
      expect(registry.resolve(name)).toBe(expected);
    });

    it.each(['Class', 'CLASS', 'C', 'FaM'])('ignores the letter case of %j', (name) => {
      expect(registry.resolve(name)).toBeDefined();
    });

    it.each(['clas', 'classes', 'x', ''])('does not know %j', (name) => {
      expect(registry.resolve(name)).toBeUndefined();
    });
  });

  describe('the matcher of a term', () => {
    it('is the one of its field, asked for the value in lower case', () => {
      const matcher = vi.fn<FieldDefinition['matcher']>(() => () => true);
      const registry = createFieldRegistry([definition('class', ['c'], matcher)], () => () => false);
      registry.matcherFor(termOf('C:Rodian'))(anyTrait);
      expect(matcher).toHaveBeenCalledExactlyOnceWith('rodian');
    });

    it('reads the value without its quotes', () => {
      const matcher = vi.fn<FieldDefinition['matcher']>(() => () => true);
      createFieldRegistry([definition('class', [], matcher)], () => () => false).matcherFor(
        termOf('class:"Rodian Master"'),
      );
      expect(matcher).toHaveBeenCalledWith('rodian master');
    });

    it('asks the field once for a term, not once per trait', () => {
      const matcher = vi.fn<FieldDefinition['matcher']>(() => () => true);
      const match = createFieldRegistry([definition('class', [], matcher)], () => () => false).matcherFor(
        termOf('class:life'),
      );
      for (let times = 0; times < 5; times += 1) match(anyTrait);
      expect(matcher).toHaveBeenCalledTimes(1);
    });

    it('is the free-text one for a term with no field, asked for the value in lower case', () => {
      const freeText = vi.fn<(value: string) => TraitMatcher>(() => () => true);
      createFieldRegistry([], freeText).matcherFor(termOf('Vulnerable'));
      expect(freeText).toHaveBeenCalledExactlyOnceWith('vulnerable');
    });

    it('is the free-text one, asked for the whole token, for a field the registry does not know', () => {
      const freeText = vi.fn<(value: string) => TraitMatcher>(() => () => true);
      createFieldRegistry([definition('class')], freeText).matcherFor(termOf('Clas:Life'));
      expect(freeText).toHaveBeenCalledExactlyOnceWith('clas:life');
    });

    it('keeps what follows the colon of an unknown field as one phrase, quotes stripped', () => {
      const freeText = vi.fn<(value: string) => TraitMatcher>(() => () => true);
      createFieldRegistry([], freeText).matcherFor(termOf('clas:"Rodian Master"'));
      expect(freeText).toHaveBeenCalledExactlyOnceWith('clas:rodian master');
    });

    it('asks for what an unknown field and an unclosed quote leave of the value', () => {
      const freeText = vi.fn<(value: string) => TraitMatcher>(() => () => true);
      createFieldRegistry([], freeText).matcherFor(termOf('clas:"Rodian'));
      expect(freeText).toHaveBeenCalledExactlyOnceWith('clas:rodian');
    });

    it.each(['applies:', '""', 'applies:""', '"'])(
      'matches every trait, asking nobody, when %j has no value yet',
      (source) => {
        const matcher = vi.fn<FieldDefinition['matcher']>(() => () => false);
        const freeText = vi.fn<(value: string) => TraitMatcher>(() => () => false);
        const registry = createFieldRegistry([definition('applies', [], matcher)], freeText);
        expect(registry.matcherFor(termOf(source))(anyTrait)).toBe(true);
        expect(matcher).not.toHaveBeenCalled();
        expect(freeText).not.toHaveBeenCalled();
      },
    );

    it('does not match every trait for an unknown field without a value: it is still a word to look for', () => {
      const freeText = vi.fn<(value: string) => TraitMatcher>(() => () => false);
      const registry = createFieldRegistry([], freeText);
      expect(registry.matcherFor(termOf('clas:'))(anyTrait)).toBe(false);
      expect(freeText).toHaveBeenCalledExactlyOnceWith('clas:');
    });
  });

  describe('the fields it accepts', () => {
    it('accepts no field at all', () => {
      expect(createFieldRegistry([], () => () => true).fields).toEqual([]);
    });

    it('rejects two fields with the same name', () => {
      expect(problems([definition('class'), definition('class')])).toContain('"class" names 2 fields');
    });

    it('rejects an alias that is the name of another field', () => {
      expect(problems([definition('class'), definition('family', ['class'])])).toContain('"class" names 2 fields');
    });

    it('rejects an alias two fields share', () => {
      expect(problems([definition('class', ['c']), definition('creature', ['c'])])).toContain('"c" names 2 fields');
    });

    it('rejects an alias a field gives twice, or that repeats its own name', () => {
      expect(problems([definition('class', ['c', 'c'])])).toContain('"c" names 2 fields');
      expect(problems([definition('class', ['class'])])).toContain('"class" names 2 fields');
    });

    it.each(['', 'Class', 'cla ss', 'class2', 'class:', 'clâss'])(
      'rejects %j: the lexer reads a field name as lower case letters before a colon',
      (name) => {
        expect(problems([definition(name)])).toContain(`${JSON.stringify(name)} must be`);
      },
    );

    it('checks the aliases like the names', () => {
      expect(problems([definition('class', ['C'])])).toContain('"C" must be');
    });

    it('lists every violation at once', () => {
      const message = problems([definition('class', ['c']), definition('Creature', ['c'])]);
      expect(message).toContain('"Creature" must be');
      expect(message).toContain('"c" names 2 fields');
    });
  });
});
