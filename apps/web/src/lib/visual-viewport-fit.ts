/**
 * Keeps the custom properties `--sheet-top` and `--sheet-height` of an element at the top and the height of the visual viewport,
 * the part of the window that can be seen. A sheet that fills the window is then as tall as what is left above the keyboard of a
 * phone and not as tall as the window under it, so that what it docks at its foot (the button and the syntax toolbar of the search
 * sheet) is in sight. Safari keeps the layout viewport where it is and pans the visual one (`offsetTop`); Chrome on Android shrinks
 * only the visual one. A browser with no visual viewport leaves the element to its stylesheet, which falls back to the window.
 * Returns the way to stop.
 */
export function fitToVisualViewport(element: HTMLElement): () => void {
  const viewport = visualViewport;
  if (viewport === null) {
    return () => undefined;
  }

  const fit = (): void => {
    element.style.setProperty('--sheet-top', `${String(viewport.offsetTop)}px`);
    element.style.setProperty('--sheet-height', `${String(viewport.height)}px`);
  };

  fit();
  viewport.addEventListener('resize', fit);
  viewport.addEventListener('scroll', fit);
  return () => {
    viewport.removeEventListener('resize', fit);
    viewport.removeEventListener('scroll', fit);
    element.style.removeProperty('--sheet-top');
    element.style.removeProperty('--sheet-height');
  };
}
