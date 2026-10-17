/** Whether the page is scrolled far enough from its top (more than a screen) for the Back to top button to be on offer. */
export function showsBackToTop(scrollY: number, viewportHeight: number): boolean {
  return scrollY > viewportHeight;
}
