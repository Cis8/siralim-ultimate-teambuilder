import { afterEach, describe, expect, it, vi } from 'vitest';
import { afterNextPaint } from './after-paint';

describe('afterNextPaint', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  /** A browser whose frames are drawn by hand: `draw()` runs the callbacks asked for with `requestAnimationFrame`. */
  function browserWithFrames() {
    const frames = new Map<number, () => void>();
    let next = 1;
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (callback: () => void) => {
      frames.set(next, callback);
      return next++;
    });
    vi.stubGlobal('cancelAnimationFrame', (handle: number) => frames.delete(handle));
    return {
      draw() {
        const due = [...frames.values()];
        frames.clear();
        for (const callback of due) callback();
      },
      waiting: () => frames.size,
    };
  }

  it('calls back after the frame that follows is drawn, in a task of its own', () => {
    const browser = browserWithFrames();
    const callback = vi.fn();

    afterNextPaint(callback);
    expect(callback).not.toHaveBeenCalled();
    browser.draw();
    // The frame is on its way: what runs in the callback of the frame would hold up the paint, so the call waits for a task.
    expect(callback).not.toHaveBeenCalled();
    vi.runAllTimers();

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('can be called off before the frame is drawn', () => {
    const browser = browserWithFrames();
    const callback = vi.fn();

    afterNextPaint(callback)();
    browser.draw();
    vi.runAllTimers();

    expect(browser.waiting()).toBe(0);
    expect(callback).not.toHaveBeenCalled();
  });

  it('can be called off after the frame is drawn, before the task that follows it', () => {
    const browser = browserWithFrames();
    const callback = vi.fn();

    const cancel = afterNextPaint(callback);
    browser.draw();
    cancel();
    vi.runAllTimers();

    expect(callback).not.toHaveBeenCalled();
  });

  it('calls back once, whatever is done after', () => {
    const browser = browserWithFrames();
    const callback = vi.fn();

    const cancel = afterNextPaint(callback);
    browser.draw();
    vi.runAllTimers();
    cancel();
    browser.draw();
    vi.runAllTimers();

    expect(callback).toHaveBeenCalledTimes(1);
  });
});
