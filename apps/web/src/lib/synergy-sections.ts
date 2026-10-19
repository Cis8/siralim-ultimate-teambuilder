import type { RelatedSectionModel } from './related-sections';
import type { SynergySection } from './synergy-address';

/**
 * The parts of a Synergy page that a narrow screen shows one at a time, as tabs (DESIGN § Synergy pages). The page of a trait has
 * four, the page of a keyword two; a wide screen shows them all and the address's `section=` only rides along.
 */
export const TRAIT_SECTIONS = [
  'enabled-by',
  'enables',
  'alternatives',
  'related',
] as const satisfies readonly SynergySection[];
export const KEYWORD_SECTIONS = ['appliers', 'users'] as const satisfies readonly SynergySection[];

/** The section a narrow screen shows: the one the address names if the page has it, else the page's first. */
export function shownSection<Section extends SynergySection>(
  requested: SynergySection | undefined,
  sections: readonly [Section, ...Section[]],
): Section {
  return sections.find((section) => section === requested) ?? sections[0];
}

/** The section to write to the address for `section`: none for the first, which is what an address that names none stands for. */
export function sectionInAddress<Section extends SynergySection>(
  section: Section,
  sections: readonly [Section, ...Section[]],
): Section | undefined {
  return section === sections[0] ? undefined : section;
}

/** What a section's tab and its panel are called in the page, so that each names the other (`aria-controls`, `aria-labelledby`). */
export const sectionTabId = (section: SynergySection): string => `${section}-section-tab`;
export const sectionPanelId = (section: SynergySection): string => `${section}-section-panel`;

/** The attributes of the box that holds a section (spread onto it): what makes it a tab panel when the sections are tabs. */
export interface PanelAttributes {
  readonly id: string;
  readonly role?: 'tabpanel';
  readonly 'aria-labelledby'?: string;
  readonly hidden?: true;
}

/**
 * The attributes of the box of `section`. On a wide screen every section is on show and the box is nothing but a box; on a narrow
 * one the box is the panel of the section's tab, and every section but `shown` is hidden (the tab still names the box it controls).
 */
export function panelAttributes(section: SynergySection, tabbed: boolean, shown: SynergySection): PanelAttributes {
  const id = sectionPanelId(section);
  if (!tabbed) return { id };
  return {
    id,
    role: 'tabpanel',
    'aria-labelledby': sectionTabId(section),
    ...(section === shown ? {} : { hidden: true as const }),
  };
}

/** How many traits the lists hold between them: one that is in several of them is one trait. */
export function distinctTraits(sections: readonly RelatedSectionModel[]): number {
  return new Set(sections.flatMap(({ cards }) => cards.map(({ trait }) => trait.id))).size;
}
