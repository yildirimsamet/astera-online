import { describe, expect, it, vi } from 'vitest';
import { AsyncCache } from '../src/services/asyncCache.js';

it('invalidates only the addressed caller, including a pending fill', async () => {
  const cache = new AsyncCache<string>(4, 1000);
  const pending = deferred<string>();
  const load = vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValue('fresh');
  const read = cache.get('alice:season', load);
  await cache.get('bob:season', () => Promise.resolve('bob'));
  cache.invalidatePrefix('alice:');
  pending.resolve('stale');
  await expect(read).resolves.toBe('fresh');
  expect(await cache.get('bob:season', () => Promise.resolve('wrong'))).toBe('bob');
  expect(cache.status()).toMatchObject({ entries: 2, invalidations: 1 });
});

it('selects settled entries by value and hands a pending fill no value to judge', async () => {
  const cache = new AsyncCache<{ season: string }>(4, 1000);
  const pending = deferred<{ season: string }>();
  const load = vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValue({ season: 'A' });
  const read = cache.get('carol', load);
  const there = await cache.get('alice', () => Promise.resolve({ season: 'B' }));
  await cache.get('bob', () => Promise.resolve({ season: 'A' }));
  // Scaling plan F1.2: the fill may resolve to the selected galaxy, so it must go too.
  cache.invalidateWhere((_, value) => value === undefined || value.season === 'A');
  pending.resolve({ season: 'A' });
  await read;
  expect(load).toHaveBeenCalledTimes(2);
  expect(await cache.get('alice', () => Promise.resolve({ season: 'wrong' }))).toBe(there);
  expect(cache.status()).toMatchObject({ invalidations: 2 });
});

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('bounded projection cache', () => {
  it('single-flights concurrent misses and reuses the settled value', async () => {
    const pending = deferred<string>();
    const load = vi.fn(() => pending.promise);
    const cache = new AsyncCache<string>(2, 1000);

    const first = cache.get('season', load);
    const second = cache.get('season', load);
    pending.resolve('public view');

    await expect(Promise.all([first, second])).resolves.toEqual(['public view', 'public view']);
    await expect(cache.get('season', load)).resolves.toBe('public view');
    expect(load).toHaveBeenCalledTimes(1);
    expect(cache.status()).toMatchObject({ hits: 2, misses: 1, singleFlightWaits: 1 });
  });

  it('does not return a fill that raced a committed invalidation', async () => {
    const old = deferred<string>();
    const load = vi.fn()
      .mockImplementationOnce(() => old.promise)
      .mockResolvedValueOnce('new');
    const cache = new AsyncCache<string>(2, 1000);

    const read = cache.get('season', load);
    cache.invalidate('season');
    old.resolve('old');

    await expect(read).resolves.toBe('new');
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('keeps a slow pending fill single-flight after the settled-value TTL passes', async () => {
    let now = 0;
    const pending = deferred<string>();
    const load = vi.fn(() => pending.promise);
    const cache = new AsyncCache<string>(2, 10, () => true, () => now);

    const first = cache.get('season', load);
    now = 20;
    const second = cache.get('season', load);
    pending.resolve('one fill');

    await expect(Promise.all([first, second])).resolves.toEqual(['one fill', 'one fill']);
    expect(load).toHaveBeenCalledTimes(1);
    expect(cache.status().singleFlightWaits).toBe(1);
  });

  it('expires by TTL and evicts the least recently used season', async () => {
    let now = 0;
    const cache = new AsyncCache<string>(2, 10, () => true, () => now);
    const load = vi.fn((key: string) => Promise.resolve(`${key}:${String(now)}`));

    await cache.get('a', () => load('a'));
    await cache.get('b', () => load('b'));
    await cache.get('a', () => load('a'));
    await cache.get('c', () => load('c'));
    expect(cache.status()).toMatchObject({ entries: 2, evictions: 1 });

    await cache.get('b', () => load('b'));
    now = 11;
    await expect(cache.get('b', () => load('b'))).resolves.toBe('b:11');
    expect(cache.status().misses).toBe(5);
  });

  it('bypasses storage whenever its correctness channel is unavailable', async () => {
    let enabled = false;
    const load = vi.fn().mockResolvedValue('view');
    const cache = new AsyncCache<string>(2, 1000, () => enabled);

    await cache.get('season', load);
    await cache.get('season', load);
    enabled = true;
    await cache.get('season', load);
    await cache.get('season', load);

    expect(load).toHaveBeenCalledTimes(3);
    expect(cache.status()).toMatchObject({ bypasses: 2, hits: 1, misses: 1 });
  });
});
