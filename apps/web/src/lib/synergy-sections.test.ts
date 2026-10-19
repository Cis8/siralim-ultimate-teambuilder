import type { Trait } from '@atlas/core';
import { describe, expect, it } from 'vitest';
import type { RelatedSectionModel } from './related-sections';
import { SYNERGY_SECTIONS } from './synergy-address';
import {
  distinctTraits,
  KEYWORD_SECTIONS,
  panelAttributes,
  sectionInAddress,
  sectionPanelId,
  sectionTabId,
  shownSection,
  TRAIT_SECTIONS,
} from './synergy-sections';

describe('the sections of a page', () => {
  it('are the ones an address may name, in the order of the page, and share none between the two pages', () => {
    expect([...TRAIT_SECTIONS, ...KEYWORD_SECTIONS]).toEqual(SYNERGY_SECTIONS);
  });
});

describe('shownSection', () => {
  it('is the section the address names, when the page has it', () => {
    expect(shownSection('enables', TRAIT_SECTIONS)).toBe('enables');
    expect(shownSection('related', TRAIT_SECTIONS)).toBe('related');
    expect(shownSection('users', KEYWORD_SECTIONS)).toBe('users');
  });

  it('is the first section when the address names none', () => {
    expect(shownSection(undefined, TRAIT_SECTIONS)).toBe('enabled-by');
    expect(shownSection(undefined, KEYWORD_SECTIONS)).toBe('appliers');
  });

  it('is the first section when the address names one the page does not have', () => {
    expect(shownSection('appliers', TRAIT_SECTIONS)).toBe('enabled-by');
    expect(shownSection('alternatives', KEYWORD_SECTIONS)).toBe('appliers');
  });
});

describe('sectionInAddress', () => {
  it('writes nothing for the first section, so that the address of a page stays the plain one', () => {
    expect(sectionInAddress('enabled-by', TRAIT_SECTIONS)).toBeUndefined();
    expect(sectionInAddress('appliers', KEYWORD_SECTIONS)).toBeUndefined();
  });

  it('writes any other section by its name', () => {
    expect(sectionInAddress('related', TRAIT_SECTIONS)).toBe('related');
    expect(sectionInAddress('users', KEYWORD_SECTIONS)).toBe('users');
  });

  it('is read back as the section it stands for', () => {
    for (const section of [...TRAIT_SECTIONS, ...KEYWORD_SECTIONS]) {
      const sections = TRAIT_SECTIONS.some((each) => each === section) ? TRAIT_SECTIONS : KEYWORD_SECTIONS;
      expect(shownSection(sectionInAddress(section, sections), sections)).toBe(section);
    }
  });
});

describe('the ids of a section’s tab and panel', () => {
  it('are one each, and different for every section', () => {
    const ids = SYNERGY_SECTIONS.flatMap((section) => [sectionTabId(section), sectionPanelId(section)]);

    expect(new Set(ids).size).toBe(SYNERGY_SECTIONS.length * 2);
  });
});

describe('panelAttributes', () => {
  it('is only an id on a wide screen, where every section is on show and nothing is a tab panel', () => {
    expect(panelAttributes('enables', false, 'enabled-by')).toEqual({ id: 'enables-section-panel' });
    expect(panelAttributes('enables', false, 'enables')).toEqual({ id: 'enables-section-panel' });
  });

  it('makes the shown section a tab panel named by its tab, on a narrow screen', () => {
    expect(panelAttributes('enables', true, 'enables')).toEqual({
      id: 'enables-section-panel',
      role: 'tabpanel',
      'aria-labelledby': 'enables-section-tab',
    });
  });

  it('hides a section that is not the one shown, but keeps the id its tab controls', () => {
    expect(panelAttributes('alternatives', true, 'enables')).toEqual({
      id: 'alternatives-section-panel',
      role: 'tabpanel',
      'aria-labelledby': 'alternatives-section-tab',
      hidden: true,
    });
  });
});

describe('distinctTraits', () => {
  const trait = (id: string): Trait => ({
    id,
    name: id,
    creature: 'Brute',
    family: 'Abomination',
    class: 'Death',
    kind: 'creature',
    description: '',
    material: 'Ore',
    stacks: true,
    randomDebuff: null,
    masteryFamily: null,
    partyRequirement: null,
    keywords: [],
    conditionalSources: [],
  });
  const section = (...ids: string[]): RelatedSectionModel => ({
    id: 'same-trigger',
    title: 'Same trigger',
    hint: '',
    cards: ids.map((id) => ({ trait: trait(id) })),
    empty: '',
    counted: true,
  });

  it('counts a trait once when it is in both lists', () => {
    expect(distinctTraits([section('a', 'b', 'c'), section('c', 'd')])).toBe(4);
  });

  it('adds up lists that share nobody', () => {
    expect(distinctTraits([section('a'), section('b', 'c')])).toBe(3);
  });

  it('is nothing for lists with no card', () => {
    expect(distinctTraits([section(), section()])).toBe(0);
    expect(distinctTraits([])).toBe(0);
  });
});
