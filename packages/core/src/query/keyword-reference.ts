import { KEYWORD_ACTORS, type KeywordActor, type KeywordReference } from '../model/trait';
import type { Taxonomy } from '../taxonomy/registry';
import { taxonomy as appTaxonomy } from '../taxonomy/taxonomy';

const isActor = (word: string): word is KeywordActor => KEYWORD_ACTORS.some((actor) => actor === word);

/**
 * What the value of a keyword field (`uses:provoke/self`) or an item of the address (`u:provoke/self`) asks for: the start
 * of a key and, after a slash, who acts (QUERY_LANGUAGE §2). Letter case and the blanks around the key and the actor do not
 * count.
 * - An old trigger phrase (an alias, ADR-0009) is the event and the actor it stands for. It must be written whole, and
 *   alone: `strike/enemy` is the start of a key nobody has.
 * - A slash with nothing after it asks for no actor yet, as the query is typed: `provoke/` is `provoke`.
 * - A word after the slash that is no actor stays in the key, which then finds nothing: `provoke/nobody`.
 *
 * Reading the text that `writeKeywordReference` writes gives the reference back.
 */
export function parseKeywordReference(text: string, taxonomy: Taxonomy = appTaxonomy): KeywordReference {
  const folded = text.trim().toLowerCase();
  const alias = taxonomy.alias(folded);
  if (alias !== undefined) return alias;

  const slash = folded.lastIndexOf('/');
  if (slash < 0) return { key: folded };
  const key = folded.slice(0, slash).trim();
  const actor = folded.slice(slash + 1).trim();
  if (actor === '') return parseKeywordReference(key, taxonomy);
  return isActor(actor) ? { key, actor } : { key: folded };
}

/** The text a keyword field or an item of the address carries for a reference: `provoke/self`, or just `provoke`. */
export function writeKeywordReference({ key, actor }: KeywordReference): string {
  return actor === undefined ? key : `${key}/${actor}`;
}
