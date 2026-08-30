import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { useIntel } from '../src/api/queries.js';

describe('the open Intel screen', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('keeps time-derived Telescope readings live in a quiet galaxy', async () => {
    vi.useFakeTimers();
    const intel = vi.fn().mockResolvedValue({
      watching: [], radarLog: [], probeCooldowns: [], probeReports: [],
      probeCost: { alloy: 0, crystal: 0, deuterium: 0 },
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>
        <ApiProvider api={{ intel } as unknown as Api}>{children}</ApiProvider>
      </QueryClientProvider>
    );

    const view = renderHook(() => useIntel(), { wrapper });
    await act(async () => { await Promise.resolve(); });
    expect(intel).toHaveBeenCalledTimes(1);

    await act(async () => { await vi.advanceTimersByTimeAsync(60_001); });
    expect(intel).toHaveBeenCalledTimes(2);
    view.unmount();
    client.clear();
  });
});
