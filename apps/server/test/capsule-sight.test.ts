import { and, eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { AppliedCapsule } from '@astera/rules';
import { clanMemberships, clans, missions, notifications, paidAlerts, scheduledEvents } from '../src/db/schema.js';
import { wakeInboundRadarWarnings } from '../src/services/radar.js';
import { pendingThreads } from '../src/services/session.js';
import { galaxyTraffic } from '../src/services/traffic.js';
import { EventWorker } from '../src/worker/loop.js';
import { giveInstrument, giveSatellite, placeAt, seedWorld, testDb, type Fixture } from './helpers.js';

/**
 * WHO SEES A CAPSULED FLIGHT (plan 2026-11-24 §3.5, K11, S9/S10). Optik Örtü takes the leg off every
 * map except its owner's and the owner's clan's, whatever the instruments; Sessiz İtki keeps it on
 * the map but rings nothing at the target: no warning, no inbound mark, no strip line.
 */
let f: Fixture;
let attacker: string;
let ally: string;
let target: string;
const silent = pino({ level: 'silent' });

afterAll(async () => { await (await testDb()).close(); });

beforeEach(async () => {
  f = await seedWorld(4, 3_303);
  [attacker, ally, target] = f.playerIds as [string, string, string];
  const [from, mate, aim, other] = f.planetIds as [string, string, string, string];
  await placeAt(f.db, from, { x: 0 });
  await placeAt(f.db, mate, { x: 40 });
  await placeAt(f.db, aim, { x: 120 });
  await placeAt(f.db, other, { x: 160 });
  for (const planetId of [aim, other, mate]) {
    await giveInstrument(f.db, planetId, 'TELESCOPE', 5);
    await giveInstrument(f.db, planetId, 'RADAR', 5);
  }
  await giveSatellite(f.db, aim, 'UPLINK');
  const [clan] = await f.db.insert(clans).values({ seasonId: f.seasonId, name: 'Veil Test', nameKey: 'veil test', tag: 'VT', createdAt: f.clock.now() }).returning();
  await f.db.insert(clanMemberships).values([attacker, ally].map((playerId, slot) => ({
    seasonId: f.seasonId, clanId: clan!.id, playerId, slot, role: slot === 0 ? 'LEADER' as const : 'MEMBER' as const,
    joinedAt: f.clock.now(), matureAt: f.clock.now(), aidPolicyChangedAt: f.clock.now(),
  })));
});

/** A raid twenty seconds out: inside every radar circle and every telescope's reach. */
const raid = async (appliedCapsules: AppliedCapsule[]): Promise<string> => {
  const now = f.clock.now().getTime();
  const [row] = await f.db.insert(missions).values({
    seasonId: f.seasonId, ownerPlayerId: attacker, originPlanetId: f.planetIds[0]!, targetPlanetId: f.planetIds[2]!,
    kind: 'attack', status: 'in_flight', fleet: { DART: 10 }, distance: 120, fuelPaid: 0,
    departAt: new Date(now - 600_000), arriveAt: new Date(now + 20_000), appliedCapsules,
  }).returning();
  return row!.id;
};
const sees = async (index: number, missionId: string) =>
  (await galaxyTraffic(f.db, f.seasonId, f.planetIds[index]!, f.clock.now(), f.playerIds[index], [f.planetIds[index]!]))
    .find((contact) => contact.id === missionId);
const VEIL: AppliedCapsule[] = [{ id: 'OPTIC_VEIL', count: 1 }];
const SILENCE: AppliedCapsule[] = [{ id: 'SILENT_THRUST', count: 1 }];

describe('S9 Optik Örtü', () => {
  it('is seen by the owner’s clan alone: not the target, not a stranger, whatever they have', async () => {
    const plain = await raid([]);
    expect(await sees(2, plain)).toBeDefined();
    expect(await sees(3, plain)).toBeDefined();
    await f.db.update(missions).set({ status: 'resolved' }).where(eq(missions.id, plain));

    const veiled = await raid(VEIL);
    expect(await sees(1, veiled)).toBeDefined();
    expect(await sees(2, veiled)).toBeUndefined();
    expect(await sees(3, veiled)).toBeUndefined();
  });

  it('marks the leg as veiled for those who still see it, and never a plain one (G17)', async () => {
    const veiled = await raid(VEIL);
    // The owner draws its own craft from its strip, a clanmate from the traffic: both are told.
    const own = (await pendingThreads(f.db, f.planetIds[0]!, f.clock.now())).find((thread) => thread.id === veiled);
    expect(own).toMatchObject({ veiled: true });
    expect(await sees(1, veiled)).toMatchObject({ veiled: true });
    await f.db.update(missions).set({ status: 'resolved' }).where(eq(missions.id, veiled));
    const plain = await raid([]);
    expect(await sees(1, plain)).not.toHaveProperty('veiled');
  });

  it('hides from a clanmate who has left the clan', async () => {
    const veiled = await raid(VEIL);
    await f.db.update(clanMemberships).set({ leftAt: f.clock.now() }).where(eq(clanMemberships.playerId, ally));
    expect(await sees(1, veiled)).toBeUndefined();
  });
});

describe('S10 Sessiz İtki', () => {
  it('stays on the map but is never marked as aimed at the target', async () => {
    const plain = await raid([]);
    expect((await sees(2, plain))?.inbound).toBe(true);
    await f.db.update(missions).set({ status: 'resolved' }).where(eq(missions.id, plain));
    const quiet = await raid(SILENCE);
    const contact = await sees(2, quiet);
    expect(contact).toBeDefined();
    expect(contact).not.toHaveProperty('inbound');
  });

  it('puts no inbound line on the target’s strip', async () => {
    await raid(SILENCE);
    expect((await pendingThreads(f.db, f.planetIds[2]!, f.clock.now())).map((thread) => thread.kind)).not.toContain('incoming');
  });

  it('is not woken by a radar bought mid-flight, and a stray warning event rings nothing', async () => {
    const quiet = await raid(SILENCE);
    await wakeInboundRadarWarnings(f.db, f.planetIds[2]!, f.clock.now());
    const woken = await f.db.select().from(scheduledEvents).where(and(eq(scheduledEvents.kind, 'radar_warning'), eq(scheduledEvents.refId, quiet)));
    expect(woken).toHaveLength(0);

    await f.db.insert(scheduledEvents).values({ seasonId: f.seasonId, kind: 'radar_warning', refId: quiet, resolveAt: f.clock.now() });
    await new EventWorker(f.db, f.clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, silent).tick();
    // No warning, no clan alarm, no paid alert: nobody is told anything (S11).
    expect(await f.db.select().from(notifications)).toHaveLength(0);
    expect(await f.db.select().from(paidAlerts)).toHaveLength(0);
  });

  it('control: a plain raid’s stray warning does ring the target', async () => {
    const plain = await raid([]);
    await f.db.insert(scheduledEvents).values({ seasonId: f.seasonId, kind: 'radar_warning', refId: plain, resolveAt: f.clock.now() });
    await new EventWorker(f.db, f.clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, silent).tick();
    const rung = await f.db.select().from(notifications).where(and(eq(notifications.kind, 'incoming_fleet'), eq(notifications.playerId, target)));
    expect(rung).toHaveLength(1);
  });
});

describe('S12 both capsules at once', () => {
  it('is off the target’s map and rings nothing', async () => {
    const both = await raid([...VEIL, ...SILENCE]);
    expect(await sees(1, both)).toBeDefined();
    expect(await sees(2, both)).toBeUndefined();
    expect((await pendingThreads(f.db, f.planetIds[2]!, f.clock.now())).map((thread) => thread.kind)).not.toContain('incoming');
    await f.db.insert(scheduledEvents).values({ seasonId: f.seasonId, kind: 'radar_warning', refId: both, resolveAt: f.clock.now() });
    await new EventWorker(f.db, f.clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, silent).tick();
    expect(await f.db.select().from(notifications)).toHaveLength(0);
  });
});
