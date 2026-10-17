import { buffs } from './buffs';
import { debuffs } from './debuffs';
import { effects } from './effects';
import { events } from './events';
import { flags } from './flags';
import { mechanics } from './mechanics';
import { createTaxonomy } from './registry';

/** Every keyword the extractor knows. To teach it another, add an entry to one of the lists. */
export const taxonomy = createTaxonomy([...debuffs, ...buffs, ...effects, ...events, ...mechanics, ...flags]);
