import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Signals } from '../src/shell/Signals.js';
import type { NotificationView } from '../src/api/schemas.js';
import i18n from '../src/i18n/index.js';

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
    const row = screen.getByTestId('signal-event');
    expect(row.querySelector('svg')).not.toBeNull();
    expect(row.querySelector('.size-9')).not.toBeNull();
  });

  it('announces both Asteroid Shower lifecycle moments in Turkish', async () => {
    await i18n.changeLanguage('tr');
    const lifecycle = {
      eventKind: 'ASTEROID_SHOWER',
      startsAt: '2026-09-02T09:00:00.000Z',
      endsAt: '2026-09-02T10:00:00.000Z',
      asteroidSpawnMultiplier: 5,
    };
    mount([
      notification({ id: 'start', kind: 'galaxy_event_started', payload: lifecycle }),
      notification({ id: 'end', kind: 'galaxy_event_ended', payload: lifecycle }),
    ]);
    await userEvent.click(screen.getByRole('button', { name: 'Sinyaller — 2 okunmamış' }));

    expect(screen.getByText('Galakside asteroid yağmuru başladı.')).toBeInTheDocument();
    expect(screen.getByText(
      'Asteroid yağmuru bitti. Yeni asteroid oluşma hızı normale döndü.',
    )).toBeInTheDocument();
    await i18n.changeLanguage('en');
  });

  it('bolds a revealed identity and closes Signals through its planet focus route', async () => {
    const view = mount([
      notification({
        kind: 'probe_report',
        payload: {
          targetPlanetId: 'target-planet',
          targetUsername: 'İzci',
          targetClanTag: 'WAR',
          targetPlanetName: 'Kestrel-12',
          detected: false,
        },
      }),
    ]);
    await userEvent.click(screen.getByRole('button', { name: 'Signals — 1 unread' }));
    const identity = screen.getByRole('button', { name: /\[WAR\] İzci/i });
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
  /**
   * NEWNESS IS A PIP, NOT A WASH — because the wash now says something else.
   *
   * The row's background carries the OUTCOME (a thin green for a win, a thin red
   * for a loss), so it cannot also carry "this is new": two `raided` rows, one
   * read and one not, are both losses and would be painted identically. The pip is
   * the design system's unread mark and the only thing on the surface shaped like
   * it, which is exactly why it can carry newness for every family at once.
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
    expect(shown[0]!.querySelector('[data-unread]')).not.toBeNull();
    expect(shown[1]!.querySelector('[data-unread]')).toBeNull();
  });
});

/**
 * TELLING THE ROWS APART — the whole reason this surface is worth opening. D142.
 *
 * Every line here used to be drawn identically: one of five glyphs (a bell for
 * everything else), aqua while unread and grey once read. A probe coming home, a
 * colony falling and an asteroid shower starting were three interchangeable rows,
 * so the surface that exists to say WHAT happened while you were away could only
 * say THAT something had.
 *
 * `docs/visual-design.md`: **icons carry shape, the interface carries colour.** So
 * the family carries the hue — which CATEGORY of news — and the glyph carries the
 * kind, and neither may be the only thing that distinguishes a row.
 */
describe('what a signal row looks like', () => {
  const open = async (): Promise<void> => {
    await userEvent.click(screen.getByRole('button', { name: /^Signals/ }));
  };

  const rowOf = (id: string): HTMLElement => {
    const row = screen
      .getAllByTestId('signal-event')
      .find((el) => el.getAttribute('data-signal-id') === id);
    if (!row) throw new Error(`no row for ${id}`);
    return row;
  };

  it('gives four kinds of news four different hues', async () => {
    mount([
      notification({ id: 'raid', kind: 'raided' }),
      notification({
        id: 'probe',
        kind: 'probe_report',
        payload: { targetPlanetName: 'Kestrel-12', detected: false },
      }),
      notification({ id: 'scan', kind: 'scan_detected', payload: {} }),
      notification({
        id: 'shower',
        kind: 'galaxy_event_started',
        payload: {
          eventKind: 'ASTEROID_SHOWER',
          startsAt: '2026-09-02T09:00:00.000Z',
          endsAt: '2026-09-02T10:00:00.000Z',
          asteroidSpawnMultiplier: 5,
        },
      }),
    ]);
    await open();

    const families = ['raid', 'probe', 'scan', 'shower'].map(
      (id) => rowOf(id).getAttribute('data-family'),
    );
    expect(families).toEqual(['threat', 'gain', 'watch', 'world']);
    // And no two of them are drawn from the same swatch.
    expect(new Set(families).size).toBe(4);
  });

  /**
   * A PIRATE REPORTS BACK UNDER THE MARK IT WEARS ON THE DISC. D150.
   *
   * `PIRATE_MARK` in `Fleets.tsx` puts a red skull over an identified pirate
   * formation, and the mark answers "that is a target, not a commander". The row
   * that reports the fight has to be findable by the same answer.
   */
  it('marks a raid at a pirate with the skull, and a raid at a commander without it', async () => {
    mount([
      notification({
        id: 'pirate',
        kind: 'raid_result',
        payload: {
          targetKind: 'PIRATE', pirateLevel: 2, pirateCallsign: 'BLACKJAW',
          grade: 'DECISIVE', lootAlloy: 900, lootCrystal: 0, unitsLost: 2, shipsHome: 26,
        },
      }),
      notification({
        id: 'pvp',
        kind: 'raid_result',
        payload: {
          grade: 'DECISIVE', lootAlloy: 900, lootCrystal: 0, unitsLost: 2, shipsHome: 26,
        },
      }),
    ]);
    await open();

    expect(rowOf('pirate').getAttribute('data-family')).toBe('pirate');
    expect(rowOf('pirate').querySelector('[data-glyph="skull"]')).not.toBeNull();
    expect(rowOf('pvp').getAttribute('data-family')).toBe('gain');
    expect(rowOf('pvp').querySelector('[data-glyph="skull"]')).toBeNull();
  });

  /**
   * AN EVENT IS NOT PERSONAL MAIL, AND MUST NOT BE DRAWN LIKE IT.
   *
   * A galaxy event happened to the whole shard. It is in this feed because it is
   * news, but a row that looks like "your fleet came home" invites the reader to
   * ask which of their worlds it was about. It says GALAXY EVENT on its face.
   */
  it('draws a galaxy event as a galaxy-wide banner rather than as a personal row', async () => {
    mount([
      notification({
        id: 'shower',
        kind: 'galaxy_event_started',
        payload: {
          eventKind: 'ASTEROID_SHOWER',
          startsAt: '2026-09-02T09:00:00.000Z',
          endsAt: '2026-09-02T10:00:00.000Z',
          asteroidSpawnMultiplier: 5,
        },
      }),
      notification({ id: 'raid', kind: 'raided' }),
    ]);
    await open();

    const banner = rowOf('shower');
    expect(banner.getAttribute('data-family')).toBe('world');
    expect(banner.textContent).toContain(i18n.t('signals.worldEvent'));
    // The personal row beside it says nothing of the kind.
    expect(rowOf('raid').textContent).not.toContain(i18n.t('signals.worldEvent'));
  });

  /**
   * A WIN IS THINLY GREEN, A LOSS IS THINLY RED, AND THE REST IS UNTOUCHED.
   *
   * Owner instruction, and the one thing on this surface that is legible without
   * focusing on any row: whether the news went your way. The wash is deliberately
   * faint — it is the ground the sentence sits on, not a highlight — and a neutral
   * row gets nothing at all, because a third wash would cost the other two their
   * meaning.
   */
  it('washes a win green, a loss red, and leaves a neutral row alone', async () => {
    mount([
      notification({ id: 'loss', kind: 'raided' }),
      notification({
        id: 'win',
        kind: 'probe_report',
        payload: { targetPlanetName: 'Kestrel-12', detected: false },
      }),
      notification({ id: 'neutral', kind: 'scan_detected', payload: {} }),
    ]);
    await open();

    expect(rowOf('loss').className).toContain('bg-threat');
    expect(rowOf('win').className).toContain('bg-opportunity');
    expect(rowOf('neutral').className).not.toContain('bg-threat');
    expect(rowOf('neutral').className).not.toContain('bg-opportunity');
  });

  /** The wash follows the OUTCOME, so one lane can carry both of them. */
  it('washes a pirate raid by what came home, under the same skull', async () => {
    mount([
      notification({
        id: 'won',
        kind: 'raid_result',
        payload: {
          targetKind: 'PIRATE', grade: 'DECISIVE',
          lootAlloy: 900, lootCrystal: 0, unitsLost: 2, shipsHome: 26,
        },
      }),
      notification({
        id: 'wiped',
        kind: 'raid_result',
        payload: {
          targetKind: 'PIRATE', grade: 'REPELLED',
          lootAlloy: 0, lootCrystal: 0, unitsLost: 30, shipsHome: 0,
        },
      }),
    ]);
    await open();

    expect(rowOf('won').className).toContain('bg-opportunity');
    expect(rowOf('wiped').className).toContain('bg-threat');
    for (const id of ['won', 'wiped']) {
      expect(rowOf(id).querySelector('[data-glyph="skull"]'), id).not.toBeNull();
    }
  });

  /**
   * AND THE WASH DOES NOT SWALLOW NEWNESS. Two losses, one read, one not.
   *
   * The outcome wash is the same on both — they are both losses — so the unread
   * mark has to be something else entirely, and it is the design system's pip.
   */
  it('keeps newness readable on rows that share an outcome', async () => {
    mount([
      notification({ id: 'fresh', kind: 'raided' }),
      notification({ id: 'old', kind: 'raided', seen: true }),
    ]);
    await open();

    expect(rowOf('fresh').className).toContain('bg-threat');
    expect(rowOf('old').className).toContain('bg-threat');
    expect(rowOf('fresh').querySelector('[data-unread]')).not.toBeNull();
    expect(rowOf('old').querySelector('[data-unread]')).toBeNull();
  });
});
