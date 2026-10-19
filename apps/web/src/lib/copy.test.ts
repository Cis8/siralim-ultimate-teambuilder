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

describe('the page of a trait', () => {
  it('names a keyword of the focus by what the trait does with it, then where the link leads', () => {
    expect(copy.keywordLink({ role: 'uses' }, 'Vulnerable')).toBe(
      'Relies on Vulnerable — see who applies it and who relies on it',
    );
    expect(copy.keywordLink({ role: 'applies' }, 'Weak')).toBe(
      'Applies Weak — see who applies it and who relies on it',
    );
    expect(copy.keywordLink({}, 'Zombies')).toBe('Zombies — see who applies it and who relies on it');
  });

  it('says a lane is empty in the words of the side it is on, and of the filter that left it so', () => {
    expect(copy.noApplier('Weak', false)).toBe('No trait applies Weak in the compendium.');
    expect(copy.noApplier('Weak', true)).toBe('No trait applies Weak among artifact-eligible traits.');
    expect(copy.noUser('Savage', false)).toBe('Nothing relies on Savage yet in the compendium.');
    expect(copy.noUser('Savage', true)).toBe('Nothing relies on Savage yet among artifact-eligible traits.');
  });

  it('writes how many links tie a trait to the focus, and a key it gives in a weaker way', () => {
    expect(copy.links(2)).toBe('×2 links');
    expect(copy.keyAs('Weak', 'random')).toBe('Weak (random)');
    expect(copy.keyAs('Weak', 'conditional')).toBe('Weak (conditional)');
  });

  it('tells a screen reader what the filter did, since only the counts change', () => {
    expect(copy.artifactFilterNow(true, 6, 12)).toBe(
      'Only traits with a material are listed. Enabled by 6 traits. Enables 12 traits.',
    );
    expect(copy.artifactFilterNow(false, 1, 0)).toBe('Every trait is listed. Enabled by 1 trait. Enables 0 traits.');
  });

  it('writes who acts where an event has an actor', () => {
    expect(copy.triggerWithActor('Attack', 'self')).toBe('Attack (this creature)');
    expect(copy.triggerWithActor('Dodge', 'enemy')).toBe('Dodge (enemies)');
  });
});
