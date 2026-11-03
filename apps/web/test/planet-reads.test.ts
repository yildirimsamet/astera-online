import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Api } from '../src/api/client.js';
import { planetReads, WORLD_READ_DEADLINE_MS } from '../src/api/planetReads.js';
import type { PlanetView, PlanetsView } from '../src/api/schemas.js';
import { planetView } from './fixtures.js';

/**
 * ONE HTTP READ FOR A SCREEN'S WORTH OF WORLD READS. Query plan, 2026-11-03.
 *
 * Half of production's world reads repeated one from the last two seconds: an event
 * refreshes the list and the open world side by side, though the list already carries
 * that world and costs the server the same 33 statements. Reads asked for together now
 * share one request. A read asked for during a request waits for the next one: it may
 * follow a write that the running request did not see.
 */
const world = (id: string) => planetView({}, { id });
const worldList = (...ids: string[]): PlanetsView => ({
  playerId: 'player-1', seasonId: 'season-1', capitalPlanetId: ids[0] ?? null, planets: ids.map(world),
} as PlanetsView);
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
type Options = { signal?: AbortSignal } | undefined;
const fakeApi = (list: () => Promise<PlanetsView> = () => Promise.resolve(worldList('capital', 'colony'))) => {
  const planets = vi.fn((_options?: Options) => list());
  const planet = vi.fn((id?: string, _options?: Options): Promise<PlanetView> => Promise.resolve(world(id ?? 'capital')));
  return { api: { planets, planet } as unknown as Api, planets, planet };
};
const idOf = (view: PlanetView) => view.planet.id;

describe('reads asked for together', () => {
  it('answers the list and a world from one list request', async () => {
    const { api, planets, planet } = fakeApi();
    const reads = planetReads(api);
    const [list, colony] = await Promise.all([reads.list(), reads.world('colony')]);
    expect(planets).toHaveBeenCalledOnce();
    expect(planet).not.toHaveBeenCalled();
    expect(list.planets.map(idOf)).toEqual(['capital', 'colony']);
    expect(idOf(colony)).toBe('colony');
  });

  it('answers two worlds from one list request', async () => {
    const { api, planets, planet } = fakeApi();
    const reads = planetReads(api);
    const answers = await Promise.all([reads.world('capital'), reads.world('colony')]);
    expect(planets).toHaveBeenCalledOnce();
    expect(planet).not.toHaveBeenCalled();
    expect(answers.map(idOf)).toEqual(['capital', 'colony']);
  });

  it('answers the capital alias from the list', async () => {
    const { api, planets, planet } = fakeApi();
    const reads = planetReads(api);
    const [, capital] = await Promise.all([reads.list(), reads.world(undefined)]);
    expect(planets).toHaveBeenCalledOnce();
    expect(planet).not.toHaveBeenCalled();
    expect(idOf(capital)).toBe('capital');
  });

  it('sends one request when one world is read twice', async () => {
    const { api, planets, planet } = fakeApi();
    const reads = planetReads(api);
    await Promise.all([reads.world('colony'), reads.world('colony')]);
    expect(planet).toHaveBeenCalledOnce();
    expect(planets).not.toHaveBeenCalled();
  });
});

describe('a read on its own', () => {
  it('reads one world by its own route', async () => {
    const { api, planets, planet } = fakeApi();
    expect(idOf(await planetReads(api).world('colony'))).toBe('colony');
    expect(planet).toHaveBeenCalledWith('colony', expect.objectContaining({ signal: expect.any(AbortSignal) as AbortSignal }));
    expect(planets).not.toHaveBeenCalled();
  });

  it('reads the capital alias by its own route', async () => {
    const { api, planet } = fakeApi();
    await planetReads(api).world(undefined);
    expect(planet.mock.calls[0]![0]).toBeUndefined();
  });

  it('asks the world route about a world the list does not hold, so its refusal reaches the reader', async () => {
    const refused = new Error('You no longer control that world');
    const { api, planet } = fakeApi();
    planet.mockRejectedValue(refused);
    const reads = planetReads(api);
    const [list, lost] = await Promise.allSettled([reads.list(), reads.world('lost')]);
    expect(list.status).toBe('fulfilled');
    expect(lost).toEqual({ status: 'rejected', reason: refused });
    expect(planet.mock.calls[0]![0]).toBe('lost');
  });
});

describe('a read asked for during a request', () => {
  it('never takes the running answer: it may follow a write that answer did not see', async () => {
    const first = deferred<PlanetsView>();
    const answers = [first.promise, Promise.resolve(worldList('after-the-write'))];
    const { api, planets } = fakeApi(() => answers.shift()!);
    const reads = planetReads(api);
    const before = reads.list();
    await flush();
    const after = reads.list();
    await flush();
    expect(planets).toHaveBeenCalledOnce();
    first.resolve(worldList('before-the-write'));
    expect((await before).planets.map(idOf)).toEqual(['before-the-write']);
    expect((await after).planets.map(idOf)).toEqual(['after-the-write']);
    expect(planets).toHaveBeenCalledTimes(2);
  });

  it('shares one following request with every other read that waited', async () => {
    const first = deferred<PlanetsView>();
    const answers = [first.promise, Promise.resolve(worldList('capital', 'colony'))];
    const { api, planets, planet } = fakeApi(() => answers.shift()!);
    const reads = planetReads(api);
    const running = reads.list();
    await flush();
    const waiting = [reads.list(), reads.world('colony'), reads.list(), reads.world('capital')];
    await flush();
    first.resolve(worldList('capital', 'colony'));
    await Promise.all([running, ...waiting]);
    expect(planets).toHaveBeenCalledTimes(2);
    expect(planet).not.toHaveBeenCalled();
  });

  it('still runs after the request before it failed', async () => {
    const failed = new Error('the network dropped');
    const answers = [Promise.reject(failed), Promise.resolve(worldList('capital'))];
    const { api, planets } = fakeApi(() => answers.shift()!);
    const reads = planetReads(api);
    const running = reads.list();
    await flush();
    const waiting = reads.list();
    await expect(running).rejects.toBe(failed);
    expect((await waiting).capitalPlanetId).toBe('capital');
    expect(planets).toHaveBeenCalledTimes(2);
  });

  it('gives every reader of a failed request the failure', async () => {
    const failed = new Error('the network dropped');
    const { api } = fakeApi(() => Promise.reject(failed));
    const reads = planetReads(api);
    const answers = await Promise.allSettled([reads.list(), reads.world('colony')]);
    expect(answers).toEqual([{ status: 'rejected', reason: failed }, { status: 'rejected', reason: failed }]);
  });
});

describe('cancelling', () => {
  const pendingUntilAborted = () => {
    const seen: { signal?: AbortSignal } = {};
    const list = vi.fn((options?: Options) => new Promise<PlanetsView>((_resolve, reject) => {
      if (options?.signal) seen.signal = options.signal;
      options?.signal?.addEventListener('abort', () => { reject(new DOMException('Read cancelled', 'AbortError')); }, { once: true });
    }));
    return { api: { planets: list, planet: vi.fn() } as unknown as Api, list, seen };
  };

  it('aborts the request when its only reader leaves', async () => {
    const { api, list, seen } = pendingUntilAborted();
    const leaving = new AbortController();
    const answer = planetReads(api).list(leaving.signal).catch((error: unknown) => error);
    await flush();
    expect(list).toHaveBeenCalledOnce();
    leaving.abort();
    expect(seen.signal?.aborted).toBe(true);
    expect(await answer).toMatchObject({ name: 'AbortError' });
  });

  it('keeps the request for the reader that stayed', async () => {
    const answer = deferred<PlanetsView>();
    const { api, planets } = fakeApi(() => answer.promise);
    const reads = planetReads(api);
    const leaving = new AbortController();
    const left = reads.list(leaving.signal).catch((error: unknown) => error);
    const stayed = reads.world('colony');
    await flush();
    leaving.abort();
    expect(await left).toMatchObject({ name: 'AbortError' });
    expect((planets.mock.calls[0]![0] as { signal: AbortSignal }).signal.aborted).toBe(false);
    answer.resolve(worldList('capital', 'colony'));
    expect(idOf(await stayed)).toBe('colony');
  });

  it('sends nothing when every reader left before the request went out', async () => {
    const first = deferred<PlanetsView>();
    const { api, planets } = fakeApi(() => first.promise);
    const reads = planetReads(api);
    const running = reads.list();
    await flush();
    const leaving = new AbortController();
    const left = reads.list(leaving.signal).catch((error: unknown) => error);
    leaving.abort();
    expect(await left).toMatchObject({ name: 'AbortError' });
    first.resolve(worldList('capital'));
    await running;
    await flush();
    expect(planets).toHaveBeenCalledOnce();
  });

  it('answers a reader that came after every earlier reader of the unsent request left', async () => {
    const { api, planets } = fakeApi();
    const reads = planetReads(api);
    const leaving = new AbortController();
    const left = reads.list(leaving.signal).catch((error: unknown) => error);
    leaving.abort();
    const stayed = reads.list();
    expect(await left).toMatchObject({ name: 'AbortError' });
    expect((await stayed).capitalPlanetId).toBe('capital');
    expect(planets).toHaveBeenCalledOnce();
  });

  it('answers a reader that came after every waiting reader left a running request behind', async () => {
    const first = deferred<PlanetsView>();
    const answers = [first.promise, Promise.resolve(worldList('next'))];
    const { api, planets } = fakeApi(() => answers.shift()!);
    const reads = planetReads(api);
    const running = reads.list();
    await flush();
    const leaving = new AbortController();
    const left = reads.list(leaving.signal).catch((error: unknown) => error);
    leaving.abort();
    expect(await left).toMatchObject({ name: 'AbortError' });
    const stayed = reads.list();
    first.resolve(worldList('capital'));
    await running;
    expect((await stayed).capitalPlanetId).toBe('next');
    expect(planets).toHaveBeenCalledTimes(2);
  });

  it('refuses a reader that is already cancelled and starts no request', async () => {
    const { api, planets } = fakeApi();
    const gone = new AbortController();
    gone.abort();
    await expect(planetReads(api).list(gone.signal)).rejects.toMatchObject({ name: 'AbortError' });
    await flush();
    expect(planets).not.toHaveBeenCalled();
  });
});

it('keeps one set of reads per client, so screens of one session share them', () => {
  const { api } = fakeApi();
  expect(planetReads(api)).toBe(planetReads(api));
  expect(planetReads(fakeApi().api)).not.toBe(planetReads(api));
});

/** One running request at a time means a stuck one must not hold every world read. Review, 2026-11-03. */
describe('a request that never answers', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  /** Fails on abort, as `fetch` does, and otherwise never answers on its first call. */
  const stuckOnce = () => {
    let calls = 0;
    const planet = vi.fn((id?: string, options?: Options): Promise<PlanetView> => {
      calls += 1;
      if (calls > 1) return Promise.resolve({ planet: { id: id ?? 'capital' } } as PlanetView);
      return new Promise((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () => { reject(new DOMException('Aborted', 'AbortError')); });
      });
    });
    return { api: { planet, planets: vi.fn() } as unknown as Api, planet };
  };

  it('gives up at the deadline and lets the next read through', async () => {
    const { api, planet } = stuckOnce();
    const reads = planetReads(api);
    const stuck = reads.world('capital');
    const failure = expect(stuck).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(1);
    const next = reads.world('colony');
    await vi.advanceTimersByTimeAsync(WORLD_READ_DEADLINE_MS);
    await failure;
    expect(idOf(await next)).toBe('colony');
    expect(planet).toHaveBeenCalledTimes(2);
  });

  it('leaves no deadline behind a read that answered', async () => {
    const { api } = fakeApi();
    await planetReads(api).world('capital');
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});

