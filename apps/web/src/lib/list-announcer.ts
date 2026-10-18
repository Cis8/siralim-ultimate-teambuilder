import { copy } from './copy';

/** How long a list must keep its size before a screen reader is told: typing changes it with every key. */
export const ANNOUNCE_LIST_AFTER_MS = 500;

export interface ListAnnouncer {
  /**
   * The list now shows `size` options (none when it is not showing). The size is said once it has stayed so for
   * `ANNOUNCE_LIST_AFTER_MS`, unless it is the one already said.
   */
  sized(size: number): void;
  /** Nothing waiting is said: the field is gone. */
  stop(): void;
}

/**
 * What a screen reader is told about the options of a combobox (a polite line, said by `say`): how many there are, after a pause
 * in the typing. A list that goes away is not announced, only forgotten, so that it is told again when it comes back.
 */
export function createListAnnouncer(say: (message: string) => void): ListAnnouncer {
  let announced = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const cancel = (): void => {
    clearTimeout(timer);
    timer = undefined;
  };

  return {
    sized(size) {
      cancel();
      if (size === 0) {
        announced = 0;
      } else if (size !== announced) {
        timer = setTimeout(() => {
          announced = size;
          say(copy.suggestionCount(size));
        }, ANNOUNCE_LIST_AFTER_MS);
      }
    },
    stop: cancel,
  };
}
