import { createTaxonomy, type PartyRequirement, type Trait } from '@atlas/core';
import { describe, expect, it } from 'vitest';
import type { BuiltTraits } from '../build/build-traits';
import { buildReport, type PreviousBuild } from './build-report';

function trait(id: string, overrides: Partial<Trait> = {}): Trait {
  return {
    id,
    name: id,
    creature: 'Somebody',
    family: 'Family',
    class: 'Death',
    kind: 'creature',
    description: 'Text.',
    material: 'Stitches',
    stacks: true,
    randomDebuff: null,
    masteryFamily: null,
    partyRequirement: null,
    conditionalSources: [],
    keywords: [],
    ...overrides,
  };
}

const build = (datasetVersion: string, traits: Trait[], warnings: string[] = []): BuiltTraits => ({
  datasetVersion,
  traits,
  warnings,
});
const previousOf = (built: BuiltTraits): PreviousBuild => ({
  datasetVersion: built.datasetVersion,
  traits: built.traits.map((t) => ({ ...t })),
});
const mastery = (id: string, partyRequirement: PartyRequirement): Trait =>
  trait(id, { kind: 'mastery', class: 'Rodian Master', creature: null, masteryFamily: 'Family', partyRequirement });

describe('buildReport', () => {
  describe('between two versions of the sheet', () => {
    const before = build('2.0', [
      trait('a--keep'),
      trait('b--gone'),
      trait('c--edit', { description: 'Old.', material: 'Stitches' }),
    ]);
    const after = build('2.1', [
      trait('a--keep'),
      trait('c--edit', { description: 'New.', material: null }),
      trait('d--new', { class: 'Foo', kind: 'other' }),
    ]);

    it('tells what changed, what there is and what needs attention', () => {
      expect(buildReport(after, previousOf(before))).toBe(
        [
          '# Data report: Siralim Ultimate compendium v2.1',
          '',
          '## Changes since the previous build (v2.0)',
          '',
          'Traits: 3 → 3 (±0).',
          '',
          '### Added (1)',
          '',
          '- `d--new`',
          '',
          '### Removed (1)',
          '',
          '- `b--gone`',
          '',
          '### Changed (1)',
          '',
          '- `c--edit`: description, material',
          '',
          '## Counts',
          '',
          '### Kinds',
          '',
          '| Kind | Traits |',
          '|---|---|',
          '| creature | 2 |',
          '| avatar | 0 |',
          '| mastery | 0 |',
          '| backer | 0 |',
          '| other | 1 |',
          '',
          '### Classes',
          '',
          '| Class | Traits |',
          '|---|---|',
          '| Death | 2 |',
          '| Foo | 1 |',
          '',
          '## Needs attention',
          '',
          '- Class `Foo` (1 trait) is not in GAME_RULES R7. It is read as `other`, so its traits can only sit in the Artifact slot until the owner confirms it.',
          '',
        ].join('\n'),
      );
    });

    it('is the same text every time', () => {
      expect(buildReport(after, previousOf(before))).toBe(buildReport(after, previousOf(before)));
    });
  });

  describe('changes since the previous build', () => {
    const built = build('2.0', [trait('a'), trait('b')]);

    it('says so when there is nothing to compare with', () => {
      const report = buildReport(built, null);
      expect(report).toContain('## Changes since the previous build\n\nNo previous build to compare with.');
      expect(report).not.toContain('### Added');
    });

    it('says so when nothing changed', () => {
      expect(buildReport(built, previousOf(built))).toContain(
        'Traits: 2 → 2 (±0). No trait was added, removed or changed.',
      );
    });

    it.each([
      [[trait('a')], 'Traits: 1 → 2 (+1).'],
      [[trait('a'), trait('b'), trait('c'), trait('d')], 'Traits: 4 → 2 (-2).'],
    ])('shows the change in the number of traits', (previousTraits, expected) => {
      expect(buildReport(built, previousOf(build('2.0', previousTraits)))).toContain(expected);
    });

    it('names the previous version', () => {
      expect(buildReport(built, previousOf(build('1.9', [])))).toContain('since the previous build (v1.9)');
    });

    it('lists at most 50 ids of a kind and counts the rest', () => {
      const many = build(
        '2.0',
        Array.from({ length: 60 }, (_, i) => trait(`t-${String(i).padStart(2, '0')}`)),
      );
      const report = buildReport(many, previousOf(build('2.0', [])));
      expect(report).toContain('### Added (60)');
      expect(report).toContain('- `t-49`');
      expect(report).not.toContain('- `t-50`');
      expect(report).toContain('- …and 10 more');
    });
  });

  describe('counts', () => {
    it('counts masteries by the kind of party requirement', () => {
      const report = buildReport(
        build('2.0', [
          mastery('m1', { type: 'allFamily', families: ['Family'] }),
          mastery('m2', { type: 'allFamily', families: ['Family'] }),
          mastery('m3', { type: 'none' }),
        ]),
        null,
      );
      expect(report).toContain(
        [
          '### Mastery requirements',
          '',
          '| Requirement | Traits |',
          '|---|---|',
          '| allFamily | 2 |',
          '| distinctFamilyCount | 0 |',
          '| perFamilyCount | 0 |',
          '| classDiversity | 0 |',
          '| familyScoped | 0 |',
          '| none | 1 |',
        ].join('\n'),
      );
    });

    it('leaves out the mastery table when there are no masteries', () => {
      expect(buildReport(build('2.0', [trait('a')]), null)).not.toContain('Mastery requirements');
    });

    it('counts the traits that afflict a random debuff', () => {
      const report = buildReport(
        build('2.0', [
          trait('a', { randomDebuff: { target: 'enemy', activation: 'unconditional' } }),
          trait('b', { randomDebuff: { target: 'enemy', activation: 'conditional', note: 'After X' } }),
          trait('c', { randomDebuff: { target: 'both', activation: 'unconditional' } }),
          trait('d'),
        ]),
        null,
      );
      expect(report).toContain('### Random debuffs\n\n3 traits afflict one: 2 aimed at enemies only, 1 conditional.');
    });

    it('leaves out the random debuffs when there are none', () => {
      expect(buildReport(build('2.0', [trait('a')]), null)).not.toContain('Random debuffs');
    });

    it('orders classes by number of traits, then by name', () => {
      const report = buildReport(
        build('2.0', [
          trait('a', { class: 'Life' }),
          trait('b', { class: 'Death' }),
          trait('c', { class: 'Death' }),
          trait('d', { class: 'Chaos' }),
        ]),
        null,
      );
      expect(report.indexOf('| Death | 2 |')).toBeLessThan(report.indexOf('| Chaos | 1 |'));
      expect(report.indexOf('| Chaos | 1 |')).toBeLessThan(report.indexOf('| Life | 1 |'));
    });
  });

  describe('keywords', () => {
    const hit = (key: string, kind: 'debuff' | 'buff' | 'event' | 'mechanic', role?: 'applies' | 'uses' | 'resists') =>
      role === undefined ? { key, kind, span: [0, 1] as const } : { key, kind, span: [0, 1] as const, role };

    it('counts the mentions, and how many buffs and debuffs are given or relied on', () => {
      const report = buildReport(
        build('2.0', [
          trait('a', { keywords: [hit('weak', 'debuff', 'applies'), hit('timeline', 'mechanic')] }),
          trait('b', { keywords: [hit('weak', 'debuff', 'uses'), hit('barrier', 'buff', 'applies')] }),
          trait('c'),
        ]),
        null,
      );
      expect(report).toContain(
        '### Keywords\n\n4 mentions in 2 traits. Of the 3 buffs, debuffs and effects, 2 are given (applies), 1 relied on (uses) and 0 guarded against (resists).',
      );
    });

    it('counts the events apart: they are caused, waited for or prevented, never given or relied on', () => {
      const report = buildReport(
        build('2.0', [
          trait('a', { keywords: [hit('weak', 'debuff', 'applies'), hit('attack', 'event', 'applies')] }),
          trait('b', {
            keywords: [hit('attack', 'event', 'uses'), hit('death', 'event', 'uses'), hit('heal', 'event', 'resists')],
          }),
        ]),
        null,
      );
      expect(report).toContain('Of the 1 buffs, debuffs and effects, 1 are given (applies), 0 relied on (uses)');
      expect(report).toContain(
        'Of the 4 events, 1 are caused (applies), 2 waited for (uses) and 1 prevented (resists).',
      );
    });

    it('counts the traits that apply debuffs only through a pair', () => {
      const report = buildReport(
        build('2.0', [
          trait('a', { keywords: [hit('weak', 'debuff', 'uses')], conditionalSources: ['weak', 'vulnerable'] }),
          trait('b', { keywords: [hit('weak', 'debuff', 'uses')] }),
        ]),
        null,
      );
      expect(report).toContain('1 trait applies debuffs only through a pair (conditional sources).');
    });

    it('leaves the section out when nothing was extracted', () => {
      expect(buildReport(build('2.0', [trait('a')]), null)).not.toContain('### Keywords');
    });
  });

  describe('needs attention', () => {
    it('passes on the warnings of overrides that change nothing', () => {
      const report = buildReport(
        build('2.0', [trait('a')], ['roles[0]: in "a", "weak" is already "uses"; this changes nothing']),
        null,
      );
      expect(report).toContain('- Override roles[0]: in "a", "weak" is already "uses"; this changes nothing');
    });

    it('is empty when everything is known', () => {
      expect(buildReport(build('2.0', [trait('a')]), null)).toContain('## Needs attention\n\nNothing.');
    });

    it('flags a class outside GAME_RULES R7, with the number of traits', () => {
      const report = buildReport(build('2.0', [trait('a', { class: 'Foo' }), trait('b', { class: 'Foo' })]), null);
      expect(report).toContain('- Class `Foo` (2 traits) is not in GAME_RULES R7.');
    });

    it('flags a mastery whose requirement names no family it knows', () => {
      const report = buildReport(
        build('2.0', [
          mastery('m-bad', { type: 'allFamily', families: [] }),
          mastery('m-ok', { type: 'allFamily', families: ['Family'] }),
          mastery('m-none', { type: 'none' }),
          mastery('m-class', { type: 'classDiversity' }),
        ]),
        null,
      );
      expect(report).toContain('- `m-bad`: the `allFamily` requirement names no family the sheet knows.');
      expect(report).not.toContain('`m-ok`:');
      expect(report).not.toContain('`m-none`:');
      expect(report).not.toContain('`m-class`:');
    });
  });

  describe('taxonomy', () => {
    const moonbeam = (id: string) => trait(id, { description: 'This creature casts Moonbeam and Frostbolt.' });
    const traits = [moonbeam('a'), moonbeam('b'), moonbeam('c')];
    const withKeywords = (list: Trait[]) =>
      list.map((entry) => ({
        ...entry,
        keywords: [{ key: 'weak', kind: 'debuff' as const, span: [0, 1] as const, role: 'uses' as const }],
      }));
    const taxonomy = createTaxonomy([
      { kind: 'debuff', key: 'weak', label: 'Weak', patterns: ['Weak'], canBeRandomlyApplied: true },
    ]);

    it('lists the capitalised terms no keyword covers, most frequent first', () => {
      const report = buildReport(build('2.0', [...traits, trait('d', { description: 'Casts Frostbolt.' })]), null, {
        taxonomy,
      });
      expect(report).toContain(
        [
          '## Taxonomy',
          '',
          '### Candidates',
          '',
          'Capitalised terms in at least 3 traits that no keyword covers and nobody has ruled out.',
          '',
          '| Term | Traits | Example | Buff or debuff? |',
          '|---|---|---|---|',
          '| Frostbolt | 4 | `a` | - |',
          '| Moonbeam | 3 | `a` | - |',
        ].join('\n'),
      );
    });

    it('flags a term that follows "gains" or "afflicted with"', () => {
      const gains = ['a', 'b', 'c'].map((id) => trait(id, { description: 'This creature gains Taunted.' }));
      expect(buildReport(build('2.0', gains), null, { taxonomy })).toContain('| Taunted | 3 | `a` | maybe |');
    });

    it('leaves out terms that were ruled out', () => {
      const report = buildReport(build('2.0', traits), null, {
        taxonomy,
        ignoredTerms: new Set(['Moonbeam', 'Frostbolt']),
      });
      expect(report).not.toContain('### Candidates');
    });

    it('lists at most 25 candidates and counts the rest', () => {
      const words = Array.from({ length: 30 }, (_, i) => `W${'a'.repeat(i + 1)}`);
      const many = ['a', 'b', 'c'].map((id) => trait(id, { description: `Casts ${words.join(', ')}.` }));
      const report = buildReport(build('2.0', many), null, { taxonomy });
      expect(report).toContain('- …and 5 more');
    });

    it('compares with the canonical lists once keywords were extracted', () => {
      const report = buildReport(build('2.0', withKeywords([trait('a', { description: 'Weak.' })])), null, {
        taxonomy: createTaxonomy([
          { kind: 'debuff', key: 'weak', label: 'Weak', patterns: ['Weak'], canBeRandomlyApplied: true },
          { kind: 'buff', key: 'shelled', label: 'Shelled', patterns: ['Shelled'] },
        ]),
      });
      expect(report).toContain(
        '### Compared with the canonical lists\n\n- "Shelled" is in the canonical lists, but no trait mentions it.',
      );
    });

    it('is left out when there is nothing to say', () => {
      expect(buildReport(build('2.0', [trait('a')]), null, { taxonomy })).not.toContain('## Taxonomy');
    });
  });
});
