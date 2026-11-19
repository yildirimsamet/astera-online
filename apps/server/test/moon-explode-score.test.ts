import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { MOON, crackLimit, fleetValue } from '@astera/rules';
import { dominionEvents, honorEvents, moons, players, scheduledEvents, seasons, strategicAssets, units } from '../src/db/schema.js';
import { prepareHonorSeason } from '../src/services/honorLedger.js';
import { launchDeathStar } from '../src/services/strategic.js';
import { MOON_LOCATION } from '../src/services/unitLocation.js';
import { onMissionArrival } from '../src/worker/handlers.js';
import { giveUnits, levelWorld, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

/*
  F7b-2 (S35, plan §6.14 step 2, §6.19): the ships that die with a moon count for the commander who struck the
  last blow as a battle's kills would — Dominion moves from the moon's holder to the striker, and Honor scores
  the dead as the defender's battle loss. A crack alone moves no score.
*/
describe('the score of a broken moon', () => {
  let f: Fixture;
  let striker: string;
  let holder: string;

  beforeEach(async () => {
    f = await seedWorld(3, 24_019);
    [striker, holder] = f.planetIds as [string, string];
    await f.db.update(seasons).set({ rulesetVersion: MOON.rulesetVersion }).where(eq(seasons.id, f.seasonId));
    await levelWorld(f.db, f.planetIds);
    for (const id of f.planetIds) {
      await setLevel(f.db, id, 'CORE', 12);
      await giveUnits(f.db, id, { PIKE: 500 });
    }
    await f.db.transaction((tx) => prepareHonorSeason(tx, f.seasonId, 'SHADOW', f.clock, 4));
    f.clock.advance(250);
    await f.db.insert(moons).values({ planetId: holder, rarity: 'COMMON', origin: 'BUILT', visualSeed: 9, bornAt: f.clock.now(),
      cracks: crackLimit('COMMON') - 1, lastHitAt: new Date(f.clock.now().getTime() - 3_600_000) });
  });
  afterAll(async () => { await (await testDb()).close(); });

  const strike = async () => {
    await f.db.insert(strategicAssets).values({ planetId: striker, type: 'DEATH_STAR', status: 'READY', startedAt: f.clock.now(), remainingSeconds: 0 });
    const sent = await launchDeathStar(f.db, striker, holder, f.clock, f.playerIds[0], false, new Set(), 'MOON');
    f.clock.set(sent.arriveAt);
    const [event] = await f.db.select().from(scheduledEvents)
      .where(and(eq(scheduledEvents.refId, sent.missionId), eq(scheduledEvents.kind, 'mission_arrival')));
    await onMissionArrival({ db: f.db, clock: f.clock }, event!);
    // Redelivery books nothing twice.
    await onMissionArrival({ db: f.db, clock: f.clock }, event!);
    return sent;
  };
  const ledger = async (playerId: string) =>
    (await f.db.select({ taken: players.dominionTaken, lost: players.dominionLost }).from(players).where(eq(players.id, playerId)))[0]!;

  it('moves Dominion from the holder to the striker by the value of the dead, as a battle would', async () => {
    await f.db.insert(units).values({ planetId: holder, ownerPlayerId: f.playerIds[1]!, hull: 'PIKE', location: MOON_LOCATION, count: 30 });
    const [strikerBefore, holderBefore] = [await ledger(f.playerIds[0]!), await ledger(f.playerIds[1]!)];
    const sent = await strike();
    const value = fleetValue({ PIKE: 30 });
    const [booked] = await f.db.select().from(dominionEvents).where(eq(dominionEvents.missionId, sent.missionId));
    expect(booked).toMatchObject({
      attackerPlayerId: f.playerIds[0], defenderPlayerId: f.playerIds[1], eligible: true,
      lootValue: 0, attackerLossValue: 0, defenderLossValue: value, rawExchange: value, transfer: value,
    });
    expect((await ledger(f.playerIds[0]!)).taken - strikerBefore.taken).toBe(value);
    expect((await ledger(f.playerIds[1]!)).lost - holderBefore.lost).toBe(value);
  });

  it('scores the dead in Honor as the defender’s battle loss', async () => {
    await f.db.insert(units).values({ planetId: holder, ownerPlayerId: f.playerIds[1]!, hull: 'PIKE', location: MOON_LOCATION, count: 30 });
    const sent = await strike();
    const entries = await f.db.select().from(honorEvents);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.sourceId).toBe(sent.missionId);
    expect(entries[0]?.evidence.attack[0]?.loss).toBe(0);
    expect(entries[0]?.evidence.defence[0]?.loss).toBeGreaterThan(0);
    expect(entries[0]?.outcome.attack.total).toBeGreaterThan(0);
  });

  it('a crack moves no Dominion and earns no Honor', async () => {
    await f.db.update(moons).set({ cracks: 0, lastHitAt: null }).where(eq(moons.planetId, holder));
    await f.db.insert(units).values({ planetId: holder, ownerPlayerId: f.playerIds[1]!, hull: 'PIKE', location: MOON_LOCATION, count: 30 });
    const sent = await strike();
    expect(await f.db.select().from(dominionEvents).where(eq(dominionEvents.missionId, sent.missionId))).toEqual([]);
    const [entry] = await f.db.select().from(honorEvents);
    expect(entry?.outcome.attack.total).toBe(0);
  });
});
