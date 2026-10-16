import { randomUUID } from 'node:crypto';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, beforeEach, expect, it } from 'vitest';
import { DEATH_STAR, RADIATION_BOMB } from '@astera/rules';
import { hpRadiationSources, missions, notifications, planets, players, radiationBombFlights,
  scheduledEvents, seasons, strategicAssets, strategicImpacts, strategicInterceptions } from '../src/db/schema.js';
import { EventWorker } from '../src/worker/loop.js';
import { launchDeathStar } from '../src/services/strategic.js';
import { buildRadiationBomb, launchRadiationBomb } from '../src/services/radiationBomb.js';
import { bombInterceptionLeg } from '../src/services/radiationBombInterception.js';
import { interceptionLeg } from '../src/services/strategicInterception.js';
import { loadTrafficSnapshot, projectStrategicInterceptionImpacts, projectStrategicInterceptions } from '../src/services/traffic.js';
import { giveInstrument, giveSatellite, grant, placeAt, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

/**
 * A SALVO AGAINST A LOADED BATTERY. Owner, 2026-10-16: *"ard arda gönderilen füzeler (örn:
 * 500ms 1sn gibi kısa aralıklarla üst üste yollanan aynı veya farklı füze kombinasyonları) →
 * hedef gezegende şarjı yeten battery tarafından doğru düzgün şekilde vuruluyor mu?"*
 *
 * Mixed weapons half a second apart, walked through the real worker: the battery spends one
 * charge per weapon in the order the weapons cross its ring, never two on one weapon and
 * never one on two, and every weapon past the last charge lands as a real hit.
 */

const silent = pino({ level: 'silent' });
let f: Fixture;
let origin: string;
let target: string;

beforeEach(async () => {
  f = await seedWorld(4);
  [origin, target] = f.planetIds as [string, string];
  await f.db.update(seasons).set({ radiationBombStartsAt: f.clock.now(), rulesetVersion: 18 }).where(eq(seasons.id, f.seasonId));
  await f.db.update(players).set({ newcomerShieldUntil: null, recoveryShieldUntil: null });
  for (const id of [origin, target]) {
    await setLevel(f.db, id, 'CORE', 13);
    await setLevel(f.db, id, 'SHIPYARD', 5);
    await grant(f.db, id, 900000, 900000);
    await f.db.update(planets).set({ deuterium: 900000 }).where(eq(planets.id, id));
  }
  await placeAt(f.db, origin, { x: 5000 });
  await placeAt(f.db, target, { x: 0 });
  await giveSatellite(f.db, target, 'UPLINK');
  await giveInstrument(f.db, target, 'RADAR', 3);
});
afterAll(async () => { await (await testDb()).close(); });

interface Weapon { kind: 'DS' | 'BOMB'; id: string; arriveAt: Date }

const charges = async (count: number) => {
  for (let n = 0; n < count; n++) {
    await f.db.insert(strategicAssets).values({ planetId: target, type: 'INTERCEPTOR', status: 'READY',
      startedAt: f.clock.now(), readyAt: f.clock.now() });
  }
};
const deathStar = async (): Promise<Weapon> => {
  await f.db.insert(strategicAssets).values({ planetId: origin, status: 'READY', startedAt: f.clock.now(), remainingSeconds: 0 });
  const launched = await launchDeathStar(f.db, origin, target, f.clock);
  return { kind: 'DS', id: launched.missionId, arriveAt: launched.arriveAt };
};
const bomb = async (level: 1 | 2 | 3): Promise<Weapon> => {
  const asset = await buildRadiationBomb(f.db, origin, level, f.clock, f.playerIds[0]);
  await f.db.update(strategicAssets).set({ status: 'READY' }).where(eq(strategicAssets.id, asset.assetId));
  const launched = await launchRadiationBomb(f.db, { playerId: f.playerIds[0]!, originPlanetId: origin,
    target: { kind: 'PLANET', id: target }, level, key: randomUUID(), clock: f.clock });
  return { kind: 'BOMB', id: launched.flightId, arriveAt: new Date(launched.arriveAt) };
};
const halfSecond = () => { f.clock.set(new Date(f.clock.now().getTime() + 500)); };

/** The instant each weapon crosses the target's interception ring. */
const ringCrossing = async (weapon: Weapon): Promise<number> => {
  if (weapon.kind === 'DS') {
    const [mission] = await f.db.select().from(missions).where(eq(missions.id, weapon.id));
    const leg = await f.db.transaction(tx => interceptionLeg(tx, mission!));
    return mission!.arriveAt.getTime() - leg!.radarLead * 60_000;
  }
  const [flight] = await f.db.select().from(radiationBombFlights).where(eq(radiationBombFlights.id, weapon.id));
  const leg = await f.db.transaction(tx => bombInterceptionLeg(tx, flight!));
  return flight!.arriveAt.getTime() - leg!.radarLead * 60_000;
};

/** Walk the queue the way a one-second worker does, through the last arrival. */
const fly = async (last: Date) => {
  const worker = new EventWorker(f.db, f.clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, silent);
  for (let step = 0; step < 120; step++) {
    const [next] = await f.db.select({ at: scheduledEvents.resolveAt }).from(scheduledEvents)
      .where(eq(scheduledEvents.status, 'pending')).orderBy(asc(scheduledEvents.resolveAt)).limit(1);
    if (!next || next.at > new Date(last.getTime() + 20_000)) break;
    if (next.at > f.clock.now()) f.clock.set(next.at);
    await worker.tick();
  }
};

const outcome = async (weapon: Weapon) => {
  if (weapon.kind === 'BOMB') {
    const [flight] = await f.db.select().from(radiationBombFlights).where(eq(radiationBombFlights.id, weapon.id));
    return { status: flight!.status, chargeId: flight!.chargeId };
  }
  const [interception] = await f.db.select().from(strategicInterceptions).where(eq(strategicInterceptions.missionId, weapon.id));
  const [impact] = await f.db.select().from(strategicImpacts).where(eq(strategicImpacts.missionId, weapon.id));
  return { status: interception ? 'INTERCEPTED' : impact?.outcome ?? 'NONE', chargeId: interception?.chargeId ?? null };
};

it('spends one charge per weapon in ring order and lets the rest of a mixed salvo land', async () => {
  await charges(2);
  const salvo = [await deathStar()];
  halfSecond();
  salvo.push(await bomb(1));
  halfSecond();
  salvo.push(await bomb(2));
  const crossings = await Promise.all(salvo.map(ringCrossing));
  const order = salvo.map((weapon, index) => ({ weapon, at: crossings[index]! })).toSorted((a, b) => a.at - b.at);
  await fly(new Date(Math.max(...salvo.map(weapon => weapon.arriveAt.getTime()))));

  const results = await Promise.all(order.map(({ weapon }) => outcome(weapon)));
  expect(results.map(result => result.status)).toEqual(['INTERCEPTED', 'INTERCEPTED',
    order[2]!.weapon.kind === 'DS' ? 'FIRST_STRIKE' : 'HIT']);
  const spent = results.flatMap(result => result.chargeId ? [result.chargeId] : []);
  expect(new Set(spent).size).toBe(2);
  const battery = await f.db.select().from(strategicAssets).where(and(eq(strategicAssets.planetId, target), eq(strategicAssets.type, 'INTERCEPTOR')));
  expect(battery.map(row => row.status).sort()).toEqual(['CONSUMED', 'CONSUMED']);

  // Only the weapon that landed leaves a mark on the world.
  const landed = order[2]!.weapon;
  expect(await f.db.select().from(hpRadiationSources)).toHaveLength(landed.kind === 'BOMB' ? 1 : 0);
  const notices = await f.db.select().from(notifications).where(inArray(notifications.refId, salvo.map(weapon => weapon.id)));
  for (const { weapon } of order.slice(0, 2)) {
    expect(notices.filter(notice => notice.refId === weapon.id && notice.kind === 'strategic_intercepted')).toHaveLength(2);
    expect(notices.filter(notice => notice.refId === weapon.id
      && (notice.kind === 'radiation_bomb_result' || notice.kind === 'death_star_result'))).toHaveLength(0);
  }
});

it('takes the weapons in the order they reach the ring, not the order they left', async () => {
  await charges(1);
  const first = await bomb(1);
  halfSecond();
  const faster = await deathStar();
  // The Death Star is the faster weapon, so it can overtake a bomb that left first.
  expect(DEATH_STAR.speed).toBeGreaterThan(RADIATION_BOMB.speed);
  const [bombCrossing, deathStarCrossing] = await Promise.all([ringCrossing(first), ringCrossing(faster)]);
  await fly(new Date(Math.max(first.arriveAt.getTime(), faster.arriveAt.getTime())));
  const [shotFirst, landedSecond] = bombCrossing <= deathStarCrossing ? [first, faster] : [faster, first];
  expect((await outcome(shotFirst)).status).toBe('INTERCEPTED');
  expect((await outcome(landedSecond)).status).toBe(landedSecond.kind === 'DS' ? 'FIRST_STRIKE' : 'HIT');
});

/**
 * EVERY AIRBORNE COLLISION IS STILL ON THE MAP WHILE IT BURNS. A refetch lands a second or so
 * after a collision (the `impact` shard is coalesced). An intercepted bomb's row was kept
 * for eight seconds from the interceptor's LAUNCH — which is the collision instant itself —
 * so that refetch dropped it: a bystander never saw the bomb die, and both sides watched
 * the fireball vanish mid-burn. A Death Star's row counts from its collision, and so must a bomb's.
 */
it('keeps each shot of a salvo on the map for its whole explosion, for both sides and a bystander', async () => {
  await charges(4);
  const salvo = [await bomb(1)];
  halfSecond();
  salvo.push(await bomb(2));
  halfSecond();
  salvo.push(await deathStar());
  const last = new Date(Math.max(...salvo.map(weapon => weapon.arriveAt.getTime())));
  // Read the scenes the attacker is served while every collision is still in the air.
  const worker = new EventWorker(f.db, f.clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, silent);
  let scenes: ReturnType<typeof projectStrategicInterceptions> = [];
  for (let step = 0; step < 120 && scenes.length < salvo.length; step++) {
    const [next] = await f.db.select({ at: scheduledEvents.resolveAt }).from(scheduledEvents)
      .where(eq(scheduledEvents.status, 'pending')).orderBy(asc(scheduledEvents.resolveAt)).limit(1);
    if (!next || next.at > last) break;
    if (next.at > f.clock.now()) f.clock.set(next.at);
    await worker.tick();
    scenes = projectStrategicInterceptions(await loadTrafficSnapshot(f.db, f.seasonId, f.clock.now()), f.playerIds[0]!, []);
  }
  expect(scenes).toHaveLength(3);
  expect(new Set(scenes.map(scene => scene.id)).size).toBe(3);
  // Each scene names the weapon it killed, so no screen can still land that weapon.
  expect(scenes.map(scene => scene.weaponId).toSorted()).toEqual(salvo.map(weapon => weapon.id).toSorted());
  for (const scene of scenes) {
    expect(scene.impactAt.getTime()).toBeGreaterThan(scene.launchAt.getTime());
    // The read that follows the collision's own `impact` shard, a second or so later.
    const refetch = new Date(scene.impactAt.getTime() + 1_000);
    const snapshot = await loadTrafficSnapshot(f.db, f.seasonId, refetch);
    for (const side of [f.playerIds[0]!, f.playerIds[1]!]) {
      expect(projectStrategicInterceptions(snapshot, side, []).map(view => view.id)).toContain(scene.id);
    }
    const moments = projectStrategicInterceptionImpacts(snapshot, f.playerIds[3]!, [], refetch);
    expect(moments.find(moment => moment.id === scene.id)).toMatchObject({ at: scene.impactAt, weaponId: scene.weaponId });
  }
});
