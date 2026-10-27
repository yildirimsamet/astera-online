import { fleetTravelExact, missionFuel } from '@astera/rules';
import { and, eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { arenaShips, battleReports, missions, notifications, seasons } from '../src/db/schema.js';
import { repairQuote } from '@astera/rules/arena';
import { chooseShip, launchSortie, readHangar, repairShip } from '../src/services/arenaShips.js';
import { readCommanderShip } from '../src/services/arenaShipState.js';
import { launchAttack } from '../src/services/mission.js';
import { recallFlight } from '../src/services/movement.js';
import { readBattleReports } from '../src/services/reports.js';
import { pendingThreads } from '../src/services/session.js';
import { EventWorker } from '../src/worker/loop.js';
import { fuelUp, giveInstrument, giveSatellite, giveUnits, grant, placeAt, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

const silent = pino({ level: 'silent' });
afterAll(async () => { const { close } = await testDb(); await close(); });

/**
 * THE COMMANDER SHIP ESCORTS A RAID (Y9, owner 2026-10-25, doc 22 "Amiral savaşmaz").
 * It flies with the fleet, never fires and is never hit; it only lends its class bonus.
 * A lost battle or a fleet lost to the last ship sends it home to repair, else service.
 */
describe('the admiral on a raid', () => {
  let f: Fixture; let mine: string; let theirs: string; let me: string;
  const worker = () => new EventWorker(f.db, f.clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, silent);
  const ship = async () => (await f.db.select().from(arenaShips).where(eq(arenaShips.playerId, me)))[0]!;
  const raid = (fleet = { DART: 20 }, admiral = true) =>
    launchAttack(f.db, mine, theirs, fleet, f.clock, undefined, undefined, undefined, false, new Set(), admiral);
  /** Every event up to `at` has run. */
  const runTo = async (at: Date) => { f.clock.set(new Date(at.getTime() + 60_000)); await worker().tick(); await worker().tick(); };

  beforeEach(async () => {
    f = await seedWorld(3, 9994);
    [mine, theirs] = f.planetIds as [string, string]; me = f.playerIds[0]!;
    for (const id of [mine, theirs]) { await setLevel(f.db, id, 'CORE', 9); await setLevel(f.db, id, 'SHIPYARD', 2); await grant(f.db, id, 300_000, 60_000); }
    await placeAt(f.db, mine, { x: 0 }); await placeAt(f.db, theirs, { x: 4_000 });
    await fuelUp(f.db, mine, 200_000);
    f.clock.advance(250);
    await giveUnits(f.db, mine, { DART: 20 });
    await f.db.update(seasons).set({ rulesetVersion: 19 }).where(eq(seasons.id, f.seasonId));
    await chooseShip(f.db, f.clock, f.accountIds[0]!, 'kilavuz');
  });

  it('marks the escorted craft on its own commander\'s flight list, out and home, and nowhere else', async () => {
    const launched = await raid();
    const threads = await pendingThreads(f.db, mine, f.clock.now());
    expect(threads.find(t => t.id === launched.missionId)?.admiral).toEqual({ ship: 'kilavuz', level: 1 });
    // The defender's warning names the escort on the radar line, never as a drawn own craft.
    expect((await pendingThreads(f.db, theirs, f.clock.now())).every(t => t.admiral === undefined)).toBe(true);
    const [row] = await f.db.select().from(missions).where(eq(missions.id, launched.missionId));
    await runTo(row!.arriveAt);
    const back = (await pendingThreads(f.db, mine, f.clock.now())).find(t => t.leg === 'return' && t.admiral);
    expect(back?.admiral).toEqual({ ship: 'kilavuz', level: 1 });
  });

  it('refuses an escort before its season and launches nothing', async () => {
    await f.db.update(seasons).set({ rulesetVersion: 18 }).where(eq(seasons.id, f.seasonId));
    await expect(raid()).rejects.toMatchObject({ code: 'ADMIRAL_RULESET' });
    expect(await f.db.select().from(missions)).toHaveLength(0);
    expect((await ship()).admiralId).toBeNull();
  });

  it('refuses an escort while the ship is under repair, and the raid with it', async () => {
    await f.db.update(arenaShips).set({ readyAt: new Date(f.clock.now().getTime() + 30 * 60_000), readyReason: 'repair' }).where(eq(arenaShips.playerId, me));
    await expect(raid()).rejects.toMatchObject({ code: 'SHIP_NOT_READY' });
    expect(await f.db.select().from(missions)).toHaveLength(0);
  });

  it('flies a Kılavuz-led raid shorter and on less fuel, and holds the ship for the whole trip', async () => {
    const launched = await raid();
    const [row] = await f.db.select().from(missions).where(eq(missions.id, launched.missionId));
    const plain = fleetTravelExact(row!.distance, { DART: 20 }, { boost: 1, tech: {}, pace: 1 });
    expect((row!.arriveAt.getTime() - row!.departAt.getTime()) / 60_000).toBeCloseTo(plain * 0.97, 4);
    expect(row!.fuelPaid).toBe(Math.ceil(missionFuel({ DART: 20 }, row!.distance, 2, 'HOSTILE', 1) * 0.95));
    expect((await ship()).admiralId).not.toBeNull();
  });

  it('comes home with a won raid to service, earning XP for the battle, and names itself in the report and the warning', async () => {
    await giveSatellite(f.db, theirs, 'UPLINK');
    await giveInstrument(f.db, theirs, 'RADAR', 5);
    const launched = await raid();
    // The warning is read while the fleet is still on its way in.
    f.clock.set(new Date(launched.arriveAt.getTime() - 20_000)); await worker().tick();
    await runTo(launched.arriveAt);
    const [report] = await f.db.select().from(battleReports).where(eq(battleReports.missionId, launched.missionId));
    expect(report!.admirals).toEqual([{ side: 'attack', ship: 'kilavuz', level: 1 }]);
    // Both sides read it on the report.
    for (const reader of [me, f.playerIds[1]!]) {
      const { reports } = await readBattleReports(f.db, reader);
      expect(reports[0]).toMatchObject({ admirals: [{ side: 'attack', ship: 'kilavuz', level: 1 }] });
    }
    const [warning] = await f.db.select().from(notifications).where(and(eq(notifications.kind, 'incoming_fleet'), eq(notifications.refId, launched.missionId)));
    expect(warning!.payload).toMatchObject({ admiral: { ship: 'kilavuz', level: 1 } });
    expect((await ship()).admiralId).not.toBeNull();
    const [back] = await f.db.select().from(missions).where(and(eq(missions.parentMissionId, launched.missionId), eq(missions.kind, 'return')));
    // The way home is the Kılavuz's too.
    const plain = fleetTravelExact(back!.distance, back!.fleet, { boost: 1, tech: {}, pace: 1 });
    expect((back!.arriveAt.getTime() - back!.departAt.getTime()) / 60_000).toBeCloseTo(plain * 0.97, 4);
    await runTo(back!.arriveAt);
    const after = await ship();
    expect(after).toMatchObject({ admiralId: null, readyReason: 'service', xp: 10 });
  });

  it('flies home alone to repair when the whole fleet is lost', async () => {
    await giveUnits(f.db, theirs, { SENTINEL: 300 });
    const launched = await raid({ DART: 2 });
    const [row] = await f.db.select().from(missions).where(eq(missions.id, launched.missionId));
    await runTo(launched.arriveAt);
    const [report] = await f.db.select().from(battleReports).where(eq(battleReports.missionId, launched.missionId));
    expect(report!.attackerLosses).toEqual({ DART: 2 });
    const after = await ship();
    expect(after).toMatchObject({ admiralId: null, readyReason: 'repair' });
    // Resolved when the worker ran (`runTo`), then the leg home alone, then the repair.
    const resolvedAt = launched.arriveAt.getTime() + 60_000;
    const leg = row!.arriveAt.getTime() - row!.departAt.getTime();
    expect(after.readyAt!.getTime()).toBe(resolvedAt + leg + 60 * 60_000);
    // On its way it is out in space, not docked at home: the galaxy draws it from the battle to the launch world.
    const view = () => readCommanderShip(f.db, f.accountIds[0]!, f.clock);
    expect(await view()).toMatchObject({ ship: { status: 'admiral' }, homeward: { from: { x: 4_000, y: 0, z: 0 }, to: { x: 0, y: 0, z: 0 },
      departAt: new Date(resolvedAt).toISOString(), arriveAt: new Date(resolvedAt + leg).toISOString() } });
    f.clock.set(new Date(resolvedAt + leg));
    expect(await view()).toMatchObject({ ship: { status: 'repair' }, homeward: null });
  });

  // Codex review CR2: a paid repair once wrote `now + quote`, erasing the flight home still ahead.
  it('starts a paid repair on the lone flight home only once the ship has landed', async () => {
    await giveUnits(f.db, theirs, { SENTINEL: 300 });
    const launched = await raid({ DART: 2 });
    const [row] = await f.db.select().from(missions).where(eq(missions.id, launched.missionId));
    await runTo(launched.arriveAt);
    const landsAt = launched.arriveAt.getTime() + 60_000 + row!.arriveAt.getTime() - row!.departAt.getTime();
    const paid = await repairShip(f.db, f.clock, f.accountIds[0]!);
    expect(Date.parse(paid.ship!.readyAt!)).toBe(landsAt + repairQuote(1).minutes * 60_000);
    f.clock.set(new Date(landsAt - 60_000));
    await expect(launchSortie(f.db, f.clock, f.accountIds[0]!)).rejects.toMatchObject({ code: 'SHIP_NOT_READY' });
  });

  // Codex review CR3: the hangar said "Hazır" and offered the Yarık while the ship escorted a fleet.
  it('tells the hangar the ship is out with the fleet, then flying home alone until it lands', async () => {
    await giveUnits(f.db, theirs, { SENTINEL: 300 });
    const launched = await raid({ DART: 2 });
    const hangar = () => readHangar(f.db, f.clock, f.accountIds[0]!);
    expect((await hangar()).ship).toMatchObject({ away: 'escort', homeAt: null });
    const [row] = await f.db.select().from(missions).where(eq(missions.id, launched.missionId));
    await runTo(launched.arriveAt);
    const landsAt = launched.arriveAt.getTime() + 60_000 + row!.arriveAt.getTime() - row!.departAt.getTime();
    expect((await hangar()).ship).toMatchObject({ away: 'homeward', homeAt: new Date(landsAt).toISOString(), readyReason: 'repair' });
    f.clock.set(new Date(landsAt));
    expect((await hangar()).ship).toMatchObject({ away: null, homeAt: null, readyReason: 'repair' });
  });

  it('turns home with a recalled raid and is serviced, with only the quiet-escort XP', async () => {
    const launched = await raid();
    f.clock.advance(1);
    const recall = await recallFlight(f.db, launched.missionId, f.clock, me);
    await runTo(recall.arriveAt);
    expect(await ship()).toMatchObject({ admiralId: null, readyReason: 'service', xp: 5 });
  });

  it('leaves a raid without an escort exactly as it was', async () => {
    const launched = await raid({ DART: 20 }, false);
    expect((await ship()).admiralId).toBeNull();
    expect((await pendingThreads(f.db, mine, f.clock.now())).find(t => t.id === launched.missionId)?.admiral).toBeUndefined();
    await runTo(launched.arriveAt);
    const [report] = await f.db.select().from(battleReports).where(eq(battleReports.missionId, launched.missionId));
    expect(report!.admirals).toEqual([]);
  });
});
