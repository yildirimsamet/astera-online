import { and, eq, notInArray } from 'drizzle-orm';
import {
  NEWCOMER_HOUR,
  NEWCOMER_SCENARIO,
  isScenarioActive,
  personalPirateSpec,
  type NewcomerScenarioStep,
  type PirateSpec,
  type Vec3,
} from '@astera/rules';
import { minutesSince, type Clock } from '../clock.js';
import type { Db, Queryable, Tx } from '../db/client.js';
import { newcomerScenario, players } from '../db/schema.js';
import { publish } from '../stream/bus.js';
import { GameError } from './planet.js';
import { ensureUnknownSignalSchedule } from './unknownSignalSchedule.js';

/**
 * İNİŞ SONRASI İLK SAAT GÖREVLERİ (plan 2026-11-20 §5.3, Faz 4; playtest 2026-11-23).
 *
 * Authentic, player-driven onboarding in the main galaxy:
 *   LANDING → MINE → PIRATE → PROBE → WRAP_UP → DONE (or DISMISSED).
 *
 * No fake probe/attack actions or custom timers:
 *  - Mining any asteroid spawns a real personal pirate (`pirate_index < 0`) visible only to its owner.
 *  - Raiding & defeating a pirate via the real pirate pipeline advances PIRATE → PROBE (with zero player losses on the personal pirate).
 *  - Launching a real probe to another planet advances PROBE → WRAP_UP.
 */

export type NewcomerScenarioRow = typeof newcomerScenario.$inferSelect;

export interface NewcomerScenarioView {
  step: NewcomerScenarioStep;
  pirateDefeated: boolean;
  /**
   * Until when the tasks keep other windows waiting (review 2026-11-23): the founding hour from the landing.
   * After it the card still guides, but the brand quiz, the install card and the news come in their turn.
   */
  holdsScreenUntil: Date;
}

const toView = (row: NewcomerScenarioRow): NewcomerScenarioView => ({
  step: row.step,
  pirateDefeated: row.pirateDefeatedAt !== null,
  holdsScreenUntil: new Date(row.createdAt.getTime() + NEWCOMER_HOUR.minutes * 60_000),
});

/** Initialise the onboarding row when a first-game commander lands in the main galaxy. */
export async function initNewcomerScenario(
  tx: Tx,
  input: { seasonId: string; playerId: string; now: Date },
): Promise<void> {
  await tx.insert(newcomerScenario).values({
    playerId: input.playerId,
    seasonId: input.seasonId,
    step: 'LANDING',
    pirateSpec: null,
    createdAt: input.now,
    updatedAt: input.now,
  }).onConflictDoNothing();
}

export async function readNewcomerScenario(db: Queryable, playerId: string): Promise<NewcomerScenarioView | null> {
  const [row] = await db.select().from(newcomerScenario).where(eq(newcomerScenario.playerId, playerId));
  return row ? toView(row) : null;
}

async function lockScenario(tx: Tx, playerId: string): Promise<NewcomerScenarioRow> {
  const [row] = await tx.select().from(newcomerScenario)
    .where(eq(newcomerScenario.playerId, playerId)).for('update');
  if (!row) throw new GameError('SCENARIO_NOT_FOUND', 'No newcomer scenario for this commander', 404);
  return row;
}

async function releaseUnknownSignal(tx: Tx, playerId: string, seasonId: string, now: Date): Promise<void> {
  await ensureUnknownSignalSchedule(
    tx,
    playerId,
    seasonId,
    now,
    false,
    true,
    NEWCOMER_SCENARIO.postScenarioSignalGapMinutes,
  );
}

/** An 1 → An 2: player taps "Kuruluş Saatini Başlat". */
export async function startNewcomerScenario(db: Db, playerId: string, clock: Clock): Promise<NewcomerScenarioView> {
  const now = clock.now();
  return db.transaction(async (tx) => {
    const row = await lockScenario(tx, playerId);
    if (row.step !== 'LANDING') return toView(row);
    const [updated] = await tx.update(newcomerScenario)
      .set({ step: 'MINE', updatedAt: now })
      .where(eq(newcomerScenario.playerId, playerId))
      .returning();
    await publish(tx, playerId, 'private:newcomer-scenario');
    return toView(updated!);
  });
}

/**
 * Called from `launchMining`: sending a Prospector at any asteroid advances MINE → PIRATE and
 * spawns the commander's personal pirate on a real orbit beside their capital.
 */
export async function onScenarioAsteroidMined(
  tx: Tx,
  playerId: string,
  seasonStartsAt: Date,
  capital: Vec3,
  now: Date,
): Promise<void> {
  const [row] = await tx.select().from(newcomerScenario)
    .where(eq(newcomerScenario.playerId, playerId)).for('update');
  if (row?.step !== 'MINE' && row?.step !== 'LANDING') return;
  const spec = personalPirateSpec(capital, minutesSince(seasonStartsAt, now));
  await tx.update(newcomerScenario)
    .set({
      step: 'PIRATE',
      pirateSpec: spec,
      pirateSpawnedAt: now,
      updatedAt: now,
    })
    .where(eq(newcomerScenario.playerId, playerId));
  await publish(tx, playerId, 'private:newcomer-scenario');
}

/**
 * This commander's personal pirate, if spawned and still active in the scenario.
 * Never returned to any other player; hidden once defeated, completed, or dismissed.
 */
export async function personalPirateOf(db: Queryable, playerId: string): Promise<PirateSpec | undefined> {
  const [row] = await db.select().from(newcomerScenario)
    .where(eq(newcomerScenario.playerId, playerId));
  if (!row?.pirateSpec || row.pirateDefeatedAt !== null || !isScenarioActive(row.step) || row.step !== 'PIRATE') {
    return undefined;
  }
  return { ...row.pirateSpec, index: row.pirateIndex };
}

/**
 * Resolve one personal pirate by its negative index, for arrival settlement, flight strips,
 * and battle reports after a raid has already been launched.
 */
export async function personalPirateAt(
  db: Queryable,
  seasonId: string,
  index: number,
): Promise<PirateSpec | undefined> {
  const [row] = await db.select().from(newcomerScenario)
    .where(and(eq(newcomerScenario.seasonId, seasonId), eq(newcomerScenario.pirateIndex, index)));
  return row?.pirateSpec ? { ...row.pirateSpec, index: row.pirateIndex } : undefined;
}

/**
 * Called from `resolvePirateArrival`: defeating a pirate decisively advances PIRATE → PROBE.
 */
export async function onScenarioPirateDefeated(tx: Tx, playerId: string, now: Date): Promise<void> {
  const [row] = await tx.select().from(newcomerScenario)
    .where(eq(newcomerScenario.playerId, playerId)).for('update');
  if (row?.step !== 'PIRATE') return;
  await tx.update(newcomerScenario)
    .set({ step: 'PROBE', pirateDefeatedAt: now, updatedAt: now })
    .where(eq(newcomerScenario.playerId, playerId));
  await publish(tx, playerId, 'private:newcomer-scenario');
}

/**
 * Called from `launchProbe`: sending a real probe to another planet advances PROBE → WRAP_UP.
 */
export async function onScenarioPlanetProbed(tx: Tx, playerId: string, now: Date): Promise<void> {
  const [row] = await tx.select().from(newcomerScenario)
    .where(eq(newcomerScenario.playerId, playerId)).for('update');
  if (row?.step !== 'PROBE') return;
  await tx.update(newcomerScenario)
    .set({ step: 'WRAP_UP', probeSentAt: now, updatedAt: now })
    .where(eq(newcomerScenario.playerId, playerId));
  await publish(tx, playerId, 'private:newcomer-scenario');
}

/** Complete from WRAP_UP → DONE and release the regular unknown signal schedule. */
export async function completeNewcomerScenario(db: Db, playerId: string, clock: Clock): Promise<NewcomerScenarioView> {
  const now = clock.now();
  return db.transaction(async (tx) => {
    const row = await lockScenario(tx, playerId);
    if (row.step === 'DONE' || row.step === 'DISMISSED') return toView(row);
    if (row.step !== 'WRAP_UP') {
      throw new GameError('SCENARIO_WRONG_STEP', 'Scenario is not ready to finish yet', 409);
    }
    const [updated] = await tx.update(newcomerScenario)
      .set({ step: 'DONE', completedAt: now, updatedAt: now })
      .where(eq(newcomerScenario.playerId, playerId))
      .returning();
    await releaseUnknownSignal(tx, playerId, row.seasonId, now);
    await publish(tx, playerId, 'private:newcomer-scenario');
    return toView(updated!);
  });
}

/** Dismiss from any active step → DISMISSED and release the regular unknown signal schedule. */
export async function dismissNewcomerScenario(db: Db, playerId: string, clock: Clock): Promise<NewcomerScenarioView> {
  const now = clock.now();
  return db.transaction(async (tx) => {
    const row = await lockScenario(tx, playerId);
    if (!isScenarioActive(row.step)) return toView(row);
    const [updated] = await tx.update(newcomerScenario)
      .set({ step: 'DISMISSED', dismissedAt: now, updatedAt: now })
      .where(eq(newcomerScenario.playerId, playerId))
      .returning();
    await releaseUnknownSignal(tx, playerId, row.seasonId, now);
    await publish(tx, playerId, 'private:newcomer-scenario');
    return toView(updated!);
  });
}

/** Dismiss any active newcomer scenario rows for an account (e.g. when the player turns off the guide). */
export async function dismissNewcomerScenarioForAccount(db: Db, accountId: string, clock: Clock): Promise<void> {
  const now = clock.now();
  await db.transaction(async (tx) => {
    const seats = await tx.select({ id: players.id, seasonId: players.seasonId })
      .from(players).where(eq(players.accountId, accountId));
    for (const seat of seats) {
      const updated = await tx.update(newcomerScenario)
        .set({ step: 'DISMISSED', dismissedAt: now, updatedAt: now })
        .where(and(
          eq(newcomerScenario.playerId, seat.id),
          notInArray(newcomerScenario.step, ['DONE', 'DISMISSED']),
        ))
        .returning({ playerId: newcomerScenario.playerId, seasonId: newcomerScenario.seasonId });
      for (const row of updated) {
        await releaseUnknownSignal(tx, row.playerId, row.seasonId, now);
        await publish(tx, row.playerId, 'private:newcomer-scenario');
      }
    }
  });
}
