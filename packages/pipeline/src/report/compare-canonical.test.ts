import { createTaxonomy, type KeywordHit, type Trait } from '@atlas/core';
import { describe, expect, it } from 'vitest';
import { compareWithCanonicalLists } from './compare-canonical';

const taxonomy = createTaxonomy([
  {
    kind: 'debuff',
    key: 'stoned',
    label: 'Stoned',
    canonicalName: 'Stone',
    patterns: ['Stoned', 'Stone'],
    canBeRandomlyApplied: true,
  },
  { kind: 'debuff', key: 'weak', label: 'Weak', patterns: ['Weak'], canBeRandomlyApplied: true },
  { kind: 'buff', key: 'shelled', label: 'Shelled', patterns: ['Shelled'] },
  { kind: 'mechanic', key: 'timeline', label: 'Timeline', patterns: ['Timeline'] },
]);

function trait(id: string, description: string, words: Record<string, string>): Trait {
  const keywords: KeywordHit[] = Object.entries(words).map(([word, key]) => {
    const start = description.indexOf(word);
    return { key, kind: 'debuff', span: [start, start + word.length], role: 'uses' };
  });
  return {
    id,
    name: id,
    creature: null,
    family: 'Family',
    class: 'Death',
    kind: 'creature',
    description,
    material: null,
    stacks: true,
    randomDebuff: null,
    masteryFamily: null,
    partyRequirement: null,
    keywords,
  };
}

describe('compareWithCanonicalLists', () => {
  it('says how the compendium spells a name that differs from the canonical one', () => {
    const traits = [
      trait('a', 'Enemies with Stoned.', { Stoned: 'stoned' }),
      trait('b', 'It afflicts Stoned.', { Stoned: 'stoned' }),
      trait('c', 'Enemies with Stone.', { Stone: 'stoned' }),
      trait('d', 'Enemies with Weak and Shelled.', { Weak: 'weak', Shelled: 'shelled' }),
    ];
    expect(compareWithCanonicalLists(traits, taxonomy)).toEqual([
      'The canonical name "Stone" is written "Stoned" in 2 traits and "Stone" in 1 trait.',
    ]);
  });

  it('says so when the compendium never uses the canonical name, or never differs from it', () => {
    const onlyAlias = [
      trait('a', 'With Stoned.', { Stoned: 'stoned' }),
      trait('b', 'Weak and Shelled', { Weak: 'weak', Shelled: 'shelled' }),
    ];
    expect(compareWithCanonicalLists(onlyAlias, taxonomy)).toEqual([
      'The canonical name "Stone" is written "Stoned" in 1 trait.',
    ]);
  });

  it('names a buff or debuff of the canonical lists that no trait mentions', () => {
    const traits = [trait('a', 'With Stoned and Weak.', { Stoned: 'stoned', Weak: 'weak' })];
    expect(compareWithCanonicalLists(traits, taxonomy)).toContain(
      '"Shelled" is in the canonical lists, but no trait mentions it.',
    );
  });

  it('does not ask for mechanics, which are not in the canonical lists', () => {
    const traits = [trait('a', 'With Weak.', { Weak: 'weak' })];
    expect(compareWithCanonicalLists(traits, taxonomy).join('\n')).not.toMatch(/Timeline/);
  });

  it('has nothing to say when no trait has keywords: the extractor did not run', () => {
    expect(compareWithCanonicalLists([trait('a', 'Text.', {})], taxonomy)).toEqual([]);
    expect(compareWithCanonicalLists([], taxonomy)).toEqual([]);
  });
});
