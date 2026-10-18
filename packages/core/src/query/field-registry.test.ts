import { describe, expect, it, vi } from 'vitest';
import { tokenize } from './lexer';
import type { FieldDefinition, TraitMatcher, ValueChoice, ValueDomain } from './field';
import { createFieldRegistry, FieldRegistryError } from './field-registry';
import type { IndexedTrait } from './indexed-trait';
import type { TermToken } from './token';

/** The matchers here read nothing from the trait; what they were asked to look for is the observation. */
const anyTrait = {} as IndexedTrait;

const definition = (name: string, aliases: string[] = [], matcher?: FieldDefinition['matcher']): FieldDefinition => ({
  name,
  aliases,
  help: `the ${name} of a trait`,
  matcher: matcher ?? (() => () => true),
  describe: (value) => `${name} is “${value}”`,
});

const choice = (value: string, aliases: string[] = []): ValueChoice => ({
  value,
  aliases,
  matcher: () => true,
  meaning: `is ${value}`,
});

const withChoices = (name: string, ...choices: ValueChoice[]): FieldDefinition => ({
  ...definition(name),
  values: { kind: 'choices', mode: 'exact', choices },
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

  describe('the text of a term that the results mark', () => {
    const registry = createFieldRegistry(
      [
        { ...definition('desc', ['d']), highlightsDescription: true },
        definition('class', ['c']),
        { ...definition('quiet'), highlightsDescription: false },
      ],
      () => () => true,
    );
    const markedFor = (source: string) => registry.highlightedText(termOf(source));

    it.each([
      ['Vulnerable', 'vulnerable'],
      ['"Two Words"', 'two words'],
      ['desc:Weak', 'weak'],
      ['D:"Two Words"', 'two words'],
      ['clas:Life', 'clas:life'],
      ['clas:"Rodian Master"', 'clas:rodian master'],
      ['clas:', 'clas:'],
    ])('is, for %j, the text the free-text search looks for: %j', (source, expected) => {
      expect(markedFor(source)).toBe(expected);
    });

    it.each(['class:life', 'c:life', 'quiet:life'])(
      'is nothing for %j, whose field does not look in the description',
      (source) => {
        expect(markedFor(source)).toBeUndefined();
      },
    );

    it.each(['""', '"', 'desc:', 'D:""'])('is nothing for %j, which asks for nothing', (source) => {
      expect(markedFor(source)).toBeUndefined();
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

  describe('the help of a field', () => {
    it.each(['', '   ', ' padded ', 'two\nlines', 'carriage\rreturn'])(
      'rejects %j: it is one line of text, as it is shown beside the name',
      (help) => {
        expect(problems([{ ...definition('class'), help }])).toContain('field "class" needs one line of help');
      },
    );

    it('accepts a line with inner blanks and punctuation', () => {
      const field = { ...definition('mat'), help: 'yes = artifact-eligible (has a material), no = has none' };
      expect(createFieldRegistry([field], () => () => true).resolve('mat')?.help).toBe(field.help);
    });
  });

  describe('the values of a field', () => {
    const registryOf = (field: FieldDefinition) => createFieldRegistry([field], () => () => true);

    it('keeps the domain as it was given, whatever its kind', () => {
      const domains: ValueDomain[] = [
        { kind: 'choices', mode: 'exact', choices: [choice('yes'), choice('no', ['none'])] },
        { kind: 'vocabulary', mode: 'substring', column: 'class' },
        { kind: 'keyword', mode: 'prefix', accepts: () => true },
      ];
      for (const values of domains) {
        expect(registryOf({ ...definition('field'), values }).resolve('field')?.values).toBe(values);
      }
    });

    it('accepts a field with no domain: its value is free text', () => {
      expect(registryOf(definition('desc')).resolve('desc')?.values).toBeUndefined();
    });

    it('rejects a list of choices with nothing in it: no value would be right', () => {
      expect(problems([withChoices('mat')])).toContain('field "mat" has no choice');
    });

    it.each(['Yes', ' yes', 'yes ', 'ye s ', ''])(
      'rejects the choice %j: the matcher is asked for lower case, trimmed and not empty text',
      (value) => {
        expect(problems([withChoices('mat', choice(value))])).toContain(
          `field "mat" lists the choice ${JSON.stringify(value)}, which must be lower case, trimmed and not empty`,
        );
      },
    );

    it('checks the aliases of a choice like the choice', () => {
      expect(problems([withChoices('mat', choice('no', ['None']))])).toContain('the choice "None"');
    });

    it('rejects a spelling that two choices share, or a choice that repeats its own', () => {
      expect(problems([withChoices('mat', choice('yes'), choice('no', ['yes']))])).toContain(
        'field "mat" lists the choice "yes" more than once',
      );
      expect(problems([withChoices('mat', choice('no', ['none', 'none']))])).toContain('"none" more than once');
      expect(problems([withChoices('mat', choice('no', ['no']))])).toContain('"no" more than once');
    });

    it('lets two fields use the same choice', () => {
      expect(() =>
        createFieldRegistry([withChoices('mat', choice('yes')), withChoices('stack', choice('yes'))], () => () => true),
      ).not.toThrow();
    });

    it('lists every violation of every field at once', () => {
      const message = problems([
        { ...withChoices('mat', choice('Yes')), help: '' },
        withChoices('stack'),
        definition('Bad'),
      ]);
      expect(message).toContain('field "mat" needs one line of help');
      expect(message).toContain('field "mat" lists the choice "Yes"');
      expect(message).toContain('field "stack" has no choice');
      expect(message).toContain('"Bad" must be');
    });
  });
});
