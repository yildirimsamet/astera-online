import { pino } from 'pino';
import { and, eq, sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { adjustDefendedDominion, defendedTransfer, hangarLoad, supportFactor, type Fleet } from '@astera/rules';
import {
  battleReports,
  clanScoreEvents,
  clanSupportBattleResults,
  clanSupportDominionEvents,
  clanSupportWaves,
  dominionEvents,
  missions,
  notifications,
  planets,
  players,
  units,
} from '../src/db/schema.js';
import { sendClanSupport, setDefencePosture } from '../src/services/clanSupport.js';
import { launchAttack } from '../src/services/mission.js';
import { EventWorker } from '../src/worker/loop.js';
import { giveUnits, setLevel, testDb, type Fixture } from './helpers.js';
import { formClan, supportWorld } from './clanSupportFixture.js';

/**
 * KLAN SAVUNMA DESTEĞİ — a supported world raided (`docs/clan-defense-support-plan.md`, P8).
 *
 * Commander 1 holds world 1 at SUPPORT; commander 0 stands a wave of Pikes there (a hull
 * the host does not own, so a leak into the host's home would show). Commander 3, outside
 * the clan, raids world 1.
 */

afterAll(async () => { await (await testDb()).close(); });
const silent = pino({ level: 'silent' });
const worker = (f: Fixture) => new EventWorker(f.db, f.clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, silent);
const at = async (f: Fixture, ms: number) => {
  f.clock.set(new Date(ms));
  await worker(f).tick();
};

const setPosture = (f: Fixture, planet: number, escape: boolean, support: boolean) =>
  f.db.transaction((tx) => setDefencePosture(tx, {
    planetId: f.planetIds[planet]!,
    playerId: f.playerIds[planet]!,
    toggles: { escape, support },
    clock: f.clock,
  }));

const homeOf = async (f: Fixture, planet: number): Promise<Fleet> => {
  const rows = await f.db.select().from(units)
    .where(and(eq(units.planetId, f.planetIds[planet]!), eq(units.location, 'home')));
  return Object.fromEntries(rows.filter((row) => row.count > 0).map((row) => [row.hull, row.count]));
};

async function landRaid(f: Fixture, missionId: string): Promise<void> {
  const [mission] = await f.db.select().from(missions).where(eq(missions.id, missionId));
  await at(f, mission!.arriveAt.getTime() + 30_000);
}

/** World 1 at SUPPORT with commander 0's Pikes standing in it. */
async function supported(seed: number, wave: Fleet = { PIKE: 40 }) {
  const f = await supportWorld(4, seed);
  await formClan(f, 0, [1, 2]);
  await giveUnits(f.db, f.planetIds[0]!, { PIKE: 200 });
  await setPosture(f, 1, false, true);
  const { wave: sent } = await f.db.transaction((tx) => sendClanSupport(tx, {
    senderPlayerId: f.playerIds[0]!,
    originPlanetId: f.planetIds[0]!,
    hostPlanetId: f.planetIds[1]!,
    fleet: wave,
    clock: f.clock,
  }));
  await at(f, new Date(sent.arriveAt).getTime() + 1_000);
  return { f, waveId: sent.id };
}

const raid = async (f: Fixture, fleet: Fleet) => {
  await giveUnits(f.db, f.planetIds[3]!, fleet);
  const launched = await launchAttack(f.db, f.planetIds[3]!, f.planetIds[1]!, fleet, f.clock, f.playerIds[3], true);
  return launched.missionId;
};

describe('a raid on a supported world', () => {
  it('fights host and wave as one line, and writes each one’s survivors back to its owner', async () => {
    const { f, waveId } = await supported(15_401);
    const hostBefore = await homeOf(f, 1);
    const missionId = await raid(f, { DART: 150 });
    await landRaid(f, missionId);

    const [report] = await f.db.select().from(battleReports).where(eq(battleReports.missionId, missionId));
    expect(report!.defenderCount).toBe(2);
    expect(report!.defenderFleet.PIKE).toBe(40);

    // No Pike ever lands in the host's home, whatever the wave lost.
    expect((await homeOf(f, 1)).PIKE ?? 0).toBe(0);
    expect(hostBefore.PIKE ?? 0).toBe(0);

    const [wave] = await f.db.select().from(clanSupportWaves).where(eq(clanSupportWaves.id, waveId));
    const left = await f.db.select().from(units).where(eq(units.location, wave!.unitLocation));
    const survivors: Fleet = Object.fromEntries(left.filter((row) => row.count > 0).map((row) => [row.hull, row.count]));
    const [mine] = await f.db.select().from(clanSupportBattleResults).where(and(
      eq(clanSupportBattleResults.reportId, report!.id),
      eq(clanSupportBattleResults.playerId, f.playerIds[0]!),
    ));
    expect(mine).toMatchObject({ role: 'SUPPORT', sent: { PIKE: 40 } });
    expect(survivors).toEqual(Object.fromEntries(Object.entries(mine!.survivors).filter(([, n]) => n > 0)));
    expect(wave!.battles).toBe(1);
    if (Object.keys(survivors).length > 0) {
      expect(wave!.status).toBe('STATIONED');
      expect(wave!.reservedBulk).toBe(hangarLoad(survivors));
    }

    const [host] = await f.db.select().from(clanSupportBattleResults).where(and(
      eq(clanSupportBattleResults.reportId, report!.id),
      eq(clanSupportBattleResults.playerId, f.playerIds[1]!),
    ));
    expect(host!.role).toBe('HOST');
    expect(host!.lootLost).not.toBeNull();

    const told = await f.db.select().from(notifications).where(and(
      eq(notifications.playerId, f.playerIds[0]!),
      eq(notifications.kind, 'clan_support_result'),
    ));
    expect(told).toHaveLength(1);
    expect(told[0]!.payload).toMatchObject({ reportId: report!.id });
  });

  /*
    OWNER DECISION, 2026-10-02. Only the host's Dominion moves; the support multiplies it by
    line power ÷ host power (at most ×5): a host who loses loses ×D, one who wins gains ÷D.
  */
  const ledger = async (f: Fixture) => {
    const rows = await f.db.select({ id: players.id, taken: players.dominionTaken, lost: players.dominionLost }).from(players);
    return new Map(rows.map((row) => [row.id, row.taken - row.lost]));
  };

  /** Raid the supported world and read back every figure the ladder moved by. */
  async function scored(f: Fixture, fleet: Fleet) {
    const before = await ledger(f);
    const missionId = await raid(f, fleet);
    await landRaid(f, missionId);
    const after = await ledger(f);
    const delta = (player: number) => (after.get(f.playerIds[player]!) ?? 0) - (before.get(f.playerIds[player]!) ?? 0);
    const [report] = await f.db.select().from(battleReports).where(eq(battleReports.missionId, missionId));
    const lines = await f.db.select().from(clanSupportBattleResults)
      .where(eq(clanSupportBattleResults.reportId, report!.id));
    const journal = await f.db.select().from(clanSupportDominionEvents)
      .where(eq(clanSupportDominionEvents.missionId, missionId));
    const hostPower = lines.find((row) => row.role === 'HOST')!.power;
    const supportPower = lines.filter((row) => row.role === 'SUPPORT').reduce((sum, row) => sum + row.power, 0);
    const base = journal.find((row) => row.role === 'ATTACKER')!.baseExchange;
    // What the supporters' ships were worth when they died: written at face value (owner, (b)).
    const supportLoss = lines.filter((row) => row.role === 'SUPPORT').reduce((sum, row) => sum + row.lossValue, 0);
    return { missionId, delta, report: report!, lines, journal, hostPower, supportPower, base, supportLoss };
  }

  it('moves only the host, by the transfer the support multiplied, and keeps the ladder zero-sum', async () => {
    const { f } = await supported(15_402);
    const { missionId, delta, report, lines, journal, hostPower, supportPower, base, supportLoss } = await scored(f, { DART: 150 });

    // The supporter (0) and the bystander (2) never move; the host (1) carries the whole side.
    expect(delta(0)).toBe(0);
    expect(delta(2)).toBe(0);
    expect(delta(1)).toBe(-delta(3));
    expect(delta(3)).toBe(defendedTransfer(base, supportLoss, 1, supportFactor({ hostPower, supportPower })));
    // The host's own fight was multiplied; the wave's losses were not.
    expect(delta(3) - supportLoss).toBe(adjustDefendedDominion(base - supportLoss, 1, supportFactor({ hostPower, supportPower })));
    expect(report.dominionSwing).toBe(delta(3));

    expect(await f.db.select().from(dominionEvents).where(eq(dominionEvents.missionId, missionId))).toHaveLength(0);
    // The journal names the two whose ledgers moved: the raider and the host.
    expect(journal.map((row) => [row.role, row.playerId]).sort()).toEqual([
      ['ATTACKER', f.playerIds[3]], ['DEFENDER', f.playerIds[1]],
    ].sort());
    expect(journal.reduce((sum, row) => sum + row.delta, 0)).toBe(0);
    for (const row of journal) expect(row).toMatchObject({ attackerCount: 1, defenderCount: 2, adjustedTransfer: delta(3) });
    expect(lines.find((row) => row.role === 'SUPPORT')!.dominionDelta).toBe(0);
    expect(lines.find((row) => row.role === 'HOST')!.dominionDelta).toBe(delta(1));

    // The raider has no clan; the host's clan books the host's movement.
    const clanRows = await f.db.select().from(clanScoreEvents).where(eq(clanScoreEvents.missionId, missionId));
    expect(clanRows).toHaveLength(1);
    expect(clanRows[0]).toMatchObject({ side: 'DEFENCE', dominionDelta: delta(1) });

    // The supporter is told what their ships did, and nothing about a Dominion that did not move.
    const told = await f.db.select().from(notifications).where(and(
      eq(notifications.playerId, f.playerIds[0]!),
      eq(notifications.kind, 'clan_support_result'),
    ));
    expect(told[0]!.payload).not.toHaveProperty('dominion');
  });

  it('leaves the transfer ordinary when the wave brought nothing that fires', async () => {
    const { f } = await supported(15_408, { COURIER: 5 });
    const { delta, journal, supportPower, base } = await scored(f, { DART: 150 });
    expect(supportPower).toBe(0);
    expect(journal.find((row) => row.role === 'ATTACKER')!.adjustedTransfer).toBe(base);
    expect(delta(3)).toBe(base);
    expect(delta(0)).toBe(0);
  });

  it('puts a host with nothing of its own at the ×5 ceiling when the line breaks', async () => {
    const { f } = await supported(15_409, { PIKE: 10 });
    // The host's own ships and guns all gone: only the clanmate's wave stands there.
    await f.db.delete(units).where(and(eq(units.planetId, f.planetIds[1]!), eq(units.location, 'home')));
    const { delta, hostPower, base, supportLoss } = await scored(f, { DART: 1_500 });
    expect(hostPower).toBe(0);
    expect(base).toBeGreaterThan(0);
    expect(supportLoss).toBeGreaterThan(0);
    // ×5 on the host's own fight (the loot), the wave's destroyed ships once.
    expect(delta(3)).toBe(adjustDefendedDominion(base - supportLoss, 1, { num: 5, den: 1 }) + supportLoss);
    expect(delta(3)).toBeLessThan(adjustDefendedDominion(base, 1, { num: 5, den: 1 }));
    expect(delta(1)).toBe(-delta(3));
  });

  it('divides a host’s win by the support it was given', async () => {
    const { f } = await supported(15_410, { PIKE: 120 });
    const { delta, hostPower, supportPower, base, supportLoss } = await scored(f, { DART: 6 });
    expect(base).toBeLessThan(0);
    expect(delta(1)).toBeGreaterThan(0);
    const factor = supportFactor({ hostPower, supportPower });
    expect(delta(1)).toBe(-defendedTransfer(base, supportLoss, 1, factor));
    // Less than the ordinary win, because the line was more than the host.
    expect(delta(1)).toBeLessThan(-base);
    expect(delta(0)).toBe(0);
  });

  it('never lifts a supported line, however lopsided the raid', async () => {
    const { f } = await supported(15_403, { DART: 5 });
    const missionId = await raid(f, { DART: 3_000 });
    await landRaid(f, missionId);
    const [report] = await f.db.select().from(battleReports).where(eq(battleReports.missionId, missionId));
    expect(report!.fleetEscape).toBeNull();
  });

  it('sends a wave that drifted out of the tier band home before the shooting', async () => {
    const { f, waveId } = await supported(15_404);
    await setLevel(f.db, f.planetIds[0]!, 'CORE', 18);
    for (const index of [1, 3]) await setLevel(f.db, f.planetIds[index]!, 'CORE', 3);
    const missionId = await raid(f, { DART: 60 });
    await landRaid(f, missionId);
    const [wave] = await f.db.select().from(clanSupportWaves).where(eq(clanSupportWaves.id, waveId));
    expect(wave).toMatchObject({ status: 'RETURNING', returnReason: 'BAND', battles: 0 });
    const [report] = await f.db.select().from(battleReports).where(eq(battleReports.missionId, missionId));
    expect(report!.defenderCount).toBe(1);
    expect(report!.defenderFleet.PIKE ?? 0).toBe(0);
  });

  it('loses a wave the raid wipes out', async () => {
    const { f, waveId } = await supported(15_405, { PIKE: 2 });
    // Strip the host's own line so the raid has nothing else to chew through.
    await f.db.update(units).set({ count: 0 })
      .where(and(eq(units.planetId, f.planetIds[1]!), eq(units.location, 'home')));
    const missionId = await raid(f, { DART: 600 });
    await landRaid(f, missionId);
    const [wave] = await f.db.select().from(clanSupportWaves).where(eq(clanSupportWaves.id, waveId));
    expect(wave!.status).toBe('LOST');
    expect(await f.db.select().from(units).where(eq(units.location, wave!.unitLocation))).toHaveLength(0);
  });
});

describe('the posture alone decides the retreat', () => {
  async function bare(seed: number, escape: boolean, support: boolean) {
    const f = await supportWorld(4, seed);
    await formClan(f, 0, [1]);
    await setPosture(f, 1, escape, support);
    const missionId = await raid(f, { DART: 3_000 });
    await landRaid(f, missionId);
    const [report] = await f.db.select().from(battleReports).where(eq(battleReports.missionId, missionId));
    return report!;
  }

  it('lifts an ESCAPE world from a crushing raid, as before', async () => {
    expect((await bare(15_406, true, false)).fleetEscape).toMatchObject({ kind: 'ESCAPED' });
  });

  it('holds a HOLD world — and a SUPPORT world nobody has supported yet', async () => {
    expect((await bare(15_407, false, false)).fleetEscape).toBeNull();
    expect((await bare(15_408, false, true)).fleetEscape).toBeNull();
  });
});

describe('a world nobody supports', () => {
  it('settles exactly as an ordinary raid always has', async () => {
    const f = await supportWorld(4, 15_409);
    const missionId = await raid(f, { DART: 80 });
    await landRaid(f, missionId);
    const [report] = await f.db.select().from(battleReports).where(eq(battleReports.missionId, missionId));
    expect(report!.defenderCount).toBe(1);
    expect(await f.db.select().from(dominionEvents).where(eq(dominionEvents.missionId, missionId))).toHaveLength(1);
    expect(await f.db.select().from(clanSupportBattleResults)).toHaveLength(0);
    const [world] = await f.db.select({ shield: planets.shield }).from(planets).where(eq(planets.id, f.planetIds[1]!));
    expect(world).toBeDefined();
  });
});

/*
  THE ONE LOCK ORDER, WITH A SUPPORTER IN THE LINE. A supporter's Dominion never moves, but
  the battle still writes their row (`settleStations` recomputes their wealth), so the row is
  taken with the ledgers, in id order — never late, after the attacker's is already held. A
  late take deadlocks against a commander who locks players in id order (any launch).
*/
describe('the supporter’s player row in the lock order', () => {
  it('is waited for before the attacker’s ledger is taken, not after', async () => {
    const f = await supportWorld(4, 15_411);
    // Roles by id: the supporter has the smallest, the attacker the largest.
    const order = [0, 1, 2, 3].sort((a, b) => (f.playerIds[a]! < f.playerIds[b]! ? -1 : 1));
    const [supporter, host, , attacker] = order as [number, number, number, number];
    await formClan(f, host, [supporter]);
    await setPosture(f, host, false, true);
    await giveUnits(f.db, f.planetIds[supporter]!, { PIKE: 60 });
    const { wave } = await f.db.transaction((tx) => sendClanSupport(tx, {
      senderPlayerId: f.playerIds[supporter]!,
      originPlanetId: f.planetIds[supporter]!,
      hostPlanetId: f.planetIds[host]!,
      fleet: { PIKE: 40 },
      clock: f.clock,
    }));
    await at(f, new Date(wave.arriveAt).getTime() + 1_000);
    await giveUnits(f.db, f.planetIds[attacker]!, { DART: 150 });
    const launched = await launchAttack(
      f.db, f.planetIds[attacker]!, f.planetIds[host]!, { DART: 150 }, f.clock, f.playerIds[attacker], true,
    );
    const [mission] = await f.db.select().from(missions).where(eq(missions.id, launched.missionId));

    // Another commander holds the supporter's row, as a launch in id order would.
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    let taken!: () => void;
    const lockTaken = new Promise<void>((resolve) => { taken = resolve; });
    const holder = f.db.transaction(async (tx) => {
      await tx.select({ id: players.id }).from(players).where(eq(players.id, f.playerIds[supporter]!)).for('update');
      taken();
      await held;
    });
    await lockTaken;
    const settling = at(f, mission!.arriveAt.getTime() + 30_000);
    await new Promise((resolve) => setTimeout(resolve, 2_000));

    // The battle is waiting — and it is waiting BEFORE it holds the attacker's ledger.
    let attackerFree = true;
    try {
      await f.db.execute(sql`select id from players where id = ${f.playerIds[attacker]!} for update nowait`);
    } catch {
      attackerFree = false;
    }
    release();
    await holder;
    await settling;
    expect(attackerFree).toBe(true);
    const [report] = await f.db.select().from(battleReports).where(eq(battleReports.missionId, launched.missionId));
    expect(report!.defenderCount).toBe(2);
  });
});
