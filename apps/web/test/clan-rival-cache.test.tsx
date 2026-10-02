import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { keys, useClanActions } from '../src/api/queries.js';
import { clanRequestAcceptedSchema } from '../src/api/schemas.js';

describe('clan membership rival cache', () => {
  it('refreshes the season marks when a clan request is accepted locally', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const api = new Api({ fetch: globalThis.fetch });
    vi.spyOn(api, 'acceptClanRequest').mockResolvedValue(clanRequestAcceptedSchema.parse({
      clanId: 'clan', playerId: 'new-member', slot: 1,
      matureAt: '2026-09-30T12:00:00Z', hostileFlightsContinue: false,
    }));
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>
        <ApiProvider api={api}>{children}</ApiProvider>
      </QueryClientProvider>
    );
    const view = renderHook(() => useClanActions(), { wrapper });

    await act(async () => {
      await view.result.current.accept.mutateAsync({ requestId: 'request', acknowledgeHostile: false });
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: keys.season });
  });
});
