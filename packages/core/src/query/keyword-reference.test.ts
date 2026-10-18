import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { KEYWORD_ACTORS } from '../model/trait';
import { createTaxonomy } from '../taxonomy/registry';
import { parseKeywordReference, writeKeywordReference } from './keyword-reference';

const taxonomy = createTaxonomy([
  {
    kind: 'event',
    key: 'attack',
    label: 'Attack',
    patterns: ['attack'],
    group: 'actions',
    aliases: [{ key: 'after this creature attacks', actor: 'self' }, { key: 'strike' }],
  },
  { kind: 'event', key: 'start of turn', label: 'Start of turn', patterns: ['start of turn'], group: 'battle' },
  { kind: 'debuff', key: 'weak', label: 'Weak', patterns: ['Weak'], canBeRandomlyApplied: true },
]);
const parse = (text: string) => parseKeywordReference(text, taxonomy);

describe('parseKeywordReference', () => {
  it('reads a key as it is: the start of a key, whatever the letter case, trimmed', () => {
    expect(parse('weak')).toEqual({ key: 'weak' });
    expect(parse('  Start Of  ')).toEqual({ key: 'start of' });
  });

  it.each(KEYWORD_ACTORS)('reads %s after a slash as who does it', (actor) => {
    expect(parse(`attack/${actor}`)).toEqual({ key: 'attack', actor });
  });

  it('keeps the key prefix in front of the actor, and several words in the key', () => {
    expect(parse('att/enemy')).toEqual({ key: 'att', actor: 'enemy' });
    expect(parse('start of turn/ally')).toEqual({ key: 'start of turn', actor: 'ally' });
  });

  it('ignores the letter case and the blanks around the slash', () => {
    expect(parse('Attack / SELF')).toEqual({ key: 'attack', actor: 'self' });
  });

  it('reads an actor on a key that is no event too: whether it finds anything is up to the fields', () => {
    expect(parse('weak/self')).toEqual({ key: 'weak', actor: 'self' });
  });

  it('reads a key with no key yet and an actor: every event that actor takes part in', () => {
    expect(parse('/self')).toEqual({ key: '', actor: 'self' });
    expect(parse('')).toEqual({ key: '' });
  });

  describe('an alias, an old trigger phrase (ADR-0009)', () => {
    it('is the event, and the actor the phrase names', () => {
      expect(parse('after this creature attacks')).toEqual({ key: 'attack', actor: 'self' });
    });

    it('is the event of any creature when the phrase names none', () => {
      expect(parse('strike')).toEqual({ key: 'attack' });
    });

    it('is read whatever its letter case and blanks', () => {
      expect(parse('  After This Creature Attacks ')).toEqual({ key: 'attack', actor: 'self' });
    });

    it('stands alone: with an actor after it, it is the start of a key that no key has', () => {
      expect(parse('strike/enemy')).toEqual({ key: 'strike', actor: 'enemy' });
    });

    it('is not read for the start of it, which is nobody’s key', () => {
      expect(parse('after this creature')).toEqual({ key: 'after this creature' });
    });
  });

  describe('a slash that names no actor', () => {
    it('leaves the text as it is: it is a key nobody has, so it finds nothing', () => {
      expect(parse('attack/nobody')).toEqual({ key: 'attack/nobody' });
      expect(parse('attack/sel')).toEqual({ key: 'attack/sel' });
      expect(parse('a/b/c')).toEqual({ key: 'a/b/c' });
    });

    it('is no actor yet when nothing follows it, as the query is typed', () => {
      expect(parse('attack/')).toEqual({ key: 'attack' });
      expect(parse('attack/ ')).toEqual({ key: 'attack' });
      expect(parse('attack//')).toEqual({ key: 'attack' });
      expect(parse('attack/self/')).toEqual({ key: 'attack', actor: 'self' });
    });

    it('is an alias read before the slash was typed', () => {
      expect(parse('after this creature attacks/')).toEqual({ key: 'attack', actor: 'self' });
    });
  });

  it('reads the aliases of the taxonomy of the app by default', () => {
    expect(parseKeywordReference('after this creature attacks')).toEqual({ key: 'attack', actor: 'self' });
  });
});

describe('writeKeywordReference', () => {
  it('writes the key, then a slash and the actor if there is one', () => {
    expect(writeKeywordReference({ key: 'attack' })).toBe('attack');
    expect(writeKeywordReference({ key: 'start of turn', actor: 'enemy' })).toBe('start of turn/enemy');
  });

  it('is what parseKeywordReference reads back', () => {
    for (const reference of [
      { key: 'weak' },
      { key: 'attack', actor: 'any' as const },
      { key: '', actor: 'ally' as const },
    ]) {
      expect(parse(writeKeywordReference(reference))).toEqual(reference);
    }
  });

  it('writes the same reference whatever text it was read from', () => {
    fc.assert(
      fc.property(
        fc.string({ unit: fc.constantFrom('a', 'B', ' ', '/', 'é', 'self', 'any', 'attack', 'strike', ':', '"') }),
        (text) => {
          const read = parse(text);
          expect(parse(writeKeywordReference(read))).toEqual(read);
        },
      ),
    );
  });
});
