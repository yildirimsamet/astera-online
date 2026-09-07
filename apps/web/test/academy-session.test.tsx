import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { useSession } from '../src/session/useSession.js';

describe('local Academy entry', () => {
  it('does not request preview or create an account when training starts', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(() => Promise.resolve(new Response('{}', { status: 401 })));
    const api = new Api({ fetch });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}><ApiProvider api={api}>{children}</ApiProvider></QueryClientProvider>;
    const { result } = renderHook(useSession, { wrapper });
    await waitFor(() => { expect(result.current.session.phase).toBe('landing'); });
    fetch.mockClear();
    await act(async () => { await result.current.rehearse(); });
    expect(result.current.session.phase).toBe('rehearsing');
    expect(fetch).not.toHaveBeenCalled();
  });
});
