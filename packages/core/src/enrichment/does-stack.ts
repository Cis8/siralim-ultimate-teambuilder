/** `false` when the text says "This trait does not stack." (GAME_RULES R4). */
export function doesStack(description: string): boolean {
  return !/\bthis trait does not stack\b/i.test(description);
}
