import { describe, expect, it } from 'vitest';
import type { TraitKind } from '../model/trait';
import { classifyKind } from './trait-kind';

describe('classifyKind (GAME_RULES R7)', () => {
  it.each(['Chaos', 'Death', 'Life', 'Nature', 'Sorcery'])('reads a %s creature as a creature', (className) => {
    expect(classifyKind({ class: className, family: 'Abomination', creature: 'Abomination Brute' })).toBe('creature');
  });

  it('reads a creature-class trait of the Avatar family as an avatar', () => {
    expect(classifyKind({ class: 'Chaos', family: 'Avatar', creature: 'Caliban' })).toBe('avatar');
  });

  it('reads the Mastery Trait marker as a mastery', () => {
    expect(classifyKind({ class: 'Rodian Master', family: 'Cruncher', creature: 'Mastery Trait' })).toBe('mastery');
  });

  it('reads the Backer Trait marker as a backer', () => {
    expect(classifyKind({ class: 'Backer', family: 'Backer', creature: 'Backer Trait' })).toBe('backer');
  });

  it('lets the marker decide whatever the class says', () => {
    expect(classifyKind({ class: 'Death', family: 'Avatar', creature: 'Mastery Trait' })).toBe('mastery');
    expect(classifyKind({ class: 'Death', family: 'Abomination', creature: 'Backer Trait' })).toBe('backer');
  });

  it.each(['Nether Boss', 'Boss', 'Pandemonium', 'Nether Room'])('reads class %s as other', (className) => {
    expect(classifyKind({ class: className, family: 'Maniac', creature: 'Loid' })).toBe('other');
  });

  it('reads a class nobody has seen before as other: artifact-only until the owner says otherwise', () => {
    expect(classifyKind({ class: 'Brand New Class', family: 'Abomination', creature: 'Somebody' })).toBe('other');
  });

  it('needs a creature class to be an avatar', () => {
    const kind: TraitKind = classifyKind({ class: 'Nether Boss', family: 'Avatar', creature: 'Somebody' });
    expect(kind).toBe('other');
  });
});
