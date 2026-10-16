import { flag } from './entries';

/** The key of the flag a trait carries when it says it does not stack: the `stack:no` filter stands for it. */
export const NO_STACK_KEY = 'nostack';

/** Properties a trait states about itself (GAME_RULES R4). */
export const flags = [flag(NO_STACK_KEY, 'Does not stack', ['This trait does not stack'])] as const;
