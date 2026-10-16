import { describe, expect, it } from 'vitest';
import { createFamilyMatcher, writtenForms } from './family-matcher';

const familiesIn = (families: string[], text: string) =>
  createFamilyMatcher(families)
    .mentionsIn(text)
    .map((mention) => mention.family);

describe('createFamilyMatcher', () => {
  it.each([
    ['Abomination', 'Abomination', 'the singular'],
    ['Abomination', 'Abominations', 'a plural in s'],
    ['Cerberus', 'Cerberuses', 'a plural in es'],
    ['Mummy', 'Mummies', 'a plural in ies'],
    ['Elf', 'Elves', 'a plural in ves (f)'],
    ['Knife', 'Knives', 'a plural in ves (fe)'],
    ['Doom Fortress', 'Doom Fortresses', 'a multi-word family'],
    ['Fae', 'Fae', 'a family that is its own plural'],
    ['Nephilim', 'Nephilims', 'a plural the sheet writes with an s'],
  ])('finds %s as %s (%s)', (family, written) => {
    expect(familiesIn([family, 'Unrelated'], `Your ${written} attack.`)).toEqual([family]);
  });

  it('finds nothing when no family is named', () => {
    expect(familiesIn(['Abomination', 'Angel'], 'Your creatures deal 10% more damage.')).toEqual([]);
  });

  it('finds nothing when there are no families', () => {
    expect(familiesIn([], 'Your Angels attack.')).toEqual([]);
  });

  it('matches whole words only', () => {
    expect(familiesIn(['Elf', 'Ant'], 'The Elfin Antelope itself.')).toEqual([]);
    expect(familiesIn(['Elf'], 'Elf-kin')).toEqual(['Elf']);
  });

  it('is case sensitive, like the proper nouns it looks for', () => {
    expect(familiesIn(['Elf', 'Spirit'], 'a spirit and an elf')).toEqual([]);
  });

  it('prefers the longest family at a position', () => {
    expect(familiesIn(['Pit Worm', 'Worm'], 'Your Pit Worms and your Worms.')).toEqual(['Pit Worm', 'Worm']);
  });

  it('reports each mention with its position, in order', () => {
    const mentions = createFamilyMatcher(['Angel', 'Imp']).mentionsIn('Imps and Angels, then Imps.');
    expect(mentions).toEqual([
      { family: 'Imp', index: 0 },
      { family: 'Angel', index: 9 },
      { family: 'Imp', index: 22 },
    ]);
  });

  it('reports every family that can be read from a form shared by two', () => {
    expect(familiesIn(['Sin', 'Sins'], 'Your Sins')).toEqual(['Sin', 'Sins']);
  });

  it('treats characters with a meaning in patterns as plain text', () => {
    expect(familiesIn(['Dr. Who', 'Mr+Mrs'], 'Your Dr. Whos and Mr+Mrs.')).toEqual(['Dr. Who', 'Mr+Mrs']);
    expect(familiesIn(['Dr. Who'], 'Dr! Who')).toEqual([]);
  });
});

describe('writtenForms', () => {
  it('lists the singular and the regular plurals of a family', () => {
    expect(writtenForms('Mummy')).toEqual(['Mummy', 'Mummys', 'Mummyes', 'Mummies']);
    expect(writtenForms('Elf')).toEqual(['Elf', 'Elfs', 'Elfes', 'Elves']);
    expect(writtenForms('Knife')).toEqual(['Knife', 'Knifes', 'Knifees', 'Knives']);
  });
});
