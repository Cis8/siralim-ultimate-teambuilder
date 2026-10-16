import { describe, expect, it } from 'vitest';
import { OverridesError } from './overrides-error';
import { parseOverrides } from './parse-overrides';

function failureOf(yaml: string): string {
  try {
    parseOverrides(yaml);
  } catch (error) {
    if (error instanceof OverridesError) return error.message;
    throw error;
  }
  throw new Error('Expected parseOverrides to throw');
}

const ROLE = `
roles:
  - trait: sandstorm
    keyword: blind
    occurrence: 2
    role: uses
    reason: Sandstorm, second sentence, only reads Blind.
`;

describe('parseOverrides', () => {
  describe('what it accepts', () => {
    it('reads role overrides', () => {
      expect(parseOverrides(ROLE)).toEqual({
        roles: [
          {
            trait: 'sandstorm',
            keyword: 'blind',
            occurrence: 2,
            role: 'uses',
            reason: 'Sandstorm, second sentence, only reads Blind.',
          },
        ],
        randomDebuff: [],
      });
    });

    it('does not need an occurrence: the override then covers every mention', () => {
      const parsed = parseOverrides(`
roles:
  - { trait: x, keyword: weak, role: applies, reason: Because. }
`);
      expect(parsed.roles[0]).toEqual({ trait: 'x', keyword: 'weak', role: 'applies', reason: 'Because.' });
      expect(parsed.roles[0]).not.toHaveProperty('occurrence');
    });

    it('reads a role that only guards against a status', () => {
      const parsed = parseOverrides(
        "roles:\n  - { trait: x, keyword: weak, role: resists, reason: 'Immune to it.' }\n",
      );
      expect(parsed.roles[0]?.role).toBe('resists');
    });

    it('reads random-debuff overrides', () => {
      const parsed = parseOverrides(`
randomDebuff:
  - trait: grim-ailment
    target: enemy
    activation: conditional
    note: After your creatures apply a debuff
    reason: Grim Ailment waits for another debuff to be applied.
  - { trait: pandemic, target: enemy, activation: unconditional, reason: Pandemic is a plain source. }
`);
      expect(parsed.randomDebuff).toEqual([
        {
          trait: 'grim-ailment',
          target: 'enemy',
          activation: 'conditional',
          note: 'After your creatures apply a debuff',
          reason: 'Grim Ailment waits for another debuff to be applied.',
        },
        { trait: 'pandemic', target: 'enemy', activation: 'unconditional', reason: 'Pandemic is a plain source.' },
      ]);
    });

    it.each([
      ['an empty file', ''],
      ['a file of comments', '# Nothing to correct yet.\n# Add entries under roles: or randomDebuff:.\n'],
      ['empty sections', 'roles: []\nrandomDebuff: []\n'],
      ['empty keys', 'roles:\nrandomDebuff:\n'],
    ])('reads %s as no overrides', (_label, yaml) => {
      expect(parseOverrides(yaml)).toEqual({ roles: [], randomDebuff: [] });
    });
  });

  describe('what it refuses', () => {
    it('needs a reason, so that every correction can be reviewed', () => {
      const message = failureOf('roles:\n  - { trait: x, keyword: weak, role: uses }\n');
      expect(message).toMatch(/roles\[0\]/);
      expect(message).toMatch(/reason/);
    });

    it.each([
      ['empty', "''"],
      ['blank', '"   "'],
    ])('refuses a reason that is %s', (_label, reason) => {
      expect(failureOf(`roles:\n  - { trait: x, keyword: weak, role: uses, reason: ${reason} }\n`)).toMatch(/reason/);
    });

    it('refuses a role that is neither applies nor uses', () => {
      expect(failureOf('roles:\n  - { trait: x, keyword: weak, role: gives, reason: r }\n')).toMatch(
        /roles\[0\]\.role.*applies.*uses/s,
      );
    });

    it('refuses a target or activation it does not know', () => {
      const message = failureOf('randomDebuff:\n  - { trait: x, target: nobody, activation: sometimes, reason: r }\n');
      expect(message).toMatch(/randomDebuff\[0\]\.target/);
      expect(message).toMatch(/randomDebuff\[0\]\.activation/);
    });

    it.each(['0', '-1', '1.5', '"two"'])('refuses the occurrence %s', (occurrence) => {
      expect(
        failureOf(`roles:\n  - { trait: x, keyword: weak, occurrence: ${occurrence}, role: uses, reason: r }\n`),
      ).toMatch(/roles\[0\]\.occurrence/);
    });

    it('refuses a missing trait or keyword', () => {
      const message = failureOf('roles:\n  - { role: uses, reason: r }\n');
      expect(message).toMatch(/roles\[0\]\.trait/);
      expect(message).toMatch(/roles\[0\]\.keyword/);
    });

    it('refuses a misspelt field instead of ignoring it', () => {
      expect(failureOf('roles:\n  - { trait: x, keyword: weak, role: uses, reason: r, reasn: typo }\n')).toMatch(
        /roles\[0\].*reasn/s,
      );
    });

    it('refuses a section it does not know', () => {
      expect(failureOf('role:\n  - { trait: x }\n')).toMatch(/role/);
    });

    it('refuses a file that is not a mapping', () => {
      expect(failureOf('- just\n- a list\n')).toMatch(/must have the sections/);
      expect(failureOf('just text')).toMatch(/must have the sections/);
    });

    it('refuses YAML that cannot be read', () => {
      expect(failureOf('roles: [unclosed')).toMatch(/not valid YAML/);
    });

    it('reports every problem at once', () => {
      const message = failureOf(
        'roles:\n  - { trait: a, keyword: weak, role: uses }\n  - { trait: b, keyword: weak, role: wrong, reason: r }\n',
      );
      expect(message).toMatch(/roles\[0\]/);
      expect(message).toMatch(/roles\[1\]/);
    });
  });
});
