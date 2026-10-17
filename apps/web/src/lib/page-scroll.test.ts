import { describe, expect, it } from 'vitest';
import { createPageScroll, type ScrollSource } from './page-scroll';

/** A window that keeps its listeners and its frames, and runs the frame when the test says the screen is drawn. */
function fakeWindow() {
  const listening = new Map<string, () => void>();
  let pending: (() => void) | undefined;
  let requests = 0;
  const source: ScrollSource = {
    addEventListener: (type, listener) => {
      listening.set(type, listener);
    },
    removeEventListener: (type) => {
      listening.delete(type);
    },
    requestAnimationFrame: (callback) => {
      requests++;
      pending = callback;
      return requests;
    },
    cancelAnimationFrame: () => {
      pending = undefined;
    },
  };
  return {
    source,
    listening,
    emit: (type: 'scroll' | 'resize') => listening.get(type)?.(),
    drawFrame: () => {
      const run = pending;
      pending = undefined;
      run?.();
    },
    hasPendingFrame: () => pending !== undefined,
    framesAsked: () => requests,
  };
}

describe('createPageScroll', () => {
  it('listens to the window once, however many parts of the page follow the scroll', () => {
    const window = fakeWindow();
    const pageScroll = createPageScroll(window.source);

    pageScroll.subscribe(() => undefined);
    pageScroll.subscribe(() => undefined);

    expect([...window.listening.keys()].sort()).toEqual(['resize', 'scroll']);
  });

  it('runs every subscriber once per frame, however many scrolls that frame had', () => {
    const window = fakeWindow();
    const pageScroll = createPageScroll(window.source);
    const calls: string[] = [];
    pageScroll.subscribe(() => calls.push('offset'));
    pageScroll.subscribe(() => calls.push('button'));

    window.emit('scroll');
    window.emit('scroll');
    window.emit('resize');
    expect(calls).toEqual([]);
    window.drawFrame();

    expect(calls).toEqual(['offset', 'button']);
    expect(window.framesAsked()).toBe(1);
  });

  it('asks for a new frame at the next scroll, after the frame has run', () => {
    const window = fakeWindow();
    const pageScroll = createPageScroll(window.source);
    let runs = 0;
    pageScroll.subscribe(() => runs++);

    window.emit('scroll');
    window.drawFrame();
    window.emit('scroll');
    window.drawFrame();

    expect(runs).toBe(2);
  });

  it('runs the subscribers at the next frame when asked, without a scroll', () => {
    const window = fakeWindow();
    const pageScroll = createPageScroll(window.source);
    let runs = 0;
    pageScroll.subscribe(() => runs++);

    pageScroll.request();
    pageScroll.request();
    window.drawFrame();

    expect(runs).toBe(1);
  });

  it('keeps listening while one subscriber is left, and stops running the one that left', () => {
    const window = fakeWindow();
    const pageScroll = createPageScroll(window.source);
    const calls: string[] = [];
    const stopOffset = pageScroll.subscribe(() => calls.push('offset'));
    pageScroll.subscribe(() => calls.push('button'));

    stopOffset();
    window.emit('scroll');
    window.drawFrame();

    expect(window.listening.size).toBe(2);
    expect(calls).toEqual(['button']);
  });

  it('stops listening, and drops the frame it asked for, when the last subscriber leaves', () => {
    const window = fakeWindow();
    const pageScroll = createPageScroll(window.source);
    const stop = pageScroll.subscribe(() => undefined);
    window.emit('scroll');

    stop();
    stop();

    expect(window.listening.size).toBe(0);
    expect(window.hasPendingFrame()).toBe(false);
  });

  it('starts again when someone subscribes after everyone has left', () => {
    const window = fakeWindow();
    const pageScroll = createPageScroll(window.source);
    pageScroll.subscribe(() => undefined)();
    let runs = 0;

    pageScroll.subscribe(() => runs++);
    window.emit('scroll');
    window.drawFrame();

    expect(window.listening.size).toBe(2);
    expect(runs).toBe(1);
  });
});
