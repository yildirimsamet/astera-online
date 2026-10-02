import { pino } from 'pino';
import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { combatValue, factorValue, fleetCount, supportFactor, type Fleet } from '@astera/rules';
import { battleReports, clanSupportBattleResults, missions, probeReports } from '../src/db/schema.js';
import { sendClanSupport, setDefencePosture } from '../src/services/clanSupport.js';
import { readMySupport } from '../src/services/clanSupportView.js';
import { launchProbe } from '../src/services/intel.js';
import { launchAttack } from '../src/services/mission.js';
import { readBattleReports } from '../src/services/reports.js';
import { pendingThreads } from '../src/services/session.js';
import { EventWorker } from '../src/worker/loop.js';
import { giveUnits, setLevel, testDb, type Fixture } from './helpers.js';
import { formClan, namesOf, supportWorld } from './clanSupportFixture.js';

/**
 * KLAN SAVUNMA DESTEĞİ — what each commander may read (`docs/clan-defense-support-plan.md`, P11).
 *
 * 1 holds world 1 at SUPPORT; 0 stands a wave of Pikes there; 3 is outside the clan.
 */

afterAll(async () => { await (await testDb()).close(); });
const silent = pino({ level: 'silent' });
const worker = (f: Fixture) => new EventWorker(f.db, f.clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, silent);
const landAll = async (f: Fixture) => {
  const rows = await f.db.select({ arriveAt: missions.arriveAt }).from(missions).where(eq(missions.status, 'in_flight'));
  const latest = rows.reduce((max, row) => Math.max(max, row.arriveAt.getTime()), f.clock.now().getTime());
  f.clock.set(new Date(latest + 30_000));
  await worker(f).tick();
};

const WAVE: Fleet = { PIKE: 40 };

async function supported(seed: number, rulesetVersion?: number) {
  const f = rulesetVersion === undefined ? await supportWorld(4, seed) : await supportWorld(4, seed, rulesetVersion);
  await formClan(f, 0, [1, 2]);
  await giveUnits(f.db, f.planetIds[0]!, { PIKE: 80 });
  if (rulesetVersion === undefined) {
    await f.db.transaction((tx) => setDefencePosture(tx, {
      planetId: f.planetIds[1]!,
      playerId: f.playerIds[1]!,
      toggles: { escape: false, support: true },
      clock: f.clock,
    }));
    const { wave } = await f.db.transaction((tx) => sendClanSupport(tx, {
      senderPlayerId: f.playerIds[0]!,
      originPlanetId: f.planetIds[0]!,
      hostPlanetId: f.planetIds[1]!,
      fleet: WAVE,
      clock: f.clock,
    }));
    return { f, waveId: wave.id };
  }
  return { f, waveId: null };
}

async function probe(f: Fixture, from: number, to: number) {
  const launched = await launchProbe(f.db, f.planetIds[from]!, f.planetIds[to]!, f.clock, f.playerIds[from]);
  await landAll(f);
  const [report] = await f.db.select().from(probeReports).where(eq(probeReports.missionId, launched.missionId));
  return report!;
}

describe('the sender’s own pages', () => {
  it('lists the wave on the Fleet page and draws its flight on the pending strip', async () => {
    const { f, waveId } = await supported(15_701);
    const mine = await readMySupport(f.db, f.playerIds[0]!);
    expect(mine.waves.map((wave) => wave.id)).toEqual([waveId]);
    const pending = await pendingThreads(f.db, f.planetIds[0]!, f.clock.now());
    // Drawn as a friendly flight, never as a raid: no bombardment at a clanmate's world.
    const flight = pending.find((thread) => thread.clanSupport === true);
    expect(flight).toMatchObject({ kind: 'transfer', leg: 'outbound' });
    expect(pending.some((thread) => thread.kind === 'fleet')).toBe(false);
    // The host's strip shows no "incoming": a friend is not a threat.
    const hostStrip = await pendingThreads(f.db, f.planetIds[1]!, f.clock.now());
    expect(hostStrip.some((thread) => thread.kind === 'incoming')).toBe(false);
  });
});

describe('the probe', () => {
  it('reads the posture exactly and the standing support as a reading of its own', async () => {
    const { f } = await supported(15_702);
    await landAll(f);
    const report = await probe(f, 3, 1);
    expect(report.posture).toBe('SUPPORT');
    expect(report.support).not.toBeNull();
    expect(report.support!.supporters).toBe(1);
    expect(report.support!.defence.low).toBeLessThanOrEqual(combatValue(WAVE));
    expect(report.support!.defence.high).toBeGreaterThanOrEqual(combatValue(WAVE));
    expect(report.support!.fleetSize.low).toBeLessThanOrEqual(fleetCount(WAVE));
    expect(report.support!.fleetSize.high).toBeGreaterThanOrEqual(fleetCount(WAVE));
  });

  it('leaves a wave out of the reading once it has drifted out of the band', async () => {
    const { f } = await supported(15_703);
    await landAll(f);
    await setLevel(f.db, f.planetIds[0]!, 'CORE', 18);
    for (const index of [1, 3]) await setLevel(f.db, f.planetIds[index]!, 'CORE', 3);
    const report = await probe(f, 3, 1);
    expect(report.support).toMatchObject({ supporters: 0 });
  });

  it('reads an ESCAPE world with no support line at all', async () => {
    const { f } = await supported(15_704);
    const report = await probe(f, 3, 2);
    expect(report.posture).toBe('ESCAPE');
    expect(report.support).toBeNull();
  });

  it('reads neither in a season without clan defence', async () => {
    const { f } = await supported(15_705, 14);
    const report = await probe(f, 3, 1);
    expect(report.posture).toBeNull();
    expect(report.support).toBeNull();
  });
});

describe('the battle report', () => {
  async function raided(seed: number) {
    const { f } = await supported(seed);
    await landAll(f);
    await giveUnits(f.db, f.planetIds[3]!, { DART: 150 });
    const launched = await launchAttack(f.db, f.planetIds[3]!, f.planetIds[1]!, { DART: 150 }, f.clock, f.playerIds[3], true);
    await landAll(f);
    const [row] = await f.db.select().from(battleReports).where(eq(battleReports.missionId, launched.missionId));
    return { f, row: row! };
  }

  it('reaches the supporter, who reads it as a defender of their own wave', async () => {
    const { f, row } = await raided(15_706);
    const { reports } = await readBattleReports(f.db, f.playerIds[0]!);
    const report = reports.find((entry) => entry.kind === 'BATTLE' && entry.id === row.id);
    expect(report).toBeDefined();
    if (report?.kind !== 'BATTLE') throw new Error('expected a battle report');
    expect(report.attacking).toBe(false);
    expect(report.yourFleet).toEqual(WAVE);
    expect(report.defenseLine).toMatchObject({ defenderCount: 2 });
    const members = report.defenseLine!.members;
    expect(members.map((member) => member.role).sort()).toEqual(['HOST', 'SUPPORT']);
    expect(members.find((member) => member.role === 'SUPPORT')!.sent).toEqual(WAVE);
    // Named for where their ships stood and whose line it was — the supporter has no world here.
    expect(report.supportedAt).toEqual({
      planetId: f.planetIds[1],
      planetName: (await namesOf(f, 1)).world,
      hostName: (await namesOf(f, 1)).commander,
    });
    // The supporter lost no stores, and no Dominion (owner, 2026-10-02).
    expect(report.lootAlloy).toBe(0);
    expect(report.dominion).toBe(0);
    expect(members.find((member) => member.role === 'SUPPORT')!.dominion).toBe(0);
    // The factor the support multiplied the host's Dominion by, as the report states it.
    const lines = await f.db.select().from(clanSupportBattleResults).where(eq(clanSupportBattleResults.reportId, row.id));
    const hostPower = lines.find((line) => line.role === 'HOST')!.power;
    const supportPower = lines.find((line) => line.role === 'SUPPORT')!.power;
    expect(report.defenseLine!.dominionFactor).toBe(factorValue(supportFactor({ hostPower, supportPower })));
  });

  it('shows the host only their own ships as theirs, and the line beside them', async () => {
    const { f, row } = await raided(15_707);
    const { reports } = await readBattleReports(f.db, f.playerIds[1]!);
    const report = reports.find((entry) => entry.kind === 'BATTLE' && entry.id === row.id);
    if (report?.kind !== 'BATTLE') throw new Error('expected a battle report');
    expect(report.yourFleet.PIKE ?? 0).toBe(0);
    expect(report.yourLosses.PIKE ?? 0).toBe(0);
    expect(report.defenseLine!.members).toHaveLength(2);
    // The host defended their own world: nothing to say about whose line it was.
    expect(report.supportedAt).toBeUndefined();
  });

  it('tells the raider who stood there and what each lost — never what each kept', async () => {
    const { f, row } = await raided(15_708);
    const { reports } = await readBattleReports(f.db, f.playerIds[3]!);
    const report = reports.find((entry) => entry.kind === 'BATTLE' && entry.id === row.id);
    if (report?.kind !== 'BATTLE') throw new Error('expected a battle report');
    expect(report.attacking).toBe(true);
    expect(report.supportedAt).toBeUndefined();
    for (const member of report.defenseLine!.members) {
      expect(member.name.length).toBeGreaterThan(0);
      expect(member.losses).toBeDefined();
      expect(member.sent).toBeNull();
      expect(member.survivors).toBeNull();
    }
  });

  it('keeps it from a clanmate who was not in the line', async () => {
    const { f, row } = await raided(15_709);
    const { reports } = await readBattleReports(f.db, f.playerIds[2]!);
    expect(reports.some((entry) => entry.kind === 'BATTLE' && entry.id === row.id)).toBe(false);
  });
});
