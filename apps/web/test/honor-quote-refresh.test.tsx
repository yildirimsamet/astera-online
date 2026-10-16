import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { Api, ApiError } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { useStartRepair, useLaunchTrade, useLaunchIntergalacticConvoy } from '../src/api/queries.js';
import { keys } from '../src/api/keys.js';

function setup() {
  const api = new Api({ fetch: vi.fn<typeof globalThis.fetch>() });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  for (const queryKey of [keys.planet, keys.planets, keys.leaderboard]) client.setQueryData(queryKey, { stalePrice: true });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}><ApiProvider api={api}>{children}</ApiProvider></QueryClientProvider>;
  return { api, client, wrapper };
}
describe('stale Honor prices refresh before another commitment', () => {
  it('refreshes the repair price after the server refuses its outdated tier', async () => {
    const { api, client, wrapper } = setup();
    vi.spyOn(api, 'startRepair').mockRejectedValue(new ApiError('HONOR_QUOTE_CHANGED', 'refresh', 409));
    const { result } = renderHook(() => useStartRepair(), { wrapper });
    await act(async () => { await expect(result.current.mutateAsync({ planetId: 'mine', request: { all: true, expectedHonorTier: 2 } })).rejects.toBeInstanceOf(ApiError); });
    for (const queryKey of [keys.planet, keys.planets, keys.leaderboard]) expect(client.getQueryState(queryKey)?.isInvalidated).toBe(true);
  });
  it('refreshes the merchant commission after a stale tier refusal', async () => {
    const { api, client, wrapper } = setup();
    vi.spyOn(api, 'trade').mockRejectedValue(new ApiError('HONOR_QUOTE_CHANGED', 'refresh', 409));
    const { result } = renderHook(() => useLaunchTrade('mine'), { wrapper });
    await act(async () => { await expect(result.current.mutateAsync({ occurrenceId: 'merchant', fleet: { COURIER: 1 },
      give: { alloy: 400, crystal: 0, deuterium: 0 }, want: { alloy: 0, crystal: 200, deuterium: 0 }, expectedHonorTier: 2 })).rejects.toBeInstanceOf(ApiError); });
    for (const queryKey of [keys.planet, keys.planets, keys.leaderboard]) expect(client.getQueryState(queryKey)?.isInvalidated).toBe(true);
  });
  it('refreshes convoy prices and the shared Honor benefits section after a stale tier refusal', async () => {
    const { api, client, wrapper } = setup();
    client.setQueryData(keys.planetById('mine'), { stalePrice: true });
    vi.spyOn(api, 'launchIntergalacticConvoy').mockRejectedValue(new ApiError('HONOR_QUOTE_CHANGED', 'refresh', 409));
    const { result } = renderHook(() => useLaunchIntergalacticConvoy('mine'), { wrapper });
    await act(async () => { await expect(result.current.mutateAsync({ occurrenceId: 'convoy', fleet: { DART: 1 },
      quotedAt: new Date(0), quotedFlightSeconds: 60, quotedArriveAt: new Date(60_000),
      idempotencyKey: 'stale-convoy', expectedHonorTier: 2 })).rejects.toBeInstanceOf(ApiError); });
    for (const queryKey of [keys.planetById('mine'), keys.planets, keys.leaderboard]) expect(client.getQueryState(queryKey)?.isInvalidated).toBe(true);
  });
});
