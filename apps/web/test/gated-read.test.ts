import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { gatedRead } from '../src/api/gatedRead.js';

/**
 * THE WHOLE GALAXY IS READ AT MOST ONCE EVERY FEW SECONDS, WHOEVER ASKS. Owner's
 * second phone recording, 2026-09-19: with fifteen of his own flights landing, four
 * separate paths (the private event resync, two arrival timers, the mining arrivals)
 * each invalidated `/api/galaxy`, and TanStack cancelled and restarted the read in
 * flight — up to seven ~475 KB downloads in one second, 33 MB in four minutes.
 * The limit lives on the read itself, so no trigger added later can bring it back.
 */

describe('a gated read', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shares the read already in the air instead of starting another', async () => {
    const fetch = vi.fn(() => new Promise<string>((resolve) => { setTimeout(() => { resolve('world'); }, 200); }));
    const read = gatedRead(fetch, 5000);
    const a = read();
    const b = read();
    vi.advanceTimersByTime(200);
    expect(await a).toBe('world');
    expect(await b).toBe('world');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('holds a burst of asks to one trailing read after the gap', async () => {
    const fetch = vi.fn(() => Promise.resolve('world'));
    const read = gatedRead(fetch, 5000);
    await read();
    const later = [read(), read(), read()];
    await vi.advanceTimersByTimeAsync(4999);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await Promise.all(later);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('reads at once when the last read is older than the gap', async () => {
    const fetch = vi.fn(() => Promise.resolve('world'));
    const read = gatedRead(fetch, 5000);
    await read();
    await vi.advanceTimersByTimeAsync(6000);
    await read();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('lets a failed read be asked again straight away', async () => {
    const fetch = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce('world');
    const read = gatedRead(fetch as () => Promise<string>, 5000);
    await expect(read()).rejects.toThrow('offline');
    await expect(read()).resolves.toBe('world');
  });
});
