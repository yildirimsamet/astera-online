import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { MULTI_WORLD } from '@astera/rules';
import { honorCommitments, honorEvents, honorSeasons, monumentBattles, monuments, monumentShipLots, monumentWaves, planets, seasons, units } from '../src/db/schema.js';
import { prepareHonorSeason } from '../src/services/honorLedger.js';
import { openHonorRanking } from '../src/services/honorActivation.js';
import { observeHonorOwner } from '../src/services/honorReference.js';
import { sendMonument } from '../src/services/monument.js';
import { resolveMonumentArrival } from '../src/services/monumentArrival.js';
import { fuelUp, giveUnits, levelWorld, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

describe('Honor integrated with physical monument battles', () => {
  let f: Fixture;
  let targetId: string;
  beforeEach(async () => {
    f = await seedWorld(2, 8817);
    await f.db.update(seasons).set({ rulesetVersion: MULTI_WORLD.shipDamageRulesetVersion }).where(eq(seasons.id, f.seasonId));
    for (const id of f.planetIds) {
      await setLevel(f.db, id, 'CORE', 9);
      await giveUnits(f.db, id, { DART: 120 });
      await fuelUp(f.db, id);
      await f.db.update(planets).set({ x: 3500, y: 0, z: 0 }).where(eq(planets.id, id));
    }
    await levelWorld(f.db, f.planetIds);
    const [target] = await f.db.insert(monuments).values({ seasonId: f.seasonId, ordinal: 1, x: 6000, y: 0, z: 0,
      capacity: 7270, productionPerMinute: 60, garrison: {}, garrisonTemplate: {}, controllerPlayerId: f.playerIds[1]!,
      settledAt: f.clock.now() }).returning();
    targetId = target!.id;
    const id = randomUUID();
    await f.db.insert(monumentWaves).values({ id, seasonId: f.seasonId, monumentId: targetId, playerId: f.playerIds[1]!,
      originPlanetId: f.planetIds[1]!, unitLocation: `monument:${id}`, purpose: 'ATTACK', sentFleet: { DART: 10 }, tech: {},
      route: [], status: 'HOLD', sentAt: f.clock.now(), heldAt: f.clock.now(), radiationSettledAt: f.clock.now(), fuelPaid: 0 });
    await f.db.insert(monumentShipLots).values({ waveId: id, hull: 'DART', count: 10, damageBp: 0, remainderBp: 0, deuterium: 0 });
    await f.db.insert(units).values({ planetId: f.planetIds[1]!, ownerPlayerId: f.playerIds[1]!, location: `monument:${id}`, hull: 'DART', count: 10 });
  });
  afterAll(async () => { await (await testDb()).close(); });

  it.each([{ afterLaunch: false, rankedOpening: false, openBeforeLaunch: false, version: 4 },
    { afterLaunch: false, rankedOpening: true, openBeforeLaunch: false, version: 4 },
    { afterLaunch: false, rankedOpening: false, openBeforeLaunch: true, version: 4 },
    { afterLaunch: false, rankedOpening: false, openBeforeLaunch: false, version: 3 },
    { afterLaunch: true, rankedOpening: false, openBeforeLaunch: false, version: 3 },
    { afterLaunch: false, rankedOpening: true, openBeforeLaunch: false, version: 3 },
    { afterLaunch: false, rankedOpening: false, openBeforeLaunch: true, version: 3 }] as const)('finishes a native PvP battle once, boundary $afterLaunch/$rankedOpening/$openBeforeLaunch', async ({ afterLaunch, rankedOpening, openBeforeLaunch, version }) => {
    const enable = () => f.db.transaction(async tx => {
      await prepareHonorSeason(tx, f.seasonId, 'SHADOW', f.clock, version);
      for (const actor of [...f.playerIds].sort()) await observeHonorOwner(tx, actor, f.clock.now());
    });
    if (!afterLaunch) await enable();
    if (rankedOpening || openBeforeLaunch) f.clock.advance(2 * 24 * 60);
    if (openBeforeLaunch) await openHonorRanking(f.db, { seasonId: f.seasonId, clock: f.clock, apply: true });
    const { wave } = await f.db.transaction(tx => sendMonument(tx, { senderPlayerId: f.playerIds[0]!,
      originPlanetId: f.planetIds[0]!, monumentId: targetId, fleet: { DART: 100 }, purpose: 'ATTACK', clock: f.clock }));
    expect(await f.db.select().from(honorCommitments)).toHaveLength(afterLaunch ? 0 : 1);
    if (afterLaunch) await enable();
    if (rankedOpening) await openHonorRanking(f.db, { seasonId: f.seasonId, clock: f.clock, apply: true });
    f.clock.set(wave.arriveAt!);
    await f.db.transaction(tx => resolveMonumentArrival(tx, { waveId: wave.id, generation: wave.generation, at: f.clock.now() }));
    if (afterLaunch || rankedOpening) {
      await f.db.transaction(tx => resolveMonumentArrival(tx, { waveId: wave.id, generation: wave.generation, at: f.clock.now() }));
      expect(await f.db.select().from(monumentBattles)).toHaveLength(1);
      expect(await f.db.select().from(honorEvents)).toHaveLength(0);
      return;
    }
    const [entry] = await f.db.select().from(honorEvents);
    expect(entry?.source).toBe('MONUMENT');
    expect(entry?.ranked).toBe(openBeforeLaunch);
    expect(entry?.evidence.defence[0]?.combatLoss).toBeGreaterThan(0);
    expect(entry?.outcome.attack.total).toBeGreaterThan(0);
    expect(entry?.outcome.defence.total).toBeGreaterThanOrEqual(0);
    await f.db.transaction(tx => resolveMonumentArrival(tx, { waveId: wave.id, generation: wave.generation, at: f.clock.now() }));
    expect(await f.db.select().from(honorEvents)).toHaveLength(1);
  });

  /** A reinforcement whose side lost the target fights on arrival (owner, 2026-10-15). */
  it.each([{ afterLaunch: false }, { afterLaunch: true }] as const)('settles a reinforcement that meets a new holder, Honor boundary $afterLaunch', async ({ afterLaunch }) => {
    const enable = () => f.db.transaction(async tx => {
      await prepareHonorSeason(tx, f.seasonId, 'SHADOW', f.clock);
      for (const actor of [...f.playerIds].sort()) await observeHonorOwner(tx, actor, f.clock.now());
    });
    if (!afterLaunch) await enable();
    await f.db.update(monuments).set({ controllerPlayerId: f.playerIds[0]! }).where(eq(monuments.id, targetId));
    const { wave } = await f.db.transaction(tx => sendMonument(tx, { senderPlayerId: f.playerIds[0]!,
      originPlanetId: f.planetIds[0]!, monumentId: targetId, fleet: { DART: 100 }, purpose: 'REINFORCE', clock: f.clock }));
    if (afterLaunch) {
      await enable();
      expect((await f.db.select().from(honorSeasons))[0]?.legacySources).toContain(`MONUMENT:${wave.id}`);
    }
    await f.db.update(monuments).set({ controllerPlayerId: f.playerIds[1]! }).where(eq(monuments.id, targetId));
    f.clock.set(wave.arriveAt!);
    await f.db.transaction(tx => resolveMonumentArrival(tx, { waveId: wave.id, generation: wave.generation, at: f.clock.now() }));
    expect(await f.db.select().from(monumentBattles)).toHaveLength(1);
    const entries = await f.db.select().from(honorEvents);
    expect(entries).toHaveLength(afterLaunch ? 0 : 1);
    for (const entry of entries) expect(entry.evidence).toMatchObject({ exclusion: 'TARGET_CHANGED' });
  });
});
