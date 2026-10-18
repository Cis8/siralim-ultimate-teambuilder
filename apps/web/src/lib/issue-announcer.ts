import { copy } from './copy';

/** How long the count of issues must stay the same before a screen reader is told: typing changes it with every key. */
export const ANNOUNCE_AFTER_MS = 600;

export interface IssueAnnouncer {
  /** The query now has `count` issues. It is said once it has stayed so for `ANNOUNCE_AFTER_MS`. */
  counted(count: number): void;
  /** A fix was pressed: the next count is told at once, as the result of the fix. */
  fixed(): void;
  /** Nothing waiting is said: the field is gone. */
  stop(): void;
}

/**
 * What a screen reader is told about the issues of a query (a polite line, said by `say`): their number, after a pause in the
 * typing, and the result of a fix, at once. A count that is the one already said is not said again.
 */
export function createIssueAnnouncer(say: (message: string) => void): IssueAnnouncer {
  let announced = 0;
  let afterFix = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const cancel = (): void => {
    clearTimeout(timer);
    timer = undefined;
  };

  return {
    counted(count) {
      cancel();
      if (afterFix) {
        afterFix = false;
        announced = count;
        say(copy.issuesFixed(count));
      } else if (count !== announced) {
        timer = setTimeout(() => {
          announced = count;
          say(count === 0 ? copy.noIssues : copy.issueCount(count));
        }, ANNOUNCE_AFTER_MS);
      }
    },
    fixed() {
      afterFix = true;
    },
    stop: cancel,
  };
}
