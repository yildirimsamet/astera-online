import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DESTINATION, Signals } from '../src/shell/Signals.js';
import { describeNotification } from '../src/lib/notifications.js';
import type { NotificationView } from '../src/api/schemas.js';
import { nextPanelStop } from '../src/shell/panelRoute.js';

/**
 * A NOTIFICATION IS A DOOR, AND EVERY ONE OF THEM HAS TO OPEN. D121.
 *
 * Two failures, and the second is the reason this file exists at all.
 *
 * A PANEL WAS NOT A COMPLETE ANSWER. The Intel centre holds two lists, and every
 * reading-shaped notification pointed at the centre and dropped the reader on the
 * PROBE list — so "you were raided" opened the right room and then showed
 * somebody else's scouting. The battle report is the most accurate intel in the
 * game and the news that it exists could not reach it.
 *
 * AND A MISSING ENTRY IS SILENT. Five kinds had no destination at all — a Death
 * Star resolving, a colony taken, a colony lost, a settlement landing, a
 * settlement lost, which is most of what D97 added — because the map predates
 * them and nothing fails when a key is absent: the row renders, it simply has no
 * way in. That is why the exhaustiveness case below is not decoration.
 */

/**
 * EVERY KIND THE SERVER CAN SEND.
 *
 * Kept in step with `notificationKind` in `apps/server/src/db/schema.ts` by
 * `notifications.test.ts`, which asserts that enum equals exactly this list.
 * Adding a kind fails there first, and its message names this file.
 */
const EVERY_KIND = [
  'colony_captured',
  'colony_lost',
  'death_star_result',
  'fleet_returned',
  'galaxy_event_ended',
  'galaxy_event_started',
  'incoming_fleet',
  'probe_report',
  'raid_result',
  'raided',
  'scan_detected',
  'settlement_lost',
  'settlement_success',
  'strategic_incoming',
  'strategic_intercepted',
  'unlock',
] as const;

/** A payload each kind's parser will actually accept, so a row really renders. */
const PAYLOAD: Record<(typeof EVERY_KIND)[number], Record<string, unknown>> = {
  colony_captured: { targetPlanetId: 'p9' },
  colony_lost: { targetPlanetId: 'p9' },
  death_star_result: { outcome: 'FIRST_STRIKE', targetPlanetId: 'p9' },
  fleet_returned: { trip: 'raid', ships: 4, lootAlloy: 10, lootCrystal: 0 },
  galaxy_event_ended: {
    eventKind: 'ASTEROID_SHOWER',
    startsAt: '2026-08-26T11:00:00.000Z',
    endsAt: '2026-08-26T12:00:00.000Z',
    asteroidSpawnMultiplier: 5,
  },
  galaxy_event_started: {
    eventKind: 'ASTEROID_SHOWER',
    startsAt: '2026-08-26T12:00:00.000Z',
    endsAt: '2026-08-26T13:00:00.000Z',
    asteroidSpawnMultiplier: 5,
  },
  incoming_fleet: { etaMinutes: 6 },
  probe_report: { targetPlanetName: 'Kestrel-12', detected: false },
  raid_result: { grade: 'PARTIAL', lootAlloy: 5, lootCrystal: 0, unitsLost: 1, shipsHome: 3 },
  raided: { grade: 'DECISIVE', lootAlloy: 900, lootCrystal: 0, unitsLost: 3 },
  scan_detected: {},
  settlement_lost: { targetPlanetId: 'p9' },
  settlement_success: { targetPlanetId: 'p9' },
  strategic_incoming: { etaMinutes: 9 },
  strategic_intercepted: { defended: true, range: 1300 },
  unlock: { unlock: 'RADAR', title: 'Radar unlocked', body: 'Catches anyone looking.' },
};

const notification = (kind: (typeof EVERY_KIND)[number]): NotificationView => ({
  id: `n-${kind}`,
  kind,
  refId: `mission-${kind}`,
  payload: PAYLOAD[kind],
  seen: false,
  at: new Date('2026-08-26T12:00:00.000Z'),
});

let rows: NotificationView[] = [];

vi.mock('../src/api/queries.js', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../src/api/queries.js');
  return {
    ...actual,
    useNotifications: () => ({ data: { notifications: rows } }),
    usePlanet: () => ({ data: undefined, dataUpdatedAt: Date.now() }),
    useMarkSeen: () => ({ mutate: vi.fn() }),
  };
});

function mount(given: NotificationView[]) {
  rows = given;
  const onOpen = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <Signals onOpen={onOpen} onFocusPlanet={vi.fn()} />
    </QueryClientProvider>,
  );
  return { onOpen };
}

const openSheet = async (): Promise<void> => {
  await userEvent.click(screen.getByRole('button', { name: /^Signals/ }));
};

describe('where a notification takes you', () => {
  it('does not replay an old report when Intel is later opened normally', () => {
    const deepLink = nextPanelStop(null, 'battles', 'mission-raided');
    expect(deepLink).toMatchObject({
      stop: 'battles',
      request: 1,
      reportMissionId: 'mission-raided',
    });
    expect(nextPanelStop(deepLink)).toBeNull();
  });

  /**
   * The guard the five orphaned kinds needed and did not have. A kind this build
   * can put into words but cannot route is a row a player taps and nothing
   * happens — the worst of the three possible states, because it teaches them the
   * list is inert.
   */
  it('gives every kind of news a way in', () => {
    for (const kind of EVERY_KIND) {
      expect(DESTINATION[kind], `${kind} has nowhere to go`).toBeDefined();
    }
  });

  /** And nothing routes a kind that cannot even be rendered. */
  it('routes nothing it cannot describe', () => {
    for (const kind of Object.keys(DESTINATION)) {
      expect(EVERY_KIND as readonly string[]).toContain(kind);
    }
  });

  /**
   * THE COMPLAINT, AS A TEST. "A battle report arrived" has to land on the battle
   * reports, not beside them.
   */
  it.each([
    ['raided', 'report', 'battles'],
    ['raid_result', 'report', 'battles'],
    ['death_star_result', 'report', 'battles'],
    ['strategic_intercepted', 'report', 'battles'],
  ] as const)('takes %s straight to the %s, with the %s list behind it', (kind, panel, stop) => {
    expect(DESTINATION[kind]).toEqual({ panel, stop });
  });

  /** A reading about somebody else's world still belongs with the probe reports. */
  it.each(['probe_report', 'scan_detected'] as const)(
    'leaves %s on the probe shelf',
    (kind) => {
      expect(DESTINATION[kind]).toEqual({ panel: 'intel', stop: 'probes' });
    },
  );

  /** Something is coming, or a world changed hands: that is dealt with on a planet. */
  it.each([
    'incoming_fleet',
    'strategic_incoming',
    'fleet_returned',
    'colony_captured',
    'colony_lost',
    'settlement_success',
    'settlement_lost',
  ] as const)('takes %s to the planet it is about', (kind) => {
    expect(DESTINATION[kind]?.panel).toBe('planet');
  });

  /**
   * THE SHELF IS ONLY EVER MEANINGFUL WHERE THERE ARE SHELVES — the Intel centre,
   * and the report door that falls back into it when the fight cannot be found.
   */
  it('never names a shelf on a panel that has none', () => {
    for (const [kind, where] of Object.entries(DESTINATION)) {
      if (where.panel !== 'intel' && where.panel !== 'report') {
        expect(where.stop, `${kind} names a shelf outside the Intel centre`).toBeUndefined();
      }
    }
  });

  /**
   * THE OWNER'S CORRECTION. A battle notification is about ONE fight, and the
   * reader tapped it to read that fight — so the door opens onto the report
   * itself, not onto the room the report is filed in. The Intel centre is where it
   * lands only if the report cannot be found (`GalaxyView`'s report panel), which
   * is why the battle kinds still name the battles shelf.
   */
  it('sends every battle kind to the report and nothing else there', () => {
    for (const [kind, where] of Object.entries(DESTINATION)) {
      if (where.panel !== 'report') continue;
      expect(
        ['raided', 'raid_result', 'death_star_result', 'strategic_intercepted'],
        `${kind} is not a fight`,
      ).toContain(kind);
      expect(where.stop, `${kind} has no list to fall back to`).toBe('battles');
    }
  });

  /* ── and the wiring that carries it ───────────────────────── */

  it('hands the panel, shelf and exact battle identity to whoever opens surfaces', async () => {
    const { onOpen } = mount([notification('raided')]);
    await openSheet();
    await userEvent.click(screen.getByRole('button', { name: 'Open related report' }));

    expect(onOpen).toHaveBeenCalledWith('report', 'battles', 'mission-raided');
  });

  /**
   * AND THE SHELF IS NOT THE WHOLE ANSWER EITHER. Owner report.
   *
   * A battle notification names one fight, and the reader tapped it to read THAT
   * report — landing them on a list with it somewhere in it is the same failure
   * one layer down from the one this file was written for. Two of the four kinds
   * carried their identity and two did not: a Death Star resolving and an
   * interception both dropped it, though `refId` is the mission id on all four and
   * `BattleReports` matches on exactly that.
   *
   * It is derived from the shelf rather than listed per kind, so a fifth battle
   * kind cannot arrive without it — a list of kinds in two places is how the first
   * two got left out.
   */
  it.each(['raided', 'raid_result', 'death_star_result', 'strategic_intercepted'] as const)(
    'opens the exact fight a %s notification is about',
    async (kind) => {
      const { onOpen } = mount([notification(kind)]);
      await openSheet();
      await userEvent.click(screen.getByRole('button', { name: 'Open related report' }));

      expect(onOpen).toHaveBeenCalledWith('report', 'battles', `mission-${kind}`);
    },
  );

  /** A probe report is a reading, not a fight: the battle list has nothing to open. */
  it('carries no fight identity off the probe shelf', async () => {
    const { onOpen } = mount([notification('probe_report')]);
    await openSheet();
    await userEvent.click(screen.getByRole('button', { name: 'Open related report' }));

    expect(onOpen).toHaveBeenCalledWith('intel', 'probes', undefined);
  });

  it('passes no shelf where the panel is the whole answer', async () => {
    const { onOpen } = mount([notification('incoming_fleet')]);
    await openSheet();
    await userEvent.click(screen.getByRole('button', { name: 'Open related report' }));

    expect(onOpen).toHaveBeenCalledWith('planet', undefined, undefined);
  });

  /**
   * The row has to be readable as well as routable. A destination on a kind this
   * build renders as nothing would be a door with no handle drawn on it.
   */
  it('renders a sentence for every kind it routes', () => {
    for (const kind of EVERY_KIND) {
      expect(
        describeNotification(notification(kind), Date.parse('2026-08-26T12:05:00.000Z')),
        `${kind} renders nothing`,
      ).not.toBeNull();
    }
  });

  /** A kind from a newer server has no door, and must not crash the list. */
  it('leaves a kind this build has never heard of alone', () => {
    const { onOpen } = mount([
      { id: 'x', kind: 'season_ended', payload: {}, seen: false, at: new Date() },
    ]);
    expect(DESTINATION.season_ended).toBeUndefined();
    expect(onOpen).not.toHaveBeenCalled();
  });
});
