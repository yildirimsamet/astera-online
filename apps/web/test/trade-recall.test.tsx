import type { ReactNode } from 'react';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { useRecallFlight } from '../src/api/queries.js';
import type { PendingThread } from '../src/api/schemas.js';
import { ThreadFocus } from '../src/galaxy/FocusPanel.js';
import { flightRecallInput } from '../src/lib/flights.js';
import i18n from '../src/i18n/index.js';

const id = '0f5e3c2a-7a39-4a8b-9d6e-1f2a3b4c5d6e';
const thread: PendingThread = { id, kind: 'trade', targetName: 'TRADE_SHIP', minutesRemaining: 10,
  arriveAt: new Date(Date.now() + 600_000), leg: 'outbound', fleet: { COURIER: 4 }, recallable: true };

describe('trade ship fleet recall', () => {
  it('offers the shared recall control and routes it to the trade run', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(() => Promise.resolve(new Response(JSON.stringify({ runId: id,
      homeAt: new Date(Date.now() + 300_000).toISOString() }), { status: 200 })));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const api = new Api({ fetch });
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}><ApiProvider api={api}>{children}</ApiProvider></QueryClientProvider>;
    const { result } = renderHook(() => useRecallFlight(), { wrapper });
    const input = flightRecallInput(thread);
    expect(input).toEqual({ missionId: id, trade: true });
    if (!input) throw new Error('Trade recall is missing');
    await act(async () => { await result.current.mutateAsync(input); });
    expect(fetch.mock.calls[0]?.[0]).toContain(`/api/trade/runs/${id}/recall`);
    const onRecall = vi.fn();
    render(<ThreadFocus thread={thread} minutesRemaining={10} onClose={vi.fn()} onToggle={vi.fn()} open onRecall={onRecall} />);
    expect(screen.getByRole('region', { name: `${i18n.t('trade.title')} — focus` })).toBeVisible();
    expect(screen.queryByText('TRADE_SHIP')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Recall fleet' }));
    expect(onRecall).toHaveBeenCalledOnce();
  });

  it('hides recall after merchant arrival and on the return leg', () => {
    expect(flightRecallInput({ ...thread, arriveAt: new Date(0) })).toBeUndefined();
    expect(flightRecallInput({ ...thread, leg: 'return' })).toBeUndefined();
    expect(flightRecallInput({ ...thread, recallable: false })).toBeUndefined();
  });
});
