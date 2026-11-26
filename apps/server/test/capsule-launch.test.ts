import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { pino } from 'pino';
import { battleReports, missions, planets, playerCapsules, scheduledEvents, seasons } from '../src/db/schema.js';
import { EventWorker } from '../src/worker/loop.js';
import { readBattleReports } from '../src/services/reports.js';
import { launchAttack } from '../src/services/mission.js';
import { launchTransfer, recallFlight } from '../src/services/movement.js';
import { GameError } from '../src/services/planet.js';
import { fuelUp, giveUnits, grant, placeAt, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

/**
 * CAPSULES ON A LAUNCH (plan 2026-11-24 §3.5, S6/S7/S13). The server prices every flight by its own
 * `hangarLoad` (one per 500), takes the capsules in the launching transaction, stores them on the leg,
 * and a Sessiz İtki raid books no radar warning at all.
 */
let f: Fixture;
let mine: string;
let theirs: string;
let colony: string;
let me: string;

afterAll(async () => { await (await testDb()).close(); });

beforeEach(async () => {
  f = await seedWorld(3, 5_150);
  [mine, theirs, colony] = f.planetIds as [string, string, string];
  me = f.playerIds[0]!;
  await f.db.update(seasons).set({ synthesisStartsAt: f.clock.now() }).where(eq(seasons.id, f.seasonId));
  for (const id of [mine, theirs]) {
    await setLevel(f.db, id, 'CORE', 8);
    await setLevel(f.db, id, 'SHIPYARD', 2);
    await grant(f.db, id, 300_000, 60_000);
  }
  await placeAt(f.db, mine, { x: 0 });
  await placeAt(f.db, theirs, { x: 4_000 });
  for (const id of [mine, theirs]) await setLevel(f.db, id, 'CORE', 8);
  await fuelUp(f.db, mine, 200_000);
  f.clock.advance(250);
  await giveUnits(f.db, mine, { DART: 200 }); // 600 bulk: two capsules of each kind
});

const stock = async (id: 'OPTIC_VEIL' | 'SILENT_THRUST'): Promise<number> =>
  (await f.db.select({ n: playerCapsules.quantity }).from(playerCapsules)
    .where(and(eq(playerCapsules.playerId, me), eq(playerCapsules.capsuleId, id))))[0]?.n ?? 0;
const give = (id: 'OPTIC_VEIL' | 'SILENT_THRUST', quantity: number) => f.db.insert(playerCapsules).values({ playerId: me, capsuleId: id, quantity })
  .onConflictDoUpdate({ target: [playerCapsules.playerId, playerCapsules.capsuleId], set: { quantity } });
const raid = (capsules: ('OPTIC_VEIL' | 'SILENT_THRUST')[], fleet = { DART: 200 }) => launchAttack(
  f.db, mine, theirs, fleet, f.clock, me, false, undefined, false, undefined, false, 'PLANET', 'PLANET', capsules,
);
const code = async (run: Promise<unknown>): Promise<string> => {
  try { await run; return 'ok'; } catch (error) { if (error instanceof GameError) return error.code; throw error; }
};
const leg = async (missionId: string) => (await f.db.select().from(missions).where(eq(missions.id, missionId)))[0]!;
const warnings = async (missionId: string) => f.db.select().from(scheduledEvents)
  .where(and(eq(scheduledEvents.kind, 'radar_warning'), eq(scheduledEvents.refId, missionId)));

describe('S6 a raid takes its capsules at launch', () => {
  it('prices by the fleet’s own bulk and stores what rode on the leg', async () => {
    await give('OPTIC_VEIL', 5);
    await give('SILENT_THRUST', 5);
    const launched = await raid(['OPTIC_VEIL', 'SILENT_THRUST']);
    expect(await stock('OPTIC_VEIL')).toBe(3);
    expect(await stock('SILENT_THRUST')).toBe(3);
    expect((await leg(launched.missionId)).appliedCapsules).toEqual([{ id: 'OPTIC_VEIL', count: 2 }, { id: 'SILENT_THRUST', count: 2 }]);
  });

  it('books no radar warning under Sessiz İtki, and the usual one under Optik Örtü alone', async () => {
    await give('OPTIC_VEIL', 5);
    await give('SILENT_THRUST', 5);
    const silent = await raid(['SILENT_THRUST'], { DART: 100 });
    expect(await warnings(silent.missionId)).toHaveLength(0);
    await f.db.update(missions).set({ status: 'resolved' }).where(eq(missions.id, silent.missionId));
    const veiled = await raid(['OPTIC_VEIL'], { DART: 100 });
    expect(await warnings(veiled.missionId)).toHaveLength(1);
  });

  it('refuses short stock, a repeated capsule, and a closed season, launching nothing', async () => {
    await give('OPTIC_VEIL', 1);
    expect(await code(raid(['OPTIC_VEIL']))).toBe('INSUFFICIENT_CAPSULES');
    expect(await code(raid(['OPTIC_VEIL', 'OPTIC_VEIL']))).toBe('CAPSULE_DUPLICATE');
    await f.db.update(seasons).set({ synthesisStartsAt: null }).where(eq(seasons.id, f.seasonId));
    expect(await code(raid(['OPTIC_VEIL'], { DART: 10 }))).toBe('SYNTHESIS_DISABLED');
    expect(await stock('OPTIC_VEIL')).toBe(1);
    expect(await f.db.select().from(missions)).toHaveLength(0);
  });

  it('flies a plain raid exactly as before', async () => {
    const launched = await raid([]);
    expect((await leg(launched.missionId)).appliedCapsules).toEqual([]);
    expect(await warnings(launched.missionId)).toHaveLength(1);
  });
});

describe('S6 a transfer may wear Optik Örtü, never Sessiz İtki', () => {
  it('takes the veil, refuses the silence', async () => {
    await f.db.update(planets).set({ kind: 'COLONY', controllerPlayerId: me, statsOwnerPlayerId: me }).where(eq(planets.id, colony));
    await give('OPTIC_VEIL', 2);
    await give('SILENT_THRUST', 2);
    const move = (capsules: ('OPTIC_VEIL' | 'SILENT_THRUST')[]) => launchTransfer(
      f.db, me, mine, colony, { DART: 10 }, { alloy: 0, crystal: 0, deuterium: 0 }, f.clock,
      undefined, undefined, false, 'PLANET', 'PLANET', capsules,
    );
    expect(await code(move(['SILENT_THRUST']))).toBe('CAPSULE_MISSION_FORBIDDEN');
    const sent = await move(['OPTIC_VEIL']);
    expect((await leg(sent.missionId)).appliedCapsules).toEqual([{ id: 'OPTIC_VEIL', count: 1 }]);
    expect(await stock('OPTIC_VEIL')).toBe(1);
  });
});

describe('S7 two launches race for the last capsules', () => {
  it('lets exactly one through', async () => {
    await give('OPTIC_VEIL', 3);
    await giveUnits(f.db, mine, { DART: 400 });
    const other = f.planetIds[2]!;
    await placeAt(f.db, other, { x: -4_000 });
    await setLevel(f.db, other, 'CORE', 8);
    const second = launchAttack(f.db, mine, other, { DART: 200 }, f.clock, me, false, undefined, false, undefined, false, 'PLANET', 'PLANET', ['OPTIC_VEIL']);
    const results = (await Promise.all([code(raid(['OPTIC_VEIL'])), code(second)])).sort();
    expect(results).toEqual(['INSUFFICIENT_CAPSULES', 'ok']);
    expect(await stock('OPTIC_VEIL')).toBe(1);
  });
});

describe('S13 a recalled raid keeps its capsules on the way home', () => {
  it('turns the same leg, so the veil rides home with it and nothing is refunded', async () => {
    await give('OPTIC_VEIL', 2);
    const launched = await raid(['OPTIC_VEIL']);
    f.clock.advance(1);
    await recallFlight(f.db, launched.missionId, f.clock, me);
    expect((await leg(launched.missionId)).appliedCapsules).toEqual([{ id: 'OPTIC_VEIL', count: 2 }]);
    expect(await stock('OPTIC_VEIL')).toBe(0);
  });
});

describe('S14 the battle report names the capsules, the way home wears none', () => {
  it('writes them on the report and flies the survivors home in plain sight', async () => {
    await give('OPTIC_VEIL', 2);
    await give('SILENT_THRUST', 2);
    const launched = await raid(['OPTIC_VEIL', 'SILENT_THRUST']);
    f.clock.set(new Date(launched.arriveAt.getTime() + 60_000));
    await new EventWorker(f.db, f.clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, pino({ level: 'silent' })).tick();
    const [report] = await f.db.select().from(battleReports).where(eq(battleReports.missionId, launched.missionId));
    expect(report?.appliedCapsules).toEqual([{ id: 'OPTIC_VEIL', count: 2 }, { id: 'SILENT_THRUST', count: 2 }]);
    // At the battle the veil is off: both sides read what rode on the raid.
    for (const player of [me, f.playerIds[1]!]) {
      const { reports } = await readBattleReports(f.db, player);
      const battle = reports.find((one) => one.kind === 'BATTLE' && one.missionId === launched.missionId);
      expect(battle?.kind === 'BATTLE' ? battle.appliedCapsules : null).toEqual([{ id: 'OPTIC_VEIL', count: 2 }, { id: 'SILENT_THRUST', count: 2 }]);
    }
    const home = await f.db.select().from(missions).where(and(eq(missions.kind, 'return'), eq(missions.parentMissionId, launched.missionId)));
    expect(home.map((leg) => leg.appliedCapsules)).toEqual([[]]);
  });
});
