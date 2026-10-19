import { afterEach, describe, expect, it, vi } from 'vitest';
import { memoisedLoader, whenIdle } from './lazy-load';

describe('memoisedLoader', () => {
  it('loads on the first call and hands every caller the same result', async () => {
    const load = vi.fn(() => Promise.resolve({ layer: 'assist' }));
    const loadOnce = memoisedLoader(load);

    const [first, second] = await Promise.all([loadOnce(), loadOnce()]);
    const third = await loadOnce();

    expect(load).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
    expect(third).toBe(first);
  });

  it('does not start a second load while the first is under way', () => {
    const load = vi.fn(() => new Promise<string>(() => undefined));
    const loadOnce = memoisedLoader(load);

    void loadOnce();
    void loadOnce();

    expect(load).toHaveBeenCalledTimes(1);
  });

  it('tells every caller of a load that failed, and tries again on the next call', async () => {
    const load = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce('loaded');
    const loadOnce = memoisedLoader(load);

    await expect(loadOnce()).rejects.toThrow('offline');
    await expect(loadOnce()).resolves.toBe('loaded');
    await expect(loadOnce()).resolves.toBe('loaded');

    expect(load).toHaveBeenCalledTimes(2);
  });
});

describe('whenIdle', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  /** A browser whose idle moments come when the test says so: `idle()` runs the callback it was asked for. */
  function browserWithIdleCallbacks() {
    let pending: (() => void) | undefined;
    const cancelIdleCallback = vi.fn();
    vi.useFakeTimers();
    vi.stubGlobal('requestIdleCallback', (callback: () => void) => {
      pending = callback;
      return 7;
    });
    vi.stubGlobal('cancelIdleCallback', cancelIdleCallback);
    return {
      idle: () => pending?.(),
      asked: () => pending !== undefined,
      cancelIdleCallback,
    };
  }

  it('calls back when the browser is idle', () => {
    const browser = browserWithIdleCallbacks();
    const callback = vi.fn();

    whenIdle(callback);
    vi.runAllTimers();
    expect(callback).not.toHaveBeenCalled();
    browser.idle();

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('does not ask the browser for an idle moment before the time it was given has gone by', () => {
    const browser = browserWithIdleCallbacks();
    const callback = vi.fn();

    whenIdle(callback, 500);
    vi.advanceTimersByTime(499);
    expect(browser.asked()).toBe(false);
    vi.advanceTimersByTime(1);
    expect(browser.asked()).toBe(true);
    browser.idle();

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('can be called off while it waits for the browser to be idle', () => {
    const browser = browserWithIdleCallbacks();

    const cancel = whenIdle(vi.fn());
    vi.runAllTimers();
    cancel();

    expect(browser.cancelIdleCallback).toHaveBeenCalledExactlyOnceWith(7);
  });

  it('can be called off before the time it was given has gone by, and then asks for nothing', () => {
    const browser = browserWithIdleCallbacks();
    const callback = vi.fn();

    const cancel = whenIdle(callback, 500);
    vi.advanceTimersByTime(100);
    cancel();
    vi.runAllTimers();
    browser.idle();

    expect(browser.asked()).toBe(false);
    expect(callback).not.toHaveBeenCalled();
  });

  it('waits a moment instead where the browser has no idle callback (Safari)', () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestIdleCallback', undefined);
    const callback = vi.fn();

    whenIdle(callback);
    expect(callback).not.toHaveBeenCalled();
    vi.runAllTimers();

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('adds the moment it waits for in Safari to the time it was given', () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestIdleCallback', undefined);
    const callback = vi.fn();

    whenIdle(callback, 500);
    vi.advanceTimersByTime(500);
    expect(callback).not.toHaveBeenCalled();
    vi.runAllTimers();

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('can be called off while it waits a moment', () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestIdleCallback', undefined);
    const callback = vi.fn();

    const cancel = whenIdle(callback);
    vi.advanceTimersByTime(0);
    cancel();
    vi.runAllTimers();

    expect(callback).not.toHaveBeenCalled();
  });
});
