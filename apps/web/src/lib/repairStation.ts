import { BUILD, SHIP_DAMAGE, type Resources } from '@astera/rules';
import type { BuildOrderView, PlanetView } from '../api/schemas.js';

/**
 * THE REPAIR STATION'S ARITHMETIC, AS THE BASE READS IT. Kalıcı gemi hasarı.
 *
 * Nothing here prices a repair. The server prices every lot (`dockView`) and bills a job
 * as the sum of its lots' bills, so a choice of lots is priced by adding the rows the
 * player is looking at — a formula of the client's own could only drift from them.
 */

export type RepairDock = NonNullable<PlanetView['dock']>;
export type DockLot = RepairDock['lots'][number];
export type RepairRequest = { lotIds: string[] } | { all: true };

/** The Base row a door outside names to open the station (`PanelFocusRequest.itemId`). */
export const REPAIR_STATION_ITEM = 'REPAIR_STATION';

export interface StationSummary {
  /** Ships waiting for a repair nobody has ordered: out of the fight until one is. */
  waitingShips: number;
  waitingLots: number;
  /** Ships in a job that is running or queued. */
  repairingShips: number;
  jobs: number;
  /** How many jobs the lane holds: the depth every build lane shares. */
  depth: number;
  full: boolean;
}

export function stationSummary(dock: RepairDock | null | undefined, repairs: readonly BuildOrderView[]): StationSummary {
  const lots = dock?.lots ?? [];
  const waiting = lots.filter((lot) => !lot.repairing);
  return {
    waitingShips: waiting.reduce((n, lot) => n + lot.count, 0),
    waitingLots: waiting.length,
    repairingShips: lots.filter((lot) => lot.repairing).reduce((n, lot) => n + lot.count, 0),
    jobs: repairs.length,
    depth: BUILD.queueDepth,
    full: repairs.length >= BUILD.queueDepth,
  };
}

export interface RepairSelection {
  lots: DockLot[];
  ships: number;
  cost: Resources;
  minutes: number;
  /** What to send; null when nothing is chosen or the choice is too long to name. */
  request: RepairRequest | null;
  /** A hand-picked list longer than one request may name. */
  tooMany: boolean;
}

/**
 * THE LOTS THE PLAYER HAS CHOSEN, KEPT AS THE ONES LEFT OUT.
 *
 * Every waiting lot is chosen until it is left out, so the one-tap case — repair
 * everything — needs no tap at all, and a lot that docks while the menu is open arrives
 * chosen and priced rather than silently outside the bill. A lot under repair is never
 * offered: it is already somebody's job.
 *
 * The request names the lots the player saw priced. Only a choice of every waiting lot
 * longer than one request may name goes as "all", which is the same set.
 */
export function repairSelection(dock: RepairDock | null | undefined, excluded: ReadonlySet<string>): RepairSelection {
  const waiting = (dock?.lots ?? []).filter((lot) => !lot.repairing);
  const lots = waiting.filter((lot) => !excluded.has(lot.id));
  const cost: Resources = { alloy: 0, crystal: 0, deuterium: 0 };
  let minutes = 0;
  for (const lot of lots) {
    cost.alloy += lot.cost.alloy;
    cost.crystal += lot.cost.crystal;
    cost.deuterium += lot.cost.deuterium;
    minutes += lot.minutes;
  }
  const long = lots.length > SHIP_DAMAGE.repairLotsPerOrder;
  const everything = lots.length === waiting.length;
  let request: RepairRequest | null = null;
  if (lots.length > 0) {
    if (!long) request = { lotIds: lots.map((lot) => lot.id) };
    else if (everything) request = { all: true };
  }
  return {
    lots,
    ships: lots.reduce((n, lot) => n + lot.count, 0),
    cost,
    minutes,
    request,
    tooMany: long && !everything,
  };
}

/**
 * HOW DAMAGED A SHIP IS, IN WHOLE PERCENT, ON THE RIGHT SIDE OF THE OWNER'S LINE.
 *
 * Rounded UP: a ship 20.01% damaged waits in the dock, and to the nearest it read "20%" —
 * the very figure the rule beside it calls free. Rounded up, a patched ship (at most 20%)
 * never reads over the line and a docked one never at it. Capped at 99: 100% is destroyed.
 */
export const damagePct = (damageBp: number): number =>
  Math.min(99, Math.ceil(damageBp / 100));

/**
 * WHAT REPAIRING A LOT COSTS AGAINST NEW SHIPS, IN WHOLE PERCENT.
 *
 * With no Industrial the share IS the damage, so it reads exactly as the damage reads —
 * a ship "21% damaged" never costs "20% of a new ship". Under Industrial it is the damage
 * times the share Industrial leaves, rounded to the nearest once, from the basis points:
 * 35% at three quarters reads 26%, the figure a player works out from what they see.
 */
export const newShipShare = (damageBp: number, pct: number): number =>
  pct >= 100 ? damagePct(damageBp) : Math.round((damageBp * pct) / SHIP_DAMAGE.destroyedBp);

/** The lots a job is repairing, so a job of several hulls can say which. */
export const jobLots = (order: BuildOrderView, lots: readonly DockLot[]): DockLot[] =>
  lots.filter((lot) => lot.orderId === order.id);
