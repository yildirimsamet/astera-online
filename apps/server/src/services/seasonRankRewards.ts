import { and, eq, inArray, sql } from 'drizzle-orm';
import type { Resources } from '@astera/rules';
import type { Db, Tx } from '../db/client.js';
import { planets, seasonRewardEntitlements } from '../db/schema.js';

export interface DeliveredSeasonRankReward extends Resources {
  sourceSeasonId: string;
  displayRank: number;
  rewardPlace: number;
  programVersion: number;
}

/**
 * Make the new cycle the one and only window in which a frozen reward can be claimed.
 *
 * Called inside the same transaction that wipes the source worlds and opens their
 * successors. A crash can therefore leave neither an unbound reward beside a live
 * successor nor a bound reward beside a rolled-back successor.
 */
export async function bindSeasonRankRewardsToSuccessor(
  tx: Tx,
  sourceCycleIds: readonly string[],
  targetCycleId: string | null,
): Promise<void> {
  if (sourceCycleIds.length === 0 || targetCycleId === null) return;
  await tx
    .update(seasonRewardEntitlements)
    .set({ targetCycleId })
    .where(and(
      inArray(seasonRewardEntitlements.sourceCycleId, [...sourceCycleIds]),
      eq(seasonRewardEntitlements.status, 'PENDING'),
      sql`${seasonRewardEntitlements.targetCycleId} IS NULL`,
    ));
}

/** Unclaimed rewards cease to exist when their immediate successor cycle closes. */
export async function expireSeasonRankRewardsForCycles(
  tx: Tx,
  endingCycleIds: readonly string[],
  now: Date,
): Promise<void> {
  if (endingCycleIds.length === 0) return;
  await tx
    .update(seasonRewardEntitlements)
    .set({ status: 'EXPIRED', expiredAt: now })
    .where(and(
      inArray(seasonRewardEntitlements.targetCycleId, [...endingCycleIds]),
      eq(seasonRewardEntitlements.status, 'PENDING'),
    ));
}

/**
 * Atomically claim and deposit one frozen reward into the capital just created.
 *
 * The conditional update is the authority: only the transaction that changes
 * PENDING to DELIVERED receives an amount to credit. A retry can read the receipt,
 * but can never make the resource update happen twice.
 */
export async function deliverSeasonRankReward(
  tx: Tx,
  input: {
    accountId: string;
    targetCycleId: string;
    deliveredSeasonId: string;
    planetId: string;
    deliveredAt: Date;
  },
): Promise<DeliveredSeasonRankReward | null> {
  const [claimed] = await tx
    .update(seasonRewardEntitlements)
    .set({
      status: 'DELIVERED',
      deliveredSeasonId: input.deliveredSeasonId,
      deliveredAt: input.deliveredAt,
    })
    .where(and(
      eq(seasonRewardEntitlements.accountId, input.accountId),
      eq(seasonRewardEntitlements.targetCycleId, input.targetCycleId),
      eq(seasonRewardEntitlements.status, 'PENDING'),
    ))
    .returning({
      sourceSeasonId: seasonRewardEntitlements.sourceSeasonId,
      displayRank: seasonRewardEntitlements.displayRank,
      rewardPlace: seasonRewardEntitlements.rewardPlace,
      alloy: seasonRewardEntitlements.alloy,
      crystal: seasonRewardEntitlements.crystal,
      deuterium: seasonRewardEntitlements.deuterium,
      programVersion: seasonRewardEntitlements.programVersion,
    });
  if (!claimed) return null;

  await tx
    .update(planets)
    .set({
      alloy: sql`${planets.alloy} + ${claimed.alloy}`,
      crystal: sql`${planets.crystal} + ${claimed.crystal}`,
      deuterium: sql`${planets.deuterium} + ${claimed.deuterium}`,
    })
    .where(eq(planets.id, input.planetId));

  return claimed;
}

/** Idempotent join retries can repeat the confirmation without repeating payment. */
export async function deliveredSeasonRankReward(
  tx: Db | Tx,
  accountId: string,
  deliveredSeasonId: string,
): Promise<DeliveredSeasonRankReward | null> {
  const [receipt] = await tx
    .select({
      sourceSeasonId: seasonRewardEntitlements.sourceSeasonId,
      displayRank: seasonRewardEntitlements.displayRank,
      rewardPlace: seasonRewardEntitlements.rewardPlace,
      alloy: seasonRewardEntitlements.alloy,
      crystal: seasonRewardEntitlements.crystal,
      deuterium: seasonRewardEntitlements.deuterium,
      programVersion: seasonRewardEntitlements.programVersion,
    })
    .from(seasonRewardEntitlements)
    .where(and(
      eq(seasonRewardEntitlements.accountId, accountId),
      eq(seasonRewardEntitlements.deliveredSeasonId, deliveredSeasonId),
      eq(seasonRewardEntitlements.status, 'DELIVERED'),
    ))
    .limit(1);
  return receipt ?? null;
}
