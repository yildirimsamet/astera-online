import { pino } from 'pino';
import { and, eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { CLAN, alloyRate, clanLevelUpgradeCost, clanVictoryWreck, collectorCap } from '@astera/rules';
import { battleReports, clanAlarms, clanMemberships, clanTreasuryEvents, debrisFields, clanSupportWaves, clans, missions, notifications, planets, players, probeReports, scheduledEvents } from '../src/db/schema.js';
import { launchClanAid, quoteClanAid } from '../src/services/clanAid.js';
import { clanActor, clanLeaderboard } from '../src/services/clan.js';
import { readClanLedger } from '../src/services/clanLedger.js';
import { postClanChat, readClanChat } from '../src/services/clanChat.js';
import { postChat } from '../src/services/chat.js';
import { postClanEvent } from '../src/services/clanChatEvents.js';
import { buildReturnPayload, pendingThreads } from '../src/services/session.js';
import { listAdminPlayers } from '../src/services/adminPlayers.js';
import { readBattleReports } from '../src/services/reports.js';
import { donateToClanTreasury, upgradeClanLevel } from '../src/services/clanTreasury.js';
import { quoteClanSupport, sendClanSupport } from '../src/services/clanSupport.js';
import { launchProbe, standingAt } from '../src/services/intel.js';
import { buildApp } from '../src/app.js';
import { clanLedgerSchema, galaxySchema, intelSchema, leaderboardSchema } from '../../web/src/api/schemas.js';
import { launchAttack } from '../src/services/mission.js';
import { planetView } from '../src/services/planetView.js';
import { EventWorker } from '../src/worker/loop.js';
import { giveInstrument, giveSatellite, giveUnits, testDb, testEnv, type Fixture } from './helpers.js';
import { formClan, supportWorld } from './clanSupportFixture.js';

/**
 * KLAN PERKLERİ — F2, owner decisions 2026-11-10 (`docs/klan-perkleri-f2-plan-2026-11-10.md`).
 * Commanders 0 and 1 share a clan (founded at level 1); commander 2 sits outside it.
 */

afterAll(async () => { await (await testDb()).close(); });
const silent = pino({ level: 'silent' });
const worker = (f: Fixture) => new EventWorker(f.db, f.clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, silent);

const WAVE = { DART: 20 };
const levelUp = (f: Fixture, clanId: string, level: number | null) =>
  f.db.update(clans).set({ level }).where(eq(clans.id, clanId));

const supportQuote = (f: Fixture) => quoteClanSupport(f.db, {
  senderPlayerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!, hostPlanetId: f.planetIds[1]!, fleet: WAVE, clock: f.clock,
});

const aidQuote = (f: Fixture) => quoteClanAid(f.db, {
  senderPlayerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!, recipientPlayerId: f.playerIds[1]!,
  targetPlanetId: f.planetIds[1]!, fleet: { COURIER: 2 }, cargo: { alloy: 500, crystal: 0, deuterium: 0 }, now: f.clock.now(),
});

const minutesBetween = (from: string, to: string) => (new Date(to).getTime() - new Date(from).getTime()) / 60_000;

describe('F2 corridor — a support wave’s first leg', () => {
  it('flies out at ×2 from the day the clan is founded and comes home on the ×1.1 lane', async () => {
    const f = await supportWorld(3, 22_001);
    await formClan(f, 0, [1]);
    const q = await supportQuote(f);
    // Same distance and pace both ways, so the legs differ only by their multipliers.
    expect(q.travelMinutes * 2).toBeCloseTo(q.returnMinutes * CLAN.aidSpeedMultiplier, 6);
  });

  it('climbs to ×5 at level 7', async () => {
    const f = await supportWorld(3, 22_002);
    const clanId = await formClan(f, 0, [1]);
    await levelUp(f, clanId, 7);
    const q = await supportQuote(f);
    expect(q.travelMinutes * 5).toBeCloseTo(q.returnMinutes * CLAN.aidSpeedMultiplier, 6);
  });

  it('keeps the old ×1.1 lane both ways for a clan with no level', async () => {
    const f = await supportWorld(3, 22_003);
    const clanId = await formClan(f, 0, [1]);
    await levelUp(f, clanId, null);
    const q = await supportQuote(f);
    expect(q.travelMinutes).toBeCloseTo(q.returnMinutes, 6);
  });
});

describe('F2 corridor — clan aid’s first leg', () => {
  it('flies a delivery out at the corridor and home on the lane', async () => {
    const f = await supportWorld(3, 22_011);
    const clanId = await formClan(f, 0, [1]);
    const founded = await aidQuote(f);
    expect(founded.travelMinutes * 2)
      // The two instants travel as ISO strings, whole milliseconds.
      .toBeCloseTo(minutesBetween(founded.arriveAt, founded.possibleReturnAt) * CLAN.aidSpeedMultiplier, 4);
    await levelUp(f, clanId, 5);
    const raised = await aidQuote(f);
    expect(raised.travelMinutes * 4).toBeCloseTo(founded.travelMinutes * 2, 6);
  });
});

describe('F2 corridor — the lane is drawn', () => {
  it('marks a support wave’s first leg as flown on the corridor', async () => {
    const f = await supportWorld(3, 22_014);
    await formClan(f, 0, [1]);
    await f.db.transaction((tx) => sendClanSupport(tx, {
      senderPlayerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!, hostPlanetId: f.planetIds[1]!, fleet: WAVE, clock: f.clock,
    }));
    const pending = await pendingThreads(f.db, f.planetIds[0]!, f.clock.now());
    expect(pending.find((thread) => thread.clanSupport === true)).toMatchObject({ corridor: true });
  });

  it('marks aid going out, and not the way home', async () => {
    const f = await supportWorld(3, 22_015);
    await formClan(f, 0, [1]);
    const launched = await f.db.transaction((tx) => launchClanAid(tx, {
      senderPlayerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!, recipientPlayerId: f.playerIds[1]!,
      targetPlanetId: f.planetIds[1]!, fleet: { COURIER: 2 }, cargo: { alloy: 500, crystal: 0, deuterium: 0 }, clock: f.clock,
    }));
    const out = await pendingThreads(f.db, f.planetIds[0]!, f.clock.now());
    expect(out.filter((thread) => thread.corridor === true)).toHaveLength(1);
    f.clock.set(new Date(new Date(launched.arriveAt).getTime() + 1_000));
    await worker(f).tick();
    const home = await pendingThreads(f.db, f.planetIds[0]!, f.clock.now());
    expect(home.length).toBeGreaterThan(0);
    expect(home.some((thread) => thread.corridor === true)).toBe(false);
  });

  it('draws no lane for a commander’s own raid', async () => {
    const f = await supportWorld(3, 22_016);
    await formClan(f, 0, [1]);
    await launchAttack(f.db, f.planetIds[0]!, f.planetIds[2]!, { DART: 5 }, f.clock, f.playerIds[0], true);
    const pending = await pendingThreads(f.db, f.planetIds[0]!, f.clock.now());
    expect(pending.some((thread) => thread.corridor === true)).toBe(false);
  });
});

describe('F2 station — Uzun Nöbet', () => {
  const stayHours = async (level: number) => {
    const f = await supportWorld(3, 22_020 + level);
    const clanId = await formClan(f, 0, [1]);
    await levelUp(f, clanId, level);
    const { wave } = await f.db.transaction((tx) => sendClanSupport(tx, {
      senderPlayerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!, hostPlanetId: f.planetIds[1]!, fleet: WAVE, clock: f.clock,
    }));
    f.clock.set(new Date(new Date(wave.arriveAt).getTime() + 1_000));
    await worker(f).tick();
    const [row] = await f.db.select().from(clanSupportWaves).where(eq(clanSupportWaves.id, wave.id));
    expect(row?.status).toBe('STATIONED');
    return (row!.expiresAt!.getTime() - row!.stationedAt!.getTime()) / 3_600_000;
  };

  it('stands a wave 12 h below level 4, 18 h from 4 and 24 h from 8', async () => {
    expect(await stayHours(3)).toBeCloseTo(12, 6);
    expect(await stayHours(4)).toBeCloseTo(18, 6);
    expect(await stayHours(8)).toBeCloseTo(24, 6);
  });

  it('quotes the longer stay before the send', async () => {
    const f = await supportWorld(3, 22_030);
    const clanId = await formClan(f, 0, [1]);
    await levelUp(f, clanId, 8);
    const q = await supportQuote(f);
    expect(minutesBetween(q.arriveAt, q.stationUntil) / 60).toBeCloseTo(24, 6);
  });
});

/* ── P2 Klan Alarmı ───────────────────────────────────────────────── */

describe('F2 alarm — the host’s radar warning reaches the clan', () => {
  /** World 1 (commander 1, radar 3) is raided by commander 3; 0 and 2 are clanmates. */
  async function raided(seed: number, options: { level?: number; radar?: number; door?: boolean; immature?: number[] } = {}) {
    const f = await supportWorld(4, seed);
    const clanId = await formClan(f, 0, [1, 2]);
    await levelUp(f, clanId, options.level ?? 2);
    // A radar listens only through an Uplink.
    if ((options.radar ?? 3) > 0) {
      await giveSatellite(f.db, f.planetIds[1]!, 'UPLINK');
      await giveInstrument(f.db, f.planetIds[1]!, 'RADAR', options.radar ?? 3);
    }
    if (options.door === false) await f.db.update(planets).set({ defencePosture: 'ESCAPE' }).where(eq(planets.id, f.planetIds[1]!));
    for (const index of options.immature ?? []) {
      await f.db.update(clanMemberships).set({ matureAt: new Date(f.clock.now().getTime() + 3_600_000) })
        .where(eq(clanMemberships.playerId, f.playerIds[index]!));
    }
    await giveUnits(f.db, f.planetIds[3]!, { DART: 30 });
    const launched = await launchAttack(f.db, f.planetIds[3]!, f.planetIds[1]!, { DART: 30 }, f.clock, f.playerIds[3], true);
    const [mission] = await f.db.select().from(missions).where(eq(missions.id, launched.missionId));
    // The warning is read while the fleet is still on its way in (as arena-admiral-raid does).
    f.clock.set(new Date(mission!.arriveAt.getTime() - 20_000));
    await worker(f).tick();
    const kinds = async (index: number) => (await f.db.select().from(notifications)
      .where(and(eq(notifications.playerId, f.playerIds[index]!), eq(notifications.refId, launched.missionId))));
    return { f, missionId: launched.missionId, arriveAt: mission!.arriveAt, kinds };
  }

  it('copies the host’s warning to every mature clanmate, naming the host and the world', async () => {
    const { f, kinds, arriveAt } = await raided(22_101);
    const [host] = (await kinds(1)).filter((row) => row.kind === 'incoming_fleet');
    expect(host).toBeDefined();
    for (const index of [0, 2]) {
      const [alarm] = (await kinds(index)).filter((row) => row.kind === 'clan_alarm');
      expect(alarm?.payload).toMatchObject({
        ...(host!.payload as object),
        hostPlayerId: f.playerIds[1],
        hostPlanetId: f.planetIds[1],
        arriveAt: arriveAt.toISOString(),
      });
    }
    // The raider is no clanmate and hears nothing.
    expect((await kinds(3)).some((row) => row.kind === 'clan_alarm')).toBe(false);
  });

  it('records the alarm once, for the responses to be counted against', async () => {
    const { f, missionId, arriveAt } = await raided(22_102);
    const rows = await f.db.select().from(clanAlarms).where(eq(clanAlarms.missionId, missionId));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ hostPlanetId: f.planetIds[1], hostPlayerId: f.playerIds[1], arriveAt });
  });

  it('stays silent below level 2', async () => {
    const { kinds } = await raided(22_103, { level: 1 });
    expect((await kinds(0)).some((row) => row.kind === 'clan_alarm')).toBe(false);
  });

  it('stays silent for a world with no radar — the radar is what hears it', async () => {
    const { kinds } = await raided(22_104, { radar: 0 });
    expect((await kinds(0)).some((row) => row.kind === 'clan_alarm')).toBe(false);
  });

  it('stays silent for a world whose door is shut — the alarm is a call for support', async () => {
    const { kinds } = await raided(22_105, { door: false });
    expect((await kinds(0)).some((row) => row.kind === 'clan_alarm')).toBe(false);
  });

  it('skips a member still settling in, as support itself does', async () => {
    const { kinds } = await raided(22_106, { immature: [2] });
    expect((await kinds(0)).some((row) => row.kind === 'clan_alarm')).toBe(true);
    expect((await kinds(2)).some((row) => row.kind === 'clan_alarm')).toBe(false);
  });
});

/* ── P5 Ortak Ocak (Klan Rafinerisi V1) ───────────────────────────── */

describe('F2 refinery — every active member lifts every member’s works', () => {
  const HOUR = 60 * 60_000;
  /** Commanders 0, 1, 2 in one clan; `active` of them gave an order an hour ago. */
  async function refinery(seed: number, level: number, active: number[]) {
    const f = await supportWorld(4, seed);
    const clanId = await formClan(f, 0, [1, 2]);
    await levelUp(f, clanId, level);
    for (const index of [0, 1, 2]) {
      await f.db.update(players).set({ lastProgressAt: active.includes(index) ? new Date(f.clock.now().getTime() - HOUR) : null })
        .where(eq(players.id, f.playerIds[index]!));
    }
    const world = f.planetIds[0]!;
    await f.db.update(planets).set({ bufferAlloy: 0, bufferCrystal: 0, bufferDeuterium: 0, lastTickAt: f.clock.now() })
      .where(eq(planets.id, world));
    f.clock.advance(60);
    const [row] = await f.db.select().from(planets).where(eq(planets.id, world));
    const seen = await f.db.transaction((tx) => standingAt(tx, row!, f.clock.now()));
    const view = await f.db.transaction((tx) => planetView(tx, world, f.clock));
    return { f, seen, view, rate: alloyRate(view.buildings.REFINERY) };
  }

  it('pays nothing below level 6', async () => {
    const { view, rate } = await refinery(22_201, 5, [0, 1, 2]);
    expect(view.planet.alloyPerHour).toBe(Math.round(rate));
  });

  it('adds 1 % per member who gave an order in the last day at level 6 — the owner, a probe and the view agree', async () => {
    const { seen, view, rate } = await refinery(22_202, 6, [0, 2]);
    expect(view.planet.alloyPerHour).toBe(Math.round(rate * 1.02));
    expect(view.planet.bufferAlloy).toBe(Math.floor(rate * 1.02));
    expect(Math.floor(seen.bufferAlloy)).toBe(view.planet.bufferAlloy);
    // The vessel keeps its size.
    expect(view.planet.bufferAlloyCap).toBe(collectorCap(rate));
  });

  it('pays 2 % per active member at level 9, and nothing for a member quiet for over a day', async () => {
    const { view, rate } = await refinery(22_203, 9, [0, 1]);
    expect(view.planet.alloyPerHour).toBe(Math.round(rate * 1.04));
  });

  it('promises the same share in the away recap', async () => {
    const { f, rate } = await refinery(22_204, 9, [0, 1]);
    await f.db.update(players).set({ lastSeenAt: new Date(f.clock.now().getTime() - HOUR) }).where(eq(players.id, f.playerIds[0]!));
    const payload = await buildReturnPayload(f.db, f.playerIds[0]!, f.clock);
    const accrued = payload.entries.find((entry) => entry.kind === 'accrued');
    expect(accrued?.params.alloy).toBe(Math.round(rate * 1.04));
  });

  it('counts the share in the admin estimate, to the unit the world shows', async () => {
    const { f } = await refinery(22_205, 9, [0, 1]);
    f.clock.advance(60);
    await f.db.update(players).set({ lastActiveAt: f.clock.now() });
    const admin = await listAdminPlayers(f.db, { limit: 50 }, f.clock.now());
    const world = await f.db.transaction((tx) => planetView(tx, f.planetIds[0]!, f.clock));
    const row = admin.players.find((player) => player.playerId === f.playerIds[0]);
    expect(Math.floor(row!.resources.buffer.alloy)).toBe(world.planet.bufferAlloy);
  });
});

/* ── E4 Zafer Kasası ─────────────────────────────────────────────── */

describe('F2 victory wreck — a won supported defence pays the clan purse', () => {
  /** World 1 (commander 1) defended; with `support`, commander 0's Pikes stand in it. Commander 3 raids. */
  async function defended(seed: number, support: boolean) {
    const f = await supportWorld(4, seed);
    const clanId = await formClan(f, 0, [1, 2]);
    if (support) {
      await giveUnits(f.db, f.planetIds[0]!, { PIKE: 60 });
      const { wave } = await f.db.transaction((tx) => sendClanSupport(tx, {
        senderPlayerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!, hostPlanetId: f.planetIds[1]!,
        fleet: { PIKE: 60 }, clock: f.clock,
      }));
      f.clock.set(new Date(new Date(wave.arriveAt).getTime() + 1_000));
      await worker(f).tick();
    }
    await giveUnits(f.db, f.planetIds[3]!, { DART: 60 });
    const launched = await launchAttack(f.db, f.planetIds[3]!, f.planetIds[1]!, { DART: 60 }, f.clock, f.playerIds[3], true);
    const [mission] = await f.db.select().from(missions).where(eq(missions.id, launched.missionId));
    f.clock.set(new Date(mission!.arriveAt.getTime() + 30_000));
    await worker(f).tick();
    const [report] = await f.db.select().from(battleReports).where(eq(battleReports.missionId, launched.missionId));
    const [field] = await f.db.select().from(debrisFields).where(eq(debrisFields.missionId, launched.missionId));
    const [clan] = await f.db.select().from(clans).where(eq(clans.id, clanId));
    const events = await f.db.select().from(clanTreasuryEvents).where(eq(clanTreasuryEvents.clanId, clanId));
    const viewOf = async (player: number) => {
      const row = (await readBattleReports(f.db, f.playerIds[player]!)).reports.find((each) => each.id === report!.id);
      return row && 'clanPurse' in row ? row : undefined;
    };
    return { report: report!, field, clan: clan!, events, viewOf };
  }

  it('moves half the field into the purse, and leaves the other half in orbit', async () => {
    const { report, field, clan, events } = await defended(22_301, true);
    expect(report.grade).toBe('REPELLED');
    expect(clan.treasuryAlloy + clan.treasuryCrystal).toBeGreaterThan(0);
    expect(field).toBeDefined();
    // Half of what the fight left, in whole units and never past the next rung's price; the field holds the rest.
    const left = {
      alloy: clan.treasuryAlloy + field!.alloy,
      crystal: clan.treasuryCrystal + field!.crystal,
      deuterium: clan.treasuryDeuterium + field!.deuterium,
    };
    expect(clanVictoryWreck(left, clanLevelUpgradeCost(1)).purse)
      .toEqual({ alloy: clan.treasuryAlloy, crystal: clan.treasuryCrystal, deuterium: clan.treasuryDeuterium });
    expect(clan.treasuryAlloy).toBeLessThanOrEqual(clanLevelUpgradeCost(1).alloy);
    // The report names the field anyone may still fly out to.
    expect(report.wreckValue).toBeCloseTo(field!.alloy + field!.crystal + field!.deuterium, 6);
    expect(events).toEqual([expect.objectContaining({
      kind: 'VICTORY_WRECK', actorPlayerId: null, alloy: clan.treasuryAlloy, crystal: clan.treasuryCrystal,
    })]);
  });

  it('tells the defending line what went to the purse, and never the raider', async () => {
    const { clan, viewOf } = await defended(22_303, true);
    const paid = { alloy: clan.treasuryAlloy, crystal: clan.treasuryCrystal, deuterium: clan.treasuryDeuterium };
    expect((await viewOf(1))?.clanPurse).toEqual(paid);
    expect((await viewOf(0))?.clanPurse).toEqual(paid);
    expect((await viewOf(3))?.clanPurse).toBeNull();
  });

  it('pays nothing for a defence nobody supported', async () => {
    const { report, clan, events, viewOf } = await defended(22_302, false);
    expect((await viewOf(1))?.clanPurse).toBeNull();
    expect(report.grade).toBe('REPELLED');
    expect([clan.treasuryAlloy, clan.treasuryCrystal, clan.treasuryDeuterium]).toEqual([0, 0, 0]);
    expect(events).toEqual([]);
  });
});

/* ── E5 Saldıran riski görür ─────────────────────────────────────── */

describe('F2 probe — the raider reads what the clan has bought', () => {
  it('records the target clan’s level at the look, none outside a clan, and puts it on the wire', async () => {
    const f = await supportWorld(4, 22_401);
    const clanId = await formClan(f, 0, [1]);
    await levelUp(f, clanId, 5);
    const probe = async (from: number, to: number) => {
      const launched = await launchProbe(f.db, f.planetIds[from]!, f.planetIds[to]!, f.clock, f.playerIds[from]);
      const [mission] = await f.db.select().from(missions).where(eq(missions.id, launched.missionId));
      f.clock.set(new Date(mission!.arriveAt.getTime() + 30_000));
      await worker(f).tick();
      const [report] = await f.db.select().from(probeReports).where(eq(probeReports.missionId, launched.missionId));
      return { report: report!, mission: mission! };
    };
    const inClan = await probe(3, 1);
    expect(inClan.report.clanLevel).toBe(5);
    expect((await probe(1, 3)).report.clanLevel).toBeNull();

    // Home, and read through the route the client parses.
    const { mission } = inClan;
    f.clock.set(new Date(mission.arriveAt.getTime() + (mission.arriveAt.getTime() - mission.departAt.getTime()) + 60_000));
    await worker(f).tick();
    const built = buildApp({ db: f.db, env: testEnv(), clock: f.clock, logger: silent });
    try {
      const authorization = `Bearer ${await built.app.tokens.issueAccess(f.accountIds[3]!)}`;
      const response = await built.app.inject({ url: '/api/intel', headers: { authorization } });
      const report = intelSchema.parse(response.json()).probeReports.find((r) => r.missionId === mission.id);
      expect(report).toMatchObject({ clanLevel: 5 });
    } finally {
      await built.close();
    }
  });
});

/* ── E1 tek dokunuş yanıt · E6 ev sahibi cevabı görür ─────────────── */

describe('F2 answering the alarm', () => {
  /** World 1 raided with its alarm raised to commanders 0 and 2; returns the alarm row. */
  async function alarmed(seed: number) {
    const f = await supportWorld(4, seed);
    const clanId = await formClan(f, 0, [1, 2]);
    await levelUp(f, clanId, 2);
    await giveSatellite(f.db, f.planetIds[1]!, 'UPLINK');
    await giveInstrument(f.db, f.planetIds[1]!, 'RADAR', 5);
    await giveUnits(f.db, f.planetIds[3]!, { DART: 30 });
    const launched = await launchAttack(f.db, f.planetIds[3]!, f.planetIds[1]!, { DART: 30 }, f.clock, f.playerIds[3], true);
    const [mission] = await f.db.select().from(missions).where(eq(missions.id, launched.missionId));
    const [check] = await f.db.select().from(scheduledEvents).where(and(
      eq(scheduledEvents.refId, launched.missionId), eq(scheduledEvents.kind, 'radar_warning')));
    f.clock.set(new Date(Math.max(check!.resolveAt.getTime(), mission!.arriveAt.getTime() - 5 * 60_000)));
    await worker(f).tick();
    const [alarm] = await f.db.select().from(clanAlarms).where(eq(clanAlarms.missionId, launched.missionId));
    expect(alarm).toBeDefined();
    return { f, alarm: alarm! };
  }

  const answer = (f: Fixture, alarmId: string, hostPlanet = 1) => f.db.transaction((tx) => sendClanSupport(tx, {
    senderPlayerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!, hostPlanetId: f.planetIds[hostPlanet]!,
    fleet: WAVE, clock: f.clock, alarmId,
  }));

  it('ties a wave sent in answer to the alarm it answers', async () => {
    const { f, alarm } = await alarmed(22_501);
    const { wave } = await answer(f, alarm.id);
    const [row] = await f.db.select().from(clanSupportWaves).where(eq(clanSupportWaves.id, wave.id));
    expect(row?.alarmId).toBe(alarm.id);
    expect(wave.alarmId).toBe(alarm.id);
  });

  it('refuses an answer aimed at a world the alarm was not raised for', async () => {
    const { f, alarm } = await alarmed(22_502);
    await expect(answer(f, alarm.id, 2)).rejects.toMatchObject({ code: 'CLAN_ALARM_MISMATCH' });
  });

  it('shows the host who was called, who has seen it and who is on the way', async () => {
    const { f, alarm } = await alarmed(22_503);
    const bay = async () => (await f.db.transaction((tx) => planetView(tx, f.planetIds[1]!, f.clock))).clanSupport!;
    expect((await bay()).alarms).toEqual([{ id: alarm.id, missionId: alarm.missionId, arriveAt: alarm.arriveAt.toISOString(), called: 2, seen: 0, answered: 0 }]);
    await f.db.update(notifications).set({ seen: true })
      .where(and(eq(notifications.playerId, f.playerIds[0]!), eq(notifications.kind, 'clan_alarm')));
    await answer(f, alarm.id);
    const after = await bay();
    expect(after.alarms).toEqual([expect.objectContaining({ called: 2, seen: 1, answered: 1 })]);
    expect(after.waves.find((wave) => wave.alarmId === alarm.id)).toBeDefined();
  });
});

/* ── P6 Katkı Defteri ─────────────────────────────────────────────── */

describe('F2 contribution ledger — who carries the clan this season', () => {
  it('counts each member’s donations, support, aid and alarm answers, and splits the next rung by donor', async () => {
    const { f, alarm } = await (async () => {
      const g = await supportWorld(4, 22_601);
      const clanId = await formClan(g, 0, [1, 2]);
      await levelUp(g, clanId, 2);
      const [row] = await g.db.insert(clanAlarms).values({
        seasonId: g.seasonId, clanId, missionId: (await g.db.insert(missions).values({
          seasonId: g.seasonId, kind: 'attack', ownerPlayerId: g.playerIds[3]!, originPlanetId: g.planetIds[3]!,
          targetPlanetId: g.planetIds[1]!, fleet: { DART: 1 }, distance: 1, fuelPaid: 0, departAt: g.clock.now(),
          arriveAt: new Date(g.clock.now().getTime() + 3_600_000),
        }).returning({ id: missions.id }))[0]!.id,
        hostPlayerId: g.playerIds[1]!, hostPlanetId: g.planetIds[1]!,
        arriveAt: new Date(g.clock.now().getTime() + 3_600_000), createdAt: g.clock.now(),
      }).returning();
      return { f: g, alarm: row! };
    })();
    const actor = async (index: number) => clanActor(f.db, f.accountIds[index]!);
    // Commander 0: two donations, one wave sent from the alarm.
    for (const alloy of [100, 50]) {
      await f.db.transaction(async (tx) => donateToClanTreasury(tx, {
        actor: await clanActor(tx, f.accountIds[0]!), planetId: f.planetIds[0]!, resources: { alloy, crystal: 0, deuterium: 0 }, clock: f.clock,
      }));
    }
    await f.db.transaction((tx) => sendClanSupport(tx, {
      senderPlayerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!, hostPlanetId: f.planetIds[1]!,
      fleet: WAVE, clock: f.clock, alarmId: alarm.id,
    }));
    // Commander 2: a wave of their own and a delivery.
    await f.db.transaction((tx) => sendClanSupport(tx, {
      senderPlayerId: f.playerIds[2]!, originPlanetId: f.planetIds[2]!, hostPlanetId: f.planetIds[1]!, fleet: { DART: 5 }, clock: f.clock,
    }));
    await f.db.transaction((tx) => launchClanAid(tx, {
      senderPlayerId: f.playerIds[2]!, originPlanetId: f.planetIds[2]!, recipientPlayerId: f.playerIds[1]!,
      targetPlanetId: f.planetIds[1]!, fleet: { COURIER: 2 }, cargo: { alloy: 500, crystal: 0, deuterium: 0 }, clock: f.clock,
    }));

    const ledger = await readClanLedger(f.db, await actor(1));
    const row = (index: number) => ledger.members.find((member) => member.playerId === f.playerIds[index]);
    expect(ledger.members).toHaveLength(3);
    expect(row(0)).toMatchObject({
      donated: { alloy: 150, crystal: 0, deuterium: 0 },
      towardNext: { alloy: 150, crystal: 0, deuterium: 0 },
      supportWaves: 1, supportShips: 20, supportBattles: 0, alarmAnswers: 1, aidSent: 0, jointWar: 0,
    });
    expect(row(2)).toMatchObject({ donated: { alloy: 0, crystal: 0, deuterium: 0 }, supportWaves: 1, supportShips: 5, alarmAnswers: 0, aidSent: 1 });
    expect(row(1)).toMatchObject({ supportWaves: 0, aidSent: 0 });
    expect(row(0)!.name.length).toBeGreaterThan(0);

    // Buying the rung spends the purse: the bar starts again, the season's totals do not.
    f.clock.advance(1);
    await f.db.update(clans).set({ level: 1, treasuryAlloy: clanLevelUpgradeCost(1).alloy, treasuryCrystal: clanLevelUpgradeCost(1).crystal });
    await f.db.transaction(async (tx) => upgradeClanLevel(tx, { actor: await clanActor(tx, f.accountIds[0]!), expectedLevel: 1, clock: f.clock }));
    const bought = await readClanLedger(f.db, await actor(0));
    expect(bought.members.find((member) => member.playerId === f.playerIds[0])).toMatchObject({
      donated: { alloy: 150 }, towardNext: { alloy: 0, crystal: 0, deuterium: 0 },
    });
  });

  it('is the clan’s own: a commander outside it is refused', async () => {
    const f = await supportWorld(4, 22_602);
    await formClan(f, 0, [1]);
    await expect(readClanLedger(f.db, await clanActor(f.db, f.accountIds[3]!))).rejects.toMatchObject({ code: 'NOT_IN_CLAN' });
  });
});

describe('F2 ledger route', () => {
  it('serves the ledger to a member through GET /api/clan/ledger, in the shape the client parses', async () => {
    const f = await supportWorld(4, 22_603);
    await formClan(f, 0, [1]);
    const built = buildApp({ db: f.db, env: testEnv(), clock: f.clock, logger: silent });
    try {
      const authorization = `Bearer ${await built.app.tokens.issueAccess(f.accountIds[1]!)}`;
      const response = await built.app.inject({ url: '/api/clan/ledger', headers: { authorization } });
      expect(response.statusCode).toBe(200);
      expect(clanLedgerSchema.parse(response.json()).members).toHaveLength(2);
    } finally {
      await built.close();
    }
  });
});

/* ── E2 Klan sohbetine savaş akışı ───────────────────────────────── */

describe('F2 clan chat battle feed', () => {
  const feed = async (f: Fixture, reader: number) => (await readClanChat(f.db, f.accountIds[reader]!, { limit: 50, now: f.clock.now() }))
    .messages.filter((message) => message.event);

  it('posts the alarm under the host’s name, and the answering wave under the sender’s', async () => {
    const f = await supportWorld(4, 22_701);
    const clanId = await formClan(f, 0, [1, 2]);
    await levelUp(f, clanId, 2);
    await giveSatellite(f.db, f.planetIds[1]!, 'UPLINK');
    await giveInstrument(f.db, f.planetIds[1]!, 'RADAR', 3);
    await giveUnits(f.db, f.planetIds[3]!, { DART: 30 });
    const launched = await launchAttack(f.db, f.planetIds[3]!, f.planetIds[1]!, { DART: 30 }, f.clock, f.playerIds[3], true);
    const [mission] = await f.db.select().from(missions).where(eq(missions.id, launched.missionId));
    f.clock.set(new Date(mission!.arriveAt.getTime() - 20_000));
    await worker(f).tick();
    const [alarm] = await f.db.select().from(clanAlarms).where(eq(clanAlarms.missionId, launched.missionId));
    await f.db.transaction((tx) => sendClanSupport(tx, {
      senderPlayerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!, hostPlanetId: f.planetIds[1]!,
      fleet: WAVE, clock: f.clock, alarmId: alarm!.id,
    }));
    const events = await feed(f, 2);
    expect(events.map((message) => [message.authorPlayerId, message.event!.kind])).toEqual([
      [f.playerIds[1], 'ALARM'],
      [f.playerIds[0], 'SUPPORT_SENT'],
    ]);
    const [alarmParams, sentParams] = [events[0]!.event!.params, events[1]!.event!.params];
    expect(typeof alarmParams.hostName).toBe('string');
    expect(typeof alarmParams.hostPlanetName).toBe('string');
    expect(alarmParams.arriveAt).toBe(mission!.arriveAt.toISOString());
    expect(typeof sentParams.senderName).toBe('string');
    expect(sentParams).toMatchObject({ ships: 20, answering: true });
    expect(events.every((message) => message.content === '')).toBe(true);
    // The bell's alarm names the host too, so the card can say whose world it is.
    const [bell] = await f.db.select().from(notifications)
      .where(and(eq(notifications.playerId, f.playerIds[2]!), eq(notifications.kind, 'clan_alarm')));
    expect(bell?.payload).toMatchObject({ hostName: events[0]!.event!.params.hostName });
  });

  it('posts a supported defence’s result with its hero, and a rung bought', async () => {
    const f = await supportWorld(4, 22_702);
    const clanId = await formClan(f, 0, [1, 2]);
    await giveUnits(f.db, f.planetIds[0]!, { PIKE: 60 });
    const { wave } = await f.db.transaction((tx) => sendClanSupport(tx, {
      senderPlayerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!, hostPlanetId: f.planetIds[1]!, fleet: { PIKE: 60 }, clock: f.clock,
    }));
    f.clock.set(new Date(new Date(wave.arriveAt).getTime() + 1_000));
    await worker(f).tick();
    await giveUnits(f.db, f.planetIds[3]!, { DART: 60 });
    const launched = await launchAttack(f.db, f.planetIds[3]!, f.planetIds[1]!, { DART: 60 }, f.clock, f.playerIds[3], true);
    const [mission] = await f.db.select().from(missions).where(eq(missions.id, launched.missionId));
    f.clock.set(new Date(mission!.arriveAt.getTime() + 30_000));
    await worker(f).tick();
    const [report] = await f.db.select().from(battleReports).where(eq(battleReports.missionId, launched.missionId));
    const defence = (await feed(f, 2)).find((message) => message.event!.kind === 'DEFENCE');
    expect(defence?.authorPlayerId).toBe(f.playerIds[1]);
    expect(defence?.event?.params).toMatchObject({
      grade: report!.grade, supporters: 1, attackerLost: Object.values(report!.attackerLosses).reduce((a, b) => a + b, 0),
    });
    const heroName = defence?.event?.params.heroName;
    if (report!.grade === 'REPELLED') expect(typeof heroName).toBe('string');
    else expect(heroName).toBeNull();
    // E3: the clan ladder counts the watches its members stood this season.
    const ladder = await clanLeaderboard(f.db, f.accountIds[2]!);
    expect(ladder.clans.find((clan) => clan.id === clanId)?.watches).toBe(1);

    const cost = clanLevelUpgradeCost(1);
    await f.db.update(clans).set({ treasuryAlloy: cost.alloy, treasuryCrystal: cost.crystal, treasuryDeuterium: cost.deuterium })
      .where(eq(clans.id, clanId));
    f.clock.advance(1);
    await f.db.transaction(async (tx) => upgradeClanLevel(tx, { actor: await clanActor(tx, f.accountIds[0]!), expectedLevel: 1, clock: f.clock }));
    const rung = (await feed(f, 1)).find((message) => message.event!.kind === 'LEVEL_UP');
    expect(rung).toMatchObject({ authorPlayerId: f.playerIds[0], event: { params: { level: 2 } } });
  });

  it('never spends the author’s own chat allowance', async () => {
    const f = await supportWorld(3, 22_703);
    const clanId = await formClan(f, 0, [1]);
    const [season] = await f.db.select({ seasonId: clans.seasonId }).from(clans).where(eq(clans.id, clanId));
    await f.db.transaction(async (tx) => {
      for (let i = 0; i < CLAN.chatBurst + 1; i++) {
        await postClanEvent(tx, { clanId, seasonId: season!.seasonId, authorPlayerId: f.playerIds[0]!,
          event: { kind: 'LEVEL_UP', params: { level: 2 } }, now: f.clock.now() });
      }
    });
    await expect(f.db.transaction((tx) => postClanChat(tx, { playerId: f.playerIds[0]!, content: 'geliyorum', clock: f.clock })))
      .resolves.toMatchObject({ content: 'geliyorum' });
  });
});

/* ── Etiket kademesi: L3 bronz · L6 gümüş · L10 altın (owner 2026-11-10) ─ */

describe('F2 the clan tag colour travels with the tag', () => {
  it('reaches the galaxy, the ladder and both chats as a tier, never as the level', async () => {
    const f = await supportWorld(4, 22_801);
    const clanId = await formClan(f, 0, [1, 2]);
    await levelUp(f, clanId, 6);
    const built = buildApp({ db: f.db, env: testEnv(), clock: f.clock, logger: silent });
    try {
      // The reader sits outside the clan: the tier is public, as the tag is.
      const authorization = `Bearer ${await built.app.tokens.issueAccess(f.accountIds[3]!)}`;
      const board = leaderboardSchema.parse((await built.app.inject({ url: '/api/leaderboard', headers: { authorization } })).json());
      expect(board.ladder.find((row) => row.playerId === f.playerIds[0])?.clan?.tier).toBe('SILVER');
      expect(board.ladder.find((row) => row.playerId === f.playerIds[3])?.clan ?? null).toBeNull();
      const galaxy = galaxySchema.parse((await built.app.inject({ url: '/api/galaxy', headers: { authorization } })).json());
      const world = galaxy.planets.find((planet) => planet.id === f.planetIds[1]);
      expect(world?.clan).toEqual(expect.objectContaining({ tier: 'SILVER' }));
      expect(JSON.stringify(world?.clan)).not.toContain('level');
    } finally {
      await built.close();
    }
    const typed = await f.db.transaction((tx) => postClanChat(tx, { playerId: f.playerIds[0]!, content: 'nöbetteyim', clock: f.clock }));
    expect(typed).toMatchObject({ clanTier: 'SILVER' });
    const room = await readClanChat(f.db, f.accountIds[1]!, { limit: 10, now: f.clock.now() });
    expect(room.messages.find((message) => message.id === typed.id)).toMatchObject({ clanTier: 'SILVER' });
    // The galaxy's open channel names the same colour beside the same tag.
    expect(await postChat(f.db, f.accountIds[0]!, 'selam galaksi', f.clock)).toMatchObject({ clanTier: 'SILVER' });
  });

  it('stays plain for a clan below level 3', async () => {
    const f = await supportWorld(3, 22_802);
    const clanId = await formClan(f, 0, [1]);
    await levelUp(f, clanId, 2);
    const typed = await f.db.transaction((tx) => postClanChat(tx, { playerId: f.playerIds[0]!, content: 'merhaba', clock: f.clock }));
    expect(typed.clanTier).toBeNull();
  });
});
