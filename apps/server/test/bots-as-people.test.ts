import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { pino } from 'pino';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { ABUSE, newcomerShieldUntil } from '@astera/rules';
import { botProfiles, missions, planets, players, probeReports } from '../src/db/schema.js';
import { addBot } from '../src/services/bots/roster.js';
import { ensureBotSeats } from '../src/services/bots/sweep.js';
import { runBotTurn, type BotSeat } from '../src/services/bots/brain.js';
import { BOTS } from '../src/services/bots/personas.js';
import { launchAttack } from '../src/services/mission.js';
import { rememberWorld } from '../src/services/intel.js';
import { EventWorker } from '../src/worker/loop.js';
import {
  fuelUp, giveUnits, grant, levelWorld, seedWorld, settledAt, testDb, type Fixture,
} from './helpers.js';

/**
 * THE SERVER'S COMMANDERS PLAY BY THE RULES PEOPLE PLAY BY. Owner instruction,
 * 2026-09-19: *"Unutma onlar gerçek insan gibi artık!"*
 *
 *   · A bot opens with the same first-day shield a person does, and waits it out
 *     rather than breaking it with a raid.
 *   · A battle between two bots moves Dominion exactly as one between two people.
 */

const silent = pino({ level: 'silent' });
afterAll(async () => { await (await testDb()).close(); });

let f: Fixture;

interface Seat extends BotSeat { shieldUntil: Date | null }

const seats = async (): Promise<Seat[]> => {
  const rows = await f.db
    .select({
      accountId: players.accountId,
      playerId: players.id,
      planetId: planets.id,
      seasonId: players.seasonId,
      persona: botProfiles.persona,
      ordinal: botProfiles.ordinal,
      shieldUntil: players.newcomerShieldUntil,
    })
    .from(players)
    .innerJoin(botProfiles, eq(botProfiles.accountId, players.accountId))
    .innerJoin(planets, and(eq(planets.controllerPlayerId, players.id), eq(planets.kind, 'CAPITAL')))
    .orderBy(botProfiles.ordinal);
  return rows.map((row) => ({ ...row, seasonSeed: f.seed }));
};

beforeEach(async () => {
  f = await seedWorld(2);
  await addBot(f.db, 'Poyraz', f.clock);
  await addBot(f.db, 'Asena', f.clock);
  await ensureBotSeats(f.db, f.clock, silent);
});

describe('a bot’s first day', () => {
  it('is shielded exactly as a person’s is', async () => {
    for (const seat of await seats()) {
      expect(ABUSE.newcomerShieldHours).toBe(24);
      expect(seat.shieldUntil?.getTime()).toBe(newcomerShieldUntil(f.clock.now().getTime()));
    }
  });

  /** A person who fires gives up their shield; a bot that is waiting simply waits. */
  it('is waited out: no raid leaves while the bot’s own shield stands', async () => {
    const [bot, target] = await seats();
    f.clock.advance(BOTS.ceasefireMinutes + 1);
    // A fresh, open reading of a world it could otherwise hit.
    const [scout] = await f.db.insert(missions).values({
      fuelPaid: 0,
      seasonId: bot!.seasonId, kind: 'probe', status: 'resolved',
      ownerPlayerId: bot!.playerId, originPlanetId: bot!.planetId, targetPlanetId: target!.planetId,
      fleet: {}, distance: 10, departAt: f.clock.now(), arriveAt: f.clock.now(),
    }).returning();
    const [report] = await f.db.insert(probeReports).values({
      observerPlayerId: bot!.playerId, targetPlanetId: target!.planetId, missionId: scout!.id,
      accuracy: 1, stock: { low: 40_000, high: 40_000 }, defence: { low: 0, high: 0 },
      fleetSize: { low: 0, high: 0 }, shield: { low: 0, high: 0 }, unarmed: { low: 0, high: 0 },
      fleetHome: true, detected: false, createdAt: f.clock.now(),
    }).returning();
    await f.db.transaction((tx) => rememberWorld(tx, {
      observerPlayerId: bot!.playerId, targetPlanetId: target!.planetId, seasonId: bot!.seasonId,
      seenAt: f.clock.now(), source: 'PROBE', reportId: report!.id,
    }));
    await giveUnits(f.db, bot!.planetId, { DART: 30, COURIER: 2 });
    await fuelUp(f.db, bot!.planetId);

    for (let turn = 0; turn < 25; turn++) {
      await runBotTurn(f.db, f.clock, bot!, silent);
      f.clock.advance(1);
    }
    const raids = await f.db.select({ id: missions.id }).from(missions)
      .where(and(eq(missions.ownerPlayerId, bot!.playerId), eq(missions.kind, 'attack')));
    expect(raids).toHaveLength(0);
    const [still] = await f.db.select({ until: players.newcomerShieldUntil }).from(players)
      .where(eq(players.id, bot!.playerId));
    expect(still?.until).not.toBeNull();
  });
});

describe('a battle between two bots', () => {
  it('moves Dominion, taken by one and lost by the other', async () => {
    const [attacker, defender] = await seats();
    // Two established commanders: this is about Dominion, not about the first day.
    await f.db.update(players).set({ newcomerShieldUntil: null })
      .where(inArray(players.id, [attacker!.playerId, defender!.playerId]));
    await grant(f.db, defender!.planetId, 60_000, 15_000);
    await levelWorld(f.db, [attacker!.planetId, defender!.planetId]);
    await giveUnits(f.db, attacker!.planetId, { DART: 60, COURIER: 8 });
    await fuelUp(f.db, attacker!.planetId);

    const launch = await launchAttack(
      f.db, attacker!.planetId, defender!.planetId, { DART: 60, COURIER: 8 }, f.clock,
    );
    f.clock.set(settledAt(launch.arriveAt));
    const worker = new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, silent);
    while ((await worker.tick()).claimed > 0) { /* drain */ }

    const ledgers = await f.db
      .select({ id: players.id, taken: players.dominionTaken, lost: players.dominionLost })
      .from(players)
      .where(inArray(players.id, [attacker!.playerId, defender!.playerId]));
    const of = (id: string) => ledgers.find((row) => row.id === id)!;
    expect(of(attacker!.playerId).taken).toBeGreaterThan(0);
    expect(of(defender!.playerId).lost).toBe(of(attacker!.playerId).taken);
    expect((await f.db.select({ n: sql<number>`count(*)::int` }).from(missions)
      .where(eq(missions.kind, 'attack')))[0]?.n).toBe(1);
  });
});
