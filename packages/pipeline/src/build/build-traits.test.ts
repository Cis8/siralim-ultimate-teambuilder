import { describe, expect, it } from 'vitest';
import { OverridesError } from '../overrides/overrides-error';
import type { Overrides } from '../overrides/parse-overrides';
import { SheetFormatError } from '../sheet/sheet-format-error';
import { buildTraits } from './build-traits';

const HEADER = '"Class","Family","Creature","Trait Name","Trait Description","Material Name"';
const csv = (...rows: string[]) => ['"Siralim Ultimate","","Version 2.0"', HEADER, ...rows].join('\n');

describe('buildTraits', () => {
  it('turns the sheet into enriched traits and carries the dataset version', () => {
    const built = buildTraits(
      csv(
        '"Death","Abomination","Abomination Brute","Flesh Rot","Afflicts  a debuff. This trait does not stack.","Brute Stitches"',
        '"Rodian Master","Abomination","Mastery Trait","Master of Abominations","If all the creatures in your party are Abominations, enemies take 50% more damage.","No Material Exists"',
      ),
    );

    expect(built.datasetVersion).toBe('2.0');
    expect(built.traits.map(({ id, kind, stacks, material }) => ({ id, kind, stacks, material }))).toEqual([
      { id: 'abomination--flesh-rot', kind: 'creature', stacks: false, material: 'Brute Stitches' },
      { id: 'abomination--master-of-abominations', kind: 'mastery', stacks: true, material: null },
    ]);
    expect(built.traits[0]?.description).toBe('Afflicts a debuff. This trait does not stack.');
    expect(built.traits[1]?.partyRequirement).toEqual({ type: 'allFamily', families: ['Abomination'] });
  });

  it('stops at a sheet that is not valid, whichever stage finds out', () => {
    expect(() => buildTraits('"Siralim Ultimate","","Version 2.0"\n"Foo","Bar"')).toThrow(SheetFormatError);
    expect(() => buildTraits(csv('"Death","Abomination","Abomination Brute","","Text.","Stitches"'))).toThrow(
      SheetFormatError,
    );
    expect(() =>
      buildTraits(
        csv(
          '"Death","Abomination","Abomination Brute","Flesh Rot","One.","Stitches"',
          '"Life","Abomination","Abomination Volatile","Flesh Rot","Two.","Gland"',
        ),
      ),
    ).toThrow(SheetFormatError);
  });

  describe('keywords and overrides', () => {
    const sheet = csv(
      '"Death","Abomination","Abomination Brute","Flesh Rot","After an enemy is afflicted with either Weak or Vulnerable, this creature gains Berserk.","Brute Stitches"',
    );
    const rolesOf = (traits: readonly { keywords: readonly { key: string; role?: string }[] }[]) =>
      traits[0]?.keywords.map((hit) => `${hit.key}:${hit.role}`);

    it('gives every trait the keywords of its description', () => {
      expect(rolesOf(buildTraits(sheet).traits)).toEqual(['weak:uses', 'vulnerable:uses', 'berserk:applies']);
    });

    it('has no warnings without overrides', () => {
      expect(buildTraits(sheet).warnings).toEqual([]);
    });

    it('puts the overrides over what was extracted', () => {
      const overrides: Overrides = {
        roles: [{ trait: 'abomination--flesh-rot', keyword: 'berserk', role: 'uses', reason: 'Test.' }],
        randomDebuff: [],
      };
      expect(rolesOf(buildTraits(sheet, overrides).traits)).toEqual(['weak:uses', 'vulnerable:uses', 'berserk:uses']);
    });

    it('passes on the warnings of overrides that change nothing', () => {
      const overrides: Overrides = {
        roles: [{ trait: 'abomination--flesh-rot', keyword: 'weak', role: 'uses', reason: 'Test.' }],
        randomDebuff: [],
      };
      expect(buildTraits(sheet, overrides).warnings).toEqual([expect.stringMatching(/roles\[0\].*already/)]);
    });

    it('stops at an override for a trait that is not in the sheet', () => {
      const overrides: Overrides = {
        roles: [{ trait: 'nobody--nothing', keyword: 'weak', role: 'uses', reason: 'Test.' }],
        randomDebuff: [],
      };
      expect(() => buildTraits(sheet, overrides)).toThrow(OverridesError);
    });
  });
});
