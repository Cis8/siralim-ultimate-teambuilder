import { describe, expect, it } from 'vitest';
import { classColour } from './class-colour';

describe('classColour', () => {
  it.each([
    ['Chaos', 'var(--class-chaos)'],
    ['Death', 'var(--class-death)'],
    ['Life', 'var(--class-life)'],
    ['Nature', 'var(--class-nature)'],
    ['Sorcery', 'var(--class-sorcery)'],
    ['Rodian Master', 'var(--class-rodian-master)'],
    ['Nether Boss', 'var(--class-nether-boss)'],
  ])('gives %s its own colour', (className, colour) => {
    expect(classColour(className)).toBe(colour);
  });

  it('ignores letter case', () => {
    expect(classColour('nEtHeR bOsS')).toBe('var(--class-nether-boss)');
  });

  it.each(['Backer', 'Boss', 'Pandemonium', 'Nether Room', 'A class nobody has seen', '', 'constructor', '__proto__'])(
    'falls back for %j',
    (className) => {
      expect(classColour(className)).toBe('var(--class-fallback)');
    },
  );
});
