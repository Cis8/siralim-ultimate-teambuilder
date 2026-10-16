import { buffs } from './buffs';
import { debuffs } from './debuffs';
import { flags } from './flags';
import { mechanics } from './mechanics';
import { triggers } from './triggers';
import { createTaxonomy } from './registry';

/** Every keyword the extractor knows. To teach it another, add an entry to one of the lists. */
export const taxonomy = createTaxonomy([...debuffs, ...buffs, ...mechanics, ...triggers, ...flags]);
