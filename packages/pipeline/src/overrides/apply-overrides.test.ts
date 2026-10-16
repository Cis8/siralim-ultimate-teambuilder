import type { KeywordHit, Trait } from '@atlas/core';
import { describe, expect, it } from 'vitest';
import { applyOverrides } from './apply-overrides';
import { OverridesError } from './overrides-error';
import type { Overrides } from './parse-overrides';

const hit = (key: string, role: 'applies' | 'uses', start = 0): KeywordHit => ({
  key,
  kind: 'debuff',
  span: [start, start + key.length],
  role,
});

function trait(id: string, keywords: KeywordHit[], overrides: Partial<Trait> = {}): Trait {
  return {
    id,
    name: id,
    creature: 'Somebody',
    family: 'Family',
    class: 'Death',
    kind: 'creature',
    description: 'Text.',
    material: null,
    stacks: true,
    randomDebuff: null,
    masteryFamily: null,
    partyRequirement: null,
    conditionalSources: [],
    keywords,
    ...overrides,
  };
}

const none: Overrides = { roles: [], randomDebuff: [] };
const roles = (...entries: Overrides['roles'][number][]): Overrides => ({ ...none, roles: entries });
const roleOf = (key: string, role: 'applies' | 'uses', extra: object = {}) => ({
  trait: 'sandstorm',
  keyword: key,
  role,
  reason: 'r',
  ...extra,
});

function failureOf(traits: Trait[], overrides: Overrides): string {
  try {
    applyOverrides(traits, overrides);
  } catch (error) {
    if (error instanceof OverridesError) return error.message;
    throw error;
  }
  throw new Error('Expected applyOverrides to throw');
}

const SANDSTORM = trait('sandstorm', [
  hit('blind', 'applies', 0),
  hit('blind', 'applies', 20),
  hit('weak', 'uses', 40),
]);

describe('applyOverrides', () => {
  it('changes nothing, and says nothing, without overrides', () => {
    const traits = [SANDSTORM];
    expect(applyOverrides(traits, none)).toEqual({ traits, warnings: [] });
  });

  describe('roles', () => {
    it('sets the role of every mention of the keyword in the trait', () => {
      const { traits } = applyOverrides([SANDSTORM], roles(roleOf('blind', 'uses')));
      expect(traits[0]?.keywords.map((h) => `${h.key}:${h.role}`)).toEqual(['blind:uses', 'blind:uses', 'weak:uses']);
    });

    it('sets the role of one mention when told which', () => {
      const { traits } = applyOverrides([SANDSTORM], roles(roleOf('blind', 'uses', { occurrence: 2 })));
      expect(traits[0]?.keywords.map((h) => `${h.key}:${h.role}`)).toEqual([
        'blind:applies',
        'blind:uses',
        'weak:uses',
      ]);
    });

    it('keeps the kind and the span of what it changes', () => {
      const { traits } = applyOverrides([SANDSTORM], roles(roleOf('weak', 'applies')));
      expect(traits[0]?.keywords[2]).toEqual({ key: 'weak', kind: 'debuff', span: [40, 44], role: 'applies' });
    });

    it('leaves other traits and the input untouched', () => {
      const other = trait('other', [hit('blind', 'applies')]);
      const { traits } = applyOverrides([other, SANDSTORM], roles(roleOf('blind', 'uses')));
      expect(traits[0]).toBe(other);
      expect(SANDSTORM.keywords[0]?.role).toBe('applies');
    });

    it('lets two mentions of a keyword be set differently', () => {
      const { traits } = applyOverrides(
        [SANDSTORM],
        roles(roleOf('blind', 'uses', { occurrence: 1 }), roleOf('blind', 'applies', { occurrence: 2 })),
      );
      expect(traits[0]?.keywords.map((h) => h.role)).toEqual(['uses', 'applies', 'uses']);
    });

    it('warns about an override that changes nothing, and still applies it', () => {
      const { traits, warnings } = applyOverrides([SANDSTORM], roles(roleOf('weak', 'uses')));
      expect(warnings).toEqual([expect.stringMatching(/roles\[0\].*sandstorm.*weak.*already/)]);
      expect(traits[0]).toEqual(SANDSTORM);
    });

    it('does not warn when only some of the mentions change', () => {
      const mixed = trait('sandstorm', [hit('blind', 'uses', 0), hit('blind', 'applies', 20)]);
      expect(applyOverrides([mixed], roles(roleOf('blind', 'uses'))).warnings).toEqual([]);
    });
  });

  describe('what it refuses', () => {
    it('an override for a trait that does not exist', () => {
      expect(failureOf([SANDSTORM], roles(roleOf('weak', 'uses', { trait: 'nothing' })))).toMatch(
        /roles\[0\].*no trait "nothing"/,
      );
    });

    it('an override for a keyword the trait does not mention', () => {
      expect(failureOf([SANDSTORM], roles(roleOf('vulnerable', 'uses')))).toMatch(
        /roles\[0\].*"sandstorm" does not mention "vulnerable"/,
      );
    });

    it('an occurrence the trait does not have', () => {
      expect(failureOf([SANDSTORM], roles(roleOf('blind', 'uses', { occurrence: 3 })))).toMatch(
        /roles\[0\].*mentions "blind" 2 times.*occurrence 3/,
      );
    });

    it('a role on a keyword that has none', () => {
      const withTrigger = trait('sandstorm', [{ key: 'start of battle', kind: 'trigger', span: [0, 15] }]);
      expect(failureOf([withTrigger], roles(roleOf('start of battle', 'uses')))).toMatch(/roles\[0\].*no role/);
    });

    it('two overrides for the same mention', () => {
      expect(failureOf([SANDSTORM], roles(roleOf('weak', 'uses'), roleOf('weak', 'applies')))).toMatch(
        /roles\[1\].*same.*roles\[0\]/,
      );
    });

    it('an override for all mentions next to one for a single mention', () => {
      expect(
        failureOf([SANDSTORM], roles(roleOf('blind', 'uses'), roleOf('blind', 'applies', { occurrence: 1 }))),
      ).toMatch(/roles\[1\].*same.*roles\[0\]/);
    });

    it('everything wrong at once', () => {
      const message = failureOf(
        [SANDSTORM],
        roles(roleOf('weak', 'uses', { trait: 'nothing' }), roleOf('vulnerable', 'uses')),
      );
      expect(message).toMatch(/roles\[0\]/);
      expect(message).toMatch(/roles\[1\]/);
    });
  });

  describe('random debuffs', () => {
    const source = { target: 'enemy', activation: 'unconditional' } as const;
    const pandemic = trait('pandemic', [], { randomDebuff: source });
    const entry = { trait: 'pandemic', target: 'enemy', activation: 'conditional', reason: 'r' } as const;

    it('replaces what was detected', () => {
      const { traits, warnings } = applyOverrides([pandemic], {
        ...none,
        randomDebuff: [{ ...entry, note: 'After a debuff' }],
      });
      expect(traits[0]?.randomDebuff).toEqual({ target: 'enemy', activation: 'conditional', note: 'After a debuff' });
      expect(warnings).toEqual([]);
    });

    it('leaves out the note when there is none', () => {
      const { traits } = applyOverrides([pandemic], { ...none, randomDebuff: [{ ...entry, target: 'both' }] });
      expect(traits[0]?.randomDebuff).toEqual({ target: 'both', activation: 'conditional' });
      expect(traits[0]?.randomDebuff).not.toHaveProperty('note');
    });

    it('can name a source the wording missed', () => {
      const plain = trait('pandemic', []);
      const { traits } = applyOverrides([plain], { ...none, randomDebuff: [entry] });
      expect(traits[0]?.randomDebuff).toEqual({ target: 'enemy', activation: 'conditional' });
    });

    it('warns about an override that says what was already detected', () => {
      const { warnings } = applyOverrides([pandemic], {
        ...none,
        randomDebuff: [{ ...entry, activation: 'unconditional' }],
      });
      expect(warnings).toEqual([expect.stringMatching(/randomDebuff\[0\].*pandemic.*already/)]);
    });

    it('refuses a trait that does not exist, and two entries for one trait', () => {
      expect(failureOf([pandemic], { ...none, randomDebuff: [{ ...entry, trait: 'nothing' }] })).toMatch(
        /randomDebuff\[0\].*no trait "nothing"/,
      );
      expect(failureOf([pandemic], { ...none, randomDebuff: [entry, entry] })).toMatch(
        /randomDebuff\[1\].*randomDebuff\[0\]/,
      );
    });
  });
});
