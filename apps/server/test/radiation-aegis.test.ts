import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, expect, it } from 'vitest';
import { HULLS, SHIELD, shieldHp } from '@astera/rules';
import { hpRadiationSources, planets, seasons } from '../src/db/schema.js';
import { loadLocked, saveResources } from '../src/services/planet.js';
import { workshopRadiation } from '../src/services/workshop.js';
import { buildOrders } from '../src/db/schema.js';
import { applyBuildCompletion } from '../src/services/buildQueue.js';
import { readHomeHealth } from '../src/services/homeHealth.js';
import { planetView } from '../src/services/planetView.js';
import { giveInstrument, giveResearch, giveUnits, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

let f: Fixture;
let home: string;
beforeEach(async () => {
  f = await seedWorld(1);
  home = f.planetIds[0]!;
  await f.db.update(seasons).set({ rulesetVersion: 18, radiationBombStartsAt: f.clock.now() }).where(eq(seasons.id, f.seasonId));
  await setLevel(f.db, home, 'CORE', 12);
  await giveInstrument(f.db, home, 'AEGIS', 10);
  await giveUnits(f.db, home, { CITADEL: 1 });
  await f.db.update(planets).set({ shield: 500 }).where(eq(planets.id, home));
  await f.db.insert(hpRadiationSources).values({ seasonId: f.seasonId, anchorKind: 'PLANET', anchorId: home,
    origin: 'ENVIRONMENT', x: 0, y: 0, z: 0, radius: 1, mode: 'EMIT', intensityHpPerMinute: 18, activeFrom: f.clock.now() });
});
afterAll(async () => { await (await testDb()).close(); });
const damageHp = async () => {
  const [lot] = (await readHomeHealth(f.db, home)).damage;
  return lot ? (lot.damageBp + (lot.remainderBp ?? 0)) / 10000 * HULLS.CITADEL.hp : 0;
};

it('subtracts the charged planet Aegis before applying the ship commander’s research', async () => {
  await giveResearch(f.db, home, 'RADIATION_SHIELDING', 2);
  f.clock.advance(1);
  await f.db.transaction(tx => loadLocked(tx, home, f.clock));
  expect(await damageHp()).toBeCloseTo((18 - 10) * .68, 7);
});

it('caps combined sources before subtracting Aegis once', async () => {
  await f.db.insert(hpRadiationSources).values({ seasonId: f.seasonId, anchorKind: 'PLANET', anchorId: home,
    x: 0, y: 0, z: 0, radius: 1, mode: 'EMIT', intensityHpPerMinute: 40, activeFrom: f.clock.now() });
  f.clock.advance(1);
  await f.db.transaction(tx => loadLocked(tx, home, f.clock));
  expect(await damageHp()).toBeCloseTo(40, 7);
});

it('retains the first L1 source with zero damage, then deals 8 HP/min when a second L1 is added', async () => {
  await f.db.update(hpRadiationSources).set({ intensityHpPerMinute: 9 });
  f.clock.advance(1);
  await f.db.transaction(tx => loadLocked(tx, home, f.clock));
  expect(await damageHp()).toBe(0);
  expect(await f.db.select().from(hpRadiationSources)).toHaveLength(1);
  await f.db.insert(hpRadiationSources).values({ seasonId: f.seasonId, anchorKind: 'PLANET', anchorId: home,
    x: 0, y: 0, z: 0, radius: 1, mode: 'EMIT', intensityHpPerMinute: 9, activeFrom: f.clock.now() });
  f.clock.advance(1);
  await f.db.transaction(tx => loadLocked(tx, home, f.clock));
  expect(await damageHp()).toBeCloseTo(8, 7);
  expect(await f.db.select().from(hpRadiationSources)).toHaveLength(2);
});

it('does not grant Aegis protection while an EMP blocks its empty shield', async () => {
  await f.db.update(planets).set({ shield: 0, empUntil: new Date(f.clock.now().getTime() + 5 * 60000) }).where(eq(planets.id, home));
  f.clock.advance(1);
  await f.db.transaction(tx => loadLocked(tx, home, f.clock));
  expect(await damageHp()).toBeCloseTo(18, 7);
});

it('publishes planet protection separately from the commander’s ship research', async () => {
  await giveResearch(f.db, home, 'RADIATION_SHIELDING', 2);
  const view = await f.db.transaction(tx => planetView(tx, home, f.clock));
  expect(view.planet).toMatchObject({ radiationProtectionHpPerMinute: 10, radiationProtectionLevel: 10 });
});

it('keeps the workshop open when Aegis absorbs all radiation, and closes it as soon as the shield breaks', async () => {
  await f.db.update(hpRadiationSources).set({ intensityHpPerMinute: 9 });
  await f.db.transaction(async tx => {
    const world = await loadLocked(tx, home, f.clock);
    expect(await workshopRadiation(tx, world)).toBe(false);
    await saveResources(tx, home, { alloy: world.alloy, crystal: world.crystal, deuterium: world.deuterium, shield: 0 });
    const broken = await loadLocked(tx, home, f.clock);
    expect(await workshopRadiation(tx, broken)).toBe(true);
  });
});

it('starts recharge 15 minutes after depletion, then restores protection at 1 HP without repricing earlier exposure', async () => {
  const start = f.clock.now().getTime();
  await f.db.transaction(async tx => {
    const world = await loadLocked(tx, home, f.clock);
    await saveResources(tx, home, { alloy: world.alloy, crystal: world.crystal, deuterium: world.deuterium, shield: 0 });
  });
  f.clock.advance(15);
  const stillEmpty = await f.db.transaction(tx => loadLocked(tx, home, f.clock));
  expect(stillEmpty.shield).toBe(0);
  expect(stillEmpty.shieldRegenAt?.getTime()).toBe(start + 15 * 60000);
  expect(await damageHp()).toBeCloseTo(18 * 15, 6);
  f.clock.advance(1);
  const charged = await f.db.transaction(tx => loadLocked(tx, home, f.clock));
  expect(charged.shield).toBeGreaterThan(1);
  expect(await damageHp()).toBeGreaterThan(18 * 15 + 8);
  expect(await damageHp()).toBeLessThan(18 * 16);
});

it('refuses to settle past an overdue Aegis upgrade before its actual completion is reconciled', async () => {
  await f.db.transaction(tx => loadLocked(tx, home, f.clock));
  const readyAt = new Date(f.clock.now().getTime() + 60000);
  const [order] = await f.db.insert(buildOrders).values({ planetId: home, queue: 'CONSTRUCTION', slot: 0,
    kind: 'INSTRUMENT', subject: 'AEGIS', count: 1, startedAt: f.clock.now(), readyAt,
    remainingSeconds: 60, cost: { alloy: 1, crystal: 0, deuterium: 0 } }).returning();
  f.clock.advance(2);
  await expect(f.db.transaction(tx => loadLocked(tx, home, f.clock))).rejects.toMatchObject({ code: 'RADIATION_RESEARCH_PENDING' });
  await f.db.transaction(tx => applyBuildCompletion(tx, order!.id, readyAt.toISOString(), f.clock));
  await f.db.transaction(tx => loadLocked(tx, home, f.clock));
  expect(await damageHp()).toBeCloseTo(8 + 7, 7);
});

it('restores radiation protection at the first whole HP, with no cooldown extension from hitting an already empty shield', async () => {
  const start = f.clock.now().getTime();
  const deplete = () => f.db.transaction(async tx => {
    const world = await loadLocked(tx, home, f.clock);
    await saveResources(tx, home, { alloy: world.alloy, crystal: world.crystal, deuterium: world.deuterium, shield: 0 });
  });
  await deplete();
  f.clock.advance(5);
  await deplete();
  const [world] = await f.db.select().from(planets).where(eq(planets.id, home));
  expect(world!.shieldRegenAt!.getTime()).toBe(start + 15 * 60000);
  const firstHp = start + 15 * 60000 + Math.ceil(3600000 / (shieldHp(10) * SHIELD.regenPerHour));
  f.clock.set(new Date(firstHp - 1));
  const before = await f.db.transaction(tx => planetView(tx, home, f.clock));
  expect(before.planet.radiationProtectionHpPerMinute).toBe(0);
  f.clock.set(new Date(firstHp));
  const charged = await f.db.transaction(tx => planetView(tx, home, f.clock));
  expect(charged.planet.shield).toBeGreaterThanOrEqual(1);
  expect(charged.planet.radiationProtectionHpPerMinute).toBe(10);
});
