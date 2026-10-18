import { describe, expect, it } from 'vitest';
import { hasRole } from '../model/keyword-kind';
import type { KeywordActor, KeywordHit, KeywordKind, KeywordRole, Trait } from '../model/trait';
import { taxonomy } from '../taxonomy/taxonomy';
import type { FieldDefinition, MatchMode, ValueChoice } from './field';
import { fieldRegistry } from './fields';
import { indexTrait } from './indexed-trait';
import { tokenize } from './lexer';

function trait(overrides: Partial<Trait> = {}): Trait {
  return {
    id: 'abomination--flesh-rot',
    name: 'Flesh Rot',
    creature: 'Abomination Brute',
    family: 'Abomination',
    class: 'Death',
    kind: 'creature',
    description: 'Afflicts a debuff.',
    material: 'Brute Stitches',
    stacks: true,
    randomDebuff: null,
    masteryFamily: null,
    partyRequirement: null,
    keywords: [],
    conditionalSources: [],
    ...overrides,
  };
}

const hit = (key: string, kind: KeywordKind, role?: KeywordRole): KeywordHit => ({
  key,
  kind,
  ...(role === undefined ? {} : { role }),
  span: [0, key.length],
});

/** Whether the term in `source` (one word or `field:value`, as typed in the query bar) matches the trait. */
function matches(source: string, subject: Trait): boolean {
  const [token, ...rest] = tokenize(source);
  if (token?.kind !== 'term' || rest.length > 0) throw new Error(`"${source}" is not one term`);
  return fieldRegistry.matcherFor(token)(indexTrait(subject));
}

describe('the fields of the query language', () => {
  describe('a word with no field', () => {
    const subject = trait({
      class: 'Rodian Master',
      family: 'Clutcher',
      creature: 'Clutcher Bruiser',
      name: 'Last Stand',
      description: 'Applies Vulnerable after an enemy dodges.',
      material: 'Knight Helm',
    });

    it.each([
      ['the class', 'rodian'],
      ['the family', 'clutcher'],
      ['the creature', 'bruiser'],
      ['the trait name', '"last stand"'],
      ['the description', 'dodges'],
      ['the material', 'helm'],
    ])('is looked for in %s', (_column, word) => {
      expect(matches(word, subject)).toBe(true);
    });

    it('is looked for as a substring: a word need not be a whole word', () => {
      expect(matches('ulner', subject)).toBe(true);
    });

    it('ignores letter case on both sides', () => {
      expect(matches('VULNERABLE', subject)).toBe(true);
      expect(matches('knight', trait({ material: 'KNIGHT HELM' }))).toBe(true);
    });

    it('finds a phrase', () => {
      expect(matches('"after an enemy"', subject)).toBe(true);
      expect(matches('"enemy after"', subject)).toBe(false);
    });

    it('does not find a phrase that runs from one column into the next', () => {
      const split = trait({ creature: 'Clutcher Bruiser', family: 'Clutcher', class: 'Life' });
      expect(matches('"bruiser clutcher"', split)).toBe(false);
      expect(matches('"clutcher life"', split)).toBe(false);
    });

    it('finds nothing in a mastery, which has no creature and may have no material', () => {
      const mastery = trait({ kind: 'mastery', creature: null, material: null, name: 'Master of Sins' });
      expect(matches('mastery', mastery)).toBe(false);
      expect(matches('sins', mastery)).toBe(true);
    });

    it('does not find a word that is nowhere in the trait', () => {
      expect(matches('zombies', subject)).toBe(false);
    });
  });

  describe('the text fields', () => {
    const subject = trait({
      class: 'Rodian Master',
      family: 'Clutcher',
      creature: 'Clutcher Bruiser',
      name: 'Last Stand',
      description: 'Applies Vulnerable. Bruiser lovers rejoice.',
      material: 'Clutcher Plate',
    });

    it.each([
      ['class', ['class', 'c'], 'rodian', 'clutcher'],
      ['family', ['family', 'fam', 'f'], 'clutcher', 'rodian'],
      ['creature', ['creature', 'cr'], 'bruiser', 'rodian'],
      ['trait', ['trait', 't'], 'last stand', 'bruiser'],
      ['desc', ['desc', 'd'], 'lovers', 'last stand'],
    ])('%s: matches its own column only, under every spelling', (_field, spellings, inColumn, elsewhere) => {
      for (const spelling of spellings) {
        expect(matches(`${spelling}:"${inColumn}"`, subject)).toBe(true);
        expect(matches(`${spelling}:"${elsewhere}"`, subject)).toBe(false);
      }
    });

    it.each(['class:rod', 'class:MASTER', 'Class:rodian', 'CLASS:RODIAN'])(
      'looks for the value as a substring of the column, whatever the letter case: %s',
      (source) => {
        expect(matches(source, subject)).toBe(true);
      },
    );

    it('reads a phrase as one value', () => {
      expect(matches('class:"rodian master"', subject)).toBe(true);
      expect(matches('class:"master rodian"', subject)).toBe(false);
    });

    it('does not read the description for `class:`, nor the class for `desc:`', () => {
      expect(matches('desc:rodian', subject)).toBe(false);
      expect(matches('class:vulnerable', subject)).toBe(false);
    });

    it('has nothing for `creature:` to find in a mastery', () => {
      const mastery = trait({ kind: 'mastery', creature: null });
      expect(matches('creature:mastery', mastery)).toBe(false);
      expect(matches('cr:trait', mastery)).toBe(false);
    });

    it('keeps the material out of the fields: only a word with no field reads it', () => {
      expect(matches('desc:plate', subject)).toBe(false);
      expect(matches('plate', subject)).toBe(true);
    });
  });

  describe('the keyword fields', () => {
    const subject = trait({
      keywords: [
        hit('vulnerable', 'debuff', 'applies'),
        hit('weak', 'debuff', 'uses'),
        hit('silenced', 'debuff', 'resists'),
        hit('dire wolves', 'effect', 'applies'),
        hit('start of battle', 'event'),
        hit('fused', 'mechanic'),
      ],
    });

    describe('applies: (a:)', () => {
      it.each(['applies:vulnerable', 'a:vulnerable', 'Applies:Vulnerable'])(
        'finds a keyword it gives: %s',
        (source) => {
          expect(matches(source, subject)).toBe(true);
        },
      );

      it('finds a keyword by the start of its key', () => {
        expect(matches('a:vul', subject)).toBe(true);
        expect(matches('a:v', subject)).toBe(true);
      });

      it('does not find the middle or the end of a key', () => {
        expect(matches('a:nerable', subject)).toBe(false);
        expect(matches('a:ble', subject)).toBe(false);
      });

      it('does not find a keyword the trait relies on, or only guards against', () => {
        expect(matches('applies:weak', subject)).toBe(false);
        expect(matches('applies:silenced', subject)).toBe(false);
      });

      it('does not find a keyword without a role', () => {
        expect(matches('applies:fused', subject)).toBe(false);
        expect(matches('applies:"start of battle"', subject)).toBe(false);
      });

      it('finds an effect by a key that has several words, whole or in part', () => {
        expect(matches('a:dire', subject)).toBe(true);
        expect(matches('a:"dire w"', subject)).toBe(true);
        expect(matches('a:"dire wolves"', subject)).toBe(true);
        expect(matches('a:wolves', subject)).toBe(false);
      });
    });

    describe('uses: (u:)', () => {
      it.each(['uses:weak', 'u:weak', 'USES:WEAK', 'u:we'])('finds a keyword it relies on: %s', (source) => {
        expect(matches(source, subject)).toBe(true);
      });

      it('does not find a keyword the trait gives, or only guards against', () => {
        expect(matches('uses:vulnerable', subject)).toBe(false);
        expect(matches('uses:silenced', subject)).toBe(false);
      });
    });

    it('tells the roles apart: a trait that gives a keyword and one that relies on it are different results', () => {
      const gives = trait({ keywords: [hit('weak', 'debuff', 'applies')] });
      const relies = trait({ keywords: [hit('weak', 'debuff', 'uses')] });
      expect([matches('applies:weak', gives), matches('uses:weak', gives)]).toEqual([true, false]);
      expect([matches('applies:weak', relies), matches('uses:weak', relies)]).toEqual([false, true]);
    });

    describe('kw: (k:)', () => {
      it.each(['vulnerable', 'weak', 'silenced', 'dire', '"start of"', 'fused'])(
        'finds any keyword, of any kind and in any role: kw:%s',
        (value) => {
          expect(matches(`kw:${value}`, subject)).toBe(true);
          expect(matches(`k:${value}`, subject)).toBe(true);
        },
      );

      it('finds a mention that only guards against a keyword (GAME_RULES R9)', () => {
        expect(matches('kw:silenced', subject)).toBe(true);
      });

      it('finds a keyword by the start of its key, not by the middle', () => {
        expect(matches('kw:"of battle"', subject)).toBe(false);
        expect(matches('kw:ulnerable', subject)).toBe(false);
      });

      it('does not find a keyword the trait does not mention', () => {
        expect(matches('kw:snared', subject)).toBe(false);
      });
    });

    // QUERY_LANGUAGE §2: `uses:provoke/self` is the event by one actor; the key prefix still applies before the slash.
    describe('an actor after a slash', () => {
      const event = (key: string, role: KeywordRole, actor?: KeywordActor): KeywordHit => ({
        ...hit(key, 'event', role),
        ...(actor === undefined ? {} : { actor }),
      });
      const acting = trait({
        keywords: [
          event('provoke', 'uses', 'self'),
          event('attack', 'applies', 'enemy'),
          event('attack', 'uses', 'ally'),
          event('dodge', 'resists', 'self'),
          event('start of battle', 'uses'),
          hit('weak', 'debuff', 'uses'),
        ],
      });

      it('finds the event only when that actor does it', () => {
        expect(matches('uses:provoke/self', acting)).toBe(true);
        expect(matches('uses:provoke/ally', acting)).toBe(false);
        expect(matches('uses:provoke/enemy', acting)).toBe(false);
        expect(matches('uses:provoke/any', acting)).toBe(false);
      });

      it.each(['uses:provoke', 'uses:provoke/', 'uses:provoke/self/'])(
        'finds it with no actor asked for, or none yet: %s',
        (source) => {
          expect(matches(source, acting)).toBe(true);
        },
      );

      it('applies the key prefix before the slash', () => {
        expect(matches('u:prov/self', acting)).toBe(true);
        expect(matches('u:p/self', acting)).toBe(true);
        expect(matches('u:rovoke/self', acting)).toBe(false);
      });

      it('reads the role of the mention: the actor of a mention that applies is not the one of a mention that relies', () => {
        expect(matches('applies:attack/enemy', acting)).toBe(true);
        expect(matches('uses:attack/enemy', acting)).toBe(false);
        expect(matches('uses:attack/ally', acting)).toBe(true);
        expect(matches('applies:attack/ally', acting)).toBe(false);
      });

      it('finds a key with several words, in quotes', () => {
        const turn = trait({ keywords: [event('start of turn', 'uses', 'enemy')] });
        expect(matches('u:"start of turn/enemy"', turn)).toBe(true);
        expect(matches('u:"start of/enemy"', turn)).toBe(true);
        expect(matches('u:"start of turn/self"', turn)).toBe(false);
      });

      it('lets kw: find the actor in any role, a mention that prevents it included', () => {
        expect(matches('kw:dodge/self', acting)).toBe(true);
        expect(matches('uses:dodge/self', acting)).toBe(false);
        expect(matches('k:attack/enemy', acting)).toBe(true);
        expect(matches('k:attack/self', acting)).toBe(false);
      });

      it('never finds a mention that names nobody: the start of a battle has no actor', () => {
        for (const actor of ['self', 'ally', 'enemy', 'any']) {
          expect(matches(`u:"start of battle/${actor}"`, acting)).toBe(false);
        }
        expect(matches('u:"start of battle"', acting)).toBe(true);
      });

      it('finds nothing for a word after the slash that is no actor, or for a keyword that has none', () => {
        expect(matches('uses:provoke/nobody', acting)).toBe(false);
        expect(matches('uses:provoke/sel', acting)).toBe(false);
        expect(matches('uses:weak/self', acting)).toBe(false);
      });

      it('finds an event by anyone when only the actor is given', () => {
        expect(matches('uses:/self', acting)).toBe(true);
        expect(matches('uses:/enemy', acting)).toBe(false);
        expect(matches('applies:/enemy', acting)).toBe(true);
      });

      it('reads the actor whatever its letter case', () => {
        expect(matches('USES:Provoke/SELF', acting)).toBe(true);
      });
    });

    // The eleven trigger phrases of the first version are aliases (ADR-0009): a phrase names the event and, where it says,
    // the actor. They are whole phrases, never the start of one.
    describe('an old trigger phrase', () => {
      const event = (key: string, actor?: KeywordActor): Trait =>
        trait({ keywords: [{ ...hit(key, 'event', 'uses'), ...(actor === undefined ? {} : { actor }) }] });

      it('finds the event by the actor the phrase names', () => {
        expect(matches('kw:"after this creature attacks"', event('attack', 'self'))).toBe(true);
        expect(matches('kw:"after this creature attacks"', event('attack', 'enemy'))).toBe(false);
        expect(matches('kw:"after this creature attacks"', event('attack'))).toBe(false);
      });

      it('finds the event by anyone when the phrase names no actor', () => {
        expect(matches('kw:"deals critical damage"', event('critical hit', 'enemy'))).toBe(true);
        expect(matches('kw:"is killed"', event('death'))).toBe(true);
      });

      it('is read by the three keyword fields, with its role', () => {
        const relies = event('dodge', 'enemy');
        expect(matches('uses:"after an enemy dodges"', relies)).toBe(true);
        expect(matches('applies:"after an enemy dodges"', relies)).toBe(false);
        expect(matches('k:"after an enemy dodges"', relies)).toBe(true);
      });

      it('is not the start of a phrase: `kw:after` finds nothing', () => {
        expect(matches('kw:after', event('attack', 'self'))).toBe(false);
        expect(matches('kw:"after this creature"', event('attack', 'self'))).toBe(false);
      });

      it('leaves a key that is still a key as it is', () => {
        expect(matches('kw:"start of battle"', event('start of battle'))).toBe(true);
      });
    });

    it('does not look in the description: a word that is no keyword is no keyword', () => {
      const plain = trait({ description: 'Applies Vulnerable.' });
      expect(matches('kw:vulnerable', plain)).toBe(false);
    });

    it('finds nothing in a trait with no keywords', () => {
      expect(matches('kw:v', trait())).toBe(false);
      expect(matches('a:v', trait())).toBe(false);
      expect(matches('u:v', trait())).toBe(false);
    });
  });

  describe('mat:', () => {
    const withMaterial = trait({ material: 'Brute Stitches' });
    const withoutMaterial = trait({ material: null });

    it.each(['mat:yes', 'MAT:YES', 'Mat:Yes'])('yes finds a trait that has a material: %s', (source) => {
      expect([matches(source, withMaterial), matches(source, withoutMaterial)]).toEqual([true, false]);
    });

    it.each(['mat:no', 'mat:none', 'mat:NONE'])('no and none find a trait with no material: %s', (source) => {
      expect([matches(source, withMaterial), matches(source, withoutMaterial)]).toEqual([false, true]);
    });

    it.each(['mat:maybe', 'mat:y', 'mat:true', 'mat:"no material"', 'mat:yes!', 'mat:constructor'])(
      'takes nothing but yes, no and none, so %s finds nothing',
      (source) => {
        expect([matches(source, withMaterial), matches(source, withoutMaterial)]).toEqual([false, false]);
      },
    );

    it('has no alias', () => {
      expect(fieldRegistry.resolve('mat')?.aliases).toEqual([]);
    });
  });

  describe('stack:', () => {
    const stacking = trait({ stacks: true });
    const notStacking = trait({ stacks: false });

    it.each(['stack:yes', 'STACK:Yes'])('yes finds a trait that stacks: %s', (source) => {
      expect([matches(source, stacking), matches(source, notStacking)]).toEqual([true, false]);
    });

    it.each(['stack:no', 'Stack:NO'])('no finds a trait that "does not stack": %s', (source) => {
      expect([matches(source, stacking), matches(source, notStacking)]).toEqual([false, true]);
    });

    it.each(['stack:none', 'stack:maybe', 'stack:y', 'stack:__proto__'])(
      'takes nothing but yes and no, so %s finds nothing',
      (source) => {
        expect([matches(source, stacking), matches(source, notStacking)]).toEqual([false, false]);
      },
    );
  });

  describe('a term that is not a field', () => {
    it('is a word to look for, colon included: an unknown field is no filter', () => {
      const text = trait({ description: 'See clas:life for details.' });
      expect(matches('clas:life', text)).toBe(true);
      expect(matches('clas:life', trait({ class: 'Life' }))).toBe(false);
    });

    it('keeps the whole phrase after an unknown field', () => {
      const text = trait({ description: 'Ask tag:a b.' });
      expect(matches('tag:"a b"', text)).toBe(true);
      expect(matches('tag:"a c"', text)).toBe(false);
    });
  });

  describe('a field with no value yet', () => {
    it.each(['class:', 'applies:', 'mat:', 'stack:', 'kw:""', '""', 'uses:/', 'kw:" / "'])(
      '%s narrows nothing',
      (source) => {
        expect(matches(source, trait())).toBe(true);
      },
    );
  });

  // The domain of a field is what lint and suggestions read, so it has to say what the matcher does. Each test below
  // runs the matcher and compares it with the domain, on traits made to tell the cases apart.
  describe('the values each field takes', () => {
    const fieldNamed = (name: string): FieldDefinition => {
      const found = fieldRegistry.resolve(name);
      if (found === undefined) throw new Error(`There is no field "${name}"`);
      return found;
    };

    /** What `mode` means, written out once for the tests: whether the text `entry` fits the value asked for. */
    const fits = (mode: MatchMode, entry: string, value: string): boolean =>
      mode === 'exact' ? entry === value : mode === 'substring' ? entry.includes(value) : entry.startsWith(value);

    it('tells which fields are a list of the dataset, a list of choices or a keyword, and how each is compared', () => {
      expect(fieldRegistry.fields.map(({ name, values }) => [name, values?.kind, values?.mode])).toEqual([
        ['class', 'vocabulary', 'substring'],
        ['family', 'vocabulary', 'substring'],
        ['creature', 'vocabulary', 'substring'],
        ['trait', 'vocabulary', 'substring'],
        ['desc', undefined, undefined],
        ['applies', 'keyword', 'prefix'],
        ['uses', 'keyword', 'prefix'],
        ['kw', 'keyword', 'prefix'],
        ['mat', 'choices', 'exact'],
        ['stack', 'choices', 'exact'],
      ]);
    });

    describe('a list of the dataset', () => {
      const subjects = [
        trait({ class: 'Life', family: 'Clutcher', creature: 'Clutcher Bruiser', name: 'Last Stand' }),
        trait({ class: 'Death', family: 'Abomination', creature: 'Abomination Brute', name: 'Flesh Rot' }),
        trait({ class: 'Rodian Master', family: 'Clutcher', creature: 'Clutcher Bruiser', name: 'Stand Alone' }),
        trait({ kind: 'mastery', creature: null, family: 'Rodian', class: 'Life', name: 'Master of Sins' }),
      ].map(indexTrait);

      it.each([
        ['class', 'class'],
        ['family', 'family'],
        ['creature', 'creature'],
        ['trait', 'name'],
      ] as const)('%s: names the column of the dataset it takes its values from', (name, column) => {
        expect(fieldNamed(name).values).toMatchObject({ kind: 'vocabulary', column });
      });

      it.each(['class', 'family', 'creature', 'trait'])(
        '%s: finds the traits whose entry fits the value, for every part of every entry and for what is none of them',
        (name) => {
          const { values, matcher } = fieldNamed(name);
          if (values?.kind !== 'vocabulary') throw new Error(`${name} has no vocabulary`);
          const entries = subjects.map(({ columns }) => columns[values.column]);
          const asked = new Set(['zzz', 'clutchers', 'master of sins and more']);
          for (const entry of entries) {
            for (let start = 0; start < entry.length; start += 1) {
              for (let end = start + 1; end <= entry.length; end += 1) asked.add(entry.slice(start, end));
            }
          }
          for (const value of asked) {
            const expected = subjects.filter(({ columns }) => fits(values.mode, columns[values.column], value));
            expect(subjects.filter(matcher(value)), JSON.stringify(value)).toEqual(expected);
          }
        },
      );
    });

    describe('a list of choices', () => {
      const subjects = [
        trait({ material: 'Brute Stitches', stacks: true }),
        trait({ material: 'Brute Stitches', stacks: false }),
        trait({ material: null, stacks: true }),
        trait({ material: null, stacks: false }),
      ].map(indexTrait);

      const choicesOf = (name: string): readonly ValueChoice[] => {
        const { values } = fieldNamed(name);
        if (values?.kind !== 'choices') throw new Error(`${name} has no choices`);
        return values.choices;
      };

      it.each([
        ['mat', [['yes'], ['no', 'none']]],
        ['stack', [['yes'], ['no']]],
      ])('%s: takes the spellings of QUERY_LANGUAGE §2', (name, spellings) => {
        expect(choicesOf(name).map(({ value, aliases }) => [value, ...aliases])).toEqual(spellings);
      });

      it.each(['mat', 'stack'])('%s: finds, under every spelling of a choice, what the choice finds', (name) => {
        const { matcher } = fieldNamed(name);
        for (const choice of choicesOf(name)) {
          const found = subjects.filter(choice.matcher);
          // A choice that found every trait or none would tell nothing apart, and the comparison would prove little.
          expect(found.length, choice.value).toBeGreaterThan(0);
          expect(found.length, choice.value).toBeLessThan(subjects.length);
          for (const spelling of [choice.value, ...choice.aliases]) {
            expect(subjects.filter(matcher(spelling)), spelling).toEqual(found);
          }
        }
      });

      it.each(['mat', 'stack'])('%s: finds nothing for a value that is not a choice', (name) => {
        const { matcher } = fieldNamed(name);
        for (const value of [
          'maybe',
          'y',
          'true',
          'yes!',
          'yess',
          'ye',
          'constructor',
          '__proto__',
          'tostring',
          'has material',
        ]) {
          expect(subjects.filter(matcher(value)), value).toEqual([]);
        }
      });
    });

    describe('a keyword', () => {
      const kinds: KeywordKind[] = ['debuff', 'buff', 'effect', 'event', 'mechanic', 'flag'];

      it.each([
        ['applies', [true, true, true, true, false, false]],
        ['uses', [true, true, true, true, false, false]],
        ['kw', [true, true, true, true, true, true]],
      ])('%s: takes the kinds of keyword it can find', (name, accepted) => {
        const { values } = fieldNamed(name);
        if (values?.kind !== 'keyword') throw new Error(`${name} has no keywords`);
        expect(kinds.map((kind) => values.accepts(kind))).toEqual(accepted);
      });

      it.each(['applies', 'uses', 'kw'] as const)(
        '%s: finds the key of every keyword of the taxonomy exactly when it takes its kind',
        (name) => {
          const { values } = fieldNamed(name);
          if (values?.kind !== 'keyword') throw new Error(`${name} has no keywords`);
          for (const { key, kind } of taxonomy.entries) {
            // A keyword that has a role is mentioned in the one the field reads; one that has none is mentioned bare.
            const role = hasRole(kind) ? (name === 'uses' ? 'uses' : 'applies') : undefined;
            const subject = trait({ keywords: [hit(key, kind, role)] });
            expect(matches(`${name}:"${key}"`, subject), `${name}:"${key}" (${kind})`).toBe(values.accepts(kind));
          }
        },
      );
    });
  });

  describe('what a term says in words', () => {
    const say = (field: string, value: string): string => {
      const found = fieldRegistry.resolve(field);
      if (found === undefined) throw new Error(`There is no field "${field}"`);
      return found.describe(value);
    };

    it.each([
      ['class', 'life', 'class contains “life”'],
      ['family', 'clutcher', 'family contains “clutcher”'],
      ['creature', 'bruiser', 'creature contains “bruiser”'],
      ['trait', 'last stand', 'trait name contains “last stand”'],
      ['desc', 'weak', 'description contains “weak”'],
    ])('%s:%s reads "%s"', (field, value, words) => {
      expect(say(field, value)).toBe(words);
    });

    it('reads a field by its name, whichever spelling the query used', () => {
      expect(say('c', 'life')).toBe(say('class', 'life'));
    });

    it.each([
      ['applies', 'vulnerable', 'applies “vulnerable”'],
      ['applies', 'vul', 'applies “vul”'],
      ['uses', 'weak', 'relies on “weak”'],
      ['kw', 'weak', 'has keyword “weak”'],
      ['uses', 'start of battle', 'relies on “start of battle”'],
    ])('%s:%s reads "%s"', (field, value, words) => {
      expect(say(field, value)).toBe(words);
    });

    it.each([
      ['self', 'by this creature'],
      ['ally', 'by your creatures'],
      ['enemy', 'by an enemy'],
      ['any', 'by any creature'],
    ] as const)('says who acts, when the value names %s: %s', (actor, words) => {
      expect(say('uses', `attack/${actor}`)).toBe(`relies on “attack” ${words}`);
      expect(say('applies', `provoke/${actor}`)).toBe(`applies “provoke” ${words}`);
      expect(say('kw', `death/${actor}`)).toBe(`has keyword “death” ${words}`);
    });

    it('says "any event" for an actor with no key', () => {
      expect(say('uses', '/self')).toBe('relies on any event by this creature');
    });

    it('reads a slash with no actor after it as the key alone', () => {
      expect(say('uses', 'attack/')).toBe('relies on “attack”');
    });

    it('says a slash and nothing else asks for nothing, as the search takes it', () => {
      expect(say('uses', '/')).toBe('asks for nothing');
    });

    it('reads an old trigger phrase as the event and the actor it stands for', () => {
      expect(say('uses', 'after this creature attacks')).toBe('relies on “attack” by this creature');
      expect(say('kw', 'is killed')).toBe('has keyword “death”');
    });

    it('keeps a word after the slash that is no actor in the key, as the search does', () => {
      expect(say('uses', 'provoke/nobody')).toBe('relies on “provoke/nobody”');
    });

    it.each([
      ['mat', 'yes', 'has a material'],
      ['mat', 'no', 'has no material'],
      ['mat', 'none', 'has no material'],
      ['stack', 'yes', 'stacks'],
      ['stack', 'no', 'does not stack'],
    ])('%s:%s reads "%s"', (field, value, words) => {
      expect(say(field, value)).toBe(words);
    });

    it.each([
      ['mat', 'maybe', 'mat is “maybe”'],
      ['stack', 'none', 'stack is “none”'],
    ])('says what was asked for a value the field does not take: %s:%s', (field, value, words) => {
      expect(say(field, value)).toBe(words);
    });
  });

  describe('the registry of the app', () => {
    it('has the ten fields of QUERY_LANGUAGE §2, with their spellings', () => {
      expect(fieldRegistry.fields.map(({ name, aliases }) => [name, ...aliases])).toEqual([
        ['class', 'c'],
        ['family', 'fam', 'f'],
        ['creature', 'cr'],
        ['trait', 't'],
        ['desc', 'd'],
        ['applies', 'a'],
        ['uses', 'u'],
        ['kw', 'k'],
        ['mat'],
        ['stack'],
      ]);
    });
  });
});
