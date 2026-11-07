import { STARTER } from '@astera/rules';
import { and, eq, lte } from 'drizzle-orm';
import type { Clock } from '../../clock.js';
import type { Db, Tx } from '../../db/client.js';
import { vessels } from '../../db/schema.js';
import { lockGalaxyWithRoom, pickBerth } from './enlist.js';
import type { LockedVessel } from './vessel.js';

/**
 * A SHIP WITH NO PROGRESS GIVES UP ITS PLACE, as a commander does in the main game after 30 hours;
 * here it is 48. It leaves the map and its berth goes to whoever comes next. Its owner keeps the ship:
 * they can look at it and collect, and their next repair wakes it.
 */
export async function sweepQuietShips(db: Db, clock: Clock): Promise<number> {
  const before = new Date(clock.now().getTime() - STARTER.idleMs);
  const gone = await db.update(vessels).set({ status: 'DORMANT', slotIndex: null })
    .where(and(eq(vessels.status, 'ACTIVE'), lte(vessels.lastProgressAt, before)))
    .returning({ id: vessels.id });
  return gone.length;
}

/**
 * Back to its own galaxy while there is room, else to one that has it. A galaxy's clock is its own, so
 * moving to another restates the ship's last tick on that clock and no time is earned or lost. With
 * the door closed by hand there is nowhere to go, and it sleeps on.
 */
export async function wakeVessel(tx: Tx, vessel: LockedVessel, clock: Clock): Promise<void> {
  const galaxy = await lockGalaxyWithRoom(tx, clock, vessel.row.starterGalaxyId);
  const berth = galaxy && await pickBerth(tx, galaxy);
  if (!galaxy || !berth) return;
  const woken = {
    status: 'ACTIVE' as const,
    starterGalaxyId: galaxy.id,
    slotIndex: berth.index,
    x: berth.x, y: berth.y, z: berth.z,
    sightSince: clock.now(),
    lastTickMinutes: vessel.row.lastTickMinutes + (vessel.epoch.getTime() - galaxy.epoch.getTime()) / 60_000,
  };
  await tx.update(vessels).set(woken).where(eq(vessels.id, vessel.row.id));
  vessel.row = { ...vessel.row, ...woken };
  vessel.epoch = galaxy.epoch;
  vessel.galaxyOrdinal = galaxy.ordinal;
}

/** Whatever moves the ship on keeps its place, and gets a sleeping ship its place back. */
export async function markProgress(tx: Tx, vessel: LockedVessel, clock: Clock): Promise<void> {
  if (vessel.row.status === 'DORMANT') await wakeVessel(tx, vessel, clock);
  vessel.row = { ...vessel.row, lastProgressAt: vessel.now, lastSeenAt: vessel.now };
}
