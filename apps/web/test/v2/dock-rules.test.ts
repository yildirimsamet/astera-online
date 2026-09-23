import { describe, expect, it } from 'vitest';
import type { MiningRun, NotificationView, PendingThread } from '../../src/api/schemas.js';
import { DOCK_TABS, dockBadges, isReportSignal, type DockInput } from '../../src/lib/dock.js';

/**
 * WHAT THE DOCK SAYS WITHOUT BEING OPENED. Spec B4 (docs/ui-v2/gozlemevi.md).
 *
 * Five tabs in a fixed order. Base shows a dot when there is something to collect
 * or something broken; Fleet a ring filling toward your next own landing and how
 * many are in the air; Intel the reports you have not seen; Clan what needs you.
 */

const NOW = Date.parse('2026-09-23T12:00:00Z');
const MIN = 60_000;
const at = (minutes: number): Date => new Date(NOW + minutes * MIN);

const flight = (kind: PendingThread['kind'], from: number, to: number): PendingThread => ({
  kind,
  targetName: 'Kestrel',
  minutesRemaining: to,
  arriveAt: at(to),
  path: { from: { x: 0, y: 0, z: 0 }, to: { x: 1, y: 0, z: 0 }, departAt: at(from), arriveAt: at(to) },
});

const run = (status: MiningRun['status']): MiningRun => ({
  id: `run-${status}`,
  targetKind: 'asteroid',
  asteroidId: null,
  debrisFieldId: null,
  status,
  craft: 1,
  departAt: at(-10),
  arriveAt: at(30),
  homeAt: null,
  intercept: { x: 0, y: 0, z: 0 },
  minedAlloy: 0,
  minedCrystal: 0,
  minedDeuterium: 0,
});

const input = (over: Partial<DockInput> = {}): DockInput => ({
  now: NOW,
  threads: [],
  runs: [],
  collectRipe: false,
  faults: 0,
  unseenReports: 0,
  clanAttention: 0,
  ...over,
});

describe('the dock', () => {
  it('keeps its five tabs in one order', () => {
    expect(DOCK_TABS).toEqual(['galaxy', 'base', 'fleet', 'intel', 'clan']);
  });

  it('dots the base for something to collect or something broken', () => {
    expect(dockBadges(input()).base).toBe(false);
    expect(dockBadges(input({ collectRipe: true })).base).toBe(true);
    expect(dockBadges(input({ faults: 1 })).base).toBe(true);
  });

  it('fills the fleet ring toward the next own landing and counts what is up', () => {
    const fleet = dockBadges(input({
      threads: [flight('transfer', -30, 30), flight('fleet', -10, 90), flight('incoming', -5, 5)],
      runs: [run('outbound'), run('done')],
    })).fleet;
    expect(fleet.airborne).toBe(3);
    expect(fleet.progress).toBeCloseTo(0.5, 5);
  });

  it('has no ring with nothing of yours in the air', () => {
    expect(dockBadges(input({ threads: [flight('incoming', -5, 5)] })).fleet).toEqual({ airborne: 0, progress: null });
  });

  it('carries the unseen reports and the clan attention through', () => {
    const badges = dockBadges(input({ unseenReports: 2, clanAttention: 4 }));
    expect(badges.intel).toBe(2);
    expect(badges.clan).toBe(4);
  });
});

describe('what counts as a report', () => {
  const signal = (kind: NotificationView['kind']): NotificationView['kind'] => kind;

  it('counts battles and probes, not the rest of the feed', () => {
    expect(['raided', 'raid_result', 'death_star_result', 'strategic_intercepted', 'probe_report']
      .map((kind) => isReportSignal(kind))).toEqual([true, true, true, true, true]);
    expect(isReportSignal(signal('fleet_returned'))).toBe(false);
    expect(isReportSignal(signal('galaxy_event_started'))).toBe(false);
  });
});
