/**
 * Calls `callback` once the next frame is drawn, in a task of its own, so that work which can wait (the counts beside the
 * suggestions) never holds up the keystroke that asked for it or the paint that shows its result. A callback of
 * `requestAnimationFrame` runs before the paint, so it only schedules the task that runs after it. Returns the way to call it off.
 */
export function afterNextPaint(callback: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const frame = requestAnimationFrame(() => {
    timer = setTimeout(callback, 0);
  });
  return () => {
    cancelAnimationFrame(frame);
    clearTimeout(timer);
  };
}
