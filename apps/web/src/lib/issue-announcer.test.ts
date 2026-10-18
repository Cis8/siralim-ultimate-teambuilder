import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ANNOUNCE_AFTER_MS, createIssueAnnouncer } from './issue-announcer';

function announcer() {
  const said: string[] = [];
  return {
    said,
    announcer: createIssueAnnouncer((message) => {
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

describe('createIssueAnnouncer', () => {
  it('says how many issues there are once the count has stayed the same for a moment', () => {
    const { said, announcer: issues } = announcer();

    issues.counted(1);
    vi.advanceTimersByTime(ANNOUNCE_AFTER_MS - 1);
    expect(said).toEqual([]);

    vi.advanceTimersByTime(1);
    expect(said).toEqual(['1 issue']);
  });

  it('says it once for a count that changes with every key, and then says the last', () => {
    const { said, announcer: issues } = announcer();

    issues.counted(1);
    vi.advanceTimersByTime(ANNOUNCE_AFTER_MS - 10);
    issues.counted(2);
    vi.advanceTimersByTime(ANNOUNCE_AFTER_MS - 10);
    issues.counted(3);
    vi.advanceTimersByTime(ANNOUNCE_AFTER_MS);

    expect(said).toEqual(['3 issues']);
  });

  it('says nothing when the count comes back to the one already said, or is none from the start', () => {
    const { said, announcer: issues } = announcer();

    issues.counted(0);
    vi.advanceTimersByTime(ANNOUNCE_AFTER_MS);
    issues.counted(2);
    vi.advanceTimersByTime(ANNOUNCE_AFTER_MS);
    issues.counted(3);
    issues.counted(2);
    vi.advanceTimersByTime(ANNOUNCE_AFTER_MS);

    expect(said).toEqual(['2 issues']);
  });

  it('says there are none left when the issues go away', () => {
    const { said, announcer: issues } = announcer();

    issues.counted(2);
    vi.advanceTimersByTime(ANNOUNCE_AFTER_MS);
    issues.counted(0);
    vi.advanceTimersByTime(ANNOUNCE_AFTER_MS);

    expect(said).toEqual(['2 issues', 'No issues']);
  });

  it('tells the result of a fix at once, with what is left to fix', () => {
    const { said, announcer: issues } = announcer();
    issues.counted(2);
    vi.advanceTimersByTime(ANNOUNCE_AFTER_MS);

    issues.fixed();
    issues.counted(1);
    expect(said).toEqual(['2 issues', 'Fixed. 1 issue left.']);

    issues.fixed();
    issues.counted(0);
    expect(said).toEqual(['2 issues', 'Fixed. 1 issue left.', 'Fixed. No issues left.']);
  });

  it('does not say the count again after the fix has told it', () => {
    const { said, announcer: issues } = announcer();
    issues.counted(2);
    vi.advanceTimersByTime(ANNOUNCE_AFTER_MS);

    issues.fixed();
    issues.counted(1);
    vi.advanceTimersByTime(ANNOUNCE_AFTER_MS * 2);

    expect(said).toEqual(['2 issues', 'Fixed. 1 issue left.']);
  });

  it('tells a fix even when it leaves as many issues as there were (the fix of one uncovers another)', () => {
    const { said, announcer: issues } = announcer();
    issues.counted(1);
    vi.advanceTimersByTime(ANNOUNCE_AFTER_MS);

    issues.fixed();
    issues.counted(1);

    expect(said).toEqual(['1 issue', 'Fixed. 1 issue left.']);
  });

  it('says what was waiting to be said no more when a fix comes first', () => {
    const { said, announcer: issues } = announcer();

    issues.counted(3);
    issues.fixed();
    issues.counted(2);
    vi.advanceTimersByTime(ANNOUNCE_AFTER_MS * 2);

    expect(said).toEqual(['Fixed. 2 issues left.']);
  });

  it('says nothing after it is stopped', () => {
    const { said, announcer: issues } = announcer();

    issues.counted(2);
    issues.stop();
    vi.advanceTimersByTime(ANNOUNCE_AFTER_MS * 2);

    expect(said).toEqual([]);
  });
});
