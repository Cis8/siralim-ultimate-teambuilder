import type { TraitRow } from '@atlas/core';
import { describe, expect, it } from 'vitest';
import { SheetFormatError } from '../sheet/sheet-format-error';
import { identifyRows } from './identify-rows';

function row(overrides: Partial<TraitRow> = {}): TraitRow {
  return {
    class: 'Death',
    family: 'Abomination',
    creature: 'Abomination Brute',
    name: 'Flesh Rot',
    description: 'Afflicts a debuff.',
    material: 'Brute Stitches',
    ...overrides,
  };
}

describe('identifyRows', () => {
  it('gives each row its stable id, in input order', () => {
    const identified = identifyRows([row({ name: 'Quell' }), row({ name: 'Flesh Rot' })]);
    expect(identified.map(({ id }) => id)).toEqual(['abomination--quell', 'abomination--flesh-rot']);
  });

  it('accepts the same trait name in different families', () => {
    expect(identifyRows([row({ family: 'Ant' }), row({ family: 'Bee' })])).toHaveLength(2);
  });

  it('fails the build when two rows would share an id', () => {
    const failure = catchError(() =>
      identifyRows([row(), row({ creature: 'Abomination Volatile', description: 'Other.' })]),
    );
    expect(failure).toBeInstanceOf(SheetFormatError);
    expect(failure.message).toContain('abomination--flesh-rot');
    expect(failure.message).toContain('Abomination Brute');
    expect(failure.message).toContain('Abomination Volatile');
  });

  it('also catches names that only differ by punctuation', () => {
    expect(() => identifyRows([row({ name: "Mother's Love" }), row({ name: 'Mothers Love' })])).toThrow(
      /abomination--mothers-love/,
    );
  });

  it('lists every colliding id, not just the first', () => {
    const message = catchError(() =>
      identifyRows([row({ name: 'A' }), row({ name: 'A' }), row({ name: 'B' }), row({ name: 'B' })]),
    ).message;
    expect(message).toContain('abomination--a');
    expect(message).toContain('abomination--b');
  });

  it('turns an unusable name into a sheet error naming it', () => {
    const failure = catchError(() => identifyRows([row({ name: '!!!' })]));
    expect(failure).toBeInstanceOf(SheetFormatError);
    expect(failure.message).toContain('!!!');
  });
});

function catchError(action: () => unknown): Error {
  try {
    action();
  } catch (error) {
    if (error instanceof Error) return error;
    throw error;
  }
  throw new Error('Expected the action to throw');
}
