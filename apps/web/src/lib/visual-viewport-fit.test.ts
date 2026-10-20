import { afterEach, describe, expect, it, vi } from 'vitest';
import { fitToVisualViewport } from './visual-viewport-fit';

/** The visual viewport as far as the sheet follows it: a box that tells when it moves or changes size. */
class FakeViewport extends EventTarget {
  height = 844;
  offsetTop = 0;

  move(offsetTop: number, height: number, event: 'resize' | 'scroll'): void {
    this.offsetTop = offsetTop;
    this.height = height;
    this.dispatchEvent(new Event(event));
  }
}

/** An element as far as the sheet uses one: custom properties on its style. */
function fakeElement() {
  const properties = new Map<string, string>();
  return {
    properties,
    style: {
      setProperty: (name: string, value: string) => properties.set(name, value),
      removeProperty: (name: string) => properties.delete(name),
    },
  };
}

describe('fitToVisualViewport', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('gives the element the box of the visual viewport, from the start', () => {
    const viewport = new FakeViewport();
    viewport.height = 508;
    viewport.offsetTop = 0;
    vi.stubGlobal('visualViewport', viewport);
    const element = fakeElement();

    fitToVisualViewport(element as unknown as HTMLElement);

    expect(element.properties.get('--sheet-height')).toBe('508px');
    expect(element.properties.get('--sheet-top')).toBe('0px');
  });

  it('follows the viewport when the keyboard rises and falls, and when the page is panned', () => {
    const viewport = new FakeViewport();
    vi.stubGlobal('visualViewport', viewport);
    const element = fakeElement();
    fitToVisualViewport(element as unknown as HTMLElement);

    viewport.move(0, 508, 'resize');
    expect(element.properties.get('--sheet-height')).toBe('508px');

    viewport.move(112, 508, 'scroll');
    expect(element.properties.get('--sheet-top')).toBe('112px');

    viewport.move(0, 844, 'resize');
    expect(element.properties.get('--sheet-height')).toBe('844px');
    expect(element.properties.get('--sheet-top')).toBe('0px');
  });

  it('stops following, and takes its properties away, when it is let go', () => {
    const viewport = new FakeViewport();
    vi.stubGlobal('visualViewport', viewport);
    const element = fakeElement();

    const stop = fitToVisualViewport(element as unknown as HTMLElement);
    stop();
    viewport.move(50, 300, 'resize');

    expect(element.properties.size).toBe(0);
  });

  it('leaves the element to the stylesheet in a browser that has no visual viewport', () => {
    vi.stubGlobal('visualViewport', null);
    const element = fakeElement();

    const stop = fitToVisualViewport(element as unknown as HTMLElement);

    expect(element.properties.size).toBe(0);
    expect(() => {
      stop();
    }).not.toThrow();
  });
});
