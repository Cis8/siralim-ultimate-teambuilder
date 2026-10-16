import type { FieldDefinition, TraitMatcher } from './field';
import { createFieldRegistry } from './field-registry';
import type { ColumnName, IndexedTrait } from './indexed-trait';

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

/** `value` is the start of the key of one of the keywords. */
function startOfKey(keysOf: (trait: IndexedTrait) => readonly string[]): FieldDefinition['matcher'] {
  return (value) => (trait) => keysOf(trait).some((key) => key.startsWith(value));
}

/** `value` is one of the choices, exactly; any other value matches nothing. */
function oneOf(choices: ReadonlyMap<string, TraitMatcher>): FieldDefinition['matcher'] {
  return (value) => choices.get(value) ?? matchNothing;
}

const hasMaterial: TraitMatcher = ({ trait }) => trait.material !== null;
const lacksMaterial: TraitMatcher = ({ trait }) => trait.material === null;

/** QUERY_LANGUAGE §2. To add a field, add a definition here. */
const fields: readonly FieldDefinition[] = [
  { name: 'class', aliases: ['c'], matcher: inColumn('class') },
  { name: 'family', aliases: ['fam', 'f'], matcher: inColumn('family') },
  { name: 'creature', aliases: ['cr'], matcher: inColumn('creature') },
  { name: 'trait', aliases: ['t'], matcher: inColumn('name') },
  { name: 'desc', aliases: ['d'], matcher: inColumn('description'), highlightsDescription: true },
  { name: 'applies', aliases: ['a'], matcher: startOfKey((trait) => trait.applies) },
  { name: 'uses', aliases: ['u'], matcher: startOfKey((trait) => trait.uses) },
  { name: 'kw', aliases: ['k'], matcher: startOfKey((trait) => trait.keywords) },
  {
    name: 'mat',
    aliases: [],
    matcher: oneOf(
      new Map([
        ['yes', hasMaterial],
        ['no', lacksMaterial],
        ['none', lacksMaterial],
      ]),
    ),
  },
  {
    name: 'stack',
    aliases: [],
    matcher: oneOf(
      new Map<string, TraitMatcher>([
        ['yes', ({ trait }) => trait.stacks],
        ['no', ({ trait }) => !trait.stacks],
      ]),
    ),
  },
];

/** The fields of the query language of the app. The evaluator and, in Phase 2, the editor read them from here. */
export const fieldRegistry = createFieldRegistry(fields, freeText);
