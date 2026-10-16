import { flag } from './entries';

/** Properties a trait states about itself (GAME_RULES R4). */
export const flags = [flag('nostack', 'Does not stack', ['This trait does not stack'])] as const;
