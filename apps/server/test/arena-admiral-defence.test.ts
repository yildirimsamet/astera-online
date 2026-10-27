import { pino } from 'pino';
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { Fleet } from '@astera/rules';
import { arenaShips, battleReports, clanSupportWaves, missions, seasons } from '../src/db/schema.js';
import { chooseShip } from '../src/services/arenaShips.js';
import { quoteClanSupport, recallClanSupport, sendClanSupport, setDefencePosture } from '../src/services/clanSupport.js';
import { launchAttack } from '../src/services/mission.js';
import { pendingThreads } from '../src/services/session.js';
import { EventWorker } from '../src/worker/loop.js';
import { giveUnits, testDb, type Fixture } from './helpers.js';
import { formClan, supportWorld } from './clanSupportFixture.js';

afterAll(async () => { await (await testDb()).close(); });
const silent = pino({ level: 'silent' });

/**
 * THE COMMANDER SHIP ESCORTS A CLAN SUPPORT WAVE (Y9, owner 2026-10-25, doc 22 "Amiral savaşmaz").
 * It stands with the wave at the host, lends its bonus to the wave's ships and is never hit. Only a
 * decisive defeat of the line sends it to repair; a wave lost to the last ship leaves it to fly home
 * alone. A Kılavuz shortens both legs and the round-trip fuel.
 */
describe('the admiral on a clan support wave', () => {
  let f: Fixture; let me: string;
  const worker = () => new EventWorker(f.db, f.clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, silent);
  const at = async (ms: number) => { f.clock.set(new Date(ms)); await worker().tick(); await worker().tick(); };
  const ship = async () => (await f.db.select().from(arenaShips).where(eq(arenaShips.playerId, me)))[0]!;
  const input = (fleet: Fleet, admiral: boolean) => ({ senderPlayerId: me, originPlanetId: f.planetIds[0]!, hostPlanetId: f.planetIds[1]!, fleet, clock: f.clock, admiral });
  const stand = async (fleet: Fleet = { PIKE: 40 }, admiral = true) => {
    const { wave } = await f.db.transaction(tx => sendClanSupport(tx, input(fleet, admiral)));
    await at(new Date(wave.arriveAt).getTime() + 1_000);
    return (await f.db.select().from(clanSupportWaves).where(eq(clanSupportWaves.id, wave.id)))[0]!;
  };
  const raid = async (fleet: Fleet) => {
    await giveUnits(f.db, f.planetIds[3]!, fleet);
    const launched = await launchAttack(f.db, f.planetIds[3]!, f.planetIds[1]!, fleet, f.clock, f.playerIds[3], true);
    const [mission] = await f.db.select().from(missions).where(eq(missions.id, launched.missionId));
    await at(mission!.arriveAt.getTime() + 30_000);
    return (await f.db.select().from(battleReports).where(eq(battleReports.missionId, launched.missionId)))[0]!;
  };
  const comeHome = async (waveId: string) => {
    await f.db.transaction(tx => recallClanSupport(tx, { playerId: me, waveId, clock: f.clock }));
    const [wave] = await f.db.select().from(clanSupportWaves).where(eq(clanSupportWaves.id, waveId));
    await at(wave!.returnAt!.getTime() + 1_000);
  };

  beforeEach(async () => {
    f = await supportWorld(4, 19_190, 19);
    me = f.playerIds[0]!;
    await formClan(f, 0, [1, 2]);
    await giveUnits(f.db, f.planetIds[0]!, { PIKE: 200 });
    await f.db.transaction(tx => setDefencePosture(tx, { planetId: f.planetIds[1]!, playerId: f.playerIds[1]!, toggles: { escape: false, support: true }, clock: f.clock }));
  });

  it('quotes and flies a Kılavuz wave shorter both ways on less fuel, reserving the ship only on the send', async () => {
    await chooseShip(f.db, f.clock, f.accountIds[0]!, 'kilavuz');
    const plain = await quoteClanSupport(f.db, input({ PIKE: 40 }, false));
    const led = await quoteClanSupport(f.db, input({ PIKE: 40 }, true));
    expect(led.travelMinutes).toBeLessThan(plain.travelMinutes);
    expect(led.travelMinutes).toBeCloseTo(plain.travelMinutes * 0.97, 0);
    expect(led.returnMinutes).toBeCloseTo(plain.returnMinutes * 0.97, 0);
    expect(led.fuel).toBe(Math.ceil(plain.fuel * 0.95));
    expect((await ship()).admiralId).toBeNull();
    await f.db.transaction(tx => sendClanSupport(tx, input({ PIKE: 40 }, true)));
    expect((await ship()).admiralId).not.toBeNull();
  });

  it('marks the support legs it flies on the sender\'s flight list, out and home', async () => {
    await chooseShip(f.db, f.clock, f.accountIds[0]!, 'muhafiz');
    const { wave } = await f.db.transaction(tx => sendClanSupport(tx, input({ PIKE: 40 }, true)));
    const out = (await pendingThreads(f.db, f.planetIds[0]!, f.clock.now())).find(t => t.clanSupport);
    expect(out?.admiral).toEqual({ ship: 'muhafiz', level: 1 });
    await at(new Date(wave.arriveAt).getTime() + 1_000);
    await f.db.transaction(tx => recallClanSupport(tx, { playerId: me, waveId: wave.id, clock: f.clock }));
    const back = (await pendingThreads(f.db, f.planetIds[0]!, f.clock.now())).find(t => t.clanSupport);
    expect(back?.admiral).toEqual({ ship: 'muhafiz', level: 1 });
  });

  it('refuses an escort before its season and sends nothing', async () => {
    await chooseShip(f.db, f.clock, f.accountIds[0]!, 'muhafiz');
    await f.db.update(seasons).set({ rulesetVersion: 18 }).where(eq(seasons.id, f.seasonId));
    await expect(f.db.transaction(tx => sendClanSupport(tx, input({ PIKE: 40 }, true)))).rejects.toMatchObject({ code: 'ADMIRAL_RULESET' });
    expect(await f.db.select().from(clanSupportWaves)).toHaveLength(0);
  });

  it('names itself beside the defending line and comes home from a held world to service with XP', async () => {
    await chooseShip(f.db, f.clock, f.accountIds[0]!, 'muhafiz');
    const wave = await stand();
    const report = await raid({ DART: 5 });
    expect(report.grade).toBe('REPELLED');
    expect(report.admirals).toEqual([{ side: 'defence', ship: 'muhafiz', level: 1 }]);
    expect((await ship()).admiralId).not.toBeNull();
    await comeHome(wave.id);
    const home = await ship();
    expect(home).toMatchObject({ admiralId: null, readyReason: 'service' });
    expect(home.xp).toBeGreaterThanOrEqual(10);
  });

  it('repairs after a decisive defeat, flying home alone when the wave is gone', async () => {
    await chooseShip(f.db, f.clock, f.accountIds[0]!, 'muhafiz');
    const wave = await stand({ PIKE: 5 });
    const report = await raid({ DART: 3000 });
    expect(report.grade).toBe('DECISIVE');
    const [after] = await f.db.select().from(clanSupportWaves).where(eq(clanSupportWaves.id, wave.id));
    if (after!.status === 'LOST') {
      const alone = await ship();
      expect(alone).toMatchObject({ admiralId: null, readyReason: 'repair' });
      // It leaves at the battle and flies the leg it came out on.
      expect(alone.readyAt!.getTime()).toBe(report.createdAt.getTime() + wave.arriveAt.getTime() - wave.sentAt.getTime() + 60 * 60_000);
    } else {
      await comeHome(wave.id);
      expect(await ship()).toMatchObject({ admiralId: null, readyReason: 'repair' });
    }
  });

  it('comes home from a quiet stand to service with the idle XP', async () => {
    await chooseShip(f.db, f.clock, f.accountIds[0]!, 'akinci');
    const wave = await stand();
    await comeHome(wave.id);
    expect(await ship()).toMatchObject({ admiralId: null, readyReason: 'service', xp: 5 });
  });

  it('writes no escort on a line defended without one', async () => {
    await chooseShip(f.db, f.clock, f.accountIds[0]!, 'muhafiz');
    await stand({ PIKE: 40 }, false);
    const report = await raid({ DART: 5 });
    expect(report.admirals).toEqual([]);
  });
});
