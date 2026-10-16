import {
  compareText,
  KNOWN_CLASSES,
  taxonomy as appTaxonomy,
  type PartyRequirement,
  type Taxonomy,
  type Trait,
  type TraitKind,
} from '@atlas/core';
import type { BuiltTraits } from '../build/build-traits';
import { compareWithCanonicalLists } from './compare-canonical';
import { diffTraits, type TraitRecord } from './diff-traits';
import { REVIEWED_NON_KEYWORDS } from './reviewed-non-keywords';
import { findTaxonomyCandidates } from './taxonomy-candidates';

/** The build the new one is compared with: what was last emitted. */
export interface PreviousBuild {
  readonly datasetVersion: string;
  readonly traits: readonly TraitRecord[];
}

const MAX_LISTED = 50;
const MAX_CANDIDATES = 25;

export interface ReportOptions {
  /** The keywords the extractor knows. Defaults to the app's. */
  readonly taxonomy?: Taxonomy;
  /** Capitalised terms already looked at and found to be no keyword. Defaults to `REVIEWED_NON_KEYWORDS`. */
  readonly ignoredTerms?: ReadonlySet<string>;
}

/**
 * A Markdown report of a build: what changed since the previous one, what the dataset holds, and what needs a look.
 * It becomes the body of the data-refresh pull request, so its text depends on the data and nothing else.
 */
export function buildReport(current: BuiltTraits, previous: PreviousBuild | null, options: ReportOptions = {}): string {
  const sections = [
    `# Data report: Siralim Ultimate compendium v${current.datasetVersion}`,
    changesSection(current.traits, previous),
    countsSection(current.traits),
    taxonomySection(current.traits, options),
    attentionSection(current.traits, current.warnings),
  ];
  return `${sections.filter((section) => section !== null).join('\n\n')}\n`;
}

function changesSection(traits: readonly Trait[], previous: PreviousBuild | null): string {
  if (previous === null) {
    return '## Changes since the previous build\n\nNo previous build to compare with.';
  }

  const header = `## Changes since the previous build (v${previous.datasetVersion})`;
  const summary = `Traits: ${previous.traits.length} → ${traits.length} (${signed(traits.length - previous.traits.length)}).`;
  const diff = diffTraits(
    previous.traits,
    traits.map((trait) => ({ ...trait })),
  );
  if (diff.added.length + diff.removed.length + diff.changed.length === 0) {
    return `${header}\n\n${summary} No trait was added, removed or changed.`;
  }

  const lists = [
    list(
      'Added',
      diff.added.map((id) => `\`${id}\``),
    ),
    list(
      'Removed',
      diff.removed.map((id) => `\`${id}\``),
    ),
    list(
      'Changed',
      diff.changed.map(({ id, fields }) => `\`${id}\`: ${fields.join(', ')}`),
    ),
  ].filter((section) => section !== null);
  return [header, summary, ...lists].join('\n\n');
}

function list(title: string, items: readonly string[]): string | null {
  if (items.length === 0) return null;
  const lines = items.slice(0, MAX_LISTED).map((item) => `- ${item}`);
  if (items.length > MAX_LISTED) lines.push(`- …and ${items.length - MAX_LISTED} more`);
  return `### ${title} (${items.length})\n\n${lines.join('\n')}`;
}

function signed(difference: number): string {
  if (difference === 0) return '±0';
  return difference > 0 ? `+${difference}` : `-${-difference}`;
}

function countsSection(traits: readonly Trait[]): string {
  const subsections = [
    kindsTable(traits),
    classesTable(traits),
    masteryTable(traits),
    keywordCounts(traits),
    randomDebuffs(traits),
  ];
  return ['## Counts', ...subsections.filter((subsection) => subsection !== null)].join('\n\n');
}

function table(title: string, heading: string, rows: readonly (readonly [string, number])[]): string {
  const lines = rows.map(([label, count]) => `| ${label} | ${count} |`);
  return [`### ${title}`, '', `| ${heading} | Traits |`, '|---|---|', ...lines].join('\n');
}

function kindsTable(traits: readonly Trait[]): string {
  const counts: Record<TraitKind, number> = { creature: 0, avatar: 0, mastery: 0, backer: 0, other: 0 };
  for (const trait of traits) counts[trait.kind] += 1;
  return table('Kinds', 'Kind', Object.entries(counts));
}

function classesTable(traits: readonly Trait[]): string {
  const rows = [...countClasses(traits)].toSorted(([a, x], [b, y]) => y - x || compareText(a, b));
  return table('Classes', 'Class', rows);
}

function countClasses(traits: readonly Trait[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const { class: className } of traits) counts.set(className, (counts.get(className) ?? 0) + 1);
  return counts;
}

function masteryTable(traits: readonly Trait[]): string | null {
  const counts: Record<PartyRequirement['type'], number> = {
    allFamily: 0,
    distinctFamilyCount: 0,
    perFamilyCount: 0,
    classDiversity: 0,
    familyScoped: 0,
    none: 0,
  };
  let masteries = 0;
  for (const { partyRequirement } of traits) {
    if (partyRequirement === null) continue;
    counts[partyRequirement.type] += 1;
    masteries += 1;
  }
  return masteries === 0 ? null : table('Mastery requirements', 'Requirement', Object.entries(counts));
}

function keywordCounts(traits: readonly Trait[]): string | null {
  const mentions = traits.flatMap((trait) => trait.keywords);
  if (mentions.length === 0) return null;
  const withKeywords = traits.filter((trait) => trait.keywords.length > 0).length;
  const statuses = mentions.filter((hit) => hit.role !== undefined);
  const count = (role: 'applies' | 'uses' | 'resists') => statuses.filter((hit) => hit.role === role).length;
  const conditional = traits.filter((trait) => trait.conditionalSources.length > 0).length;
  const pairs =
    conditional === 0
      ? ''
      : ` ${conditional} ${conditional === 1 ? 'trait applies' : 'traits apply'} debuffs only through a pair (conditional sources).`;
  return (
    `### Keywords\n\n${mentions.length} mentions in ${withKeywords} traits. Of the ${statuses.length} buffs and debuffs, ` +
    `${count('applies')} are given (applies), ${count('uses')} relied on (uses) and ${count('resists')} guarded against (resists).` +
    pairs
  );
}

function randomDebuffs(traits: readonly Trait[]): string | null {
  const sources = traits.flatMap((trait) => (trait.randomDebuff === null ? [] : [trait.randomDebuff]));
  if (sources.length === 0) return null;
  const enemyOnly = sources.filter((source) => source.target === 'enemy').length;
  const conditional = sources.filter((source) => source.activation === 'conditional').length;
  const verb = sources.length === 1 ? 'trait afflicts' : 'traits afflict';
  return `### Random debuffs\n\n${sources.length} ${verb} one: ${enemyOnly} aimed at enemies only, ${conditional} conditional.`;
}

/** What the taxonomy lacks or owes the canonical lists: material for keywords, not a defect. */
function taxonomySection(traits: readonly Trait[], options: ReportOptions): string | null {
  const taxonomy = options.taxonomy ?? appTaxonomy;
  const candidates = findTaxonomyCandidates(traits, { ignore: options.ignoredTerms ?? REVIEWED_NON_KEYWORDS });
  const discrepancies = compareWithCanonicalLists(traits, taxonomy);

  const subsections: string[] = [];
  if (candidates.length > 0) {
    const rows = candidates
      .slice(0, MAX_CANDIDATES)
      .map(
        ({ term, traits: count, example, afterStatusCue }) =>
          `| ${term} | ${count} | \`${example}\` | ${afterStatusCue ? 'maybe' : '-'} |`,
      );
    if (candidates.length > MAX_CANDIDATES) rows.push(`- …and ${candidates.length - MAX_CANDIDATES} more`);
    subsections.push(
      [
        '### Candidates',
        '',
        'Capitalised terms in at least 3 traits that no keyword covers and nobody has ruled out.',
        '',
        '| Term | Traits | Example | Buff or debuff? |',
        '|---|---|---|---|',
        ...rows,
      ].join('\n'),
    );
  }
  if (discrepancies.length > 0) {
    subsections.push(
      ['### Compared with the canonical lists', '', ...discrepancies.map((line) => `- ${line}`)].join('\n'),
    );
  }
  return subsections.length === 0 ? null : ['## Taxonomy', ...subsections].join('\n\n');
}

function attentionSection(traits: readonly Trait[], warnings: readonly string[]): string {
  const unknownClasses = [...countClasses(traits)]
    .filter(([className]) => !KNOWN_CLASSES.has(className))
    .toSorted(([a], [b]) => compareText(a, b))
    .map(
      ([className, count]) =>
        `Class \`${className}\` (${count} ${count === 1 ? 'trait' : 'traits'}) is not in GAME_RULES R7. ` +
        'It is read as `other`, so its traits can only sit in the Artifact slot until the owner confirms it.',
    );

  const unresolvedMasteries = traits
    .filter(
      ({ partyRequirement }) =>
        partyRequirement !== null && 'families' in partyRequirement && partyRequirement.families.length === 0,
    )
    .toSorted((a, b) => compareText(a.id, b.id))
    .map(
      ({ id, partyRequirement }) =>
        `\`${id}\`: the \`${partyRequirement?.type}\` requirement names no family the sheet knows.`,
    );

  const items = [...unknownClasses, ...unresolvedMasteries, ...warnings.map((warning) => `Override ${warning}`)];
  const body = items.length === 0 ? 'Nothing.' : items.map((item) => `- ${item}`).join('\n');
  return `## Needs attention\n\n${body}`;
}
