import { describe, expect, it } from 'vitest';
import { copy } from './copy';

describe('the name of a keyword in a description', () => {
  it('says what a trait does with a buff, a debuff or an effect, then what a click shows', () => {
    expect(copy.keywordButton({ kind: 'debuff', role: 'applies' }, 'Weak', 'users')).toBe(
      'Applies Weak — show traits that rely on it',
    );
    expect(copy.keywordButton({ kind: 'buff', role: 'uses' }, 'Shelled', 'appliers')).toBe(
      'Relies on Shelled — show traits that apply it',
    );
    expect(copy.keywordButton({ kind: 'effect', role: 'resists' }, 'Zombies', 'mentions')).toBe(
      'Guards against Zombies — show traits that mention it',
    );
  });

  it('says what a trait does with an event in the words of the filters: causes it, reacts to it, prevents it', () => {
    expect(copy.keywordButton({ kind: 'event', role: 'applies' }, 'attacks', 'users')).toBe(
      'Causes attacks — show traits that react to it',
    );
    expect(copy.keywordButton({ kind: 'event', role: 'uses' }, 'attacks', 'appliers')).toBe(
      'Reacts to attacks — show traits that cause it',
    );
    expect(copy.keywordButton({ kind: 'event', role: 'resists' }, 'resurrected', 'mentions')).toBe(
      'Prevents resurrected — show traits that mention it',
    );
  });

  it('says who acts, where the text names who', () => {
    const named = (actor: 'self' | 'ally' | 'enemy' | 'any') =>
      copy.keywordButton({ kind: 'event', role: 'uses', actor }, 'dies', 'appliers');

    expect(named('self')).toBe('Reacts to dies (this creature) — show traits that cause it');
    expect(named('ally')).toBe('Reacts to dies (your creatures) — show traits that cause it');
    expect(named('enemy')).toBe('Reacts to dies (enemies) — show traits that cause it');
    expect(named('any')).toBe('Reacts to dies (any creature) — show traits that cause it');
  });

  it('says nobody for a moment, which nobody causes, and for a keyword with no role', () => {
    expect(copy.keywordButton({ kind: 'event', role: 'uses' }, 'start of battle', 'mentions')).toBe(
      'Reacts to start of battle — show traits that mention it',
    );
    expect(copy.keywordButton({ kind: 'mechanic' }, 'Charges', 'mentions')).toBe(
      'Charges — show traits that mention it',
    );
  });
});
