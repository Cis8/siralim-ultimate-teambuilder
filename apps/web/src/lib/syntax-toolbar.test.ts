import { SYNTAX_INSERTION_IDS } from '@atlas/core';
import { describe, expect, it } from 'vitest';
import { syntaxToolbar } from './syntax-toolbar';

describe('the syntax toolbar', () => {
  it('has the buttons of the plan, in its order', () => {
    expect(syntaxToolbar.map(({ label }) => label)).toEqual([
      '(',
      ')',
      '"',
      'OR',
      'AND',
      'NOT',
      'applies:',
      'uses:',
      'class:',
      'mat:yes',
    ]);
  });

  it('has a button for every insertion the query language knows, once', () => {
    expect(syntaxToolbar.map(({ id }) => id)).toEqual([...SYNTAX_INSERTION_IDS]);
  });

  it('names every button, each differently, and the name of a button that shows a word contains that word', () => {
    const names = syntaxToolbar.map(({ name }) => name);
    expect(new Set(names).size).toBe(names.length);
    for (const { label, name } of syntaxToolbar) {
      expect(name.trim()).not.toBe('');
      if (/^[A-Za-z]/u.test(label)) expect(name).toContain(label);
    }
  });

  it('calls the button that writes a dash NOT, in its name as well as on its face', () => {
    const not = syntaxToolbar.find(({ id }) => id === 'not');
    expect(not?.label).toBe('NOT');
    expect(not?.name).toMatch(/NOT/u);
  });
});
