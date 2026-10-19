/**
 * Makes `load` (an `import()`) a function that fetches once and hands every caller the same result. A load that fails is not
 * kept: the next call tries again, so that a connection that came back brings the layer in.
 */
export function memoisedLoader<Loaded>(load: () => Promise<Loaded>): () => Promise<Loaded> {
  let loading: Promise<Loaded> | undefined;
  return () => {
    loading ??= load().catch((failure: unknown) => {
      loading = undefined;
      throw failure;
    });
    return loading;
  };
}

/** How long a browser with no idle callback (Safari) is given before a layer that waits for it is fetched anyway. */
const IDLE_FALLBACK_MS = 200;

/** Calls `callback` once the browser has nothing else to do; returns the way to call it off. */
function onIdle(callback: () => void): () => void {
  if (typeof requestIdleCallback === 'function') {
    const handle = requestIdleCallback(callback);
    return () => {
      cancelIdleCallback(handle);
    };
  }
  const timer = setTimeout(callback, IDLE_FALLBACK_MS);
  return () => {
    clearTimeout(timer);
  };
}

/**
 * Calls `callback` once the browser has nothing else to do, so that fetching a layer does not hold up the page, and not before
 * `afterMs` have gone by, for a layer that must stay out of the way of something the page is busy with. Returns the way to
 * call it off.
 */
export function whenIdle(callback: () => void, afterMs = 0): () => void {
  let cancelIdle = (): void => undefined;
  const timer = setTimeout(() => {
    cancelIdle = onIdle(callback);
  }, afterMs);
  return () => {
    clearTimeout(timer);
    cancelIdle();
  };
}
