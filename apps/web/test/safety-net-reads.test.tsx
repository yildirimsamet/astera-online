import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { CALM_NET_MS, setChannelLive } from '../src/api/liveChannel.js';
import { useClanStrength, useGalaxy, useGalaxyEvents, useIntel, usePending, useSeason, useServers, useSkins } from '../src/api/queries.js';
import { useReturnStatus } from '../src/api/returnQueries.js';

/**
 * A LIVE CHANNEL ONLY EXCUSES A READ THAT AN EVENT WOULD HAVE REFRESHED. Query plan, 2026-11-03.
 *
 * Most reads poll in case the stream missed something, and may slow down while it is
 * open. These do not: their figure drifts with no moment the server could announce, so
 * for them the timer is the mechanism. Slowing them would leave a number quietly wrong.
 */
let client: QueryClient;
const calls: string[] = [];
const answer = (name: string, value: unknown) => vi.fn(() => { calls.push(name); return Promise.resolve(value); });
const reads = (name: string) => calls.filter(each => each === name).length;

const fakeApi = (role = 'MAIN'): Api => ({
  season: answer('season', { monumentHonorees: [] }),
  intel: answer('intel', { watching: [], radarLog: [], reports: [], cooldowns: [] }),
  clanStrength: answer('clanStrength', {}),
  servers: answer('servers', { servers: [] }),
  returnStatus: answer('returnStatus', { placement: { playerId: 'p', version: 1, role }, homeShard: null, canApply: false, application: null }),
  galaxy: answer('galaxy', {}),
  galaxyEvents: answer('galaxyEvents', {}),
  pending: answer('pending', { pending: [] }),
  skins: answer('skins', {}),
}) as unknown as Api;

const mount = (hook: () => unknown, api: Api = fakeApi()) => renderHook(hook, {
  wrapper: ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}><ApiProvider api={api}>{children}</ApiProvider></QueryClientProvider>
  ),
});
const pass = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

beforeEach(() => {
  vi.useFakeTimers();
  calls.length = 0;
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  setChannelLive(true);
});
afterEach(() => {
  setChannelLive(false);
  client.clear();
  vi.useRealTimers();
});

describe('on a live channel', () => {
  it.each([
    // The online count drifts with no event.
    ['season', useSeason],
    // Telescope uncertainty and ages move with time.
    ['intel', useIntel],
    // A clanmate builds without telling this commander.
    ['clanStrength', () => useClanStrength(true)],
  ] as const)('%s still reads every minute', async (name, hook) => {
    mount(hook);
    await pass(0);
    expect(reads(name)).toBe(1);
    await pass(60_100);
    expect(reads(name)).toBe(2);
  });

  it('the server list keeps its twenty seconds, since a signed-out visitor has no channel', async () => {
    mount(useServers);
    await pass(0);
    await pass(20_100);
    expect(reads('servers')).toBe(2);
  });

  it('a commander in the waiting room still sees the queue move every minute', async () => {
    mount(() => useReturnStatus(true), fakeApi('WAITING'));
    await pass(0);
    await pass(60_100);
    expect(reads('returnStatus')).toBe(2);
  });

  it('a commander with no queue to watch does not poll for one', async () => {
    mount(() => useReturnStatus(true), fakeApi('MAIN'));
    await pass(0);
    await pass(60_100);
    expect(reads('returnStatus')).toBe(1);
  });

  it.each([
    ['galaxy', useGalaxy],
    ['galaxyEvents', useGalaxyEvents],
    ['pending', usePending],
    ['skins', useSkins],
  ] as const)('%s waits for the calm net, because an event refreshes it', async (name, hook) => {
    mount(hook);
    await pass(0);
    expect(reads(name)).toBe(1);
    await pass(60_100);
    expect(reads(name)).toBe(1);
    await pass(CALM_NET_MS - 60_000);
    expect(reads(name)).toBe(2);
  });
});
