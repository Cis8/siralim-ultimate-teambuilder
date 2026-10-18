import { KEYWORD_ACTORS } from '../model/trait';
import { canHaveActor, type TaxonomyEntry } from '../taxonomy/entry';
import { closestMatch } from './closest-match';
import type { ValueDomain } from './field';
import { changeTo, listOf, quoted, writtenValue } from './finding-text';
import { readKeywordValue, type KeywordValue } from './keyword-reference';
import type { LintContext, LintRule } from './lint-rule';
import type { FieldName, TermToken } from './token';

type KeywordDomain = Extract<ValueDomain, { kind: 'keyword' }>;

/**
 * What is wrong with the value of a keyword field, if anything. A value has one fault at most, the first of these: it is
 * checked in the order the search reads it, the key before the role and the role before who acts, so that mending one
 * never leaves a finding that was waiting behind it for the wrong reason.
 */
type KeywordFault =
  /** No key of the taxonomy starts with it. `actor` is what followed the slash, as written. */
  | {
      readonly kind: 'unknown-keyword';
      readonly field: FieldName;
      readonly domain: KeywordDomain;
      readonly key: string;
      readonly actor: string | undefined;
    }
  /** The keys it starts are all of kinds the field does not take (a mechanic given to `applies:`). */
  | { readonly kind: 'no-role'; readonly field: FieldName; readonly entries: readonly TaxonomyEntry[] }
  /** The word after the slash is no actor, and someone could do the keyword. */
  | { readonly kind: 'unknown-actor'; readonly field: FieldName; readonly key: string; readonly actor: string }
  /** Nobody does the keyword (a buff, say, or the start of a battle), so an actor, a real one or not, finds nothing. */
  | { readonly kind: 'no-actor'; readonly field: FieldName; readonly key: string; readonly actor: string };

/** The key and the word after the slash that a search for `value` is about, as written; the actor of an old phrase is the canonical one. */
function lookedFor(value: KeywordValue): { readonly key: string; readonly actor: string | undefined } {
  switch (value.kind) {
    case 'phrase':
      return { key: value.reference.key, actor: value.reference.actor };
    case 'key':
      return { key: value.key, actor: value.actor };
    case 'unknown-actor':
      return { key: value.key, actor: value.word };
  }
}

/**
 * Reads the value of a term of a keyword field the way the field's matcher does (the start of a key, then `/actor`) and
 * asks the taxonomy what that finds. Nothing for a term that is not of a keyword field, or has no value yet (that is for
 * the rule of empty values).
 */
function diagnose(term: TermToken, { fields, taxonomy }: LintContext): KeywordFault | undefined {
  const { field } = term;
  if (field === undefined || term.value === '') return undefined;
  const domain = fields.resolve(field.name)?.values;
  if (domain?.kind !== 'keyword') return undefined;

  const value = readKeywordValue(term.value, taxonomy);
  const { key, actor } = lookedFor(value);
  const start = key.toLowerCase();
  const entries = taxonomy.entries.filter((entry) => entry.key.startsWith(start));
  if (entries.length === 0) return { kind: 'unknown-keyword', field, domain, key, actor };

  const taken = entries.filter(({ kind }) => domain.accepts(kind));
  if (taken.length === 0) return { kind: 'no-role', field, entries };
  if (actor === undefined) return undefined;
  if (!taken.some(canHaveActor)) return { kind: 'no-actor', field, key, actor };
  return value.kind === 'unknown-actor' ? { kind: 'unknown-actor', field, key, actor } : undefined;
}

/** `applies:vulnrable`: no keyword starts with it, so the search finds nothing. */
const unknownKeyword: LintRule = {
  id: 'unknown-keyword',
  check(term, context) {
    const fault = diagnose(term, context);
    if (fault?.kind !== 'unknown-keyword') return undefined;
    const { field, domain, key, actor } = fault;

    const message = `No keyword ${quoted(key)}`;
    // Only keys the field takes, so that the fix does not lead to the next finding (`applies:` and a mechanic).
    const keys = context.taxonomy.entries.filter(({ kind }) => domain.accepts(kind)).map((entry) => entry.key);
    const suggestion = closestMatch(key, keys);
    if (suggestion === undefined) return { severity: 'error', span: term.valueSpan, message };
    const label = context.taxonomy.get(suggestion)?.label ?? suggestion;
    const mended = `${suggestion}${actor === undefined ? '' : `/${actor}`}`;
    return {
      severity: 'error',
      span: term.valueSpan,
      message: `${message}. Did you mean ${label}?`,
      fix: changeTo(term.valueSpan, writtenValue(field.name, mended), label),
    };
  },
};

/** `applies:timeline`: a mechanic is searched for, but no trait applies it or relies on it. The fault is the field. */
const keywordWithoutRole: LintRule = {
  id: 'keyword-without-role',
  check(term, context) {
    const fault = diagnose(term, context);
    if (fault?.kind !== 'no-role') return undefined;
    const { field, entries } = fault;

    const instead = context.fields.fields.find(
      ({ values }) => values?.kind === 'keyword' && entries.every(({ kind }) => values.accepts(kind)),
    );
    return {
      severity: 'warning',
      span: field.span,
      message: `${quoted(term.value)} has no applies/uses role, so ${quoted(`${field.name}:`)} finds nothing`,
      ...(instead === undefined ? {} : { fix: changeTo(field.span, instead.name, `${instead.name}:`) }),
    };
  },
};

/** `uses:attack/nobody`: the actors are four, and the search takes anything else for the rest of the key. */
const unknownActor: LintRule = {
  id: 'unknown-actor',
  check(term, context) {
    const fault = diagnose(term, context);
    if (fault?.kind !== 'unknown-actor') return undefined;
    const { field, key, actor } = fault;

    const message = `No actor called ${quoted(actor)}. Use ${listOf(KEYWORD_ACTORS)}`;
    const suggestion = closestMatch(actor, KEYWORD_ACTORS);
    if (suggestion === undefined) return { severity: 'error', span: term.valueSpan, message };
    return {
      severity: 'error',
      span: term.valueSpan,
      message,
      fix: changeTo(term.valueSpan, writtenValue(field.name, `${key}/${suggestion}`), suggestion),
    };
  },
};

/** `uses:weak/self`: a mention of a buff, debuff, effect or mechanic names nobody, nor does the start of a battle. */
const keywordWithoutActor: LintRule = {
  id: 'keyword-without-actor',
  check(term, context) {
    const fault = diagnose(term, context);
    if (fault?.kind !== 'no-actor') return undefined;
    const { field, key, actor } = fault;

    const named = quoted(`/${actor}`);
    return {
      severity: 'warning',
      span: term.valueSpan,
      message: `${quoted(key)} is not done by anyone, so ${named} finds nothing`,
      fix: { label: `Remove ${named}`, edit: { span: term.valueSpan, text: writtenValue(field.name, key) } },
    };
  },
};

/** The rules about the value of a keyword field and the actor after its slash (QUERY_LANGUAGE §5). */
export const keywordRules: readonly LintRule[] = [
  unknownKeyword,
  keywordWithoutRole,
  unknownActor,
  keywordWithoutActor,
];
