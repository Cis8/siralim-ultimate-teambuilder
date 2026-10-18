import {
  createHighlighter,
  createTraitIndex,
  evaluate,
  KEYWORD_ACTORS,
  parseQuery,
  serialise,
  taxonomy,
  type Trait,
  type TraitIndex,
} from '@atlas/core';
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildRealSheet, readOldTriggers } from '../testing/real-build';

// Acceptance criteria 1 and 2 (docs/ROADMAP.md) on the pinned snapshot of the compendium, v2.0. Each answer is compared
// with one worked out another way: a plain filter on the columns of the trait for criterion 1, the committed list of
// mentions read by hand (`snapshots/keywords-v2.0.txt`) for criterion 2. Neither goes through the lexer, the parser,
// the field registry or the index.

const KEYWORD_MENTIONS = new URL('../../snapshots/keywords-v2.0.txt', import.meta.url);

describe('the query language on the compendium v2.0', () => {
  let traits: readonly Trait[];
  let index: TraitIndex;

  const find = (query: string): string[] => evaluate(parseQuery(query).ast, index).map((trait) => trait.id);

  beforeAll(async () => {
    ({ traits } = await buildRealSheet());
    index = createTraitIndex(traits);
  });

  it('finds every trait for an empty query', () => {
    expect(find('')).toEqual(traits.map((trait) => trait.id));
  });

  it('splits the dataset between a query and its negation', () => {
    for (const query of ['weak', 'class:life', 'applies:vulnerable', 'mat:none', 'stack:no', '"does not stack"']) {
      const found = find(query);
      expect(found.length, query).toBeGreaterThan(0);
      expect(find(`-(${query})`), query).toEqual(traits.map((trait) => trait.id).filter((id) => !found.includes(id)));
    }
  });

  it('finds what a query finds with the canonical text it is written back as', () => {
    for (const query of [
      '(vulnerable OR weak) -stack:no',
      'class:"rodian master" OR -(applies:weak uses:weak)',
      'Kw:Silenced "does not stack" --mat:none',
      'weak OR (snared OR stunned) (class:life',
      '"and" "-x" "a:b" desc:',
    ]) {
      const written = serialise(parseQuery(query).ast);
      expect(parseQuery(written).diagnostics, written).toEqual([]);
      expect(find(written), query).toEqual(find(query));
    }
  });

  describe('highlighting: the descriptions that a query marks are the ones it finds through the description', () => {
    const marks = (query: string): string[] => {
      const highlight = createHighlighter(parseQuery(query).ast);
      return traits.filter((trait) => highlight(trait.description).length > 0).map((trait) => trait.id);
    };

    it.each(['desc:vulnerable', 'DESC:"start of battle"', 'desc:weak OR desc:snared'])(
      'marks a description for %s exactly when the trait is found by it',
      (query) => {
        const found = find(query);
        expect(found.length, query).toBeGreaterThan(0);
        expect(marks(query), query).toEqual(found);
      },
    );

    // A word with no field also finds a trait through its name, class and other columns, which are not marked.
    it.each(['weak', '"does not stack"'])('marks a description for %s only in a trait that it finds', (query) => {
      const found = find(query);
      expect(marks(query).length, query).toBeGreaterThan(0);
      expect(found).toEqual(expect.arrayContaining(marks(query)));
    });

    it('marks nothing for what is not in the description or is under a NOT', () => {
      for (const query of [
        'class:life',
        'trait:weak',
        'applies:weak',
        'mat:yes',
        '-weak',
        '-desc:weak',
        '-(weak snared)',
      ]) {
        expect(marks(query), query).toEqual([]);
      }
    });
  });

  describe('criterion 1: (vulnerable OR weak) -stack:no', () => {
    const mentions = (trait: Trait): boolean =>
      [trait.creature, trait.family, trait.class, trait.name, trait.description, trait.material].some(
        (column) => column !== null && /vulnerable|weak/i.test(column),
      );

    it('finds exactly the traits that mention Vulnerable or Weak and stack', () => {
      const expected = traits.filter((trait) => mentions(trait) && trait.stacks).map((trait) => trait.id);
      expect(find('(vulnerable OR weak) -stack:no')).toEqual(expected);
    });

    it('is a query where each part has an effect', () => {
      const mentioning = traits.filter(mentions);
      const expected = find('(vulnerable OR weak) -stack:no');
      expect(expected.length).toBeGreaterThan(0);
      expect(expected.length).toBeLessThan(mentioning.length);
      expect(mentioning.length).toBeLessThan(traits.length);
      expect(find('vulnerable').length).toBeLessThan(mentioning.length);
      expect(find('weak').length).toBeLessThan(mentioning.length);
    });
  });

  describe('criterion 2: applies: and uses:', () => {
    const mentionsRead = readMentions();
    /** The ids of the traits with a mention of a keyword that starts with `value`, in `role`, in dataset order. */
    const idsWithMention = (role: string, value: string): string[] => {
      const ids = new Set(mentionsRead.filter((m) => m.role === role && m.key.startsWith(value)).map((m) => m.id));
      return traits.map((trait) => trait.id).filter((id) => ids.has(id));
    };
    const keysWithARole = [
      ...new Set(mentionsRead.filter((m) => m.role === 'applies' || m.role === 'uses').map((m) => m.key)),
    ];

    it.each(keysWithARole)('finds for %s the traits whose mention has that role', (key) => {
      expect(find(`applies:"${key}"`)).toEqual(idsWithMention('applies', key));
      expect(find(`uses:"${key}"`)).toEqual(idsWithMention('uses', key));
    });

    // The two sets are disjoint but for a trait that gives *and* relies on the keyword (QUERY_LANGUAGE §2). For
    // Vulnerable that is one trait: Cloudy Constitution "always has Vulnerable … creatures with Vulnerable gain".
    it('keeps Vulnerable given and Vulnerable relied on apart, but for the trait that does both', () => {
      const gives = find('applies:vulnerable');
      const relies = find('uses:vulnerable');
      expect([gives.length, relies.length]).toEqual([8, 6]);
      expect(gives.filter((id) => relies.includes(id))).toEqual(['elementasaur--cloudy-constitution']);
      expect(new Set([...gives, ...relies]).size).toBe(13);
    });

    // QUERY_LANGUAGE §2: `uses:attack/self` is the event by one actor. Each answer is worked out from the actor column of the
    // committed mentions, and the union over the actors is checked against the event alone.
    describe('who acts: an actor after a slash', () => {
      const events = taxonomy.ofKind('event').map(({ key }) => key);
      const idsActing = (field: string, key: string, actor?: string): string[] => {
        const ids = new Set(
          mentionsRead
            .filter((m) => m.key === key && (actor === undefined || m.actor === actor))
            .filter((m) => field === 'kw' || m.role === field)
            .map((m) => m.id),
        );
        return traits.map((trait) => trait.id).filter((id) => ids.has(id));
      };

      it.each(events)('finds for %s the traits whose mention names that actor, in the role asked', (key) => {
        for (const field of ['applies', 'uses', 'kw']) {
          for (const actor of KEYWORD_ACTORS) {
            expect(find(`${field}:"${key}/${actor}"`), `${field}:${key}/${actor}`).toEqual(
              idsActing(field, key, actor),
            );
          }
          expect(find(`${field}:"${key}"`), `${field}:${key}`).toEqual(idsActing(field, key));
        }
      });

      it('finds an event by one actor in no more traits than by anyone, and has an actor for every event but the start of a battle', () => {
        for (const key of events) {
          const byAnyone = find(`kw:"${key}"`);
          const byAnActor = new Set(KEYWORD_ACTORS.flatMap((actor) => find(`kw:"${key}/${actor}"`)));
          expect(byAnActor.size, key).toBeLessThanOrEqual(byAnyone.length);
          if (key !== 'start of battle') expect(byAnActor.size, key).toBeGreaterThan(0);
        }
        expect(find('kw:"start of battle/self"')).toEqual([]);
      });

      it('reads the traits one by one, as the rules do (GAME_RULES R12)', () => {
        expect(find('uses:attack/self')).toContain('abomination--quell');
        expect(find('uses:attack/enemy')).not.toContain('abomination--quell');
        expect(find('applies:death/enemy')).toContain('abomination--quell');
        expect(find('uses:death/enemy')).not.toContain('abomination--quell');
        expect(find('uses:dodge/enemy')).toContain('clutcher--lash');
      });

      it('finds the same traits with the canonical text of the query as it was typed', () => {
        for (const query of ['uses:attack/self', 'KW:"Start of Turn/Enemy" -applies:death/any', 'u:/ally']) {
          const written = serialise(parseQuery(query).ast);
          expect(find(written), query).toEqual(find(query));
        }
      });
    });

    // The first version of the app had eleven trigger phrases, pinned with the traits that had them (SPEC §4). A query that
    // names one finds the event, and who did it where the phrase says, and so at least those traits (ADR-0009).
    describe('the trigger phrases of the first version', () => {
      const pinned = readOldTriggers();

      it.each([...new Set(pinned.map(([phrase]) => phrase))])('%s finds at least the traits it found', (phrase) => {
        const found = new Set(find(`kw:"${phrase}"`));
        const lost = pinned.filter(([each]) => each === phrase).filter(([, id]) => !found.has(id));
        expect(lost).toEqual([]);
        expect(found.size).toBeGreaterThanOrEqual(pinned.filter(([each]) => each === phrase).length);
      });

      it('are whole phrases: the start of one finds nothing', () => {
        expect(find('kw:"after this creature"')).toEqual([]);
        expect(find('kw:after')).toEqual([]);
      });
    });

    it('leaves a mention that only guards against a keyword to kw:', () => {
      const givesOrReliesOn = new Set([
        ...idsWithMention('applies', 'silenced'),
        ...idsWithMention('uses', 'silenced'),
      ]);
      const onlyGuards = idsWithMention('resists', 'silenced').filter((id) => !givesOrReliesOn.has(id));
      expect(onlyGuards.length).toBeGreaterThan(0);
      for (const id of onlyGuards) {
        expect(find('kw:silenced'), id).toContain(id);
        expect(find('applies:silenced'), id).not.toContain(id);
        expect(find('uses:silenced'), id).not.toContain(id);
      }
    });
  });
});

interface Mention {
  readonly id: string;
  readonly key: string;
  /** `-` for a keyword with no role. */
  readonly role: string;
  /** `-` for a mention that names nobody. */
  readonly actor: string;
}

/** The mentions as the committed file lists them, one `trait | key | role | actor` line each. */
function readMentions(): Mention[] {
  return readFileSync(KEYWORD_MENTIONS, 'utf8')
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => {
      const [id = '', key = '', role = '', actor = ''] = line.split(' | ');
      return { id, key, role, actor };
    });
}
