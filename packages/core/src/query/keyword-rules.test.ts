import { describe, expect, it } from 'vitest';
import { KEYWORD_ACTORS } from '../model/trait';
import { canHaveActor } from '../taxonomy/entry';
import { taxonomy } from '../taxonomy/taxonomy';
import type { QueryDiagnostic } from './diagnostic';
import { fieldRegistry } from './fields';
import { keywordRules } from './keyword-rules';
import { createLintRegistry } from './lint-registry';
import type { LintContext } from './lint-rule';
import { tokenize } from './lexer';
import { serialiseTerm } from './serialise';
import { applyEdit } from './text-edit';

const context: LintContext = {
  fields: fieldRegistry,
  taxonomy,
  vocabulary: { class: [], family: [], creature: [], name: [] },
  hits: () => {
    throw new Error('A keyword rule does not count hits');
  },
};

const registry = createLintRegistry(keywordRules);

/** What the rules find in the terms of `source`, in the order of the text. */
function lint(source: string): QueryDiagnostic[] {
  return tokenize(source).flatMap((token) => (token.kind === 'term' ? registry.check(token, context) : []));
}

const codes = (source: string): string[] => lint(source).map(({ code }) => code);

/** The text after the one fix that `source` has is made. */
function fixed(source: string): string {
  const [only, ...others] = lint(source);
  if (only?.fix === undefined || others.length > 0) throw new Error(`${JSON.stringify(source)} has not one fix`);
  return applyEdit(source, only.fix.edit);
}

describe('the keyword rules', () => {
  it.each([
    '',
    'weak',
    'applies:weak',
    'uses:vulnerable',
    'kw:minion',
    'kw:timeline',
    'kw:nostack',
    'a:vul',
    'APPLIES:Vulnerable',
    'applies:s',
    'applies:c',
    'u:attack/enemy',
    'kw:attack/ALLY',
    'u:"start of turn/self"',
    'kw:start/self',
    'u:start/any',
    'u:attack/',
    'u:attack/ ',
    'u:/',
    'u:/self',
    'u:"after this creature attacks"',
    'u:"after this creature attacks/"',
    'u:"manually cast a spell"',
    'desc:zzz/self',
    'class:zzz/self',
    'clas:zzz',
    'mat:maybe',
    'applies:',
    'u:""',
  ])('finds nothing in %j', (source) => {
    expect(lint(source)).toEqual([]);
  });

  describe('unknown-keyword', () => {
    it('is an error with the closest key offered (QUERY_LANGUAGE §5)', () => {
      expect(lint('applies:vulnrable')).toEqual([
        {
          code: 'unknown-keyword',
          severity: 'error',
          span: [8, 17],
          message: 'No keyword “vulnrable”. Did you mean Vulnerable?',
          fix: { label: 'Change to “Vulnerable”', edit: { span: [8, 17], text: 'vulnerable' } },
        },
      ]);
    });

    it('says the value as it was typed, and the field it was typed for does not matter', () => {
      expect(lint('KW:Vulnrable')[0]?.message).toBe('No keyword “Vulnrable”. Did you mean Vulnerable?');
      expect(fixed('u:vulnrable')).toBe('u:vulnerable');
    });

    it('offers nothing when no key is close, and gives no fix', () => {
      expect(lint('uses:zzzz')).toEqual([
        { code: 'unknown-keyword', severity: 'error', span: [5, 9], message: 'No keyword “zzzz”' },
      ]);
    });

    it('is an error for the start of no key, however long: a start that is a key is no fault', () => {
      expect(codes('kw:vulnerabl')).toEqual([]);
      expect(codes('kw:vulnerablee')).toEqual(['unknown-keyword']);
    });

    it('writes a key of several words in quotes, over the quotes it replaces', () => {
      expect(fixed('kw:"start of tun"')).toBe('kw:"start of turn"');
      expect(fixed('kw:start-of-turm')).toBe('kw:"start of turn"');
    });

    it('keeps the actor that follows the key, as written', () => {
      expect(fixed('a:vulnrable/self')).toBe('a:vulnerable/self');
      expect(fixed('kw:"Start Of Tun/ENEMY"')).toBe('kw:"start of turn/enemy"');
      expect(lint('uses:attak/nobody').map(({ code }) => code)).toEqual(['unknown-keyword']);
      expect(fixed('uses:attak/nobody')).toBe('uses:attack/nobody');
    });

    it('offers only the keys the field takes, so that the fix finds no new fault', () => {
      // "timeline" is a mechanic: `applies:` does not take it, `kw:` does.
      expect(lint('applies:timlin')[0]?.fix).toBeUndefined();
      expect(fixed('kw:timlin')).toBe('kw:timeline');
    });

    it('is the only finding of a value whose key is unknown, whatever follows the slash', () => {
      expect(codes('applies:zzz/self')).toEqual(['unknown-keyword']);
      expect(codes('applies:zzz/nobody')).toEqual(['unknown-keyword']);
    });

    it('lints clean after its fix', () => {
      for (const source of ['applies:vulnrable', 'kw:"start of tun"', 'uses:attak/self', 'kw:timlin']) {
        expect(
          lint(fixed(source)).filter(({ code }) => code === 'unknown-keyword'),
          source,
        ).toEqual([]);
      }
    });
  });

  describe('keyword-without-role', () => {
    it('is a warning on the field, with kw: offered instead (QUERY_LANGUAGE §5)', () => {
      expect(lint('applies:timeline')).toEqual([
        {
          code: 'keyword-without-role',
          severity: 'warning',
          span: [0, 7],
          message: '“timeline” has no applies/uses role, so “applies:” finds nothing',
          fix: { label: 'Change to “kw:”', edit: { span: [0, 7], text: 'kw' } },
        },
      ]);
      expect(fixed('applies:timeline')).toBe('kw:timeline');
    });

    it('says the field as it was written, and mends it whatever the spelling', () => {
      expect(lint('U:minion')[0]?.message).toBe('“minion” has no applies/uses role, so “U:” finds nothing');
      expect(fixed('U:minion')).toBe('kw:minion');
    });

    it('reads the flag as a keyword without a role too', () => {
      expect(codes('a:nostack')).toEqual(['keyword-without-role']);
    });

    it('is the only finding when an actor follows the key: the role comes first', () => {
      expect(codes('applies:timeline/self')).toEqual(['keyword-without-role']);
      expect(fixed('u:minion/self')).toBe('kw:minion/self');
    });

    it('is no fault when part of the keys the value starts has a role', () => {
      // "c" starts "cast spell" (an event) as well as "charges" (a mechanic).
      expect(codes('applies:c')).toEqual([]);
    });

    it('lints clean after its fix', () => {
      for (const source of ['applies:timeline', 'u:minion', 'a:nostack', 'uses:minion/self']) {
        expect(
          lint(fixed(source)).filter(({ code }) => code === 'keyword-without-role'),
          source,
        ).toEqual([]);
      }
    });
  });

  describe('unknown-actor', () => {
    it('is an error that says who can act (QUERY_LANGUAGE §5)', () => {
      expect(lint('uses:attack/nobody')).toEqual([
        {
          code: 'unknown-actor',
          severity: 'error',
          span: [5, 18],
          message: 'No actor called “nobody”. Use self, ally, enemy or any',
        },
      ]);
    });

    it('offers the closest actor, and keeps the key as written', () => {
      expect(lint('uses:attack/selff')[0]?.fix).toEqual({
        label: 'Change to “self”',
        edit: { span: [5, 17], text: 'attack/self' },
      });
      expect(fixed('u:Attack/enemey')).toBe('u:Attack/enemy');
    });

    it('writes a key of several words in quotes, over the quotes it replaces', () => {
      expect(fixed('uses:"start of turn/enemey"')).toBe('uses:"start of turn/enemy"');
    });

    it('reads a key that is only the start of one, or no key yet', () => {
      expect(codes('kw:att/anyy')).toEqual(['unknown-actor']);
      expect(codes('kw:/nobody')).toEqual(['unknown-actor']);
    });

    it('is no fault for an old trigger phrase, nor for the actor when it is being typed', () => {
      expect(codes('u:"after this creature attacks/"')).toEqual([]);
      expect(codes('u:attack/')).toEqual([]);
    });

    it('lints clean after its fix', () => {
      for (const source of ['uses:attack/selff', 'kw:att/anyy', 'u:"start of turn/enemey"']) {
        expect(lint(fixed(source)), source).toEqual([]);
      }
    });

    it('gives way to the finding about a keyword with no actor at all', () => {
      expect(codes('uses:weak/nobody')).toEqual(['keyword-without-actor']);
    });
  });

  describe('keyword-without-actor', () => {
    it('is a warning with the actor taken away (QUERY_LANGUAGE §5)', () => {
      expect(lint('uses:weak/self')).toEqual([
        {
          code: 'keyword-without-actor',
          severity: 'warning',
          span: [5, 14],
          message: '“weak” is not done by anyone, so “/self” finds nothing',
          fix: { label: 'Remove “/self”', edit: { span: [5, 14], text: 'weak' } },
        },
      ]);
      expect(fixed('uses:weak/self')).toBe('uses:weak');
    });

    it.each([
      ['kw:minion/ally', 'kw:minion'],
      ['a:Vulnerable/ENEMY', 'a:Vulnerable'],
      ['u:"start of battle/any"', 'u:"start of battle"'],
      ['kw:nostack/self', 'kw:nostack'],
    ])(
      'reads %j: no buff, debuff, effect, mechanic or flag is done by anyone, nor is the start of a battle',
      (source, mended) => {
        expect(codes(source)).toEqual(['keyword-without-actor']);
        expect(fixed(source)).toBe(mended);
      },
    );

    it('says the word that was written when it is no actor either', () => {
      expect(lint('uses:weak/nobody')[0]?.message).toBe('“weak” is not done by anyone, so “/nobody” finds nothing');
      expect(fixed('uses:weak/nobody')).toBe('uses:weak');
    });

    it('is no fault when part of the keys the value starts can be done by someone', () => {
      // "start" starts "start of battle" (a moment) and "start of turn".
      expect(codes('kw:start/self')).toEqual([]);
      expect(codes('kw:"start of battle/self"')).toEqual(['keyword-without-actor']);
    });

    it('lints clean after its fix', () => {
      for (const source of ['uses:weak/self', 'kw:minion/ally', 'u:"start of battle/any"', 'uses:weak/nobody']) {
        expect(lint(fixed(source)), source).toEqual([]);
      }
    });
  });

  describe('on the taxonomy of the app', () => {
    const takenBy = (field: string) => {
      const domain = fieldRegistry.resolve(field)?.values;
      if (domain?.kind !== 'keyword') throw new Error(`${field} is no keyword field`);
      return taxonomy.entries.filter(({ kind }) => domain.accepts(kind));
    };
    const written = (key: string, actor?: string) => (actor === undefined ? key : `${key}/${actor}`);

    it('takes every key the field takes, and every start of one, as no fault', () => {
      for (const field of ['applies', 'uses', 'kw']) {
        for (const { key } of takenBy(field)) {
          for (let length = 1; length <= key.length; length += 1) {
            const source = serialiseTerm(field, key.slice(0, length));
            expect(lint(source), source).toEqual([]);
          }
        }
      }
    });

    it('takes every old trigger phrase, and every one with its slash typed, as no fault', () => {
      const aliases = taxonomy.ofKind('event').flatMap(({ aliases: given = [] }) => given.map(({ key }) => key));

      expect(aliases.length).toBeGreaterThan(10);
      for (const alias of aliases) {
        for (const field of ['applies', 'uses', 'kw']) {
          expect(lint(serialiseTerm(field, alias)), `${field}:${alias}`).toEqual([]);
          expect(lint(serialiseTerm(field, `${alias}/`)), `${field}:${alias}/`).toEqual([]);
        }
      }
    });

    it('takes every actor of every event somebody can do, and finds a fault in the actor of any other keyword', () => {
      for (const field of ['applies', 'uses', 'kw']) {
        for (const entry of takenBy(field)) {
          for (const actor of KEYWORD_ACTORS) {
            const source = serialiseTerm(field, written(entry.key, actor));
            expect(codes(source), source).toEqual(canHaveActor(entry) ? [] : ['keyword-without-actor']);
          }
        }
      }
    });

    it('finds a fault in a mechanic or flag given to a field of roles, whichever its actor', () => {
      for (const field of ['applies', 'uses']) {
        const refused = taxonomy.entries.filter((entry) => !takenBy(field).includes(entry));
        expect(refused.length).toBeGreaterThan(10);
        for (const { key } of refused) {
          for (const actor of [undefined, ...KEYWORD_ACTORS]) {
            const source = serialiseTerm(field, written(key, actor));
            expect(codes(source), source).toEqual(['keyword-without-role']);
          }
        }
      }
    });

    it('mends the fault in a key with a letter added, to a key that lints clean', () => {
      for (const field of ['applies', 'uses', 'kw']) {
        for (const { key } of takenBy(field)) {
          const source = serialiseTerm(field, `${key}z`);
          expect(codes(source), source).toEqual(['unknown-keyword']);
          const mended = lint(source)[0]?.fix;
          if (mended === undefined) continue;
          expect(lint(applyEdit(source, mended.edit)), source).toEqual([]);
        }
      }
    });
  });
});
