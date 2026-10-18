import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ANNOUNCE_LIST_AFTER_MS, createListAnnouncer } from './list-announcer';

function announcer() {
  const said: string[] = [];
  return {
    said,
    announcer: createListAnnouncer((message) => {
      said.push(message);
    }),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createListAnnouncer', () => {
  it('says how many suggestions there are once the list has stayed the same size for a moment', () => {
    const { said, announcer: list } = announcer();

    list.sized(9);
    vi.advanceTimersByTime(ANNOUNCE_LIST_AFTER_MS - 1);
    expect(said).toEqual([]);

    vi.advanceTimersByTime(1);
    expect(said).toEqual(['9 suggestions']);
  });

  it('says "1 suggestion" for one', () => {
    const { said, announcer: list } = announcer();
    list.sized(1);
    vi.advanceTimersByTime(ANNOUNCE_LIST_AFTER_MS);
    expect(said).toEqual(['1 suggestion']);
  });

  it('says only the last size of a list that changes with every key', () => {
    const { said, announcer: list } = announcer();

    list.sized(9);
    vi.advanceTimersByTime(ANNOUNCE_LIST_AFTER_MS - 10);
    list.sized(4);
    vi.advanceTimersByTime(ANNOUNCE_LIST_AFTER_MS - 10);
    list.sized(2);
    vi.advanceTimersByTime(ANNOUNCE_LIST_AFTER_MS);

    expect(said).toEqual(['2 suggestions']);
  });

  it('does not say a size again when the list comes back to the one already said', () => {
    const { said, announcer: list } = announcer();

    list.sized(9);
    vi.advanceTimersByTime(ANNOUNCE_LIST_AFTER_MS);
    list.sized(5);
    list.sized(9);
    vi.advanceTimersByTime(ANNOUNCE_LIST_AFTER_MS);

    expect(said).toEqual(['9 suggestions']);
  });

  it('says nothing for a list that is gone, and says the size again when it comes back', () => {
    const { said, announcer: list } = announcer();

    list.sized(9);
    vi.advanceTimersByTime(ANNOUNCE_LIST_AFTER_MS);
    list.sized(0);
    vi.advanceTimersByTime(ANNOUNCE_LIST_AFTER_MS);
    list.sized(9);
    vi.advanceTimersByTime(ANNOUNCE_LIST_AFTER_MS);

    expect(said).toEqual(['9 suggestions', '9 suggestions']);
  });

  it('says nothing of a size that was waiting when the list went away', () => {
    const { said, announcer: list } = announcer();

    list.sized(9);
    list.sized(0);
    vi.advanceTimersByTime(ANNOUNCE_LIST_AFTER_MS * 2);

    expect(said).toEqual([]);
  });

  it('says nothing after it is stopped', () => {
    const { said, announcer: list } = announcer();

    list.sized(9);
    list.stop();
    vi.advanceTimersByTime(ANNOUNCE_LIST_AFTER_MS * 2);

    expect(said).toEqual([]);
  });
});
