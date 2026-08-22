import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Signals } from '../src/shell/Signals.js';
import type { NotificationView } from '../src/api/schemas.js';

/**
 * THE BEACON — the one control whose entire job is to go back to zero.
 *
 * It could not. `Signals` called `api.markSeen(ids)` directly and dropped the
 * promise, and nothing invalidated the notification list afterwards: the query is
 * mounted permanently, so there is no mount to refetch on, no focus event fires
 * when a sheet closes, and there is no interval. The count stayed lit after the
 * player had read every line under it, until some unrelated stream event happened
 * along and refreshed the list by accident. D45.
 */

const notification = (over: Partial<NotificationView> = {}): NotificationView => ({
  id: 'n1',
  kind: 'raided',
  payload: { grade: 'DECISIVE', lootAlloy: 900, lootCrystal: 0, unitsLost: 3 },
  seen: false,
  at: new Date(),
  ...over,
});

let rows: NotificationView[] = [];
const marked = vi.fn();

vi.mock('../src/api/queries.js', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../src/api/queries.js');
  return {
    ...actual,
    useNotifications: () => ({ data: { notifications: rows } }),
    usePlanet: () => ({ data: undefined, dataUpdatedAt: Date.now() }),
    useMarkSeen: () => ({ mutate: marked }),
  };
});

function mount(given: NotificationView[], onFocusPlanet = vi.fn()) {
  rows = given;
  marked.mockReset();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <Signals onOpen={vi.fn()} onFocusPlanet={onFocusPlanet} />
    </QueryClientProvider>,
  );
  return { ...view, onFocusPlanet };
}

describe('the signals beacon', () => {
  it('counts what is unread, and says so to a screen reader', () => {
    mount([notification({ id: 'a' }), notification({ id: 'b' }), notification({ id: 'c', seen: true })]);
    expect(screen.getByRole('button', { name: 'Signals — 2 unread' })).toBeInTheDocument();
  });

  it('reads as plain Signals when there is nothing new', () => {
    mount([notification({ id: 'a', seen: true })]);
    expect(screen.getByRole('button', { name: 'Signals' })).toBeInTheDocument();
  });

  /**
   * Opening is what marks them read — not loading the app. A player who starts
   * the game and immediately closes it has not been told anything.
   */
  it('marks exactly the unread ids when the sheet is opened', async () => {
    mount([notification({ id: 'a' }), notification({ id: 'b', seen: true }), notification({ id: 'c' })]);
    await userEvent.click(screen.getByRole('button', { name: 'Signals — 2 unread' }));

    expect(marked).toHaveBeenCalledTimes(1);
    expect(marked).toHaveBeenCalledWith(['a', 'c']);
  });

  it('does not call the server when there is nothing to mark', async () => {
    mount([notification({ id: 'a', seen: true })]);
    await userEvent.click(screen.getByRole('button', { name: 'Signals' }));
    expect(marked).not.toHaveBeenCalled();
  });

  /**
   * A SERVER ONE DEPLOY AHEAD COSTS ONE ROW, NOT THE BADGE.
   *
   * An unrecognised kind renders nothing, so counting it would light a badge that
   * reading cannot clear — and a badge that cannot be cleared is how players learn
   * to ignore badges. It is still marked seen, for the same reason.
   */
  it('does not count news this build cannot describe, but still marks it read', async () => {
    mount([notification({ id: 'a' }), notification({ id: 'future', kind: 'season_ended', payload: {} })]);
    await userEvent.click(screen.getByRole('button', { name: 'Signals — 1 unread' }));
    expect(marked).toHaveBeenCalledWith(['a', 'future']);
  });

  it('shows the news itself once opened', async () => {
    mount([notification({ id: 'a' })]);
    await userEvent.click(screen.getByRole('button', { name: 'Signals — 1 unread' }));
    expect(screen.getByText(/Raided · −900 taken · 3 units lost/)).toBeInTheDocument();
  });

  it('bolds a revealed identity and closes Signals through its planet focus route', async () => {
    const view = mount([
      notification({
        kind: 'probe_report',
        payload: {
          targetPlanetId: 'target-planet',
          targetUsername: 'İzci',
          targetPlanetName: 'Kestrel-12',
          detected: false,
        },
      }),
    ]);
    await userEvent.click(screen.getByRole('button', { name: 'Signals — 1 unread' }));
    const identity = screen.getByRole('button', { name: /İzci/i });
    expect(identity).toHaveClass('font-bold');
    await userEvent.click(identity);
    expect(view.onFocusPlanet).toHaveBeenCalledWith('target-planet');
    expect(screen.queryByRole('dialog', { name: 'Signals' })).not.toBeInTheDocument();
  });

  it('keeps a repelled raider identity visible, bold and focusable', async () => {
    const view = mount([
      notification({
        kind: 'raided',
        payload: {
          originPlanetId: 'raider-planet',
          originUsername: 'Akıncı',
          originPlanetName: 'Kestrel-9',
          grade: 'REPELLED',
          lootAlloy: 0,
          lootCrystal: 0,
          unitsLost: 2,
          theirLosses: 5,
        },
      }),
    ]);
    await userEvent.click(screen.getByRole('button', { name: 'Signals — 1 unread' }));
    const identity = screen.getByRole('button', { name: /Akıncı/ });
    expect(identity).toHaveClass('font-bold');
    await userEvent.click(identity);
    expect(view.onFocusPlanet).toHaveBeenCalledWith('raider-planet');
  });

  /**
   * WHICH OF THESE IS NEW — the one question the surface exists to answer.
   *
   * Marking read is optimistic, because the player HAS read them and a badge that
   * waits for a round trip looks stuck. But the rows are drawn from the same data,
   * so the optimism greyed out every line in the same frame the sheet appeared and
   * the answer was gone before it could be asked. The count clears at once; the
   * highlighting holds until the sheet is closed.
   */
  it('still marks which rows were new, after the count has cleared', async () => {
    const view = mount([notification({ id: 'a' }), notification({ id: 'b', seen: true })]);
    await userEvent.click(screen.getByRole('button', { name: 'Signals — 1 unread' }));

    // The optimistic update lands: the cache now says every row has been seen,
    // and the component re-renders from it.
    rows = rows.map((n) => ({ ...n, seen: true }));
    view.rerender(
      <QueryClientProvider client={new QueryClient()}>
        <Signals onOpen={vi.fn()} onFocusPlanet={vi.fn()} />
      </QueryClientProvider>,
    );

    // The badge is gone...
    expect(screen.getByRole('button', { name: 'Signals' })).toBeInTheDocument();
    // ...and the row that was new is still shown as new.
    const shown = screen.getAllByTestId('signal-event');
    expect(shown).toHaveLength(2);
    expect(shown[0]!.className).toContain('bg-crystal');
    expect(shown[1]!.className).not.toContain('bg-crystal');
  });
});
