import { STARTER } from '@astera/rules';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { starterChatMessages, starterEvents, vesselMigrations, vesselNotifications, vesselProbeReports, vesselUnits, vessels } from '../src/db/schema.js';
import { enlistVessel } from '../src/services/starter/enlist.js';
import { sweepStarterRetention } from '../src/services/starter/retention.js';
import { testDb } from './helpers.js';
import { starterWorld } from './starterFixture.js';
import { aboard, arm } from './starterShips.js';

afterAll(async () => { await (await testDb()).close(); });
const DAY = 24 * 60;

describe('what a galaxy with no wipe forgets', () => {
  let world: Awaited<ReturnType<typeof starterWorld>>;
  beforeEach(async () => { world = await starterWorld(); });
  afterEach(async () => { await world.built.close(); });
  const sweep = () => sweepStarterRetention(world.f.db, world.f.clock);

  const departed = async () => {
    const me = await aboard(world, 'Gone');
    await arm(world, me.vesselId, { DART: 2 });
    await world.f.db.update(vessels).set({ status: 'DEPARTED', slotIndex: null }).where(eq(vessels.id, me.vesselId));
    await world.f.db.insert(vesselMigrations).values({ vesselId: me.vesselId, status: 'DONE', cargo: { alloy: 0, crystal: 0, deuterium: 0, fleet: {} }, startedAt: world.f.clock.now() });
    await world.f.db.insert(vesselNotifications).values({ vesselId: me.vesselId, kind: 'X', refId: crypto.randomUUID(), payload: {}, createdAt: world.f.clock.now() });
    return me;
  };

  it('keeps everything until the time is up', async () => {
    const me = await departed();
    world.f.clock.advance((STARTER.retentionDays - 1) * DAY);
    await sweep();
    expect(await world.f.db.select().from(vesselUnits).where(eq(vesselUnits.vesselId, me.vesselId))).toHaveLength(1);
  });

  it('then drops a landed ship\'s details and keeps the row the one-ship rule stands on', async () => {
    const me = await departed();
    world.f.clock.advance((STARTER.retentionDays + 1) * DAY);
    await sweep();
    expect(await world.f.db.select().from(vesselUnits).where(eq(vesselUnits.vesselId, me.vesselId))).toHaveLength(0);
    expect(await world.f.db.select().from(vesselNotifications).where(eq(vesselNotifications.vesselId, me.vesselId))).toHaveLength(0);
    expect(await world.f.db.select().from(vessels).where(eq(vessels.id, me.vesselId))).toHaveLength(1);
    expect(await world.f.db.select().from(vesselMigrations).where(eq(vesselMigrations.vesselId, me.vesselId))).toHaveLength(1);
    await expect(enlistVessel(world.f.db, me.id, world.f.clock)).rejects.toThrow();
  });

  it('forgets old chat, reports and finished events for everyone, and nothing of a ship still here', async () => {
    const me = await aboard(world, 'Here', { SURVEY: 2 });
    await arm(world, me.vesselId, { DART: 2 });
    const [ship] = await world.f.db.select().from(vessels).where(eq(vessels.id, me.vesselId));
    const then = world.f.clock.now();
    await world.f.db.insert(starterChatMessages).values({ starterGalaxyId: ship!.starterGalaxyId, authorAccountId: me.id, authorVesselId: me.vesselId, username: 'Here', language: 'en', content: 'old', createdAt: then });
    await world.f.db.insert(vesselProbeReports).values({ observerVesselId: me.vesselId, missionId: crypto.randomUUID(), targetName: 'x', at: then, accuracy: 1, snapshot: {}, detected: false });
    await world.f.db.insert(starterEvents).values({ starterGalaxyId: ship!.starterGalaxyId, kind: 'vessel_radar_warning', refId: crypto.randomUUID(), resolveAt: then, status: 'done' });
    world.f.clock.advance((STARTER.retentionDays + 1) * DAY);
    await sweep();
    expect(await world.f.db.select().from(starterChatMessages)).toHaveLength(0);
    expect(await world.f.db.select().from(vesselProbeReports)).toHaveLength(0);
    expect(await world.f.db.select().from(starterEvents).where(eq(starterEvents.status, 'done'))).toHaveLength(0);
    expect(await world.f.db.select().from(vesselUnits).where(eq(vesselUnits.vesselId, me.vesselId))).toHaveLength(1);
  });

  it('never touches a queued event, however old', async () => {
    const me = await aboard(world, 'Here');
    const [ship] = await world.f.db.select().from(vessels).where(eq(vessels.id, me.vesselId));
    await world.f.db.insert(starterEvents).values({ starterGalaxyId: ship!.starterGalaxyId, kind: 'vessel_radar_warning', refId: crypto.randomUUID(), resolveAt: world.f.clock.now(), status: 'pending' });
    world.f.clock.advance((STARTER.retentionDays + 1) * DAY);
    await sweep();
    expect(await world.f.db.select().from(starterEvents).where(eq(starterEvents.status, 'pending'))).toHaveLength(1);
  });
});
