import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { arenaShips, seasons } from '../src/db/schema.js';
import { loadLocked } from '../src/services/planet.js';
import { chooseShip, launchSortie } from '../src/services/arenaShips.js';
import { readCommanderShip } from '../src/services/arenaShipState.js';
import { activateAdmiral } from '../src/services/admiralActivation.js';
import { prepareAdmiral, attachAdmiral, admiralForFlight, replaceAdmiralLeg, recordAdmiralBattle, finishAdmiralLeg } from '../src/services/admiral.js';
import { seedWorld, setLevel, testDb, type Fixture } from './helpers.js';
let f: Fixture;
beforeEach(async () => { f = await seedWorld(1, 9995); await setLevel(f.db, f.planetIds[0]!, 'CORE', 9); await chooseShip(f.db, f.clock, f.accountIds[0]!, 'kilavuz'); });
afterAll(async () => { const { close } = await testDb(); await close(); });
const state = async () => (await f.db.select().from(arenaShips))[0];
async function start(kind: 'mission' | 'pirate' = 'mission') {
  await f.db.update(seasons).set({ rulesetVersion: 19 }).where(eq(seasons.id, f.seasonId));
  const ref = randomUUID();
  const plan = await f.db.transaction(async tx => {
    const origin = await loadLocked(tx, f.planetIds[0]!, f.clock);
    const admiral = await prepareAdmiral(tx, origin, true);
    if (!admiral) throw new Error('no admiral');
    await attachAdmiral(tx, admiral.id, kind, ref); return admiral;
  });
  return { ref, plan };
}
describe('one real commander in one fleet task', () => {
  it('keeps old-season/unchecked missions unchanged and rejects an opt-in before its ruleset', async () => {
    await f.db.update(seasons).set({ rulesetVersion: 18 }).where(eq(seasons.id, f.seasonId));
    const before = await state();
    await f.db.transaction(async tx => {
      const origin = await loadLocked(tx, f.planetIds[0]!, f.clock);
      expect(await prepareAdmiral(tx, origin, false)).toBeNull();
      await expect(prepareAdmiral(tx, origin, true)).rejects.toMatchObject({ code: 'ADMIRAL_RULESET' });
    });
    expect(await state()).toEqual(before);
  });
  // Owner 2026-10-26: switched on in the live season once its bugs are gone, not only in a new one.
  it('opens escorts in a live season from the instant it is switched on, once, and a dry run writes nothing', async () => {
    await f.db.update(seasons).set({ rulesetVersion: 18 }).where(eq(seasons.id, f.seasonId));
    const view = () => readCommanderShip(f.db, f.accountIds[0]!, f.clock);
    expect((await view()).admiral).toBe(false);
    expect(await activateAdmiral(f.db, { seasonId: f.seasonId, clock: f.clock, apply: false })).toMatchObject({ status: 'READY', applied: false });
    expect((await view()).admiral).toBe(false);
    const on = await activateAdmiral(f.db, { seasonId: f.seasonId, clock: f.clock, apply: true });
    expect(on).toMatchObject({ status: 'ACTIVATED', applied: true, startsAt: f.clock.now() });
    expect((await view()).admiral).toBe(true);
    f.clock.advance(5);
    expect(await activateAdmiral(f.db, { seasonId: f.seasonId, clock: f.clock, apply: true })).toMatchObject({ status: 'ALREADY_ACTIVE', applied: false, startsAt: on.startsAt });
    await f.db.transaction(async tx => {
      const origin = await loadLocked(tx, f.planetIds[0]!, f.clock);
      expect(await prepareAdmiral(tx, origin, true)).toMatchObject({ snapshot: { ship: 'kilavuz', level: 1 } });
    });
  });
  it('needs nothing switched on in a season dealt it', async () => {
    await f.db.update(seasons).set({ rulesetVersion: 19 }).where(eq(seasons.id, f.seasonId));
    expect((await readCommanderShip(f.db, f.accountIds[0]!, f.clock)).admiral).toBe(true);
    expect(await activateAdmiral(f.db, { seasonId: f.seasonId, clock: f.clock, apply: true })).toMatchObject({ status: 'DEALT', applied: false });
  });
  it('freezes the ship level, locks the Yarık and prevents a second simultaneous deployment', async () => {
    const { ref, plan } = await start();
    expect(plan.snapshot).toEqual({ ship: 'kilavuz', level: 1 });
    expect(await admiralForFlight(f.db, 'mission', ref)).toMatchObject({ id: plan.id, ship: 'kilavuz', level: 1 });
    await expect(launchSortie(f.db, f.clock, f.accountIds[0]!)).rejects.toMatchObject({ code: 'ADMIRAL_AWAY' });
    await expect(start()).rejects.toMatchObject({ code: 'ADMIRAL_AWAY' });
    expect((await state())?.admiralId).toBe(plan.id);
  });
  it('holds a forked task until every native return leg has ended, awards once and queues maintenance', async () => {
    const { ref } = await start(); const children = [randomUUID(), randomUUID()];
    await f.db.transaction(tx => replaceAdmiralLeg(tx, 'mission', ref, 'mission', children, f.clock.now()));
    await f.db.transaction(tx => finishAdmiralLeg(tx, f.clock.now(), 'mission', children[0]!, 3));
    expect((await state())?.admiralId).not.toBeNull();
    await f.db.transaction(tx => finishAdmiralLeg(tx, f.clock.now(), 'mission', children[1]!, 0));
    const after = await state(); expect(after?.admiralId).toBeNull(); expect(after?.readyReason).toBe('service'); expect(after?.xp).toBe(5);
    await f.db.transaction(tx => finishAdmiralLeg(tx, f.clock.now(), 'mission', children[0]!, 3)); expect((await state())?.xp).toBe(5);
  });
  it('earns XP by the value both sides lost and repairs a completely lost fleet’s commander', async () => {
    const { ref } = await start('pirate');
    await f.db.transaction(tx => recordAdmiralBattle(tx, 'pirate', ref, { lost: false, lostValue: 8_000 }));
    await f.db.transaction(tx => finishAdmiralLeg(tx, f.clock.now(), 'pirate', ref, 0));
    expect(await state()).toMatchObject({ admiralId: null, xp: 40, readyReason: 'repair' });
    expect((await state())?.readyAt?.getTime()).toBe(f.clock.now().getTime() + 60 * 60_000);
  });
  it('sends the admiral to repair after a lost battle even when ships come home, summing every battle it saw', async () => {
    const { ref } = await start('pirate');
    await f.db.transaction(tx => recordAdmiralBattle(tx, 'pirate', ref, { lost: false, lostValue: 3_000 }));
    await f.db.transaction(tx => recordAdmiralBattle(tx, 'pirate', ref, { lost: true, lostValue: 5_000 }));
    await f.db.transaction(tx => finishAdmiralLeg(tx, f.clock.now(), 'pirate', ref, 4));
    expect(await state()).toMatchObject({ admiralId: null, xp: 40, readyReason: 'repair' });
  });
  it('services an admiral whose fleet won and came home', async () => {
    const { ref } = await start('pirate');
    await f.db.transaction(tx => recordAdmiralBattle(tx, 'pirate', ref, { lost: false, lostValue: 2_000 }));
    await f.db.transaction(tx => finishAdmiralLeg(tx, f.clock.now(), 'pirate', ref, 4));
    expect(await state()).toMatchObject({ admiralId: null, xp: 10, readyReason: 'service' });
    expect((await state())?.readyAt?.getTime()).toBe(f.clock.now().getTime() + 10 * 60_000);
  });
  it('rolls a failed native dispatch back together with its admiral reservation', async () => {
    await f.db.update(seasons).set({ rulesetVersion: 19 }).where(eq(seasons.id, f.seasonId));
    await expect(f.db.transaction(async tx => { const origin = await loadLocked(tx, f.planetIds[0]!, f.clock); await prepareAdmiral(tx, origin, true); throw new Error('dispatch refused'); })).rejects.toThrow('dispatch refused');
    expect((await state())?.admiralId).toBeNull();
  });
});
