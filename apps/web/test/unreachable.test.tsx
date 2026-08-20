import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { BattleReports } from '../src/screens/BattleReports.jsx';
import { IntelScreen } from '../src/screens/IntelScreen.jsx';
import { ToastProvider } from '../src/ui/Toast.js';

/**
 * A FAILED READ IS NOT A SLOW ONE, AND IT IS NOT AN EMPTY ONE. D53a.
 *
 * React Query's `isPending` goes FALSE the moment a query errors — the status
 * becomes `error` — but `data` stays undefined. Three surfaces were written
 * against `data` alone and each got it wrong in its own way:
 *
 *   · the planet sheet and the intel screen fell through to their loading branch,
 *     so a request that had finished retrying sat under an animated pulse claiming
 *     progress forever;
 *   · the reports list took the same branch as an empty one, so a network error
 *     was reported to the player as "nothing has been fought over yet" — the
 *     interface stating a fact about the season on the strength of a failed fetch.
 *
 * The second is the one worth a test on its own. A spinner that never resolves is
 * at least visibly stuck; a confident wrong answer is not.
 */

const failing = (): Api =>
  ({
    reports: () => Promise.reject(new Error('offline')),
    intel: () => Promise.reject(new Error('offline')),
    planet: () => Promise.reject(new Error('offline')),
    galaxy: () => Promise.reject(new Error('offline')),
  }) as unknown as Api;

function mount(node: ReactNode, api: Api) {
  const client = new QueryClient({
    // No retries: the point is the state AFTER the client has given up, and the
    // default three would make every one of these tests a timing puzzle.
    defaultOptions: { queries: { retry: false } },
  });
  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <ApiProvider api={api}>
          <ToastProvider>{node}</ToastProvider>
        </ApiProvider>
      </QueryClientProvider>,
    ),
  };
}

describe('a surface that could not be read', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /** THE ONE THAT LIED. An empty season and a dead network read the same. */
  it('does not report a failed battle-report fetch as an empty season', async () => {
    mount(<BattleReports />, failing());

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByText(/could not reach your battle reports/i)).toBeInTheDocument();
    expect(screen.queryByText(/nothing has been fought over yet/i)).not.toBeInTheDocument();
  });

  it('offers the one action that can change it', async () => {
    let calls = 0;
    const api = {
      reports: () => {
        calls += 1;
        return Promise.reject(new Error('offline'));
      },
    } as unknown as Api;
    mount(<BattleReports />, api);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });
    const before = calls;
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    await waitFor(() => {
      expect(calls).toBeGreaterThan(before);
    });
  });

  /** And the intel screen stops pulsing at a request that has given up. */
  it('does not leave the intel screen claiming progress', async () => {
    mount(<IntelScreen />, failing());

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByText(/could not reach what you know/i)).toBeInTheDocument();
    expect(screen.queryByText(/^collecting$/i)).not.toBeInTheDocument();
  });

  /**
   * AND IT MUST NOT FIRE ON A SLOW ONE.
   *
   * The whole distinction collapses if a request still in flight is described as
   * unreachable — that would be the same lie in the other direction.
   */
  it('says it is still coming while it still is', async () => {
    const api = {
      intel: () => new Promise<never>(() => undefined),
      // The screen reads three payloads; the other two only have to exist, or the
      // query client warns about a missing `queryFn` and the noise buries a real one.
      planet: () => new Promise<never>(() => undefined),
      galaxy: () => new Promise<never>(() => undefined),
    } as unknown as Api;
    mount(<IntelScreen />, api);

    await waitFor(() => {
      expect(screen.getByText(/collecting/i)).toBeInTheDocument();
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
