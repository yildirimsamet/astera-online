import { BUILD, SHIP_DAMAGE } from '@astera/rules';
import { describe, expect, it } from 'vitest';
import type { BuildOrderView } from '../src/api/schemas.js';
import { damagePct, jobLots, newShipShare, repairSelection, stationSummary, type DockLot, type RepairDock } from '../src/lib/repairStation.js';

/**
 * THE REPAIR STATION'S ARITHMETIC, AS THE BASE READS IT. Kalıcı gemi hasarı.
 *
 * The server prices every lot (`dockView`) and a job's bill is the sum of its lots' bills
 * (`shipRepairCost` invoices lot by lot), so a selection is priced here by adding the rows
 * the player can see — never by a formula of the client's own that could drift from them.
 */

const lot = (over: Partial<DockLot> = {}): DockLot => ({
  id: 'lot-1',
  hull: 'TALON',
  count: 2,
  damageBp: 3500,
  repairing: false,
  orderId: null,
  cost: { alloy: 500, crystal: 200, deuterium: 2 },
  minutes: 2.5,
  ...over,
});

const dock = (lots: DockLot[], pct = 100): RepairDock => ({
  lots,
  waiting: { cost: { alloy: 0, crystal: 0, deuterium: 0 }, minutes: 0 },
  pct,
});

const job = (over: Partial<BuildOrderView> = {}): BuildOrderView => ({
  id: 'order-1',
  queue: 'REPAIR',
  slot: 0,
  kind: 'REPAIR',
  subject: 'BALLISTA',
  count: 1,
  startedAt: new Date('2026-09-30T12:00:00Z'),
  finishesAt: new Date('2026-09-30T12:05:00Z'),
  cost: { alloy: 1, crystal: 1, deuterium: 0 },
  ...over,
} as BuildOrderView);

describe('the station at a glance', () => {
  it('counts the ships that wait apart from the ships already under repair', () => {
    const summary = stationSummary(dock([
      lot({ id: 'a', count: 2 }),
      lot({ id: 'b', count: 3, hull: 'DART' }),
      lot({ id: 'c', count: 4, repairing: true, orderId: 'order-1' }),
    ]), [job()]);
    expect(summary).toMatchObject({ waitingShips: 5, waitingLots: 2, repairingShips: 4, jobs: 1, full: false });
  });

  it('is idle with no dock at all, as an older server sends it', () => {
    expect(stationSummary(null, [])).toMatchObject({ waitingShips: 0, waitingLots: 0, repairingShips: 0, jobs: 0, full: false });
    expect(stationSummary(undefined, [])).toMatchObject({ waitingShips: 0, jobs: 0 });
  });

  it('is full at the queue depth every build lane shares', () => {
    const jobs = Array.from({ length: BUILD.queueDepth }, (_, slot) => job({ id: `o-${String(slot)}`, slot }));
    expect(stationSummary(dock([]), jobs)).toMatchObject({ jobs: BUILD.queueDepth, depth: BUILD.queueDepth, full: true });
  });
});

describe('choosing which ships to repair', () => {
  it('chooses every waiting lot until the player leaves one out, and never a lot already under repair', () => {
    const chosen = repairSelection(dock([
      lot({ id: 'a' }),
      lot({ id: 'b', hull: 'WARDEN', count: 1 }),
      lot({ id: 'c', repairing: true, orderId: 'order-1' }),
    ]), new Set());
    expect(chosen.lots.map((row) => row.id)).toEqual(['a', 'b']);
    expect(chosen.request).toEqual({ lotIds: ['a', 'b'] });
  });

  it('prices the choice as the sum of the rows the player can see', () => {
    const chosen = repairSelection(dock([
      lot({ id: 'a', count: 2, cost: { alloy: 551, crystal: 230, deuterium: 2 }, minutes: 2.3 }),
      lot({ id: 'b', count: 1, cost: { alloy: 335, crystal: 134, deuterium: 0 }, minutes: 1.5 }),
    ]), new Set());
    expect(chosen.ships).toBe(3);
    expect(chosen.cost).toEqual({ alloy: 886, crystal: 364, deuterium: 2 });
    expect(chosen.minutes).toBeCloseTo(3.8, 9);
  });

  it('leaves out what the player left out', () => {
    const chosen = repairSelection(dock([lot({ id: 'a' }), lot({ id: 'b', count: 5 })]), new Set(['a']));
    expect(chosen.lots.map((row) => row.id)).toEqual(['b']);
    expect(chosen.ships).toBe(5);
    expect(chosen.request).toEqual({ lotIds: ['b'] });
  });

  it('asks for nothing when nothing is chosen', () => {
    const chosen = repairSelection(dock([lot({ id: 'a' })]), new Set(['a']));
    expect(chosen).toMatchObject({ ships: 0, request: null, tooMany: false });
    expect(chosen.cost).toEqual({ alloy: 0, crystal: 0, deuterium: 0 });
    expect(repairSelection(dock([]), new Set()).request).toBeNull();
    expect(repairSelection(null, new Set()).request).toBeNull();
  });

  /**
   * ONE REQUEST NAMES AT MOST `repairLotsPerOrder` LOTS. Everything waiting still goes in
   * one tap — "all" is its own request — but a hand-picked list longer than that is
   * refused here, with a reason, rather than cut short behind the player's back.
   */
  it('sends every waiting lot as "all" once there are more than one request may name', () => {
    const many = Array.from({ length: SHIP_DAMAGE.repairLotsPerOrder + 1 }, (_, n) => lot({ id: `l-${String(n)}` }));
    expect(repairSelection(dock(many), new Set()).request).toEqual({ all: true });
    const picked = repairSelection(dock([...many, lot({ id: 'extra' })]), new Set(['extra']));
    expect(picked).toMatchObject({ request: null, tooMany: true });
  });
});

describe('what each job is repairing', () => {
  it('names the lots a job holds, so a mixed job lists its ships', () => {
    const lots = [
      lot({ id: 'a', repairing: true, orderId: 'order-1' }),
      lot({ id: 'b', hull: 'DART', repairing: true, orderId: 'order-2' }),
      lot({ id: 'c', hull: 'WARDEN', repairing: true, orderId: 'order-1' }),
      lot({ id: 'd' }),
    ];
    expect(jobLots(job({ id: 'order-1' }), lots).map((row) => row.id)).toEqual(['a', 'c']);
    expect(jobLots(job({ id: 'order-9' }), lots)).toEqual([]);
  });
});

/**
 * HOW DAMAGED A SHIP IS, IN WHOLE PERCENT, ON THE RIGHT SIDE OF THE OWNER'S LINE.
 *
 * Rounded to the nearest, a ship 20.01% damaged read "20%" in the dock while the rule
 * beside it said 20% or less is patched free — and the battle report drew "20% · to the
 * Repair Station" one row under "20% · patched". Rounded up, nothing at or under the line
 * reads over it and nothing over it reads at it. Capped at 99: a ship at 100% is gone.
 */
describe('how damaged a ship reads', () => {
  it('never reads a docked ship at the free line, nor a patched one over it', () => {
    expect(damagePct(SHIP_DAMAGE.autoRepairMaxBp)).toBe(20);
    expect(damagePct(SHIP_DAMAGE.autoRepairMaxBp + 1)).toBe(21);
    expect(damagePct(2049)).toBe(21);
    expect(damagePct(1950)).toBe(20);
  });

  it('never reads a scratch as no damage, nor a survivor as destroyed', () => {
    expect(damagePct(1)).toBe(1);
    expect(damagePct(SHIP_DAMAGE.destroyedBp - 1)).toBe(99);
    expect(damagePct(9901)).toBe(99);
  });

  it('reads a whole percent as itself', () => {
    expect(damagePct(3500)).toBe(35);
    expect(damagePct(6400)).toBe(64);
  });
});

/**
 * WHAT A LOT COSTS AGAINST NEW SHIPS, IN WHOLE PERCENT. With no Industrial the share IS the
 * damage, and reads as the damage reads — a ship "21% damaged" never costs "20% of a new
 * ship". Under Industrial it is the damage times the share Industrial leaves, rounded to the
 * nearest once, from the basis points: 35% at three quarters reads 26%, not 27%.
 */
describe('the share of a new ship a repair costs', () => {
  it('is the damage times Industrial\'s share, rounded once', () => {
    expect(newShipShare(3500, 100)).toBe(35);
    expect(newShipShare(6400, 50)).toBe(32);
    expect(newShipShare(3500, 75)).toBe(26);
    expect(newShipShare(3350, 75)).toBe(25);
  });

  it('equals the damage it reads beside when Industrial takes nothing off', () => {
    for (const bp of [2001, 2049, 3350, 5555, 9999]) expect(newShipShare(bp, 100), String(bp)).toBe(damagePct(bp));
  });

  it('never reads above the damage it is a share of', () => {
    for (const bp of [2001, 3350, 5555, 9999]) {
      for (const pct of [50, 75, 100]) expect(newShipShare(bp, pct), `${String(bp)} at ${String(pct)}`).toBeLessThanOrEqual(damagePct(bp));
    }
  });
});
