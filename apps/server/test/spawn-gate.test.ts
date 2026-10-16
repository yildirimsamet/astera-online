import { and, eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ASTEROID_DYNAMIC, GALAXY_EVENTS } from '@astera/rules';
import { FixedClock } from '../src/clock.js';
import { asteroidClaims, asteroidSpawnHours, botProfiles, galaxyEventOccurrences, players, seasons, spawnGateSkips } from '../src/db/schema.js';
import { createSeason } from '../src/services/season.js';
import { joinSeason } from '../src/services/player.js';
import { loadMiningSnapshot, projectVisibleAsteroids } from '../src/services/mining.js';
import { loadPirateSnapshot } from '../src/services/pirateField.js';
import { activateSpawnGate, advanceSpawnGate } from '../src/services/spawnGate.js';
import { makeAccount, testDb, truncateAll } from './helpers.js';

/**
 * Owner rule, 2026-10-17: outside asteroid showers the drifting rocks — and, always, the
 * pirate fleets — never outnumber the people who played in the last five minutes. The worker
 * checks each planned birth once and stores the skips; every read honours them.
 */
const START = new Date('2026-10-01T12:00:00.000Z');
const at = (minutes: number) => new Date(START.getTime() + minutes * 60_000);

beforeEach(async () => {
  vi.stubEnv('PIRATE_BALANCE_V2_ENABLED', 'false');
  await truncateAll((await testDb()).db);
});
afterEach(() => { vi.unstubAllEnvs(); });
afterAll(async () => { await (await testDb()).close(); });

async function galaxy(people: number, bots = 0) {
  const { db } = await testDb();
  const clock = new FixedClock(START);
  const { season } = await createSeason(db, { shardCode: 'EU-GATE', seed: 7171, startsAt: new Date(START.getTime() - 86_400_000 * 3), playerCap: 60, rulesetVersion: 16 });
  const playerIds: string[] = [];
  for (let i = 0; i < people + bots; i++) {
    const account = await makeAccount(db, `Gate${String(i)}`);
    await joinSeason(db, account.id, season.id, clock);
    const [row] = await db.select({ id: players.id }).from(players).where(eq(players.accountId, account.id));
    playerIds.push(row!.id);
    if (i >= people) await db.insert(botProfiles).values({ accountId: account.id, ordinal: i, persona: 'RAIDER', nextActionAt: START, createdAt: START });
  }
  await db.delete(asteroidSpawnHours).where(eq(asteroidSpawnHours.seasonId, season.id));
  await db.insert(asteroidSpawnHours).values({
    seasonId: season.id, hourStartsAt: START, spawnFrom: START, activePlayers: 40, eligiblePlayers: 40,
    lanes: [{ fromMinute: minutesOf(season.startsAt, START), untilMinute: minutesOf(season.startsAt, START) + 60, count: 30, frontCount: 0 }],
    levelWeights: [...ASTEROID_DYNAMIC.levelWeights], generation: null,
    pirateLane: { fromMinute: minutesOf(season.startsAt, START), untilMinute: minutesOf(season.startsAt, START) + 60, count: 20 },
    createdAt: START,
  });
  const online = async (minute: number) => {
    await db.update(players).set({ lastActiveAt: at(minute) }).where(eq(players.seasonId, season.id));
  };
  return { db, clock, season, playerIds, online };
}
const minutesOf = (from: Date, to: Date) => (to.getTime() - from.getTime()) / 60_000;

const drifting = async (seasonId: string, minute: number) => {
  const { db } = await testDb();
  const snapshot = await loadMiningSnapshot(db, seasonId, at(minute));
  return projectVisibleAsteroids(snapshot, at(minute)).filter((rock) => rock.oreRemaining > 0);
};
const pirates = async (seasonId: string, minute: number) =>
  (await loadPirateSnapshot((await testDb()).db, seasonId, at(minute))).standing(at(minute));

describe('activation', () => {
  it('previews without writing, applies once and refuses to move the epoch', async () => {
    const { db, clock, season } = await galaxy(2);
    expect(await activateSpawnGate(db, { seasonId: season.id, clock, apply: false })).toMatchObject({ status: 'READY', applied: false });
    const [before] = await db.select().from(seasons).where(eq(seasons.id, season.id));
    expect(before!.spawnGateFrom).toBeNull();
    expect(await activateSpawnGate(db, { seasonId: season.id, clock, apply: true })).toMatchObject({ status: 'READY', applied: true });
    clock.set(at(5));
    expect(await activateSpawnGate(db, { seasonId: season.id, clock, apply: true })).toMatchObject({ status: 'ALREADY_ACTIVE', applied: false });
    const [after] = await db.select().from(seasons).where(eq(seasons.id, season.id));
    expect(after!.spawnGateFrom?.getTime()).toBe(START.getTime());
    expect(after!.spawnGateThrough?.getTime()).toBe(START.getTime());
  });

  it('changes nothing while the gate is off', async () => {
    const { db, clock, season, online } = await galaxy(2);
    const open = (await drifting(season.id, 60)).length;
    await online(60);
    clock.set(at(60));
    expect(await advanceSpawnGate(db, { seasonId: season.id, clock })).toMatchObject({ status: 'OFF' });
    expect((await drifting(season.id, 60)).length).toBe(open);
    expect(open).toBeGreaterThan(2);
  });
});

describe('asteroids', () => {
  it('keeps the drifting rocks at the five-minute player count and stores every skip', async () => {
    const { db, clock, season, online } = await galaxy(2);
    await activateSpawnGate(db, { seasonId: season.id, clock, apply: true });
    await online(58);
    clock.set(at(60));
    const result = await advanceSpawnGate(db, { seasonId: season.id, clock });
    expect(result).toMatchObject({ status: 'ADVANCED', online: 2 });
    expect((await drifting(season.id, 60)).length).toBe(2);
    const skips = await db.select().from(spawnGateSkips).where(and(eq(spawnGateSkips.seasonId, season.id), eq(spawnGateSkips.kind, 'ASTEROID')));
    expect(skips.length).toBe(28);
  });

  it('hides births the worker has not decided yet', async () => {
    const { db, clock, season, online } = await galaxy(40);
    await activateSpawnGate(db, { seasonId: season.id, clock, apply: true });
    await online(30);
    clock.set(at(30));
    await advanceSpawnGate(db, { seasonId: season.id, clock });
    const decided = (await drifting(season.id, 60)).length;
    await online(60);
    clock.set(at(60));
    await advanceSpawnGate(db, { seasonId: season.id, clock });
    expect((await drifting(season.id, 60)).length).toBeGreaterThan(decided);
  });

  it('does not count bots as people', async () => {
    const { db, clock, season, online } = await galaxy(1, 3);
    await activateSpawnGate(db, { seasonId: season.id, clock, apply: true });
    await online(59);
    clock.set(at(60));
    expect(await advanceSpawnGate(db, { seasonId: season.id, clock })).toMatchObject({ online: 1 });
    expect((await drifting(season.id, 60)).length).toBe(1);
  });

  it('ignores commanders who last played more than five minutes ago', async () => {
    const { db, clock, season, online } = await galaxy(3);
    await activateSpawnGate(db, { seasonId: season.id, clock, apply: true });
    await online(54);
    clock.set(at(60));
    expect(await advanceSpawnGate(db, { seasonId: season.id, clock })).toMatchObject({ online: 0 });
    expect((await drifting(season.id, 60)).length).toBe(0);
  });

  it('never skips a rock born during an asteroid shower', async () => {
    const { db, clock, season, online } = await galaxy(1);
    await db.insert(galaxyEventOccurrences).values({
      seasonId: season.id, sequence: 900, kind: 'ASTEROID_SHOWER',
      definitionVersion: GALAXY_EVENTS.definitions.ASTEROID_SHOWER.version,
      startsAt: START, endsAt: at(60), effect: { asteroidSpawnMultiplier: 2 }, createdAt: START,
    });
    await activateSpawnGate(db, { seasonId: season.id, clock, apply: true });
    await online(59);
    clock.set(at(60));
    await advanceSpawnGate(db, { seasonId: season.id, clock });
    expect((await drifting(season.id, 60)).length).toBe(30);
  });

  it('frees a place when a rock is mined out', async () => {
    const { db, clock, season, online } = await galaxy(1);
    await activateSpawnGate(db, { seasonId: season.id, clock, apply: true });
    await online(30);
    clock.set(at(30));
    await advanceSpawnGate(db, { seasonId: season.id, clock });
    const [kept] = await drifting(season.id, 30);
    expect(kept).toBeDefined();
    await db.insert(asteroidClaims).values({ seasonId: season.id, index: kept!.index, oreTaken: kept!.ore, updatedAt: at(30) });
    await online(60);
    clock.set(at(60));
    await advanceSpawnGate(db, { seasonId: season.id, clock });
    const now = await drifting(season.id, 60);
    expect(now.length).toBe(1);
    expect(now[0]!.index).not.toBe(kept!.index);
  });

  it('never decides past an hour whose plan is not written yet, so a late hour is still gated', async () => {
    const { db, clock, season, online } = await galaxy(1);
    await activateSpawnGate(db, { seasonId: season.id, clock, apply: true });
    await online(62);
    clock.set(at(62));
    await advanceSpawnGate(db, { seasonId: season.id, clock });
    const [row] = await db.select().from(seasons).where(eq(seasons.id, season.id));
    expect(row!.spawnGateThrough?.getTime()).toBe(at(60).getTime());
    // The next hour is written late, with births from its first minute; nobody is online now.
    const base = minutesOf(season.startsAt, START);
    await db.insert(asteroidSpawnHours).values({
      seasonId: season.id, hourStartsAt: at(60), spawnFrom: at(60), activePlayers: 40, eligiblePlayers: 40,
      lanes: [{ fromMinute: base + 60, untilMinute: base + 120, count: 30, frontCount: 0 }],
      levelWeights: [...ASTEROID_DYNAMIC.levelWeights], generation: null, createdAt: at(63),
    });
    await db.update(players).set({ lastActiveAt: at(50) }).where(eq(players.seasonId, season.id));
    clock.set(at(63));
    await advanceSpawnGate(db, { seasonId: season.id, clock });
    const late = (await drifting(season.id, 63)).filter((rock) => rock.appearsAt > base + 60);
    expect(late).toHaveLength(0);
  });

  it('decides each birth once: a repeat at the same instant writes nothing', async () => {
    const { db, clock, season, online } = await galaxy(2);
    await activateSpawnGate(db, { seasonId: season.id, clock, apply: true });
    await online(59);
    clock.set(at(60));
    await advanceSpawnGate(db, { seasonId: season.id, clock });
    const first = await db.select().from(spawnGateSkips).where(eq(spawnGateSkips.seasonId, season.id));
    await online(60);
    expect(await advanceSpawnGate(db, { seasonId: season.id, clock })).toMatchObject({ status: 'UP_TO_DATE' });
    expect((await db.select().from(spawnGateSkips).where(eq(spawnGateSkips.seasonId, season.id))).length).toBe(first.length);
  });
});

describe('pirates', () => {
  it('keeps standing pirate fleets at the five-minute player count, showers or not', async () => {
    const { db, clock, season, online } = await galaxy(2);
    await db.insert(galaxyEventOccurrences).values({
      seasonId: season.id, sequence: 901, kind: 'ASTEROID_SHOWER',
      definitionVersion: GALAXY_EVENTS.definitions.ASTEROID_SHOWER.version,
      startsAt: START, endsAt: at(60), effect: { asteroidSpawnMultiplier: 2 }, createdAt: START,
    });
    await activateSpawnGate(db, { seasonId: season.id, clock, apply: true });
    await online(59);
    clock.set(at(60));
    await advanceSpawnGate(db, { seasonId: season.id, clock });
    const standing = (await pirates(season.id, 60)).filter((spec) => spec.appearsAt >= minutesOf(season.startsAt, START));
    expect(standing.length).toBe(2);
    const skips = await db.select().from(spawnGateSkips).where(and(eq(spawnGateSkips.seasonId, season.id), eq(spawnGateSkips.kind, 'PIRATE')));
    expect(skips.length).toBeGreaterThan(0);
  });
});
