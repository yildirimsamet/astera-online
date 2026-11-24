import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MOON, hashSeed, rollMoonBirth, type MoonRarity } from '@astera/rules';
import { galaxyEvents, moons, planets, seasons } from '../src/db/schema.js';
import * as moonModule from '../src/services/moon.js';
import * as birthModule from '../src/services/moonBirth.js';
import { settleMoonBirth } from '../src/services/moonBirth.js';
import { launchAttack } from '../src/services/mission.js';
import { EventWorker } from '../src/worker/loop.js';
import { fuelUp, giveUnits, levelWorld, seedWorld, setLevel, settledAt, testDb, type Fixture } from './helpers.js';

/*
  F6 (S9, S11, S44, S53, V16, V18; plan §6.13): a battle with a big wreck over a held world may give birth to a
  moon, if the holder has researched Lunar Capture. Seeded by the battle, so the same battle always rolls the
  same moon. A rarer moon takes the world's place; a commoner one changes nothing. The galaxy hears that a moon
  was born, never its rarity.
*/
const WRECK = 100_000;

/** A battle id whose seeded roll gives this rarity (or nothing). */
function battleRolling(want: MoonRarity | null, wreck = WRECK): string {
  for (let i = 0; i < 100_000; i += 1) {
    const id = randomUUID();
    if (rollMoonBirth(hashSeed('moon-birth', id), wreck) === want) return id;
  }
  throw new Error(`no battle rolls ${String(want)}`);
}

describe('a moon born in battle', () => {
  let f: Fixture;
  let world: string;

  beforeEach(async () => {
    f = await seedWorld(2, 20_193);
    world = f.planetIds[1]!;
    await f.db.update(seasons).set({ rulesetVersion: MOON.rulesetVersion }).where(eq(seasons.id, f.seasonId));
    vi.spyOn(moonModule, 'holdsLunarCapture').mockResolvedValue(true);
  });
  afterEach(() => { vi.restoreAllMocks(); });
  afterAll(async () => { await (await testDb()).close(); });

  const born = (missionId: string, wreck = WRECK) =>
    f.db.transaction((tx) => settleMoonBirth(tx, { planetId: world, missionId, wreck, now: f.clock.now() }));
  const moonOf = async () => (await f.db.select().from(moons).where(eq(moons.planetId, world)))[0];

  it('writes a moon from the battle’s seeded roll, and the galaxy hears without the rarity', async () => {
    const id = battleRolling('EPIC');
    expect(await born(id)).toBe('EPIC');
    expect(await moonOf()).toMatchObject({ rarity: 'EPIC', origin: 'BATTLE', bornMissionId: id, cracks: 0 });
    const [news] = await f.db.select().from(galaxyEvents).where(and(eq(galaxyEvents.kind, 'moon_born'), eq(galaxyEvents.refId, id)));
    expect(news?.subjectPlanetId).toBe(world);
    expect(news?.payload).not.toHaveProperty('rarity');
  });

  it('a rarer moon takes the place of the old one, healed and charged; a commoner one changes nothing (S11)', async () => {
    await f.db.insert(moons).values({ planetId: world, rarity: 'RARE', origin: 'BUILT', visualSeed: 1, bornAt: f.clock.now(),
      cracks: 3, lastHitAt: f.clock.now(), closedUntil: new Date(f.clock.now().getTime() + 3_600_000), gateReadyAt: new Date(f.clock.now().getTime() + 3_600_000) });
    expect(await born(battleRolling('COMMON'))).toBeNull();
    expect((await moonOf())?.rarity).toBe('RARE');
    const id = battleRolling('LEGENDARY');
    expect(await born(id)).toBe('LEGENDARY');
    expect(await moonOf()).toMatchObject({ rarity: 'LEGENDARY', origin: 'BATTLE', cracks: 0, lastHitAt: null, closedUntil: null, gateReadyAt: null });
  });

  it('needs the holder’s Lunar Capture, a held world and a wreck past the floor (S9, S44)', async () => {
    vi.spyOn(moonModule, 'holdsLunarCapture').mockResolvedValue(false);
    expect(await born(battleRolling('RARE'))).toBeNull();
    vi.spyOn(moonModule, 'holdsLunarCapture').mockResolvedValue(true);
    expect(await born(randomUUID(), MOON.birth.minWreck - 1)).toBeNull();
    await f.db.update(planets).set({ kind: 'NEUTRAL', controllerPlayerId: null, statsOwnerPlayerId: null }).where(eq(planets.id, world));
    expect(await born(battleRolling('RARE'))).toBeNull();
    expect(await moonOf()).toBeUndefined();
  });

  it('a raid over the world rolls from its whole wreck, before any collector (V16, S44)', async () => {
    const roll = vi.spyOn(birthModule, 'settleMoonBirth');
    for (const id of f.planetIds) {
      await setLevel(f.db, id, 'CORE', 8);
      await setLevel(f.db, id, 'SHIPYARD', 4);
    }
    await levelWorld(f.db, f.planetIds);
    await fuelUp(f.db, f.planetIds[0]!);
    await giveUnits(f.db, f.planetIds[0]!, { DART: 60 });
    await giveUnits(f.db, world, { DART: 40 });
    f.clock.advance(250);
    const raid = await launchAttack(f.db, f.planetIds[0]!, world, { DART: 60 }, f.clock);
    f.clock.set(settledAt(raid.arriveAt));
    await new EventWorker(f.db, f.clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, pino({ level: 'silent' })).tick();
    expect(roll).toHaveBeenCalledTimes(1);
    expect(roll.mock.calls[0]![1]).toMatchObject({ planetId: world, missionId: raid.missionId });
    expect(roll.mock.calls[0]![1].wreck).toBeGreaterThan(0);
  });

  it('rolls nothing in a galaxy without moons', async () => {
    await f.db.update(seasons).set({ rulesetVersion: MOON.rulesetVersion - 1 }).where(eq(seasons.id, f.seasonId));
    expect(await born(battleRolling('RARE'))).toBeNull();
  });
});
