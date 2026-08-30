import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { SENSOR, asteroidPosition, sensorSphere, type SensorEpoch } from '@astera/rules';
import {
  asteroidId,
  asteroidIndexFromId,
  privateAsteroidField,
  projectPlayerAsteroidField,
} from '../src/services/asteroidField.js';
import { refreshSensorEpoch } from '../src/services/sensorHistory.js';
import { raiseInstrument } from '../src/services/build.js';
import { transferPlanetControl } from '../src/services/ownership.js';
import {
  buildOrders,
  planets,
  satellites,
  seasons,
  sensorEpochs,
} from '../src/db/schema.js';
import {
  giveInstrument,
  giveSatellite,
  grant,
  placeAt,
  seedWorld,
  settleBuilds,
  setLevel,
  testDb,
  type Fixture,
} from './helpers.js';

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

describe('private asteroid field identity', () => {
  const keyA = '00000000-0000-4000-8000-000000000001';
  const keyB = '00000000-0000-4000-8000-000000000002';

  it('is deterministic for one private season key', () => {
    expect(privateAsteroidField(keyA)).toEqual(privateAsteroidField(keyA));
  });

  it('changes the complete schedule when only the private key changes', () => {
    const a = privateAsteroidField(keyA).slice(0, 20);
    const b = privateAsteroidField(keyB).slice(0, 20);
    expect(a.map((rock) => rock.radius)).not.toEqual(b.map((rock) => rock.radius));
    expect(a.map((rock) => rock.appearsAt)).not.toEqual(b.map((rock) => rock.appearsAt));
  });

  it('keeps every generated orbit inside radius 2000 and preserves speed-derived periods', () => {
    for (const rock of privateAsteroidField(keyA)) {
      expect(rock.radius).toBeGreaterThanOrEqual(400);
      expect(rock.radius).toBeLessThanOrEqual(2_000);
      expect(rock.period).toBeCloseTo((Math.PI * 2 * rock.radius) / rock.speed, 10);
    }
  });

  it('uses stable, opaque, URL-safe ids which cannot be guessed from the internal index', () => {
    const ids = privateAsteroidField(keyA).slice(0, 2_000).map((rock) => asteroidId(keyA, rock.index));
    expect(new Set(ids).size).toBe(ids.length);
    for (const [index, id] of ids.entries()) {
      expect(id).toMatch(/^[A-Za-z0-9_-]{22}$/);
      expect(id).not.toBe(String(index));
      expect(asteroidId(keyA, index)).toBe(id);
      expect(asteroidId(keyB, index)).not.toBe(id);
    }
  });

  it('resolves only a valid id from the same season without accepting raw indexes', () => {
    const field = privateAsteroidField(keyA);
    const target = field[17]!;
    const id = asteroidId(keyA, target.index);
    expect(asteroidIndexFromId(keyA, field, id)).toBe(target.index);
    expect(asteroidIndexFromId(keyB, field, id)).toBeNull();
    expect(asteroidIndexFromId(keyA, field, String(target.index))).toBeNull();
    expect(asteroidIndexFromId(keyA, field, `${id}x`)).toBeNull();
  });
});

describe('caller-specific asteroid projection', () => {
  const key = '00000000-0000-4000-8000-000000000003';
  const startsAt = new Date('2026-01-01T00:00:00.000Z');
  const field = privateAsteroidField(key);
  const live = field.find((rock) => rock.appearsAt > 60 && rock.expiresAt - rock.appearsAt > 120)!;
  const nowMinutes = live.appearsAt + 60;
  const now = new Date(startsAt.getTime() + nowMinutes * 60_000);
  const at = asteroidPosition(live, live.appearsAt);

  const snapshot = {
    asteroids: field,
    startsAt,
    oreTaken: new Map<number, number>(),
    debris: [],
  };

  it('returns only rocks earned through this commander’s sensor history', () => {
    const epochs: SensorEpoch[] = [{ at, reach: 50, startsAt: 0, endsAt: null }];
    const result = projectPlayerAsteroidField(snapshot, key, epochs, now, false);
    expect(result.asteroids.some((rock) => rock.id === asteroidId(key, live.index))).toBe(true);
    expect(result.asteroids.every((rock) => !('index' in rock))).toBe(true);
  });

  it('does not leak rocks from the shared snapshot when the caller has no sensor history', () => {
    expect(projectPlayerAsteroidField(snapshot, key, [], now, false).asteroids).toEqual([]);
  });

  it('removes exhausted rocks and never reports a negative remainder', () => {
    const exhaustedSnapshot = {
      ...snapshot,
      oreTaken: new Map([[live.index, live.ore + 1]]),
    };
    const epochs: SensorEpoch[] = [{ at, reach: 50, startsAt: 0, endsAt: null }];
    expect(projectPlayerAsteroidField(exhaustedSnapshot, key, epochs, now, false).asteroids)
      .not.toContainEqual(expect.objectContaining({ id: asteroidId(key, live.index) }));
  });

  it('reveals isotope composition only with research and only for discovered rocks', () => {
    const rich = field.find((rock) => rock.isotopeRich)!;
    const richAt = asteroidPosition(rich, rich.appearsAt);
    const richNow = new Date(startsAt.getTime() + (rich.appearsAt + 1) * 60_000);
    const epochs: SensorEpoch[] = [{ at: richAt, reach: 100, startsAt: 0, endsAt: null }];
    const hidden = projectPlayerAsteroidField(snapshot, key, epochs, richNow, false);
    const revealed = projectPlayerAsteroidField(snapshot, key, epochs, richNow, true);
    expect(hidden.asteroids.find((rock) => rock.id === asteroidId(key, rich.index)))
      .toMatchObject({ isotopeRich: true, deuteriumShare: null });
    expect(revealed.asteroids.find((rock) => rock.id === asteroidId(key, rich.index)))
      .toMatchObject({ isotopeRich: true, deuteriumShare: rich.deuteriumShare });
  });

  it('names the next earned appearance or expiry so the client never has to poll rapidly', () => {
    const epochs: SensorEpoch[] = [{ at, reach: 50, startsAt: 0, endsAt: null }];
    const result = projectPlayerAsteroidField(snapshot, key, epochs, now, false);
    expect(result.nextFieldChangeAt).toBeInstanceOf(Date);
    expect(result.nextFieldChangeAt!.getTime()).toBeGreaterThan(now.getTime());
  });
});

describe('durable sensor history', () => {
  let f: Fixture;
  let planetId: string;

  beforeEach(async () => {
    f = await seedWorld(2, 7117);
    planetId = f.planetIds[0]!;
    await f.db.delete(sensorEpochs);
    await placeAt(f.db, planetId, { x: 1_700, y: 100, z: -50 });
  });

  it('opens a base-radius epoch and is idempotent when nothing changed', async () => {
    await refreshSensorEpoch(f.db, planetId, f.clock.now());
    await refreshSensorEpoch(f.db, planetId, f.clock.now());
    const rows = await f.db.select().from(sensorEpochs).where(eq(sensorEpochs.planetId, planetId));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      playerId: f.playerIds[0],
      x: 1_700,
      y: 100,
      z: -50,
      reach: SENSOR.baseRadius,
      endsAt: null,
    });
  });

  it('closes the old epoch at the exact level-change instant and opens the new reach', async () => {
    await refreshSensorEpoch(f.db, planetId, f.clock.now());
    f.clock.advance(10);
    await setLevel(f.db, planetId, 'CORE', 5);
    await giveSatellite(f.db, planetId, 'UPLINK');
    await giveInstrument(f.db, planetId, 'TELESCOPE', 3);
    await refreshSensorEpoch(f.db, planetId, f.clock.now());

    const rows = await f.db
      .select()
      .from(sensorEpochs)
      .where(eq(sensorEpochs.planetId, planetId))
      .orderBy(sensorEpochs.startsAt);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.endsAt).toEqual(f.clock.now());
    expect(rows[1]).toMatchObject({
      reach: sensorSphere({ x: 0, y: 0, z: 0 }, 3, 0).identify,
      endsAt: null,
    });
  });

  it('falls back to base reach when Uplink is lost without erasing old discoveries', async () => {
    await setLevel(f.db, planetId, 'CORE', 5);
    await giveSatellite(f.db, planetId, 'UPLINK');
    await giveInstrument(f.db, planetId, 'TELESCOPE', 3);
    await refreshSensorEpoch(f.db, planetId, f.clock.now());
    f.clock.advance(5);
    await f.db.delete(satellites).where(and(
      eq(satellites.planetId, planetId),
      eq(satellites.type, 'UPLINK'),
    ));
    await refreshSensorEpoch(f.db, planetId, f.clock.now());

    const rows = await f.db.select().from(sensorEpochs).where(eq(sensorEpochs.planetId, planetId));
    expect(rows).toHaveLength(2);
    const telescopeReach = sensorSphere({ x: 0, y: 0, z: 0 }, 3, 0).identify;
    expect(rows.some((row) => row.reach === telescopeReach && row.endsAt !== null)).toBe(true);
    expect(rows.some((row) => row.reach === SENSOR.baseRadius && row.endsAt === null)).toBe(true);
  });

  it('closes the previous owner and opens an independent epoch for the new owner', async () => {
    await refreshSensorEpoch(f.db, planetId, f.clock.now());
    f.clock.advance(5);
    await f.db.update(planets).set({ controllerPlayerId: f.playerIds[1], kind: 'COLONY' })
      .where(eq(planets.id, planetId));
    await refreshSensorEpoch(f.db, planetId, f.clock.now());
    const rows = await f.db.select().from(sensorEpochs).where(eq(sensorEpochs.planetId, planetId));
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.playerId === f.playerIds[0])?.endsAt).toEqual(f.clock.now());
    expect(rows.find((row) => row.playerId === f.playerIds[1])?.endsAt).toBeNull();
  });

  it('closes the epoch without opening another when a world becomes controller-less', async () => {
    await refreshSensorEpoch(f.db, planetId, f.clock.now());
    f.clock.advance(5);
    await f.db.update(planets).set({ controllerPlayerId: null, kind: 'NEUTRAL' })
      .where(eq(planets.id, planetId));
    await refreshSensorEpoch(f.db, planetId, f.clock.now());
    const rows = await f.db.select().from(sensorEpochs).where(eq(sensorEpochs.planetId, planetId));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.endsAt).toEqual(f.clock.now());
  });

  it('the season owns an independent private asteroid key', async () => {
    const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    expect(season!.asteroidKey).toMatch(/^[0-9a-f-]{36}$/i);
    expect(season!.asteroidKey).not.toBe(String(f.seed));
  });

  it('rejects overlapping open epochs for one world at the database boundary', async () => {
    const first = await f.db.select().from(sensorEpochs).limit(1);
    if (first.length === 0) await refreshSensorEpoch(f.db, planetId, f.clock.now());
    await expect(
      f.db.insert(sensorEpochs).values({
        id: randomUUID(),
        seasonId: f.seasonId,
        playerId: f.playerIds[0]!,
        planetId,
        x: 1_700,
        y: 100,
        z: -50,
        reach: SENSOR.baseRadius,
        startsAt: f.clock.now(),
      }),
    ).rejects.toBeDefined();
  });

  it('stores no impossible non-positive reach', async () => {
    await expect(
      f.db.insert(sensorEpochs).values({
        id: randomUUID(),
        seasonId: f.seasonId,
        playerId: f.playerIds[0]!,
        planetId,
        x: 0,
        y: 0,
        z: 0,
        reach: 0,
        startsAt: f.clock.now(),
      }),
    ).rejects.toBeDefined();
  });
});

describe('automatic sensor epoch lifecycle', () => {
  it('opens the initial base sensor epoch in the same join transaction', async () => {
    const f = await seedWorld(2, 7228);
    const rows = await f.db.select().from(sensorEpochs);
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((row) => row.playerId))).toEqual(new Set(f.playerIds));
    expect(rows.every((row) => row.reach === SENSOR.baseRadius && row.endsAt === null)).toBe(true);
  });

  it('refreshes the epoch at the exact Telescope completion instant', async () => {
    const f = await seedWorld(1, 7339);
    const planetId = f.planetIds[0]!;
    await f.db.delete(sensorEpochs);
    await setLevel(f.db, planetId, 'CORE', 5);
    await giveSatellite(f.db, planetId, 'UPLINK');
    await grant(f.db, planetId, 50_000, 20_000);
    await refreshSensorEpoch(f.db, planetId, f.clock.now());

    await raiseInstrument(f.db, planetId, 'TELESCOPE', f.clock);
    await raiseInstrument(f.db, planetId, 'TELESCOPE', f.clock);
    await settleBuilds(f, planetId);

    const rows = await f.db
      .select()
      .from(sensorEpochs)
      .where(eq(sensorEpochs.planetId, planetId))
      .orderBy(sensorEpochs.startsAt);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ reach: SENSOR.baseRadius, endsAt: rows[1]!.startsAt });
    expect(rows[1]).toMatchObject({
      reach: sensorSphere({ x: 0, y: 0, z: 0 }, 1, 0).identify,
      endsAt: rows[2]!.startsAt,
    });
    expect(rows[2]).toMatchObject({
      reach: sensorSphere({ x: 0, y: 0, z: 0 }, 2, 0).identify,
      startsAt: f.clock.now(),
      endsAt: null,
    });
  });

  it('uses the promised completion instant when a delayed worker applies Telescope later', async () => {
    const f = await seedWorld(1, 7391);
    const planetId = f.planetIds[0]!;
    await f.db.delete(sensorEpochs);
    await setLevel(f.db, planetId, 'CORE', 5);
    await giveSatellite(f.db, planetId, 'UPLINK');
    await giveInstrument(f.db, planetId, 'TELESCOPE', 1);
    await grant(f.db, planetId, 50_000, 20_000);
    await refreshSensorEpoch(f.db, planetId, f.clock.now());

    await raiseInstrument(f.db, planetId, 'TELESCOPE', f.clock);
    const [order] = await f.db
      .select()
      .from(buildOrders)
      .where(eq(buildOrders.planetId, planetId));
    const promisedAt = order!.readyAt;
    f.clock.set(new Date(promisedAt.getTime() + 6 * 60_000));
    await settleBuilds(f, planetId);

    const rows = await f.db
      .select()
      .from(sensorEpochs)
      .where(eq(sensorEpochs.planetId, planetId))
      .orderBy(sensorEpochs.startsAt);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      reach: sensorSphere({ x: 0, y: 0, z: 0 }, 1, 0).identify,
      endsAt: promisedAt,
    });
    expect(rows[1]).toMatchObject({
      reach: sensorSphere({ x: 0, y: 0, z: 0 }, 2, 0).identify,
      startsAt: promisedAt,
      endsAt: null,
    });
  });

  it('moves future sensing to the new owner inside the control-transfer transaction', async () => {
    const f = await seedWorld(2, 7450);
    const planetId = f.planetIds[0]!;
    await f.db.delete(sensorEpochs);
    await refreshSensorEpoch(f.db, planetId, f.clock.now());
    f.clock.advance(3);

    await f.db.transaction((tx) => transferPlanetControl(tx, {
      targetPlanetId: planetId,
      newPlayerId: f.playerIds[1]!,
      expectedControllerPlayerId: f.playerIds[0]!,
      now: f.clock.now(),
      protectedUntil: new Date(f.clock.now().getTime() + 60_000),
    }));

    const rows = await f.db
      .select()
      .from(sensorEpochs)
      .where(eq(sensorEpochs.planetId, planetId))
      .orderBy(sensorEpochs.startsAt);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ playerId: f.playerIds[0], endsAt: f.clock.now() });
    expect(rows[1]).toMatchObject({ playerId: f.playerIds[1], startsAt: f.clock.now(), endsAt: null });
  });
});
