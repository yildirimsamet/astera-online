import { setTimeout as delay } from 'node:timers/promises';
import { eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, expect, it } from 'vitest';
import { planets, players } from '../src/db/schema.js';
import { joinSeason } from '../src/services/player.js';
import { Projections, type ProjectionConfig } from '../src/services/projections.js';
import { createSeason } from '../src/services/season.js';
import { EventBus, publish, publishShard, type ShardEventKind } from '../src/stream/bus.js';
import { TEST_DATABASE_URL, makeAccount, seedWorld, testDb, type Fixture } from './helpers.js';

/**
 * ONE GALAXY'S NEWS IS NOT ANOTHER'S. Scaling plan F1.2 (M4).
 *
 * The main galaxy and the waiting room run in the same processes. Every
 * caller-keyed cache used to be cleared whole by any galaxy's ownership event, and
 * the placement map reset itself at its bound, after which every moved commander's
 * next request cleared everything again.
 */

afterAll(async () => { await (await testDb()).close(); });

const config: ProjectionConfig = {
  enabled: true, maxSeasons: 4, maxAccounts: 1024,
  commanderTtlMs: 60_000, publicTtlMs: 60_000, trafficTtlMs: 60_000, miningTtlMs: 60_000,
};

let f: Fixture;
let other: { seasonId: string; accountId: string; playerId: string; planetId: string };
let bus: EventBus;
let projections: Projections;
let stopBarrier = (): void => undefined;
let barriers = 0;

/** Every NOTIFY committed before this one has been dispatched. */
const settle = async (): Promise<void> => {
  const target = barriers + 1;
  await publish(f.db, f.playerIds[0]!, 'test-barrier');
  for (let n = 0; n < 200 && barriers < target; n++) await delay(5);
  expect(barriers).toBe(target);
};

const shardEvent = async (seasonId: string, kind: ShardEventKind): Promise<void> => {
  await publishShard(f.db, seasonId, kind);
  await settle();
};

const start = async (overrides: Partial<ProjectionConfig> = {}): Promise<void> => {
  bus = new EventBus(TEST_DATABASE_URL, pino({ level: 'silent' }));
  projections = new Projections(f.db, bus, { ...config, ...overrides });
  stopBarrier = bus.observe(event => { if (event.kind === 'test-barrier') barriers++; });
  await bus.start();
};

beforeEach(async () => {
  f = await seedWorld(2);
  const { season } = await createSeason(f.db, { shardCode: 'ISOLATION-B', seed: 77, startsAt: f.clock.now() });
  const account = await makeAccount(f.db, 'Elsewhere');
  const joined = await joinSeason(f.db, account.id, season.id, f.clock);
  other = { seasonId: season.id, accountId: account.id, playerId: joined.playerId, planetId: joined.planetId };
});

afterEach(async () => {
  stopBarrier();
  projections.close();
  await bus.stop();
});

/** The four caller-keyed projections, read for one commander. */
const privateView = async (accountId: string) => {
  const self = await projections.commander(accountId);
  return {
    commander: self,
    sensors: await projections.sensorsFor(self.playerId, self.seasonId, self.planetIds),
    remembered: await projections.rememberedFor(self.playerId, self.seasonId),
    history: await projections.historyFor(self.playerId, self.seasonId),
  };
};

const expectSame = (actual: Awaited<ReturnType<typeof privateView>>, expected: typeof actual): void => {
  expect(actual.commander).toBe(expected.commander);
  expect(actual.sensors).toBe(expected.sensors);
  expect(actual.remembered).toBe(expected.remembered);
  expect(actual.history).toBe(expected.history);
};

const expectFresh = (actual: Awaited<ReturnType<typeof privateView>>, expected: typeof actual): void => {
  expect(actual.commander).not.toBe(expected.commander);
  expect(actual.sensors).not.toBe(expected.sensors);
  expect(actual.remembered).not.toBe(expected.remembered);
  expect(actual.history).not.toBe(expected.history);
};

it.each<ShardEventKind>(['world', 'control', 'season', 'rollover'])(
  'an ownership event (shard:%s) in one galaxy keeps the other galaxy\'s commanders warm',
  async (kind) => {
    await start();
    const here = await privateView(f.accountIds[0]!);
    const there = await privateView(other.accountId);
    const thereWorlds = await projections.worlds(other.seasonId, f.clock.now());

    await shardEvent(f.seasonId, kind);

    expectFresh(await privateView(f.accountIds[0]!), here);
    expectSame(await privateView(other.accountId), there);
    expect(await projections.worlds(other.seasonId, f.clock.now())).toBe(thereWorlds);
    expect(projections.status()).toMatchObject({
      commander: { invalidations: 1 },
      sensors: { invalidations: 1 },
      remembered: { invalidations: 1 },
      sensorHistory: { invalidations: 1 },
    });
  },
);

it('an impact in one galaxy refreshes only that galaxy\'s sensor reach', async () => {
  await start();
  const here = await privateView(f.accountIds[0]!);
  const there = await privateView(other.accountId);

  await shardEvent(f.seasonId, 'impact');

  const after = await privateView(f.accountIds[0]!);
  expect(after.commander).toBe(here.commander);
  expect(after.sensors).not.toBe(here.sensors);
  expect(after.history).not.toBe(here.history);
  expectSame(await privateView(other.accountId), there);
});

it('a commander\'s own private event still reaches their entries and no one else\'s', async () => {
  await start();
  const here = await privateView(f.accountIds[0]!);
  const neighbour = await privateView(f.accountIds[1]!);
  const there = await privateView(other.accountId);

  await publish(f.db, f.playerIds[0]!, 'build_complete');
  await publish(f.db, f.playerIds[0]!, 'probe_report');
  await settle();

  const after = await privateView(f.accountIds[0]!);
  expect(after.sensors).not.toBe(here.sensors);
  expect(after.history).not.toBe(here.history);
  expect(after.remembered).not.toBe(here.remembered);
  expectSame(await privateView(f.accountIds[1]!), neighbour);
  expectSame(await privateView(other.accountId), there);
});

it('a moved commander sees neither galaxy\'s old topology, even before any notification', async () => {
  await start();
  const accountId = f.accountIds[1]!;
  const playerId = f.playerIds[1]!;
  projections.reconcilePlacement(accountId, { id: playerId, seasonId: f.seasonId, placementVersion: 0 });
  const before = await privateView(accountId);
  const oldWorlds = await projections.worlds(f.seasonId, f.clock.now());
  const newWorlds = await projections.worlds(other.seasonId, f.clock.now());

  // The relocation commits without a shard event reaching this replica.
  await f.db.update(players).set({ placementVersion: 1, seasonId: other.seasonId }).where(eq(players.id, playerId));
  await f.db.update(planets).set({ seasonId: other.seasonId }).where(eq(planets.id, f.planetIds[1]!));
  projections.reconcilePlacement(accountId, { id: playerId, seasonId: other.seasonId, placementVersion: 1 });

  const after = await privateView(accountId);
  expect(after.commander.seasonId).toBe(other.seasonId);
  expectFresh(after, before);
  expect(await projections.worlds(f.seasonId, f.clock.now())).not.toBe(oldWorlds);
  expect(await projections.worlds(other.seasonId, f.clock.now())).not.toBe(newWorlds);
});

it('a process that sees 2,000 commanders never clears every galaxy', async () => {
  await start();
  const there = await privateView(other.accountId);
  const thereWorlds = await projections.worlds(other.seasonId, f.clock.now());

  // Moved commanders seen for the first time: their previous galaxy is unknown here.
  for (let i = 0; i < 2_000; i++) {
    projections.reconcilePlacement(`account-${String(i)}`, { id: `player-${String(i)}`, seasonId: f.seasonId, placementVersion: 1 });
  }

  expectSame(await privateView(other.accountId), there);
  expect(await projections.worlds(other.seasonId, f.clock.now())).toBe(thereWorlds);
});

it('the placement map forgets its least recently seen commander, not all of them', async () => {
  await start({ maxAccounts: 300 });
  for (let i = 0; i < 300; i++) {
    projections.reconcilePlacement(`account-${String(i)}`, { id: `player-${String(i)}`, seasonId: f.seasonId, placementVersion: 1 });
  }
  const worlds = await projections.worlds(f.seasonId, f.clock.now());

  // Seen again, so the 301st commander evicts account-1 rather than account-0.
  projections.reconcilePlacement('account-0', { id: 'player-0', seasonId: f.seasonId, placementVersion: 1 });
  projections.reconcilePlacement('account-300', { id: 'player-300', seasonId: f.seasonId, placementVersion: 0 });
  projections.reconcilePlacement('account-0', { id: 'player-0', seasonId: f.seasonId, placementVersion: 1 });

  expect(await projections.worlds(f.seasonId, f.clock.now())).toBe(worlds);
});
