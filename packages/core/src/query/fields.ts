import { hasRole } from '../model/keyword-kind';
import type { KeywordActor } from '../model/trait';
import type { FieldDefinition, TraitMatcher, ValueChoice, ValueDomain, VocabularyColumn } from './field';
import { createFieldRegistry } from './field-registry';
import { quoted } from './finding-text';
import type { ColumnName, KeywordList } from './indexed-trait';
import { parseKeywordReference } from './keyword-reference';

/** What a word with no field is looked for in. */
const FREE_TEXT_COLUMNS: readonly ColumnName[] = ['creature', 'family', 'class', 'name', 'description', 'material'];

/** One column at a time, so that a phrase cannot run from the end of one into the start of the next. */
const freeText =
  (value: string): TraitMatcher =>
  ({ columns }) =>
    FREE_TEXT_COLUMNS.some((column) => columns[column].includes(value));

const matchNothing: TraitMatcher = () => false;

/** `value` is looked for inside the column. */
function inColumn(column: ColumnName): FieldDefinition['matcher'] {
  return (value) =>
    ({ columns }) =>
      columns[column].includes(value);
}

/**
 * `value` is the start of the key of one of the keywords of the list and, if it names an actor after a slash, the mention is
 * an event by that actor (`provoke/self`). An old trigger phrase is the event it stands for. A mention that names no actor
 * is found by none.
 */
function keywordIn(list: KeywordList): FieldDefinition['matcher'] {
  return (value) => {
    const { key: start, actor } = parseKeywordReference(value);
    if (actor !== undefined) {
      return (trait) => trait.acted[list].some((acted) => acted.actor === actor && acted.key.startsWith(start));
    }
    // A slash and nothing else asks for no more than an empty value does (`uses:/` is `uses:`).
    return start === '' ? () => true : (trait) => trait[list].some((key) => key.startsWith(start));
  };
}

/** A field that takes `choices` and nothing else: any other value finds nothing and is described as what it is. */
function choiceField(name: string, help: string, choices: readonly ValueChoice[]): FieldDefinition {
  const bySpelling = new Map(
    choices.flatMap((choice) => [choice.value, ...choice.aliases].map((spelling) => [spelling, choice] as const)),
  );
  return {
    name,
    aliases: [],
    help,
    matcher: (value) => bySpelling.get(value)?.matcher ?? matchNothing,
    values: { kind: 'choices', mode: 'exact', choices },
    describe: (value) => bySpelling.get(value)?.meaning ?? `${name} is ${quoted(value)}`,
  };
}

const hasMaterial: TraitMatcher = ({ trait }) => trait.material !== null;
const lacksMaterial: TraitMatcher = ({ trait }) => trait.material === null;

/** For a field that looks inside a column: `class contains “life”`. */
const contains =
  (what: string): FieldDefinition['describe'] =>
  (value) =>
    `${what} contains ${quoted(value)}`;

/** Who acts, as a sentence says it after "by". */
const doneBy = {
  self: 'this creature',
  ally: 'your creatures',
  enemy: 'an enemy',
  any: 'any creature',
} as const satisfies Record<KeywordActor, string>;

/** For a keyword field: `relies on “attack” by this creature`. It reads the value as the matcher does, old phrases included. */
function describeKeyword(verb: string): FieldDefinition['describe'] {
  return (value) => {
    const { key, actor } = parseKeywordReference(value);
    if (key === '') return actor === undefined ? 'asks for nothing' : `${verb} any event by ${doneBy[actor]}`;
    return actor === undefined ? `${verb} ${quoted(key)}` : `${verb} ${quoted(key)} by ${doneBy[actor]}`;
  };
}

const vocabularyOf = (column: VocabularyColumn): ValueDomain => ({ kind: 'vocabulary', mode: 'substring', column });

/** Buffs, debuffs, effects and events have a role; a mechanic or a flag is in no role, so `applies:` and `uses:` never find it. */
const keywordsWithRole: ValueDomain = { kind: 'keyword', mode: 'prefix', accepts: hasRole };
const everyKeyword: ValueDomain = { kind: 'keyword', mode: 'prefix', accepts: () => true };

/** QUERY_LANGUAGE §2. To add a field, add a definition here. */
const fields: readonly FieldDefinition[] = [
  {
    name: 'class',
    aliases: ['c'],
    help: 'the class of the creature',
    matcher: inColumn('class'),
    values: vocabularyOf('class'),
    describe: contains('class'),
  },
  {
    name: 'family',
    aliases: ['fam', 'f'],
    help: 'the family of the creature',
    matcher: inColumn('family'),
    values: vocabularyOf('family'),
    describe: contains('family'),
  },
  {
    name: 'creature',
    aliases: ['cr'],
    help: 'the name of the creature',
    matcher: inColumn('creature'),
    values: vocabularyOf('creature'),
    describe: contains('creature'),
  },
  {
    name: 'trait',
    aliases: ['t'],
    help: 'the name of the trait',
    matcher: inColumn('name'),
    values: vocabularyOf('name'),
    describe: contains('trait name'),
  },
  {
    name: 'desc',
    aliases: ['d'],
    help: 'the description only',
    matcher: inColumn('description'),
    highlightsDescription: true,
    describe: contains('description'),
  },
  {
    name: 'applies',
    aliases: ['a'],
    help: 'a buff, debuff, effect or event the trait applies',
    matcher: keywordIn('applies'),
    values: keywordsWithRole,
    describe: describeKeyword('applies'),
  },
  {
    name: 'uses',
    aliases: ['u'],
    help: 'a buff, debuff, effect or event the trait relies on',
    matcher: keywordIn('uses'),
    values: keywordsWithRole,
    describe: describeKeyword('relies on'),
  },
  {
    name: 'kw',
    aliases: ['k'],
    help: 'any keyword the trait mentions',
    matcher: keywordIn('keywords'),
    values: everyKeyword,
    describe: describeKeyword('has keyword'),
  },
  choiceField('mat', 'yes = artifact-eligible (has a material), no = has none', [
    { value: 'yes', aliases: [], matcher: hasMaterial, meaning: 'has a material' },
    { value: 'no', aliases: ['none'], matcher: lacksMaterial, meaning: 'has no material' },
  ]),
  choiceField('stack', 'yes = stacks, no = does not stack', [
    { value: 'yes', aliases: [], matcher: ({ trait }) => trait.stacks, meaning: 'stacks' },
    { value: 'no', aliases: [], matcher: ({ trait }) => !trait.stacks, meaning: 'does not stack' },
  ]),
];

/** The fields of the query language of the app. The evaluator and, in Phase 2, the editor read them from here. */
export const fieldRegistry = createFieldRegistry(fields, freeText);
