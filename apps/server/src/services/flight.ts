import { and, eq, inArray, isNotNull, isNull, ne, or, sql } from 'drizzle-orm';
import { clanBayAvailable, flightSlots } from '@astera/rules';
import type { Queryable } from '../db/client.js';
import { miningRuns, missions, pirateRaids, tradeRuns } from '../db/schema.js';
import { GameError } from './planet.js';

/**
 * FLIGHT SLOTS — how much a planet may have in the air at once. D28.
 *
 * The rule lives in `@astera/rules`; this is the only place that counts what
 * is currently using it, and every launch path goes through `assertFreeBay`.
 *
 * WHY ONE HELPER AND NOT THREE COPIES. The count has to be taken under the planet
 * row lock or two launches racing each other both see a free bay — the same
 * failure the one-fleet-per-target check was written to avoid, and its comment
 * says so. Three copies of a concurrency-sensitive count is three chances to
 * forget the lock.
 */

/**
 * Which in-flight legs belong to THIS planet.
 *
 * A return leg is stored with its origin and target SWAPPED (`handlers.ts` builds
 * it that way so the craft flies back down the same line), so ownership cannot be
 * read off `originPlanetId` alone:
 *
 *   my attack, outbound     kind 'attack'  origin ME
 *   my attack, coming home  kind 'return'  target ME
 *   my probe, outbound      kind 'probe'   origin ME   parentMissionId NULL
 *   my probe, coming home   kind 'probe'   target ME   parentMissionId SET
 *
 * An enemy raid inbound at me is `kind 'attack'` with target ME, and their fleet
 * flying home afterwards is `kind 'return'` with origin ME — both of which look
 * like mine if you match on either column alone. So: **an outbound leg belongs to
 * its origin, a return leg belongs to its target**, and a return leg is one whose
 * kind is `return` or which carries a parent.
 *
 * This also quietly fixes a real bug in the probe cap it replaces, which matched
 * `origin OR target` and therefore let somebody else's probe consume one of my
 * three scouting slots.
 */
const isReturnLeg = or(eq(missions.kind, 'return'), isNotNull(missions.parentMissionId));
const isOutboundLeg = and(ne(missions.kind, 'return'), isNull(missions.parentMissionId));

const minesOf = (planetId: string) =>
  and(
    eq(missions.status, 'in_flight'),
    or(
      and(isOutboundLeg, eq(missions.originPlanetId, planetId)),
      and(isReturnLeg, eq(missions.targetPlanetId, planetId)),
    ),
  );

/**
 * THE RULE ITSELF, IN ONE PLACE, FOR CODE THAT HOLDS A ROW RATHER THAN A QUERY.
 *
 * The SQL below and this predicate are the same sentence said twice because they
 * are asked in two different places — a `WHERE` clause cannot be applied to a row
 * already in memory, and a JavaScript filter cannot be pushed into a count. What
 * must never happen again is a THIRD statement of it written from scratch, which
 * is exactly what `pendingThreads` had: it matched `origin OR target` and then
 * special-cased only an inbound attack, so every other foreign leg standing at one
 * end of your world — a probe flying at you, a probe flying home from you, a
 * raider's survivors leaving your orbit — was handed to you as YOUR OWN craft,
 * with its route, its composition and the other world's NAME on it.
 *
 * That was a duplicate and a leak at the same time: the same mission was drawn
 * once out of `pending` as your fleet and once out of `traffic` as an anonymous
 * contact, in two different places, on the same disc.
 *
 * `traffic.ts` reads this too, so the three surfaces that have to agree about
 * whose craft something is — the bay count, the public contact list and your own
 * pending list — now agree by construction.
 */
type Leg = Pick<
  typeof missions.$inferSelect,
  'kind' | 'parentMissionId' | 'originPlanetId' | 'targetPlanetId'
>;

export const legBelongsTo = (mission: Leg, planetId: string): boolean =>
  mission.kind === 'return' || mission.parentMissionId !== null
    ? mission.targetPlanetId === planetId
    : mission.originPlanetId === planetId;

/** Craft this planet currently has off the ground, across every kind of flight. */
export async function baysInUse(tx: Queryable, planetId: string): Promise<number> {
  const [flights] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(missions)
    .where(minesOf(planetId));

  /**
   * A mining run is ONE bay however many Prospectors are in it.
   *
   * A squadron is a single decision — where to send it and how much to commit —
   * and charging per craft would price the decision by its size rather than by the
   * fact that it was made.
   */
  const [mining] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(miningRuns)
    .where(
      and(eq(miningRuns.planetId, planetId), inArray(miningRuns.status, ['outbound', 'returning'])),
    );

  /**
   * A PIRATE RAID IS A BAY, LIKE EVERY OTHER FLIGHT. D28 · D150.
   *
   * Bays are the ONE scarcity governing how much a world can have committed at
   * once, and a target class that did not consume one would let a commander keep
   * their raid budget while farming pirates on the side — which is exactly the
   * "resources replace players as the fun" regression the design watches for.
   */
  const [pirate] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(pirateRaids)
    .where(
      and(
        eq(pirateRaids.planetId, planetId),
        inArray(pirateRaids.status, ['outbound', 'returning']),
      ),
    );

  /**
   * A TRADE CONVOY IS A BAY, LIKE EVERY OTHER FLIGHT. D28 · D156.
   *
   * The merchant deliberately has no quota, no fee and no per-world convoy limit —
   * the owner ruled all three out — which makes THIS the brake, together with hold
   * size and prepaid fuel. A flight table that is not counted here does not consume
   * a bay at all, so a commander would keep their whole raid budget while running
   * convoys on the side, and D28's single scarcity would be punctured by the one
   * lane that was given no scarcity of its own.
   */
  const [trade] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(tradeRuns)
    .where(
      and(eq(tradeRuns.planetId, planetId), inArray(tradeRuns.status, ['outbound', 'returning'])),
    );

  return (flights?.n ?? 0) + (mining?.n ?? 0) + (pirate?.n ?? 0) + (trade?.n ?? 0);
}

export interface BayCount {
  used: number;
  total: number;
}

export const baysOf = async (tx: Queryable, planetId: string, coreLevel: number): Promise<BayCount> => ({
  used: await baysInUse(tx, planetId),
  total: flightSlots(coreLevel),
});

/**
 * Refuse a launch that has nowhere to launch from.
 *
 * MUST be called inside the transaction that holds the planet row lock. Every
 * caller already has one — `loadLocked` takes it — so this asks for the `tx`
 * rather than a `Db` to make using it outside a transaction awkward.
 */
export async function assertFreeBay(
  tx: Queryable,
  planetId: string,
  coreLevel: number,
): Promise<void> {
  const { used, total } = await baysOf(tx, planetId, coreLevel);
  if (used >= total) {
    throw new GameError(
      'NO_FREE_BAY',
      `All ${String(total)} flight bays are in use. Something has to land first.`,
      409,
      { total },
    );
  }
}

/** D114's one extra seat, available only to a mission that remains clan aid. */
export async function assertFreeClanAidBay(
  tx: Queryable,
  planetId: string,
  coreLevel: number,
): Promise<void> {
  const { used, total } = await baysOf(tx, planetId, coreLevel);
  if (!clanBayAvailable(total, used, true)) {
    throw new GameError(
      'NO_FREE_CLAN_AID_BAY',
      'All ordinary and clan-aid flight bays are in use',
      409,
      { total: total + 1 },
    );
  }
}
