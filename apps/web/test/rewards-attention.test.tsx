import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { keys, useLaunch, useProbe } from '../src/api/queries.js';
import { planetView } from './fixtures.js';

describe('claimable reward attention after a flight launch', () => {
  const setup = (api: Partial<Api>) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    client.setQueryData(keys.planet, planetView());
    client.setQueryData(keys.rewards, { chains: [], claimable: 0 });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>
        <ApiProvider api={api as Api}>{children}</ApiProvider>
      </QueryClientProvider>
    );
    return { client, wrapper };
  };

  it('refreshes rewards when a probe mission starts', async () => {
    const { client, wrapper } = setup({ probe: vi.fn().mockResolvedValue({}) });
    const { result } = renderHook(() => useProbe(), { wrapper });
    act(() => { result.current.mutate('target'); });
    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });
    await waitFor(() => { expect(client.getQueryState(keys.rewards)?.isInvalidated).toBe(true); });
  });

  it('refreshes rewards when an attack mission starts', async () => {
    const { client, wrapper } = setup({ launch: vi.fn().mockResolvedValue({ planet: planetView(), pending: [] }) });
    const { result } = renderHook(() => useLaunch(), { wrapper });
    act(() => { result.current.mutate({ targetPlanetId: 'target', fleet: { DART: 5 } }); });
    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });
    await waitFor(() => { expect(client.getQueryState(keys.rewards)?.isInvalidated).toBe(true); });
  });
});
