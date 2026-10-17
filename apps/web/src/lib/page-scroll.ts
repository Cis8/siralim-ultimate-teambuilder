/** What the page's scrolling is watched on: the window, or a stand-in for it in a test. */
export interface ScrollSource {
  addEventListener(type: 'scroll' | 'resize', listener: () => void, options?: AddEventListenerOptions): void;
  removeEventListener(type: 'scroll' | 'resize', listener: () => void): void;
  requestAnimationFrame(callback: () => void): number;
  cancelAnimationFrame(handle: number): void;
}

export interface PageScroll {
  /** Runs `listener` once in every frame that follows a scroll or a resize. Returns the function that stops it. */
  readonly subscribe: (listener: () => void) => () => void;
  /** Asks for the subscribers to run in the next frame, as a scroll would: something changed the layout without one. */
  readonly request: () => void;
}

/**
 * Watches the scroll and the size of the window once, for everything on the page that follows them (the height a sticky
 * panel may have, the Back to top button). Scrolling and resizing fire faster than the screen is drawn, so the subscribers
 * run once per frame, and the window is listened to only while someone subscribes.
 */
export function createPageScroll(source: ScrollSource): PageScroll {
  const subscribers = new Set<() => void>();
  let frame: number | undefined;

  const run = (): void => {
    frame = undefined;
    for (const subscriber of subscribers) subscriber();
  };
  const request = (): void => {
    frame ??= source.requestAnimationFrame(run);
  };

  return {
    request,
    subscribe(listener) {
      if (subscribers.size === 0) {
        source.addEventListener('scroll', request, { passive: true });
        source.addEventListener('resize', request);
      }
      subscribers.add(listener);
      return () => {
        if (!subscribers.delete(listener) || subscribers.size > 0) return;
        source.removeEventListener('scroll', request);
        source.removeEventListener('resize', request);
        if (frame !== undefined) source.cancelAnimationFrame(frame);
        frame = undefined;
      };
    },
  };
}

let shared: PageScroll | undefined;

/** The scroll of this page's window, shared: made when it is first asked for, which only happens in the browser. */
export function pageScroll(): PageScroll {
  shared ??= createPageScroll(window);
  return shared;
}
