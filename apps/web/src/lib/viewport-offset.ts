/**
 * Keeps the custom property `--viewport-offset` of an element at how far its top edge is below the top of the window,
 * and 0 once it has been scrolled to the top or past it. A sticky panel next to a long list can then be as tall as the part
 * of the window that is left under what is above it: `max-height: calc(100dvh - var(--viewport-offset))`. Used as an
 * attachment: `{@attach trackViewportOffset}`.
 */
export function trackViewportOffset(element: HTMLElement): () => void {
  let frame = 0;

  const update = (): void => {
    frame = 0;
    element.style.setProperty(
      '--viewport-offset',
      `${String(Math.max(0, Math.round(element.getBoundingClientRect().top)))}px`,
    );
  };
  // Scrolling and resizing fire faster than the screen is drawn: one reading per frame is enough.
  const schedule = (): void => {
    if (frame === 0) frame = requestAnimationFrame(update);
  };

  update();
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  // What is above the element can change height (a chip row that wraps, a line that comes and goes) without a scroll.
  const observer = new ResizeObserver(schedule);
  observer.observe(document.body);

  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    observer.disconnect();
    element.style.removeProperty('--viewport-offset');
  };
}
