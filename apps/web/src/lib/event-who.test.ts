import type { KeywordActor } from '@atlas/core';
import { describe, expect, it } from 'vitest';
import { actorOf, eventWho, WHO_CHOICES } from './event-who';

describe('actorOf', () => {
  it('is no actor for "Any": the event whoever acts', () => {
    expect(actorOf('anyone')).toBeUndefined();
  });

  it('is the actor the other choices name', () => {
    expect(actorOf('self')).toBe('self');
    expect(actorOf('ally')).toBe('ally');
    expect(actorOf('enemy')).toBe('enemy');
  });

  it('offers "Any" first, then this creature, your creatures and enemies (GAME_RULES R12)', () => {
    expect(WHO_CHOICES).toEqual(['anyone', 'self', 'ally', 'enemy']);
  });
});

describe('eventWho', () => {
  const named = (...actors: (KeywordActor | undefined)[]) => actors;

  it('shows the choice made, and turns new filters to it, while no event filter is on', () => {
    expect(eventWho(named(), 'anyone')).toEqual({ shown: 'anyone', actor: undefined });
    expect(eventWho(named(), 'enemy')).toEqual({ shown: 'enemy', actor: 'enemy' });
  });

  it('shows what the filters that are on all name, whatever was chosen before', () => {
    expect(eventWho(named('self'), 'enemy')).toEqual({ shown: 'self', actor: 'self' });
    expect(eventWho(named(undefined), 'enemy')).toEqual({ shown: 'anyone', actor: undefined });
  });

  it('shows nothing, and turns new filters to nobody, while the filters name several actors', () => {
    expect(eventWho(named('self', 'enemy'), 'ally')).toEqual({ shown: undefined, actor: undefined });
    expect(eventWho(named('self', undefined), 'ally')).toEqual({ shown: undefined, actor: undefined });
  });

  it('shows nothing for "any creature", which is a thing a text says and no choice of the control', () => {
    expect(eventWho(named('any'), 'ally')).toEqual({ shown: undefined, actor: undefined });
  });
});
