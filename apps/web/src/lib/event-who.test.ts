import type { ActorSet } from '@atlas/core';
import { describe, expect, it } from 'vitest';
import { eventWho, pressChoice, pressedChoices, WHO_CHOICES } from './event-who';

describe('WHO_CHOICES', () => {
  it('offers "Any" first, then this creature, your creatures and enemies (GAME_RULES R12)', () => {
    expect(WHO_CHOICES).toEqual(['anyone', 'self', 'ally', 'enemy']);
  });
});

describe('eventWho', () => {
  const named = (...sets: ActorSet[]) => sets;

  it('shows the actors chosen, and turns new filters to them, while no event filter is on', () => {
    expect(eventWho(named(), [])).toEqual({ shown: [], actors: [] });
    expect(eventWho(named(), ['enemy'])).toEqual({ shown: ['enemy'], actors: ['enemy'] });
    expect(eventWho(named(), ['self', 'enemy'])).toEqual({ shown: ['self', 'enemy'], actors: ['self', 'enemy'] });
  });

  it('shows what the filters that are on all name, whatever was chosen before', () => {
    expect(eventWho(named(['self']), ['enemy'])).toEqual({ shown: ['self'], actors: ['self'] });
    expect(eventWho(named(['self', 'ally']), [])).toEqual({ shown: ['self', 'ally'], actors: ['self', 'ally'] });
    expect(eventWho(named([]), ['enemy'])).toEqual({ shown: [], actors: [] });
  });

  it('shows nothing, and turns new filters to nobody, while the filters name different actors', () => {
    expect(eventWho(named(['self'], ['enemy']), ['ally'])).toEqual({ shown: undefined, actors: [] });
    expect(eventWho(named(['self'], []), ['ally'])).toEqual({ shown: undefined, actors: [] });
    expect(eventWho(named(['self'], ['self', 'enemy']), [])).toEqual({ shown: undefined, actors: [] });
  });
});

describe('pressedChoices', () => {
  const pressed = (shown: ActorSet | undefined) => pressedChoices({ shown, actors: shown ?? [] });

  it('is "Any" while no actor is named: the event whoever acts', () => {
    expect(pressed([])).toEqual(['anyone']);
  });

  it('is the choices of the actors named, in the order of the control, and not "Any"', () => {
    expect(pressed(['enemy'])).toEqual(['enemy']);
    expect(pressed(['self', 'enemy'])).toEqual(['self', 'enemy']);
    expect(pressed(['self', 'ally', 'enemy'])).toEqual(['self', 'ally', 'enemy']);
  });

  it('is nothing while the filters name different actors', () => {
    expect(pressed(undefined)).toEqual([]);
  });

  it('is nothing for "any creature", which a text says and the control does not offer', () => {
    expect(pressed(['any'])).toEqual([]);
    expect(pressed(['self', 'any'])).toEqual(['self']);
  });
});

describe('pressChoice', () => {
  const press = (shown: ActorSet | undefined, choice: Parameters<typeof pressChoice>[1]) =>
    pressChoice({ shown, actors: shown ?? [] }, choice);

  it('puts an actor in beside the others, and takes it out again', () => {
    expect(press([], 'self')).toEqual(['self']);
    expect(press(['self'], 'enemy')).toEqual(['self', 'enemy']);
    expect(press(['self', 'enemy'], 'self')).toEqual(['enemy']);
  });

  it('falls back on "Any" when the last actor goes', () => {
    expect(press(['ally'], 'ally')).toEqual([]);
  });

  it('takes every actor off with "Any", and stays "Any" when it was pressed already', () => {
    expect(press(['self', 'enemy'], 'anyone')).toEqual([]);
    expect(press([], 'anyone')).toEqual([]);
  });

  it('makes the filters one choice when they named different actors', () => {
    expect(press(undefined, 'ally')).toEqual(['ally']);
    expect(press(undefined, 'anyone')).toEqual([]);
  });
});
