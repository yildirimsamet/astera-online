import { and, eq, inArray, isNull } from 'drizzle-orm';
import { HULLS, fleetEntries, type Fleet, type Ledger } from '@astera/rules';
import type { Tx } from '../db/client.js';
import { accounts, clanMemberships, clans, planets, players } from '../db/schema.js';

/**
 * THE PRIMITIVES EVERY BATTLE SETTLEMENT SHARES, whoever is doing the fighting.
 *
 * They lived inside `worker/handlers.ts` while there was exactly one kind of
 * battle. A clan's joint war settles in its own file — one mission, several
 * commanders, a different loot rule and a different score rule — and it needs the
 * same four things the ordinary raid does: both ledgers locked in a stable order,
 * a way to write one back, what a fleet's WRECKAGE is worth, and who a world
 * belongs to. Copying them would have been two statements of the lock order and
 * two statements of what debris is made of.
 */

/**
 * Both sides' score rows, held for the transaction, in id order.
 *
 * The ORDER is the point: a launch takes its planets and then its players by id,
 * and settlement takes clans and then players by id, so no two paths can hold
 * halves of each other's set.
 */
export async function lockLedgers(
  tx: Tx,
  playerIds: readonly string[],
): Promise<Map<string, Ledger & { id: string }>> {
  const ids = [...new Set(playerIds)].sort();
  if (ids.length === 0) return new Map();
  const rows = await tx
    .select({ id: players.id, taken: players.dominionTaken, lost: players.dominionLost })
    .from(players)
    .where(inArray(players.id, ids))
    .orderBy(players.id)
    .for('update');
  if (rows.length !== ids.length) throw new Error('mission player vanished before arrival');
  return new Map(rows.map((row) => [row.id, row]));
}

export async function saveLedger(tx: Tx, ledger: Ledger & { id: string }): Promise<void> {
  await tx
    .update(players)
    .set({ dominionTaken: ledger.taken, dominionLost: ledger.lost })
    .where(eq(players.id, ledger.id));
}

/**
 * WHAT A LIST OF DEAD HULLS IS WORTH AS WRECKAGE.
 *
 * Ground units are excluded because they already have `defenceSalvage` — counting
 * them here would return about 85% of a defender's losses and make a fortress
 * profit from being attacked. `!HULLS[id].ground` rather than `MOBILE_HULLS`
 * membership, so a hull that is neither ground nor attack-legal still prices.
 */
const flying = (fleet: Fleet, price: (hull: keyof typeof HULLS) => number): number =>
  fleetEntries(fleet)
    .filter(([id]) => !HULLS[id].ground)
    .reduce((sum, [id, n]) => sum + n * price(id), 0);

export const flyingValue = (fleet: Fleet): number =>
  flying(fleet, (id) => HULLS[id].alloy + HULLS[id].crystal + HULLS[id].deuterium);
export const flyingAlloy = (fleet: Fleet): number => flying(fleet, (id) => HULLS[id].alloy);
export const flyingCrystal = (fleet: Fleet): number => flying(fleet, (id) => HULLS[id].crystal);
export const flyingDeuterium = (fleet: Fleet): number =>
  flying(fleet, (id) => HULLS[id].deuterium);

export interface PlanetIdentity {
  username: string;
  planetName: string;
  clanTag: string | null;
}

/** Who holds this world, what it is called, and under whose tag. */
export async function identityOfPlanet(
  tx: Tx,
  planetId: string,
): Promise<PlanetIdentity | undefined> {
  const [row] = await tx
    .select({
      username: accounts.displayName,
      planetName: planets.name,
      clanTag: clans.tag,
    })
    .from(planets)
    .innerJoin(players, eq(planets.controllerPlayerId, players.id))
    .innerJoin(accounts, eq(players.accountId, accounts.id))
    .leftJoin(
      clanMemberships,
      and(eq(clanMemberships.playerId, players.id), isNull(clanMemberships.leftAt)),
    )
    .leftJoin(
      clans,
      and(eq(clans.id, clanMemberships.clanId), isNull(clans.disbandedAt)),
    )
    .where(eq(planets.id, planetId));
  return row;
}
