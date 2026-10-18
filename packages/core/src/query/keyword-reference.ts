import { KEYWORD_ACTORS, type KeywordActor, type KeywordReference } from '../model/trait';
import type { Taxonomy } from '../taxonomy/registry';
import { taxonomy as appTaxonomy } from '../taxonomy/taxonomy';

const isActor = (word: string): word is KeywordActor => KEYWORD_ACTORS.some((actor) => actor === word);

/** The value of a keyword field taken apart, with the parts as written: trimmed, letter case kept. */
export type KeywordValue =
  /** An old trigger phrase, whole and alone (ADR-0009): the event it stands for, and the actor if it names one. */
  | { readonly kind: 'phrase'; readonly reference: KeywordReference }
  /** The start of a key and, after a slash, who acts: `provoke`, `prov/self`, `provoke/`. */
  | { readonly kind: 'key'; readonly key: string; readonly actor?: KeywordActor }
  /** A slash and a word that is no actor. The search looks for `text` as a key, which nobody has. */
  | { readonly kind: 'unknown-actor'; readonly key: string; readonly word: string; readonly text: string };

/**
 * Takes the value of a keyword field (`uses:provoke/self`) or an item of the address (`u:provoke/self`) apart: the start of
 * a key and, after a slash, who acts (QUERY_LANGUAGE §2). The blanks around the key and the actor do not count, nor does the
 * letter case of the actor.
 * - An old trigger phrase (an alias, ADR-0009) is the event and the actor it stands for. It must be written whole, and
 *   alone: `strike/enemy` is the start of a key nobody has.
 * - A slash with nothing after it asks for no actor yet, as the query is typed: `provoke/` is `provoke`.
 * - A word after the slash that is no actor makes the whole text a key that finds nothing: `provoke/nobody`.
 */
export function readKeywordValue(text: string, taxonomy: Taxonomy = appTaxonomy): KeywordValue {
  const written = text.trim();
  const alias = taxonomy.alias(written.toLowerCase());
  if (alias !== undefined) return { kind: 'phrase', reference: alias };

  const slash = written.lastIndexOf('/');
  if (slash < 0) return { kind: 'key', key: written };
  const key = written.slice(0, slash).trim();
  const word = written.slice(slash + 1).trim();
  if (word === '') return readKeywordValue(key, taxonomy);
  const actor = word.toLowerCase();
  return isActor(actor)
    ? { kind: 'key', key, actor }
    : { kind: 'unknown-actor', key, word, text: written.toLowerCase() };
}

/**
 * What the value of a keyword field (`uses:provoke/self`) or an item of the address (`u:provoke/self`) asks for: the start
 * of a key and, for an event, who acts (`readKeywordValue` says how the text is read). Letter case does not count.
 *
 * Reading the text that `writeKeywordReference` writes gives the reference back.
 */
export function parseKeywordReference(text: string, taxonomy: Taxonomy = appTaxonomy): KeywordReference {
  const value = readKeywordValue(text, taxonomy);
  switch (value.kind) {
    case 'phrase':
      return value.reference;
    case 'key': {
      const key = value.key.toLowerCase();
      return value.actor === undefined ? { key } : { key, actor: value.actor };
    }
    case 'unknown-actor':
      return { key: value.text };
  }
}

/** The text a keyword field or an item of the address carries for a reference: `provoke/self`, or just `provoke`. */
export function writeKeywordReference({ key, actor }: KeywordReference): string {
  return actor === undefined ? key : `${key}/${actor}`;
}
