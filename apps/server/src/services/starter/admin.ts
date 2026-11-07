import { repairProgress } from '@astera/rules';
import { eq } from 'drizzle-orm';
import type { Clock } from '../../clock.js';
import type { Db } from '../../db/client.js';
import { starterGalaxies, vesselBotState, vessels } from '../../db/schema.js';
import { failedStarterEventCount, oldestPendingStarterAge } from '../../worker/starterQueue.js';
import { progressOf } from './vessel.js';

/** Plan §5: what an operator needs to judge these galaxies. Read by hand, so it reads whole tables. */
export async function starterAdminView(db: Db, clock: Clock) {
  const ships = await db.select({ row: vessels, crew: vesselBotState.vesselId }).from(vessels)
    .leftJoin(vesselBotState, eq(vesselBotState.vesselId, vessels.id));
  const galaxies = await db.select().from(starterGalaxies).orderBy(starterGalaxies.ordinal);
  const here = ships.filter(ship => ship.row.status !== 'DEPARTED');
  const spread = [0, 0, 0, 0];
  for (const { row } of here) {
    const band = Math.min(3, Math.floor(repairProgress(progressOf(row)).share * 4));
    spread[band] = (spread[band] ?? 0) + 1;
  }
  return {
    ships: {
      active: ships.filter(ship => ship.row.status === 'ACTIVE').length,
      dormant: ships.filter(ship => ship.row.status === 'DORMANT').length,
      departed: ships.length - here.length,
    },
    people: here.filter(ship => ship.crew === null).length,
    crew: here.filter(ship => ship.crew !== null).length,
    spread,
    galaxies: galaxies.map(galaxy => ({
      ordinal: galaxy.ordinal, capacity: galaxy.capacity, open: galaxy.status === 'OPEN',
      seated: here.filter(ship => ship.row.starterGalaxyId === galaxy.id).length,
    })),
    queue: { lagSeconds: await oldestPendingStarterAge(db, clock.now()), failed: await failedStarterEventCount(db) },
  };
}
