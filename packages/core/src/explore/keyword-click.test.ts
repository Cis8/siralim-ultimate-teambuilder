import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { KeywordKind, KeywordRole } from '../model/trait';
import { initialExploreState, type ExploreState } from './explore-state';
import { clickGoal, clickKeyword, isClickOn } from './keyword-click';

interface Clicked {
  readonly key: string;
  readonly kind: KeywordKind;
  readonly role?: KeywordRole;
}

const debuff = (key: string, role: KeywordRole): Clicked => ({ key, kind: 'debuff', role });
const stateWith = (patch: Partial<ExploreState>): ExploreState => ({ ...initialExploreState, ...patch });

describe('clickGoal', () => {
  it.each([
    ['a debuff that is applied', debuff('vulnerable', 'applies'), 'users'],
    ['a debuff that is relied on', debuff('vulnerable', 'uses'), 'appliers'],
    ['a buff that is applied', { key: 'shelled', kind: 'buff', role: 'applies' }, 'users'],
    ['an effect that is relied on', { key: 'zombies', kind: 'effect', role: 'uses' }, 'appliers'],
    ['a debuff that is only guarded against', debuff('silenced', 'resists'), 'mentions'],
    ['an event that is caused', { key: 'attack', kind: 'event', role: 'applies' }, 'mentions'],
    ['an event that is waited for', { key: 'start of battle', kind: 'event', role: 'uses' }, 'mentions'],
    ['an event that is prevented', { key: 'death', kind: 'event', role: 'resists' }, 'mentions'],
    ['a mechanic', { key: 'charges', kind: 'mechanic' }, 'mentions'],
    ['the flag "does not stack"', { key: 'nostack', kind: 'flag' }, 'nonStacking'],
    ['a flag nobody has a filter for', { key: 'unheard-of', kind: 'flag' }, 'mentions'],
    ['a debuff with no role (the dataset has none)', { key: 'weak', kind: 'debuff' }, 'mentions'],
  ] satisfies [string, Clicked, string][])('shows %s: %s', (_name, clicked, goal) => {
    expect(clickGoal(clicked)).toBe(goal);
  });
});

describe('clickKeyword', () => {
  it('shows the traits that rely on a keyword, when it is clicked where a trait applies it', () => {
    expect(clickKeyword(initialExploreState, debuff('vulnerable', 'applies')).keywords).toEqual([
      { field: 'uses', key: 'vulnerable' },
    ]);
  });

  it('shows the traits that apply a keyword, when it is clicked where a trait relies on it', () => {
    expect(clickKeyword(initialExploreState, debuff('vulnerable', 'uses')).keywords).toEqual([
      { field: 'applies', key: 'vulnerable' },
    ]);
  });

  it('shows the traits that mention a keyword that is no one’s to give or to rely on', () => {
    expect(clickKeyword(initialExploreState, debuff('silenced', 'resists')).keywords).toEqual([
      { field: 'kw', key: 'silenced' },
    ]);
    expect(clickKeyword(initialExploreState, { key: 'start of battle', kind: 'event' }).keywords).toEqual([
      { field: 'kw', key: 'start of battle' },
    ]);
  });

  it('shows only the traits that do not stack, when the flag is clicked', () => {
    const clicked = clickKeyword(initialExploreState, { key: 'nostack', kind: 'flag' });

    expect(clicked.doesNotStack).toBe(true);
    expect(clicked.keywords).toEqual([]);
  });

  it('takes the filter off with a second click', () => {
    const vulnerable = debuff('vulnerable', 'applies');
    const flag: Clicked = { key: 'nostack', kind: 'flag' };

    expect(clickKeyword(clickKeyword(initialExploreState, vulnerable), vulnerable)).toEqual(initialExploreState);
    expect(clickKeyword(clickKeyword(initialExploreState, flag), flag)).toEqual(initialExploreState);
  });

  it('jumps from the appliers of a keyword to its users, and not to the traits that are both', () => {
    const state = stateWith({ keywords: [{ field: 'applies', key: 'vulnerable' }] });

    expect(clickKeyword(state, debuff('vulnerable', 'applies')).keywords).toEqual([
      { field: 'uses', key: 'vulnerable' },
    ]);
  });

  it('jumps from the users of a keyword to its appliers', () => {
    const state = stateWith({ keywords: [{ field: 'uses', key: 'vulnerable' }] });

    expect(clickKeyword(state, debuff('vulnerable', 'uses')).keywords).toEqual([
      { field: 'applies', key: 'vulnerable' },
    ]);
  });

  it('adds the filter after the others and leaves them as they are, other roles of other keywords included', () => {
    const state = stateWith({
      keywords: [
        { field: 'applies', key: 'weak' },
        { field: 'applies', key: 'vulnerable' },
        { field: 'kw', key: 'vulnerable' },
        { field: 'kw', key: 'start of battle' },
      ],
    });

    expect(clickKeyword(state, debuff('vulnerable', 'applies')).keywords).toEqual([
      { field: 'applies', key: 'weak' },
      { field: 'kw', key: 'vulnerable' },
      { field: 'kw', key: 'start of battle' },
      { field: 'uses', key: 'vulnerable' },
    ]);
  });

  it('takes off only the filter of the click when both roles of the keyword are on', () => {
    const state = stateWith({
      keywords: [
        { field: 'applies', key: 'vulnerable' },
        { field: 'uses', key: 'vulnerable' },
      ],
    });

    expect(clickKeyword(state, debuff('vulnerable', 'applies')).keywords).toEqual([
      { field: 'applies', key: 'vulnerable' },
    ]);
  });

  it('leaves the rest of the state alone, and the state it was given unchanged', () => {
    const made = () =>
      stateWith({
        query: 'weak OR snared',
        classes: ['life'],
        keywords: [{ field: 'applies', key: 'vulnerable' }],
        keywordMode: 'any',
        artifactEligible: true,
        sort: 'az',
      });
    const state = made();

    const clicked = clickKeyword(state, debuff('vulnerable', 'applies'));

    expect(clicked).toEqual({ ...made(), keywords: [{ field: 'uses', key: 'vulnerable' }] });
    expect(state).toEqual(made());
  });
});

describe('isClickOn', () => {
  it('is off until the filter the click stands for is chosen', () => {
    const applied = debuff('vulnerable', 'applies');

    expect(isClickOn(initialExploreState, applied)).toBe(false);
    expect(isClickOn(clickKeyword(initialExploreState, applied), applied)).toBe(true);
  });

  it('is on for the counterpart of the role and off for the role itself', () => {
    const state = stateWith({ keywords: [{ field: 'uses', key: 'vulnerable' }] });

    expect(isClickOn(state, debuff('vulnerable', 'applies'))).toBe(true);
    expect(isClickOn(state, debuff('vulnerable', 'uses'))).toBe(false);
  });

  it('tells a keyword from another, and a field from another', () => {
    const state = stateWith({ keywords: [{ field: 'kw', key: 'vulnerable' }] });

    expect(isClickOn(state, debuff('weak', 'resists'))).toBe(false);
    expect(isClickOn(state, debuff('vulnerable', 'applies'))).toBe(false);
    expect(isClickOn(state, debuff('vulnerable', 'resists'))).toBe(true);
  });

  it('follows the flag', () => {
    const flag: Clicked = { key: 'nostack', kind: 'flag' };

    expect(isClickOn(stateWith({ doesNotStack: true }), flag)).toBe(true);
    expect(isClickOn(stateWith({ doesNotStack: false }), flag)).toBe(false);
  });
});

describe('a click, on any state', () => {
  const clicked = fc.record({
    key: fc.constantFrom('vulnerable', 'weak', 'start of battle', 'nostack'),
    kind: fc.constantFrom<KeywordKind>('debuff', 'buff', 'effect', 'event', 'mechanic', 'flag'),
    role: fc.option(fc.constantFrom<KeywordRole>('applies', 'uses', 'resists'), { nil: undefined }),
  });
  const state = fc.record({
    query: fc.string(),
    classes: fc.array(fc.constantFrom('life', 'death')),
    keywords: fc.array(
      fc.record({
        field: fc.constantFrom('applies', 'uses', 'kw'),
        key: fc.constantFrom('vulnerable', 'weak', 'start of battle'),
      }),
    ),
    keywordMode: fc.constantFrom('all', 'any'),
    artifactEligible: fc.boolean(),
    doesNotStack: fc.boolean(),
    sort: fc.constantFrom('book', 'class', 'az'),
  }) satisfies fc.Arbitrary<ExploreState>;
  const hit = (properties: { key: string; kind: KeywordKind; role?: KeywordRole | undefined }): Clicked => ({
    key: properties.key,
    kind: properties.kind,
    ...(properties.role === undefined ? {} : { role: properties.role }),
  });

  it('turns the filter it stands for on when it was off, and off when it was on', () => {
    fc.assert(
      fc.property(state, clicked, (before, properties) => {
        const keyword = hit(properties);
        expect(isClickOn(clickKeyword(before, keyword), keyword)).toBe(!isClickOn(before, keyword));
      }),
    );
  });

  it('never changes what the query bar, the classes, the mode, the material filter or the sort say', () => {
    fc.assert(
      fc.property(state, clicked, (before, properties) => {
        const after = clickKeyword(before, hit(properties));
        expect({ ...after, keywords: [], doesNotStack: false }).toEqual({
          ...before,
          keywords: [],
          doesNotStack: false,
        });
      }),
    );
  });
});
