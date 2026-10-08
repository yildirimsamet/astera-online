import { and, eq, isNull } from 'drizzle-orm';
import { BRAND_RECALL } from '@astera/rules';
import type { Clock } from '../clock.js';
import type { Db } from '../db/client.js';
import { accountRewards, planets, players } from '../db/schema.js';
import { assertWorldOperational, GameError, refreshWealth, saveResources, withPlanetLock } from './planet.js';
import { planetView } from './planetView.js';

const emptyReward = { alloy: 0, crystal: 0, deuterium: 0 };
const enrollment = (accountId: string) => and(eq(accountRewards.accountId, accountId), eq(accountRewards.rewardId, BRAND_RECALL.rewardId));

export async function brandRecallStatus(db: Db, accountId: string) {
  const [row] = await db.select({ claimedAt: accountRewards.claimedAt }).from(accountRewards).where(enrollment(accountId)).limit(1);
  return { eligible: row !== undefined, completed: row?.claimedAt != null, reward: BRAND_RECALL.reward };
}

/** The foreground clock is a UI choice; payout trusts this ledger and server time. */
export async function answerBrandRecall(db: Db, accountId: string, answer: string | null, clock: Clock) {
  if (answer === null) {
    // A skip needs no planet and moves no economy. It competes with a claim on the
    // same ledger row, so a simultaneous skip cannot be followed by a payout.
    const [skipped] = await db.update(accountRewards).set({ claimedAt: clock.now() })
      .where(and(enrollment(accountId), isNull(accountRewards.claimedAt))).returning({ id: accountRewards.rewardId });
    if (!skipped) {
      const [row] = await db.select({ id: accountRewards.rewardId }).from(accountRewards).where(enrollment(accountId)).limit(1);
      if (!row) throw new GameError('RECALL_UNAVAILABLE', 'This quiz is only available to new commanders', 404);
    }
    return { correct: false, completed: true, granted: emptyReward };
  }

  const [owner] = await db.select({ planetId: planets.id, playerId: players.id })
    .from(players).innerJoin(planets, and(eq(planets.controllerPlayerId, players.id), eq(planets.kind, 'CAPITAL')))
    .where(eq(players.accountId, accountId)).limit(1);
  if (!owner) throw new GameError('NO_PLANET', 'Join a galaxy first', 404);

  return withPlanetLock(db, owner.planetId, clock, async (tx, planet) => {
    const [row] = await tx.select().from(accountRewards).where(enrollment(accountId)).limit(1);
    if (!row) throw new GameError('RECALL_UNAVAILABLE', 'This quiz is only available to new commanders', 404);
    if (row.claimedAt) return { correct: answer === BRAND_RECALL.answer, completed: true, granted: emptyReward, planet: await planetView(tx, owner.planetId, clock) };
    if (planet.now.getTime() - row.createdAt.getTime() < BRAND_RECALL.delayMs) {
      throw new GameError('RECALL_TOO_EARLY', 'Play for three minutes before answering this quiz');
    }
    if (answer !== BRAND_RECALL.answer) return { correct: false, completed: false, granted: emptyReward };
    assertWorldOperational(planet);

    const [claimed] = await tx.update(accountRewards)
      .set({ claimedAt: planet.now, ...BRAND_RECALL.reward })
      .where(and(enrollment(accountId), isNull(accountRewards.claimedAt)))
      .returning({ id: accountRewards.rewardId });
    if (!claimed) return { correct: true, completed: true, granted: emptyReward };

    const next = {
      alloy: planet.alloy + BRAND_RECALL.reward.alloy,
      crystal: planet.crystal + BRAND_RECALL.reward.crystal,
      deuterium: planet.deuterium + BRAND_RECALL.reward.deuterium,
    };
    await saveResources(tx, owner.planetId, next);
    await refreshWealth(tx, planet);
    return { correct: true, completed: true, granted: BRAND_RECALL.reward, planet: await planetView(tx, owner.planetId, clock) };
  }, owner.playerId);
}
