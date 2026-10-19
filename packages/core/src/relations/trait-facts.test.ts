import { describe, expect, it } from 'vitest';
import type { KeywordActor, KeywordHit, KeywordKind, KeywordRole, Trait } from '../model/trait';
import { traitFacts } from './trait-facts';

function hit(key: string, kind: KeywordKind, role?: KeywordRole, actor?: KeywordActor): KeywordHit {
  return {
    key,
    kind,
    ...(role === undefined ? {} : { role }),
    ...(actor === undefined ? {} : { actor }),
    span: [0, 1],
  };
}

const traitWith = (...keywords: KeywordHit[]): Trait => ({
  id: 'family--focus',
  name: 'Focus',
  creature: 'Some Creature',
  family: 'Family',
  class: 'Death',
  kind: 'creature',
  description: 'Does something.',
  material: 'Ferrous Ore',
  stacks: true,
  randomDebuff: null,
  masteryFamily: null,
  partyRequirement: null,
  keywords,
  conditionalSources: [],
});

describe('traitFacts: the buffs, debuffs and effects a trait relies on, applies and guards against', () => {
  it('lists each key under the role the text gives it, in the order the text names them', () => {
    const facts = traitFacts(
      traitWith(
        hit('weak', 'debuff', 'uses'),
        hit('shelled', 'buff', 'applies'),
        hit('vulnerable', 'debuff', 'uses'),
        hit('mega magic', 'effect', 'applies'),
        hit('silenced', 'debuff', 'resists'),
      ),
    );

    expect(facts.relies).toEqual(['weak', 'vulnerable']);
    expect(facts.applies).toEqual(['shelled', 'mega magic']);
    expect(facts.guards).toEqual(['silenced']);
  });

  it('lists a key once however often the text names it', () => {
    const focus = traitWith(
      hit('weak', 'debuff', 'uses'),
      hit('snared', 'debuff', 'uses'),
      hit('weak', 'debuff', 'uses'),
    );

    expect(traitFacts(focus).relies).toEqual(['weak', 'snared']);
  });

  it('lists a key under two roles when the text gives it two', () => {
    const facts = traitFacts(traitWith(hit('weak', 'debuff', 'applies'), hit('weak', 'debuff', 'uses')));

    expect(facts.applies).toEqual(['weak']);
    expect(facts.relies).toEqual(['weak']);
  });

  it('leaves out a mention that has no role: it is neither given, relied on nor guarded against', () => {
    expect(traitFacts(traitWith(hit('weak', 'debuff')))).toEqual({ relies: [], applies: [], guards: [], triggers: [] });
  });

  it('leaves out mechanics and flags, which have no role', () => {
    const facts = traitFacts(traitWith(hit('barrier', 'mechanic'), hit('nostack', 'flag')));

    expect(facts).toEqual({ relies: [], applies: [], guards: [], triggers: [] });
  });

  it('is empty for a trait that mentions nothing', () => {
    expect(traitFacts(traitWith())).toEqual({ relies: [], applies: [], guards: [], triggers: [] });
  });
});

describe('traitFacts: the events a trait waits for', () => {
  it('lists the events the trait pays off on (the role uses), with who acts where the text says so', () => {
    const facts = traitFacts(
      traitWith(
        hit('attack', 'event', 'uses', 'self'),
        hit('start of battle', 'event', 'uses'),
        hit('dodge', 'event', 'uses', 'enemy'),
      ),
    );

    expect(facts.triggers).toEqual([
      { event: 'attack', actor: 'self' },
      { event: 'start of battle' },
      { event: 'dodge', actor: 'enemy' },
    ]);
  });

  it('is no trigger for an event the trait makes happen or prevents, and no event is a dependency', () => {
    const facts = traitFacts(
      traitWith(hit('attack', 'event', 'applies', 'self'), hit('resurrect', 'event', 'resists', 'self')),
    );

    expect(facts).toEqual({ relies: [], applies: [], guards: [], triggers: [] });
  });

  it('lists an event once for each actor the text gives it, and once if it names the same one twice', () => {
    const facts = traitFacts(
      traitWith(
        hit('attack', 'event', 'uses', 'self'),
        hit('attack', 'event', 'uses', 'enemy'),
        hit('attack', 'event', 'uses', 'self'),
        hit('attack', 'event', 'uses'),
      ),
    );

    expect(facts.triggers).toEqual([
      { event: 'attack', actor: 'self' },
      { event: 'attack', actor: 'enemy' },
      { event: 'attack' },
    ]);
  });
});
