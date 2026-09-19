import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import i18n from '../src/i18n/index.js';
import AdminPanel from '../src/screens/AdminPanel.js';
import { perfGalaxyFrame, resetPerfSession, setPerfGalaxyContext } from '../src/lib/perfSession.js';

/**
 * THE OWNER'S PERFORMANCE TAB. Owner request, 2026-09-19: start a recording, close
 * the sheet and play, come back and stop it; the phone sends the lot home and the
 * tab shows the headline figures at once.
 */

function setup() {
  const api = new Api({ fetch: vi.fn() as unknown as typeof globalThis.fetch });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.spyOn(api, 'adminFeedback').mockResolvedValue({ feedback: [] });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <ApiProvider api={api}>{children}</ApiProvider>
    </QueryClientProvider>
  );
  return { api, Wrapper };
}

describe('the admin performance tab', () => {
  beforeEach(() => {
    resetPerfSession();
  });
  afterEach(() => {
    resetPerfSession();
    vi.useRealTimers();
  });

  it('records, stops, sends, and shows the headline figures', async () => {
    const { api, Wrapper } = setup();
    const post = vi.spyOn(api, 'postPerfSession').mockResolvedValue({ id: 'b1a6e0f2-6a0c-4a57-9a8f-0b0d3c6a2f10' });
    render(<Wrapper><AdminPanel /></Wrapper>);

    fireEvent.click(screen.getByRole('tab', { name: i18n.t('community.admin.perfTab') }));
    expect(screen.getByText(i18n.t('community.admin.perfIntro'))).toBeInTheDocument();

    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'],
    });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('community.admin.perfStart') }));
    setPerfGalaxyContext({ planets: 1230 });
    for (let i = 0; i < 30; i += 1) perfGalaxyFrame(4, { calls: 150, triangles: 1, geometries: 1, textures: 1, programs: 1 });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByText(/0:0[12]/)).toBeInTheDocument();
    vi.useRealTimers();

    fireEvent.click(screen.getByRole('button', { name: i18n.t('community.admin.perfStop') }));
    await waitFor(() => {
      expect(screen.getByText(i18n.t('community.admin.perfSent'))).toBeInTheDocument();
    });
    expect(post).toHaveBeenCalledOnce();
    expect(screen.getByText(i18n.t('community.admin.perfFpsAvg'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('community.admin.perfFreezes'))).toBeInTheDocument();
  });

  it('offers a retry when the send fails, and keeps the recording', async () => {
    const { api, Wrapper } = setup();
    const post = vi.spyOn(api, 'postPerfSession')
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ id: 'b1a6e0f2-6a0c-4a57-9a8f-0b0d3c6a2f10' });
    render(<Wrapper><AdminPanel /></Wrapper>);
    fireEvent.click(screen.getByRole('tab', { name: i18n.t('community.admin.perfTab') }));
    fireEvent.click(screen.getByRole('button', { name: i18n.t('community.admin.perfStart') }));
    fireEvent.click(screen.getByRole('button', { name: i18n.t('community.admin.perfStop') }));

    const retry = await screen.findByRole('button', { name: i18n.t('community.admin.perfRetry') });
    fireEvent.click(retry);
    await waitFor(() => {
      expect(screen.getByText(i18n.t('community.admin.perfSent'))).toBeInTheDocument();
    });
    expect(post).toHaveBeenCalledTimes(2);
  });
});
