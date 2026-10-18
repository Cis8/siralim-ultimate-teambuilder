import { describe, expect, it } from 'vitest';
import { bestMatchTier, matchTier } from './match-tier';

describe('matchTier', () => {
  it('is the prefix when the text starts with what was typed, whole text included', () => {
    expect(matchTier('vul', 'vulnerable')).toBe('prefix');
    expect(matchTier('vulnerable', 'vulnerable')).toBe('prefix');
  });

  it('is the prefix for nothing typed: everything starts with it', () => {
    expect(matchTier('', 'vulnerable')).toBe('prefix');
    expect(matchTier('', '')).toBe('prefix');
  });

  it.each([
    ['att', 'being attacked'],
    ['wolf', 'dire wolf'],
    ['love', "mother's love"],
    ['pack', 'wolf-pack'],
    ['turn', 'start of turn'],
    ['b', 'a/b'],
    ['atta', 'start of (attack)'],
  ])('is the start of a word when %j begins a word of %j that is not the first', (typed, text) => {
    expect(matchTier(typed, text)).toBe('word-start');
  });

  it.each([
    ['ner', 'vulnerable'],
    ['ulner', 'vulnerable'],
    ['ack', 'attack'],
    ['wolf', 'werewolf'],
    ['olv', 'dire wolves'],
  ])('is a substring when %j is inside %j and begins no word', (typed, text) => {
    expect(matchTier(typed, text)).toBe('substring');
  });

  it('prefers the better place when the text is found in more than one', () => {
    expect(matchTier('at', 'attack at dawn')).toBe('prefix');
    expect(matchTier('at', 'being attacked')).toBe('word-start');
    expect(matchTier('at', 'ratatouille at')).toBe('word-start');
    expect(matchTier('at', 'ratatouille')).toBe('substring');
  });

  it('is nothing when the text is not in it, or only apart', () => {
    expect(matchTier('xyz', 'vulnerable')).toBeUndefined();
    expect(matchTier('vulnerable', 'vul')).toBeUndefined();
    expect(matchTier('a b', 'ab')).toBeUndefined();
  });

  it('does not count a digit or a letter beside it as the edge of a word', () => {
    expect(matchTier('2', 'x2')).toBe('substring');
    expect(matchTier('é', 'caf é')).toBe('word-start');
    expect(matchTier('é', 'café')).toBe('substring');
  });
});

describe('bestMatchTier', () => {
  it('is the best place any of the texts gives', () => {
    expect(bestMatchTier('fam', ['family', 'fam'])).toBe('prefix');
    expect(bestMatchTier('amily', ['family', 'fam'])).toBe('substring');
    expect(bestMatchTier('ily', ['family', 'fam'])).toBe('substring');
    expect(bestMatchTier('attacked', ['attack', 'being attacked'])).toBe('word-start');
  });

  it('is nothing when none of the texts has it, and when there are none', () => {
    expect(bestMatchTier('zz', ['family', 'fam'])).toBeUndefined();
    expect(bestMatchTier('a', [])).toBeUndefined();
  });
});
