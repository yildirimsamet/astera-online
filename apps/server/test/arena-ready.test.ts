import { and, eq } from 'drizzle-orm';
import { ADMIRAL_WAIT } from '@astera/rules/arena';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { arenaShips, notifications, scheduledEvents, seasons } from '../src/db/schema.js';
import { chooseShip, endSortie, launchSortie, repairShip } from '../src/services/arenaShips.js';
import { shipReadyNotice } from '../src/services/arenaReady.js';
import { seedWorld, setLevel, testDb, type Fixture } from './helpers.js';
let f: Fixture;
beforeEach(async () => { f = await seedWorld(1, 4245); await setLevel(f.db, f.planetIds[0]!, 'CORE', 9); await chooseShip(f.db, f.clock, f.accountIds[0]!, 'kilavuz'); });
afterAll(async () => { const { close } = await testDb(); await close(); });
const notes = () => f.db.select().from(notifications).where(eq(notifications.kind, 'arena_ship_ready'));
async function ended(outcome: 'dead' | 'extracted' | 'recalled') {
  const launch = await launchSortie(f.db, f.clock, f.accountIds[0]!);
  await endSortie(f.db, f.clock, f.accountIds[0]!, launch.sortieId, { outcome, fuel: launch.fuel, ammo: launch.ammo, hold: [], pilotKills: 0, assists: 0 });
  const [event] = await f.db.select().from(scheduledEvents).where(and(eq(scheduledEvents.kind, 'arena_ship_ready'), eq(scheduledEvents.refId, launch.sortieId)));
  return { launch, event };
}
describe('the commander ship is ready, told once', () => {
  it('waits for the persisted deadline and sends one completion even if the worker repeats it', async () => {
    const { event } = await ended('extracted'); if (!event) throw new Error('no readiness event');
    await shipReadyNotice(f.db, f.clock, event); expect(await notes()).toHaveLength(0);
    f.clock.set(event.resolveAt); await Promise.all([shipReadyNotice(f.db, f.clock, event), shipReadyNotice(f.db, f.clock, event)]);
    expect(await notes()).toHaveLength(1); expect((await notes())[0]?.payload).toMatchObject({ ship: 'kilavuz', reason: 'service' });
  });
  it('notifies the shortened paid repair and ignores the obsolete old deadline', async () => {
    const { event: yarik } = await ended('dead'); if (!yarik) throw new Error('no repair event');
    // Owner 2026-10-28: only a repair longer than any quote (an escort's lost battle) is worth paying for.
    const long = new Date(f.clock.now().getTime() + ADMIRAL_WAIT.repairMinutes * 60_000);
    await f.db.update(arenaShips).set({ readyAt: long });
    await f.db.update(scheduledEvents).set({ resolveAt: long }).where(eq(scheduledEvents.id, yarik.id));
    const event = { ...yarik, resolveAt: long };
    await repairShip(f.db, f.clock, f.accountIds[0]!);
    const events = await f.db.select().from(scheduledEvents).where(eq(scheduledEvents.kind, 'arena_ship_ready'));
    const early = events.find(e => e.resolveAt < event.resolveAt); if (!early) throw new Error('no shortened event');
    f.clock.set(early.resolveAt); await shipReadyNotice(f.db, f.clock, early); expect(await notes()).toHaveLength(1);
    f.clock.set(event.resolveAt); await shipReadyNotice(f.db, f.clock, event); expect(await notes()).toHaveLength(1);
  });
  it('never mistakes the next flight for the previous completion, or a recalled sortie for maintenance', async () => {
    const { event } = await ended('extracted'); if (!event) throw new Error('no event');
    f.clock.set(event.resolveAt); await launchSortie(f.db, f.clock, f.accountIds[0]!);
    await shipReadyNotice(f.db, f.clock, event); expect(await notes()).toHaveLength(0);
  });
  it('ignores completion news after the season stopped', async () => {
    const { event } = await ended('dead'); if (!event) throw new Error('no event');
    await f.db.update(seasons).set({ status: 'frozen' }).where(eq(seasons.id, f.seasonId));
    f.clock.set(event.resolveAt); await shipReadyNotice(f.db, f.clock, event); expect(await notes()).toHaveLength(0);
  });
  it('queues no timer for a recall and keeps real availability independent of the worker', async () => {
    const { event } = await ended('recalled'); expect(event).toBeUndefined();
    const [ship] = await f.db.select().from(arenaShips); expect(ship?.readyAt).toBeNull();
  });
});
