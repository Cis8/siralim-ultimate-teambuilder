import { describe, expect, it } from 'vitest';
import { createTaxonomy } from '../taxonomy/registry';
import { createKeywordExtractor, extractKeywords } from './extract-keywords';

describe('extractKeywords', () => {
  it('finds the keywords of a trait with their spans and roles', () => {
    const text = 'At the start of battle, this creature gains a Barrier. This trait does not stack.';
    expect(extractKeywords(text)).toEqual([
      { key: 'start of battle', kind: 'event', span: [7, 22], role: 'uses' },
      { key: 'barrier', kind: 'buff', span: [46, 53], role: 'applies' },
      { key: 'nostack', kind: 'flag', span: [55, 80] },
    ]);
  });

  it('gives an event the role and the actor the words around it say', () => {
    expect(extractKeywords('After an enemy dodges, this creature recovers 10% health.')).toEqual([
      { key: 'dodge', kind: 'event', span: [15, 21], role: 'uses', actor: 'enemy' },
      { key: 'heal', kind: 'event', span: [37, 45], role: 'applies', actor: 'self' },
    ]);
  });

  it('cuts every keyword out of the text where its span says', () => {
    const text = 'After an enemy is afflicted with either Weak or Vulnerable, this creature gains Berserk.';
    expect(extractKeywords(text).map(({ span }) => text.slice(span[0], span[1]))).toEqual([
      'Weak',
      'Vulnerable',
      'Berserk',
    ]);
  });

  it('finds nothing in a text without keywords', () => {
    expect(extractKeywords('This creature deals 10% more damage.')).toEqual([]);
  });

  it('can be built over another taxonomy', () => {
    const extract = createKeywordExtractor(
      createTaxonomy([{ kind: 'buff', key: 'glowing', label: 'Glowing', patterns: ['Glowing'] }]),
    );
    expect(extract('This creature gains Glowing and Weak.')).toEqual([
      { key: 'glowing', kind: 'buff', span: [20, 27], role: 'applies' },
    ]);
  });
});
