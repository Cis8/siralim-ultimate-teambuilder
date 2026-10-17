import { pageScroll } from './page-scroll';

/**
 * Keeps the custom property `--viewport-offset` of an element at how far its top edge is below the top of the window,
 * and 0 once it has been scrolled to the top or past it. A sticky panel next to a long list can then be as tall as the part
 * of the window that is left under what is above it: `max-height: calc(100dvh - var(--viewport-offset))`. Used as an
 * attachment: `{@attach trackViewportOffset}`.
 */
export function trackViewportOffset(element: HTMLElement): () => void {
  const update = (): void => {
    element.style.setProperty(
      '--viewport-offset',
      `${String(Math.max(0, Math.round(element.getBoundingClientRect().top)))}px`,
    );
  };

  update();
  const { subscribe, request } = pageScroll();
  const stop = subscribe(update);
  // What is above the element can change height (a chip row that wraps, a line that comes and goes) without a scroll.
  const observer = new ResizeObserver(request);
  observer.observe(document.body);

  return () => {
    stop();
    observer.disconnect();
    element.style.removeProperty('--viewport-offset');
  };
}
