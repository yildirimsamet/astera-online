import { afterEach, describe, expect, it, vi } from 'vitest';
import { retryArenaImport } from '../../src/arena/loading.js';

afterEach(() => { vi.useRealTimers(); });
describe('arena chunk retry', () => {
  it('retries a failed import once after 500ms', async () => {
    vi.useFakeTimers();
    const load = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ default: 'arena' });
    const result = retryArenaImport(load);
    await vi.advanceTimersByTimeAsync(499);
    expect(load).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(await result).toEqual({ default: 'arena' });
    expect(load).toHaveBeenCalledTimes(2);
  });
  it('exposes the second failure so the player can return to the galaxy', async () => {
    vi.useFakeTimers();
    const load = vi.fn().mockRejectedValue(new Error('offline'));
    const result = retryArenaImport(load);
    const rejected = expect(result).rejects.toThrow('offline');
    await vi.advanceTimersByTimeAsync(1000);
    await rejected;
    expect(load).toHaveBeenCalledTimes(2);
  });
});
