import { pino } from 'pino';
import { and, eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { defendedTransfer, supportFactor, type Fleet } from '@astera/rules';
import {
  battleReports,
  clanSupportBattleResults,
  clanSupportWaves,
  clanTreasuryEvents,
  clans,
  clanWarDominionEvents,
  missions,
  notifications,
  players,
  units,
} from '../src/db/schema.js';
import { clanActor } from '../src/services/clan.js';
import { sendClanSupport, setDefencePosture } from '../src/services/clanSupport.js';
import { markClanWarTarget, sendClanWarContribution, startClanWar } from '../src/services/clanWar.js';
import { EventWorker } from '../src/worker/loop.js';
import { giveUnits, testDb, type Fixture } from './helpers.js';
import { formClan, supportWorld } from './clanSupportFixture.js';

/**
 * KLAN SAVUNMA DESTEĞİ — a clan's joint war against a supported world
 * (`docs/clan-defense-support-plan.md`, P9). Both sides are plural.
 *
 * Attacking clan: 0 leads, 1 contributes. Defending clan: 2 holds world 2 at SUPPORT,
 * 3 stands a wave of Pikes there.
 */

afterAll(async () => { await (await testDb()).close(); });
const silent = pino({ level: 'silent' });
const worker = (f: Fixture) => new EventWorker(f.db, f.clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, silent);
const at = async (f: Fixture, ms: number) => {
  f.clock.set(new Date(ms));
  await worker(f).tick();
};
const landAll = async (f: Fixture) => {
  const rows = await f.db.select({ arriveAt: missions.arriveAt }).from(missions).where(eq(missions.status, 'in_flight'));
  const latest = rows.reduce((max, row) => Math.max(max, row.arriveAt.getTime()), f.clock.now().getTime());
  await at(f, latest + 30_000);
};

const ledgerSnapshot = async (f: Fixture) => {
  const rows = await f.db.select({ id: players.id, taken: players.dominionTaken, lost: players.dominionLost }).from(players);
  return new Map(rows.map((row) => [row.id, row.taken - row.lost]));
};

async function battle(seed: number, attackWith: Fleet, toggles = { escape: false, support: true }) {
  const f = await supportWorld(4, seed);
  await giveUnits(f.db, f.planetIds[3]!, { PIKE: 120 });
  for (const planet of [0, 1]) await giveUnits(f.db, f.planetIds[planet]!, attackWith);
  const raiders = await formClan(f, 0, [1], { name: 'Raiders', tag: 'RD' });
  // A tall Klan Hangarı, so the pool's size is the test's choice rather than the ladder's.
  await f.db.update(clans).set({ level: 8 }).where(eq(clans.id, raiders));
  await formClan(f, 2, [3], { name: 'Wardens', tag: 'WD' });
  await f.db.transaction((tx) => setDefencePosture(tx, {
    planetId: f.planetIds[2]!,
    playerId: f.playerIds[2]!,
    toggles,
    clock: f.clock,
  }));
  await f.db.transaction((tx) => sendClanSupport(tx, {
    senderPlayerId: f.playerIds[3]!,
    originPlanetId: f.planetIds[3]!,
    hostPlanetId: f.planetIds[2]!,
    fleet: { PIKE: 60 },
    clock: f.clock,
  }));
  await landAll(f);

  await f.db.transaction(async (tx) => markClanWarTarget(tx, {
    actor: await clanActor(tx, f.accountIds[0]!),
    targetPlanetId: f.planetIds[2]!,
    clock: f.clock,
  }));
  for (const index of [0, 1]) {
    await f.db.transaction(async (tx) => sendClanWarContribution(tx, {
      actor: await clanActor(tx, f.accountIds[index]!),
      originPlanetId: f.planetIds[index]!,
      fleet: attackWith,
      acknowledgeShieldLoss: true,
      clock: f.clock,
    }));
  }
  await landAll(f);
  const before = await ledgerSnapshot(f);
  const started = await f.db.transaction(async (tx) => startClanWar(tx, {
    actor: await clanActor(tx, f.accountIds[0]!),
    acknowledgeShieldLoss: true,
    clock: f.clock,
  }));
  await landAll(f);
  const [report] = await f.db.select().from(battleReports).where(eq(battleReports.missionId, started.missionId));
  return { f, report: report!, before, after: await ledgerSnapshot(f), missionId: started.missionId };
}

describe('a joint war meets a supported line', () => {
  it('fights both pools, books both teams and keeps the ladder exactly zero-sum', async () => {
    const { f, report, before, after } = await battle(15_501, { DART: 90, COURIER: 6 });
    expect(report.defenderCount).toBe(2);
    expect(report.defenderFleet.PIKE).toBe(60);
    const delta = (index: number) => (after.get(f.playerIds[index]!) ?? 0) - (before.get(f.playerIds[index]!) ?? 0);
    expect(delta(0) + delta(1) + delta(2) + delta(3)).toBe(0);
    // The supporter (3) never moves; the host (2) carries the defending side (owner, 2026-10-02).
    expect(delta(3)).toBe(0);

    const audit = await f.db.select().from(clanWarDominionEvents).where(eq(clanWarDominionEvents.reportId, report.id));
    expect(audit.filter((row) => row.role === 'DEFENDER').map((row) => row.playerId)).toEqual([f.playerIds[2]]);
    for (const row of audit) expect(row).toMatchObject({ attackerCount: 2, defenderCount: 2 });
    expect(audit.reduce((sum, row) => sum + row.delta, 0)).toBe(0);

    const results = await f.db.select().from(clanSupportBattleResults).where(eq(clanSupportBattleResults.reportId, report.id));
    expect(results.map((row) => row.role).sort()).toEqual(['HOST', 'SUPPORT']);
    // Two attackers' head count against the support factor read from power.
    const hostPower = results.find((row) => row.role === 'HOST')!.power;
    const support = results.find((row) => row.role === 'SUPPORT')!;
    const [first] = audit;
    // The host's own fight against the head count and the factor; the wave's losses once (owner, (b)).
    expect(first!.adjustedTransfer).toBe(defendedTransfer(
      first!.baseExchange, support.lossValue, 2, supportFactor({ hostPower, supportPower: support.power }),
    ));
    expect(delta(2)).toBe(-first!.adjustedTransfer);

    // Not one of the supporter's Pikes entered the host's own home.
    const home = await f.db.select().from(units)
      .where(and(eq(units.planetId, f.planetIds[2]!), eq(units.location, 'home'), eq(units.hull, 'PIKE')));
    expect(home.reduce((sum, row) => sum + row.count, 0)).toBe(0);
  });
});

describe('a joint war repelled by a supported line (F2 E4 Zafer Kasası)', () => {
  it('pays half the wreck into the defending clan’s purse and says so on the report', async () => {
    const { f, report } = await battle(15_503, { DART: 40 });
    expect(report.grade).toBe('REPELLED');
    const [wardens] = await f.db.select().from(clans).where(eq(clans.tag, 'WD'));
    const events = await f.db.select().from(clanTreasuryEvents).where(eq(clanTreasuryEvents.clanId, wardens!.id));
    expect(events).toEqual([expect.objectContaining({ kind: 'VICTORY_WRECK' })]);
    expect(report.clanPurse).toEqual({
      alloy: wardens!.treasuryAlloy, crystal: wardens!.treasuryCrystal, deuterium: wardens!.treasuryDeuterium,
    });
    expect(wardens!.treasuryAlloy + wardens!.treasuryCrystal).toBeGreaterThan(0);
  });
});

describe('a joint war crushing an ESCAPE_SUPPORT line (F1)', () => {
  it('lifts host and wave together, books the guns’ battle alone and leaves the wave standing', async () => {
    const { f, report } = await battle(15_502, { DART: 900 }, { escape: true, support: true });
    expect(report.fleetEscape?.kind).toBe('ESCAPED');
    expect(report.fleetEscape?.kind === 'ESCAPED' ? report.fleetEscape.support?.length : 0).toBe(1);
    expect(report.defenderCount).toBe(1);
    expect(report.defenderFleet.PIKE ?? 0).toBe(0);
    expect(await f.db.select().from(clanSupportBattleResults).where(eq(clanSupportBattleResults.reportId, report.id))).toHaveLength(0);
    const [wave] = await f.db.select().from(clanSupportWaves).where(eq(clanSupportWaves.senderPlayerId, f.playerIds[3]!));
    expect(wave).toMatchObject({ status: 'STATIONED', battles: 0 });
    const lifted = await f.db.select().from(notifications).where(and(
      eq(notifications.playerId, f.playerIds[3]!), eq(notifications.kind, 'clan_support_lifted')));
    expect(lifted).toHaveLength(1);
  });
});
