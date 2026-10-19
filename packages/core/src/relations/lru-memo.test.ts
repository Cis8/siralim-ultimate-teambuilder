import { describe, expect, it } from 'vitest';
import { memoiseRecent } from './lru-memo';

/** `work(key)` that counts how often it ran and hands back a new object each time, so a reused answer is told by identity. */
function counted() {
  const calls: string[] = [];
  const work = (key: string) => {
    calls.push(key);
    return { key };
  };
  return { calls, work };
}

describe('memoiseRecent', () => {
  it('answers a repeated call with the first answer, without working again', () => {
    const { calls, work } = counted();
    const memo = memoiseRecent(3, (key: string) => key, work);

    const first = memo('a');

    expect(memo('a')).toBe(first);
    expect(calls).toEqual(['a']);
  });

  it('tells calls apart by the key it is given, not by the arguments', () => {
    const calls: string[] = [];
    const memo = memoiseRecent(
      3,
      (id: string, options: { loud?: boolean }) => `${id}|${String(options.loud === true)}`,
      (id: string, options: { loud?: boolean }) => {
        calls.push(`${id}${options.loud === true ? '!' : ''}`);
        return {};
      },
    );

    expect(memo('a', {})).toBe(memo('a', { loud: false }));
    expect(memo('a', { loud: true })).not.toBe(memo('a', {}));
    expect(calls).toEqual(['a', 'a!']);
  });

  it('forgets the call used longest ago once it holds more than its capacity', () => {
    const { calls, work } = counted();
    const memo = memoiseRecent(2, (key: string) => key, work);

    memo('a');
    memo('b');
    memo('c');
    memo('a');

    expect(calls).toEqual(['a', 'b', 'c', 'a']);
  });

  it('counts a repeat as a use: the call asked for again outlives one that was not', () => {
    const { calls, work } = counted();
    const memo = memoiseRecent(2, (key: string) => key, work);

    memo('a');
    memo('b');
    memo('a');
    memo('c');
    memo('a');
    memo('b');

    expect(calls).toEqual(['a', 'b', 'c', 'b']);
  });

  it('keeps an answer of undefined, which is what an unknown id gets', () => {
    const calls: string[] = [];
    const memo = memoiseRecent(
      2,
      (key: string) => key,
      (key: string): string | undefined => {
        calls.push(key);
        return undefined;
      },
    );

    expect(memo('a')).toBeUndefined();
    expect(memo('a')).toBeUndefined();
    expect(calls).toEqual(['a']);
  });

  it('does not keep a call that threw: the next one works again', () => {
    let fail = true;
    const memo = memoiseRecent(
      2,
      (key: string) => key,
      (key: string) => {
        if (fail) throw new Error('no');
        return { key };
      },
    );

    expect(() => memo('a')).toThrow('no');
    fail = false;
    expect(memo('a')).toEqual({ key: 'a' });
  });

  it('refuses a capacity that holds nothing', () => {
    expect(() => memoiseRecent(0, (key: string) => key, counted().work)).toThrow(RangeError);
    expect(() => memoiseRecent(1.5, (key: string) => key, counted().work)).toThrow(RangeError);
  });
});
