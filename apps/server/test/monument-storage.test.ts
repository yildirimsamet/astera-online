import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { MONUMENT_CAPACITY } from '@astera/rules';
import { hpRadiationSources, monuments, monumentShipLots, monumentWaves, planets } from '../src/db/schema.js';
import { runMigrations } from '../src/db/migrate.js';
import { createSeason } from '../src/services/season.js';
import { seedWorld, testDb, type Fixture } from './helpers.js';

// Schema fixtures, not approved production/radiation/placement settings.
let f: Fixture;
let target: typeof monuments.$inferSelect;
const monumentInput = () => ({
  seasonId: f.seasonId, ordinal: 1, x: 6000, y: 0, z: 50,
  capacity: MONUMENT_CAPACITY, productionPerMinute: 60,
  garrison: { CITADEL: 2 }, settledAt: f.clock.now(),
});
const waveInput = (over: Partial<typeof monumentWaves.$inferInsert> = {}): typeof monumentWaves.$inferInsert => {
  const id = randomUUID();
  return {
    id, seasonId: f.seasonId, monumentId: target.id,
    playerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!,
    unitLocation: `monument:${id}`, purpose: 'ATTACK', sentFleet: { DART: 2, COURIER: 2 },
    tech: { SHIP_ARMOR: 4, CARGO_HOLDS: 2 }, route: [], reservedBulk: 0, fuelPaid: 1,
    sentAt: f.clock.now(), arriveAt: new Date(f.clock.now().getTime() + 60_000),
    radiationSettledAt: f.clock.now(), ...over,
  };
};
const insertWave = async () => (await f.db.insert(monumentWaves).values(waveInput()).returning())[0]!;
const sourceInput = () => ({
  seasonId: f.seasonId, anchorKind: 'MONUMENT' as const, anchorId: target.id,
  x: target.x, y: target.y, z: target.z, radius: 100, intensityHpPerMinute: 3,
  mode: 'EMIT' as const, activeFrom: f.clock.now(), label: 'fixture cloud',
});

beforeEach(async () => {
  f = await seedWorld(1, 20_261_003);
  const [created] = await f.db.insert(monuments).values(monumentInput()).returning();
  target = created!;
});
afterAll(async () => { const { close } = await testDb(); await close(); });

describe('monument persistence foundation', () => {
  it('stores a genuine monument target without a target planet or changed planet layout', async () => {
    const before = await f.db.select({ id: planets.id, x: planets.x, y: planets.y, z: planets.z }).from(planets);
    const wave = await insertWave();
    expect(wave.monumentId).toBe(target.id);
    expect(wave.originPlanetId).toBe(f.planetIds[0]);
    expect(target).toMatchObject({ capacity: 7270, productionPerMinute: 60, generation: 0, controllerPlayerId: null, controllerClanId: null });
    expect(await f.db.select({ id: planets.id, x: planets.x, y: planets.y, z: planets.z }).from(planets)).toEqual(before);
  });

  it('stores exact sub-bp damage and fractional cargo separately from wave ownership/research', async () => {
    const wave = await insertWave();
    const input = { waveId: wave.id, hull: 'COURIER' as const, count: 2, damageBp: 2000, remainderBp: 0.375, deuterium: 300.125 };
    const [stored] = await f.db.insert(monumentShipLots).values(input).returning();
    expect(stored).toMatchObject(input);
    expect(wave.tech).toEqual({ SHIP_ARMOR: 4, CARGO_HOLDS: 2 });
    expect(wave.playerId).toBe(f.playerIds[0]);
  });

  it('ties partial return fragments to the original wave without creating another bay identity', async () => {
    const root = await insertWave();
    const [part] = await f.db.insert(monumentWaves).values(waveInput({ rootWaveId: root.id, status: 'RETURNING', returnReason: 'RECALLED' })).returning();
    expect(part?.rootWaveId).toBe(root.id);
    expect(part?.unitLocation).not.toBe(root.unitLocation);
  });

  it('prevents a cross-season monument target even when both seasons exist', async () => {
    const other = await createSeason(f.db, { days: 30, shardCode: 'OTHER-MONUMENT', seed: 5000, startsAt: f.clock.now(), playerCap: 60, rulesetVersion: 1 });
    await expect(f.db.insert(monumentWaves).values(waveInput({ seasonId: other.season.id }))).rejects.toMatchObject({ cause: { code: '23503' } });
  });

  it('rejects invalid or repeated monument ordinals and malformed geometry/rates', async () => {
    await expect(f.db.insert(monuments).values(monumentInput())).rejects.toMatchObject({ cause: { code: '23505' } });
    for (const over of [{ ordinal: 0 }, { ordinal: 6 }, { capacity: -1 }, { productionPerMinute: -1 }, { productionPerMinute: Number.NaN }, { x: Number.POSITIVE_INFINITY }, { y: Number.NaN }]) {
      await expect(f.db.insert(monuments).values({ ...monumentInput(), ordinal: 2, ...over })).rejects.toMatchObject({ cause: { code: '23514' } });
    }
  });

  it('does not accept invalid owners/origins or reused unit parking locations', async () => {
    await expect(f.db.insert(monumentWaves).values(waveInput({ playerId: randomUUID() }))).rejects.toMatchObject({ cause: { code: '23503' } });
    await expect(f.db.insert(monumentWaves).values(waveInput({ originPlanetId: randomUUID() }))).rejects.toMatchObject({ cause: { code: '23503' } });
    await expect(f.db.insert(monumentWaves).values(waveInput({ unitLocation: 'home' }))).rejects.toMatchObject({ cause: { code: '23514' } });
    const root = await insertWave();
    await expect(f.db.insert(monumentWaves).values(waveInput({ unitLocation: root.unitLocation }))).rejects.toMatchObject({ cause: { code: '23514' } });
  });

  it('requires consistent lifecycle timestamps and refuses negative reservations/fuel', async () => {
    const wave = await insertWave();
    for (const over of [{ reservedBulk: -1 }, { fuelPaid: -1 }, { fuelPaid: Number.NaN }, { status: 'HOLD' as const }, { status: 'HOME' as const }, { status: 'LOST' as const }, { status: 'RETURNING' as const }]) {
      await expect(f.db.update(monumentWaves).set(over).where(eq(monumentWaves.id, wave.id))).rejects.toMatchObject({ cause: { code: '23514' } });
    }
    await expect(f.db.execute(sql`UPDATE monument_waves SET status = 'unknown' WHERE id = ${wave.id}`)).rejects.toMatchObject({ cause: { code: '23514' } });
    await expect(f.db.update(monumentWaves).set({ arriveAt: new Date(f.clock.now().getTime() - 1) }).where(eq(monumentWaves.id, wave.id))).rejects.toMatchObject({ cause: { code: '23514' } });
    await f.db.update(monumentWaves).set({ status: 'HOLD', heldAt: f.clock.now(), arriveAt: null }).where(eq(monumentWaves.id, wave.id));
    await f.db.update(monumentWaves).set({ status: 'HOME', resolvedAt: f.clock.now() }).where(eq(monumentWaves.id, wave.id));
    expect((await f.db.select().from(monumentWaves))[0]?.status).toBe('HOME');
  });

  it('refuses impossible health, count, nonfinite cargo and cargo on combat hulls', async () => {
    const wave = await insertWave();
    const input = { waveId: wave.id, hull: 'COURIER' as const, count: 1, damageBp: 0, remainderBp: 0, deuterium: 0 };
    for (const over of [{ count: 0 }, { count: -1 }, { damageBp: 10000 }, { damageBp: -1 }, { remainderBp: -0.1 }, { remainderBp: 1 }, { remainderBp: Number.NaN }, { deuterium: -1 }, { deuterium: Number.POSITIVE_INFINITY }, { deuterium: Number.NaN }, { hull: 'DART' as const, deuterium: 1 }]) {
      await expect(f.db.insert(monumentShipLots).values({ ...input, ...over })).rejects.toMatchObject({ cause: { code: '23514' } });
    }
    await expect(f.db.execute(sql`INSERT INTO monument_ship_lots (wave_id, hull, count, damage_bp, remainder_bp, deuterium) VALUES (${wave.id}, 'PROSPECTOR', 1, 0, 0, 0)`)).rejects.toMatchObject({ cause: { code: '23514' } });
  });

  it('rolls back a wave and its manifest together when persistence fails', async () => {
    await expect(f.db.transaction(async (tx) => {
      const [wave] = await tx.insert(monumentWaves).values(waveInput()).returning();
      await tx.insert(monumentShipLots).values({ waveId: wave!.id, hull: 'COURIER', count: 1, damageBp: 0, remainderBp: 0.125, deuterium: 0.25 });
      throw new Error('fixture rollback');
    })).rejects.toThrow('fixture rollback');
    expect(await f.db.select().from(monumentWaves)).toHaveLength(0);
    expect(await f.db.select().from(monumentShipLots)).toHaveLength(0);
  });

  it('cascades target/wave/manifest cleanup and refuses an origin deletion before reanchoring', async () => {
    // A bare origin has no buildings/units/missions whose older foreign keys
    // could reject the deletion for the wrong reason.
    const [origin] = await f.db.insert(planets).values({
      seasonId: f.seasonId, controllerPlayerId: f.playerIds[0]!, kind: 'COLONY',
      name: 'bare origin', slotIndex: 987654, x: 0, y: 0, z: 0,
    }).returning();
    const [wave] = await f.db.insert(monumentWaves).values(waveInput({ originPlanetId: origin!.id })).returning();
    if (!wave) throw new Error('missing fixture wave');
    await f.db.insert(monumentShipLots).values({ waveId: wave.id, hull: 'COURIER', count: 1, damageBp: 0, remainderBp: 0, deuterium: 1 });
    await expect(f.db.delete(planets).where(eq(planets.id, wave.originPlanetId))).rejects.toMatchObject({ cause: { code: '23503', constraint_name: 'monument_waves_origin_planet_id_planets_id_fk' } });
    await f.db.delete(monuments).where(eq(monuments.id, target.id));
    expect(await f.db.select().from(monumentWaves)).toHaveLength(0);
    expect(await f.db.select().from(monumentShipLots)).toHaveLength(0);
  });

  it('keeps HP source history after the monument is deleted, with its exact active interval', async () => {
    const [source] = await f.db.insert(hpRadiationSources).values(sourceInput()).returning();
    const endedAt = new Date(f.clock.now().getTime() + 600_000);
    await f.db.update(hpRadiationSources).set({ activeUntil: endedAt }).where(eq(hpRadiationSources.id, source!.id));
    await f.db.delete(monuments).where(eq(monuments.id, target.id));
    expect((await f.db.select().from(hpRadiationSources))[0]).toMatchObject({ anchorId: target.id, intensityHpPerMinute: 3, activeFrom: f.clock.now(), activeUntil: endedAt });
  });

  it('refuses malformed source rate, geometry, anchor and historical windows', async () => {
    for (const over of [{ radius: 0 }, { intensityHpPerMinute: -1 }, { intensityHpPerMinute: Number.NaN }, { radius: Number.POSITIVE_INFINITY }, { z: Number.NaN }, { anchorId: null }, { anchorKind: 'ZONE' as const }, { activeUntil: new Date(f.clock.now().getTime() - 1) }]) {
      await expect(f.db.insert(hpRadiationSources).values({ ...sourceInput(), ...over })).rejects.toMatchObject({ cause: { code: '23514' } });
    }
  });

  it('can run the migration again without erasing physical cargo', async () => {
    const wave = await insertWave();
    await f.db.insert(monumentShipLots).values({ waveId: wave.id, hull: 'COURIER', count: 1, damageBp: 2000, remainderBp: 0.125, deuterium: 0.375 });
    await runMigrations(f.db);
    expect((await f.db.select().from(monumentShipLots))[0]).toMatchObject({ deuterium: 0.375, remainderBp: 0.125 });
  });
});
