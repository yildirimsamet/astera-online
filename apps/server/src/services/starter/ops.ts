import { count, inArray, sql } from 'drizzle-orm';
import type { Clock } from '../../clock.js';
import type { Db } from '../../db/client.js';
import { contentReports, starterChatMessages, starterDepartures, starterEvents, starterGalaxies, starterSites, vesselBattleReports, vesselMissions, vessels } from '../../db/schema.js';
import { lockGalaxyWithRoom } from './enlist.js';
import { runDeparture } from './migration.js';
import { sweepStarterWorld } from './sites.js';

/**
 * WHAT ONLY AN OPERATOR DOES. Plan §7. There is no route to any of this: it runs from `pnpm starter`,
 * and everything that changes a player's ship does nothing until it is told to.
 */

/** Creates the first galaxy and lays out its places. Safe to run again. */
export async function bootstrapStarterGalaxy(db: Db, clock: Clock) {
  await db.transaction(tx => lockGalaxyWithRoom(tx, clock));
  await sweepStarterWorld(db, clock);
  const [galaxies] = await db.select({ value: count() }).from(starterGalaxies);
  const [sites] = await db.select({ value: count() }).from(starterSites);
  return { galaxies: galaxies?.value ?? 0, sites: sites?.value ?? 0 };
}

const stillAboard = () => inArray(vessels.status, ['ACTIVE', 'DORMANT']);

/**
 * CLOSES THE SHIP SIDE FOR GOOD, the last resort of §7. Every ship lands on the standard package,
 * ready or not, and whatever it had in the air stays there: the cargo limit would have taken most of
 * it anyway. One failure does not stop the rest, and running it again picks up whoever is left.
 */
export async function landAllShips(db: Db, clock: Clock, { apply }: { apply: boolean }) {
  const ships = await db.select({ id: vessels.id, accountId: vessels.accountId }).from(vessels).where(stillAboard());
  const failed: { accountId: string; reason: string }[] = [];
  let landed = 0;
  if (apply) {
    for (const ship of ships) {
      try {
        await db.transaction(async (tx) => {
          const flying = await tx.update(vesselMissions).set({ status: 'DONE', returnAt: null })
            .where(sql`${vesselMissions.ownerVesselId} = ${ship.id} and ${vesselMissions.status} in ('OUTBOUND', 'RETURNING')`)
            .returning({ id: vesselMissions.id });
          if (flying.length > 0) {
            await tx.update(starterEvents).set({ status: 'done', claimedAt: null }).where(inArray(starterEvents.refId, flying.map(flight => flight.id)));
          }
        });
        await runDeparture(db, ship.accountId, clock, { force: true });
        landed += 1;
      } catch (error) {
        failed.push({ accountId: ship.accountId, reason: error instanceof Error ? error.message : String(error) });
      }
    }
  }
  return { ships: ships.length, landed, failed };
}

/**
 * THE BETA'S CLEAN SLATE. `wipeAllServers` leaves ships alone on purpose, so nothing else can do this.
 * Accounts and the main game are not touched, and an account with no ship left can take a new one.
 */
export async function resetStarter(db: Db, { apply }: { apply: boolean }) {
  const [ships] = await db.select({ value: count() }).from(vessels);
  const [galaxies] = await db.select({ value: count() }).from(starterGalaxies);
  const total = { ships: ships?.value ?? 0, galaxies: galaxies?.value ?? 0 };
  if (!apply) return total;
  await db.transaction(async (tx) => {
    await tx.delete(contentReports).where(sql`${contentReports.targetKey} like 'starter:%'`);
    await tx.delete(starterChatMessages);
    await tx.delete(starterDepartures);
    await tx.delete(starterEvents);
    await tx.delete(vesselBattleReports);
    await tx.delete(vesselMissions);
    await tx.delete(starterSites);
    // The rest of a ship's rows go with it by cascade, and nothing else points at a galaxy once these are gone.
    await tx.delete(vessels);
    await tx.delete(starterGalaxies);
  });
  return total;
}
