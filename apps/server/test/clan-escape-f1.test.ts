import { pino } from 'pino';
import { and, eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { escapeFuel, type Fleet } from '@astera/rules';
import {
  battleReports,
  clanSupportBattleResults,
  clanSupportWaves,
  dominionEvents,
  missions,
  notifications,
  planets,
  probeReports,
  units,
} from '../src/db/schema.js';
import { clanActor, leaveClan, readClanPresence } from '../src/services/clan.js';
import { quoteClanSupport, sendClanSupport, setDefencePosture } from '../src/services/clanSupport.js';
import { probePostureFields } from '../src/services/defencePosture.js';
import { launchProbe } from '../src/services/intel.js';
import { launchAttack } from '../src/services/mission.js';
import { planetView } from '../src/services/planetView.js';
import { EventWorker } from '../src/worker/loop.js';
import { buildApp } from '../src/app.js';
import { intelSchema } from '../../web/src/api/schemas.js';
import { giveUnits, testDb, testEnv, type Fixture } from './helpers.js';
import { formClan, namesOf, supportWorld } from './clanSupportFixture.js';

/**
 * KLAN DESTEĞİYLE BİRLİKTE KAÇIŞ — F1, owner decisions 2026-11-10
 * (`docs/klan-savunma-kacis-f1-2026-11-10.md`).
 *
 * Commander 1 holds world 1; commander 0 stands a wave of Pikes there (a hull the host does
 * not own, so a leak into the host's home would show); commander 3, outside the clan, raids.
 */

afterAll(async () => { await (await testDb()).close(); });
const silent = pino({ level: 'silent' });
const worker = (f: Fixture) => new EventWorker(f.db, f.clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, silent);
const at = async (f: Fixture, ms: number) => {
  f.clock.set(new Date(ms));
  await worker(f).tick();
};

const post = (f: Fixture, planet: number, escape: boolean, support: boolean) =>
  f.db.transaction((tx) => setDefencePosture(tx, {
    planetId: f.planetIds[planet]!,
    playerId: f.playerIds[planet]!,
    toggles: { escape, support },
    clock: f.clock,
  }));

const stored = async (f: Fixture, planet: number) => {
  const [row] = await f.db.select({ posture: planets.defencePosture }).from(planets).where(eq(planets.id, f.planetIds[planet]!));
  return row!.posture;
};

const viewOf = (f: Fixture, planet: number) => f.db.transaction((tx) => planetView(tx, f.planetIds[planet]!, f.clock));

const homeOf = async (f: Fixture, planet: number): Promise<Fleet> => {
  const rows = await f.db.select().from(units)
    .where(and(eq(units.planetId, f.planetIds[planet]!), eq(units.location, 'home')));
  return Object.fromEntries(rows.filter((row) => row.count > 0).map((row) => [row.hull, row.count]));
};

const WAVE: Fleet = { PIKE: 40 };

const sendWave = (f: Fixture, fleet: Fleet = WAVE) => f.db.transaction((tx) => sendClanSupport(tx, {
  senderPlayerId: f.playerIds[0]!,
  originPlanetId: f.planetIds[0]!,
  hostPlanetId: f.planetIds[1]!,
  fleet,
  clock: f.clock,
}));

/** World 1 left exactly as a clan member finds it — nobody touched a toggle — with a wave standing there. */
async function standing(seed: number) {
  const f = await supportWorld(4, seed);
  await formClan(f, 0, [1, 2]);
  await giveUnits(f.db, f.planetIds[0]!, { PIKE: 200 });
  const { wave } = await sendWave(f);
  await at(f, new Date(wave.arriveAt).getTime() + 1_000);
  return { f, waveId: wave.id };
}

async function raid(f: Fixture, fleet: Fleet): Promise<string> {
  await giveUnits(f.db, f.planetIds[3]!, fleet);
  const launched = await launchAttack(f.db, f.planetIds[3]!, f.planetIds[1]!, fleet, f.clock, f.playerIds[3], true);
  const [mission] = await f.db.select().from(missions).where(eq(missions.id, launched.missionId));
  await at(f, mission!.arriveAt.getTime() + 30_000);
  return launched.missionId;
}

const reportOf = async (f: Fixture, missionId: string) =>
  (await f.db.select().from(battleReports).where(eq(battleReports.missionId, missionId)))[0]!;

describe('F1 defaults — a clan member’s world takes support without touching a toggle', () => {
  it('stores ESCAPE_SUPPORT on every new world, and shows it as the retreat alone outside a clan', async () => {
    const f = await supportWorld(2, 16_101);
    expect(await stored(f, 0)).toBe('ESCAPE_SUPPORT');
    expect((await viewOf(f, 0)).defencePosture).toEqual({
      posture: 'ESCAPE', stance: 'ESCAPE', escape: true, support: false, supportLocked: 'NOT_IN_CLAN',
    });
  });

  it('opens the door the moment the commander is in a clan', async () => {
    const f = await supportWorld(2, 16_102);
    await formClan(f, 0, [1]);
    // An old client still parses three postures; a new one reads the stance.
    expect((await viewOf(f, 1)).defencePosture).toEqual({
      posture: 'ESCAPE', stance: 'ESCAPE_SUPPORT', escape: true, support: true, supportLocked: null,
    });
    const presence = await readClanPresence(f.db, f.playerIds[0]!);
    const worlds = presence!.members.flatMap((member) => member.worlds);
    expect(worlds.find((world) => world.planetId === f.planetIds[1]!)!.supportOpen).toBe(true);
  });

  it('keeps a member’s choice to close the door', async () => {
    const f = await supportWorld(2, 16_103);
    await formClan(f, 0, [1]);
    await post(f, 1, true, false);
    expect(await stored(f, 1)).toBe('ESCAPE');
    const quote = await quoteClanSupport(f.db, {
      senderPlayerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!, hostPlanetId: f.planetIds[1]!, fleet: { DART: 5 }, clock: f.clock,
    });
    expect(quote.refusals.map((refusal) => refusal.code)).toContain('CLAN_SUPPORT_CLOSED');
  });
});

describe('F1 toggles — both may be on', () => {
  it('saves both on as ESCAPE_SUPPORT for a member', async () => {
    const f = await supportWorld(2, 16_201);
    await formClan(f, 0, [1]);
    await post(f, 1, false, false);
    const result = await post(f, 1, true, true);
    expect(result.planet.defencePosture).toMatchObject({ stance: 'ESCAPE_SUPPORT', escape: true, support: true });
    expect(await stored(f, 1)).toBe('ESCAPE_SUPPORT');
  });

  it('keeps the default door through a save made outside a clan — the switch there is locked, not a choice', async () => {
    const f = await supportWorld(2, 16_205);
    await post(f, 0, false, false);
    expect((await viewOf(f, 0)).defencePosture).toMatchObject({ stance: 'HOLD', escape: false, support: false });
    await post(f, 0, true, false);
    await formClan(f, 0, [1]);
    expect((await viewOf(f, 0)).defencePosture).toMatchObject({ stance: 'ESCAPE_SUPPORT', support: true });
  });

  it('still needs a clan for support', async () => {
    const f = await supportWorld(2, 16_202);
    await expect(post(f, 0, true, true)).rejects.toMatchObject({ code: 'NOT_IN_CLAN' });
  });

  it('keeps the waves when only the retreat changes, and sends them home when the door closes', async () => {
    const { f, waveId } = await standing(16_203);
    expect((await post(f, 1, false, true)).returnedWaves).toBe(0);
    expect((await post(f, 1, true, true)).returnedWaves).toBe(0);
    const [still] = await f.db.select().from(clanSupportWaves).where(eq(clanSupportWaves.id, waveId));
    expect(still!.status).toBe('STATIONED');
    expect((await post(f, 1, true, false)).returnedWaves).toBe(1);
    const [gone] = await f.db.select().from(clanSupportWaves).where(eq(clanSupportWaves.id, waveId));
    expect(gone).toMatchObject({ status: 'RETURNING', returnReason: 'HOST_CLOSED' });
  });

  it('restores the retreat when a SUPPORT world’s commander leaves, and leaves an ESCAPE_SUPPORT world quiet', async () => {
    const f = await supportWorld(3, 16_204);
    await formClan(f, 0, [1, 2]);
    await post(f, 1, false, true);
    for (const index of [1, 2]) {
      await f.db.transaction(async (tx) => leaveClan(tx, { actor: await clanActor(tx, f.accountIds[index]!), now: f.clock.now() }));
    }
    expect(await stored(f, 1)).toBe('ESCAPE_SUPPORT');
    expect(await stored(f, 2)).toBe('ESCAPE_SUPPORT');
    const told = (index: number) => f.db.select().from(notifications).where(and(
      eq(notifications.playerId, f.playerIds[index]!), eq(notifications.kind, 'defence_posture_reset')));
    expect(await told(1)).toHaveLength(1);
    expect(await told(2)).toHaveLength(0);
    expect((await viewOf(f, 1)).defencePosture).toMatchObject({ stance: 'ESCAPE', support: false, supportLocked: 'NOT_IN_CLAN' });
  });
});

describe('F1 raid — the whole line runs together', () => {
  it('lifts host and wave from a crushing raid: the wave stands untouched and the battle is the guns’ alone', async () => {
    const { f, waveId } = await standing(16_301);
    const hostBefore = await homeOf(f, 1);
    const missionId = await raid(f, { DART: 3_000 });
    const report = await reportOf(f, missionId);
    expect(report.fleetEscape?.kind).toBe('ESCAPED');
    if (report.fleetEscape?.kind !== 'ESCAPED') return;
    expect(report.fleetEscape.support).toEqual([{ stackId: waveId, ships: WAVE }]);
    // The host paid for its own ships, and only those.
    expect(report.fleetEscape.ships.PIKE).toBeUndefined();
    expect(report.fleetEscape.fuel).toBe(escapeFuel(report.fleetEscape.ships));
    // The guns fought alone: an ordinary, unsupported battle on the books (D = 1).
    expect(report.defenderCount).toBe(1);
    expect(report.defenderFleet.PIKE ?? 0).toBe(0);
    expect(await f.db.select().from(clanSupportBattleResults).where(eq(clanSupportBattleResults.reportId, report.id))).toHaveLength(0);
    expect(await f.db.select().from(dominionEvents).where(eq(dominionEvents.missionId, missionId))).toHaveLength(1);
    // Nothing that ran was touched.
    const home = await homeOf(f, 1);
    for (const [hull, count] of Object.entries(report.fleetEscape.ships)) expect(home[hull as keyof Fleet]).toBe(hostBefore[hull as keyof Fleet] ?? count);
    const [wave] = await f.db.select().from(clanSupportWaves).where(eq(clanSupportWaves.id, waveId));
    expect(wave).toMatchObject({ status: 'STATIONED', battles: 0, damage: null });
    const parked = await f.db.select().from(units).where(eq(units.location, wave!.unitLocation));
    expect(Object.fromEntries(parked.map((row) => [row.hull, row.count]))).toEqual(WAVE);
  });

  it('tells the supporter their wave lifted with the line, and sends no battle result', async () => {
    const { f } = await standing(16_302);
    await raid(f, { DART: 3_000 });
    const mine = await f.db.select().from(notifications).where(eq(notifications.playerId, f.playerIds[0]!));
    const lifted = mine.filter((row) => row.kind === 'clan_support_lifted');
    expect(lifted).toHaveLength(1);
    expect(lifted[0]!.payload).toMatchObject({ hostPlanetId: f.planetIds[1]!, hostPlanetName: (await namesOf(f, 1)).world });
    expect(mine.some((row) => row.kind === 'clan_support_result')).toBe(false);
  });

  it('keeps the whole line in when the host’s tank cannot pay (F1-K4)', async () => {
    const { f, waveId } = await standing(16_303);
    await f.db.update(planets).set({ deuterium: 0 }).where(eq(planets.id, f.planetIds[1]!));
    const missionId = await raid(f, { DART: 3_000 });
    const report = await reportOf(f, missionId);
    expect(report.fleetEscape?.kind).toBe('STRANDED');
    expect(report.defenderCount).toBe(2);
    const [wave] = await f.db.select().from(clanSupportWaves).where(eq(clanSupportWaves.id, waveId));
    expect(wave!.status === 'LOST' || wave!.battles === 1).toBe(true);
  });

  it('fights a supported line the wing does not outmatch, as a supported line always fought', async () => {
    const { f, waveId } = await standing(16_304);
    const missionId = await raid(f, { DART: 60 });
    const report = await reportOf(f, missionId);
    expect(report.fleetEscape).toBeNull();
    expect(report.defenderCount).toBe(2);
    const [wave] = await f.db.select().from(clanSupportWaves).where(eq(clanSupportWaves.id, waveId));
    expect(wave!.battles).toBe(1);
  });

  it('never lifts a SUPPORT world, whatever the raid', async () => {
    const { f } = await standing(16_305);
    await post(f, 1, false, true);
    const report = await reportOf(f, await raid(f, { DART: 3_000 }));
    expect(report.fleetEscape).toBeNull();
    expect(report.defenderCount).toBe(2);
  });
});

describe('F1 probe — the raider reads the door and the guests', () => {
  it('records ESCAPE_SUPPORT exactly with its support reading, and only the retreat outside a clan', async () => {
    const { f } = await standing(16_401);
    const probe = async (from: number, to: number) => {
      const launched = await launchProbe(f.db, f.planetIds[from]!, f.planetIds[to]!, f.clock, f.playerIds[from]);
      const [mission] = await f.db.select().from(missions).where(eq(missions.id, launched.missionId));
      await at(f, mission!.arriveAt.getTime() + 30_000);
      return (await f.db.select().from(probeReports).where(eq(probeReports.missionId, launched.missionId)))[0]!;
    };
    const supported = await probe(3, 1);
    expect(supported.posture).toBe('ESCAPE_SUPPORT');
    expect(supported.support).toMatchObject({ supporters: 1 });
    // Commander 3 is in no clan: the stored default takes nobody, and the probe says so.
    expect(await stored(f, 3)).toBe('ESCAPE_SUPPORT');
    const outside = await probe(1, 3);
    expect(outside.posture).toBe('ESCAPE');
    expect(outside.support).toBeNull();
  });

  it('puts the posture on the wire in the three values old clients parse, the exact one in stance', () => {
    const reading = { supporters: 2, defence: { low: 1, high: 2 }, fleetSize: { low: 1, high: 2 }, classReading: null };
    expect(probePostureFields({ posture: 'ESCAPE_SUPPORT', support: reading })).toEqual({ posture: 'ESCAPE', stance: 'ESCAPE_SUPPORT', support: reading });
    expect(probePostureFields({ posture: 'SUPPORT', support: reading })).toEqual({ posture: 'SUPPORT', stance: 'SUPPORT', support: reading });
    expect(probePostureFields({ posture: null, support: null })).toEqual({});
  });

  // The route once dropped both readings on the way out; the meaning must reach the client, not just parse.
  it('delivers the posture, the stance and the support reading through GET /api/intel', async () => {
    const { f } = await standing(16_402);
    const launched = await launchProbe(f.db, f.planetIds[3]!, f.planetIds[1]!, f.clock, f.playerIds[3]);
    const [mission] = await f.db.select().from(missions).where(eq(missions.id, launched.missionId));
    await at(f, mission!.arriveAt.getTime() + 30_000);
    await at(f, mission!.arriveAt.getTime() + (mission!.arriveAt.getTime() - mission!.departAt.getTime()) + 60_000);

    const built = buildApp({ db: f.db, env: testEnv(), clock: f.clock, logger: silent });
    try {
      const authorization = `Bearer ${await built.app.tokens.issueAccess(f.accountIds[3]!)}`;
      const response = await built.app.inject({ url: '/api/intel', headers: { authorization } });
      const report = intelSchema.parse(response.json()).probeReports.find((r) => r.missionId === launched.missionId);
      expect(report, 'the delivered report never reached the payload').toBeDefined();
      expect(report).toMatchObject({ posture: 'ESCAPE', stance: 'ESCAPE_SUPPORT', support: { supporters: 1 } });
    } finally {
      await built.close();
    }
  });
});
