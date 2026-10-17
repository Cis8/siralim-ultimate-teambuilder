import { describe, expect, it } from 'vitest';
import { decodeTab, encodeTab, initialTab, PAGE_TABS, panelId, tabForKey, tabId, TAB_PARAMS } from './page-tab';

const read = (search: string): ReturnType<typeof decodeTab> => decodeTab(new URLSearchParams(search));

describe('decodeTab', () => {
  it('is the Explore tab for an address that names none', () => {
    expect(read('')).toBe('explore');
    expect(read('q=weak&party=2.0,life--mender')).toBe('explore');
  });

  it('reads the tab the address names', () => {
    expect(read('tab=party')).toBe('party');
    expect(read('tab=explore')).toBe('explore');
  });

  it('ignores case and the blanks around a name, as the party codec does', () => {
    expect(read('tab=Party')).toBe('party');
    expect(read('tab=%20party%20')).toBe('party');
  });

  it.each(['', 'synergies', 'party,explore', '2', 'null'])(
    'is the Explore tab for a name that is no tab: %j',
    (name) => {
      expect(read(`tab=${encodeURIComponent(name)}`)).toBe(initialTab);
    },
  );

  it('reads the first of two tabs', () => {
    expect(read('tab=party&tab=explore')).toBe('party');
  });
});

describe('encodeTab', () => {
  it('writes nothing for the tab the page opens on, so that its address stays the plain one', () => {
    expect(encodeTab(initialTab)).toEqual([]);
  });

  it('writes the other tab by its name', () => {
    expect(encodeTab('party')).toEqual([['tab', 'party']]);
  });

  it.each(PAGE_TABS)('is read back as the same tab: %s', (tab) => {
    expect(decodeTab(new URLSearchParams(Object.fromEntries(encodeTab(tab))))).toBe(tab);
  });

  it('writes only the parameters of TAB_PARAMS, so that a page can clear them before it writes', () => {
    for (const tab of PAGE_TABS) {
      for (const [name] of encodeTab(tab)) expect(TAB_PARAMS).toContain(name);
    }
  });
});

describe('tabForKey (the keys of the ARIA tab list)', () => {
  it('moves to the next tab on the right arrow, and goes round from the last', () => {
    expect(tabForKey('ArrowRight', 'explore')).toBe('party');
    expect(tabForKey('ArrowRight', 'party')).toBe('explore');
  });

  it('moves to the previous tab on the left arrow, and goes round from the first', () => {
    expect(tabForKey('ArrowLeft', 'party')).toBe('explore');
    expect(tabForKey('ArrowLeft', 'explore')).toBe('party');
  });

  it('goes to the first tab on Home and to the last on End', () => {
    expect(tabForKey('Home', 'party')).toBe('explore');
    expect(tabForKey('End', 'explore')).toBe('party');
  });

  it.each(['Enter', ' ', 'Tab', 'ArrowDown', 'ArrowUp', 'a'])('leaves the key %j to the browser', (key) => {
    expect(tabForKey(key, 'explore')).toBeUndefined();
  });
});

describe('the ids of a tab and of its panel', () => {
  it('are one each, and different for every tab', () => {
    const ids = PAGE_TABS.flatMap((tab) => [tabId(tab), panelId(tab)]);

    expect(new Set(ids).size).toBe(PAGE_TABS.length * 2);
  });
});
