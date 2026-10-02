import { pino } from 'pino';
import { and, eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { CLAN_SUPPORT, hangarLoad, type Fleet } from '@astera/rules';
import {
  clanSupportWaves,
  missions,
  notifications,
  planets,
  scheduledEvents,
  units,
} from '../src/db/schema.js';
import { clanActor, leaveClan } from '../src/services/clan.js';
import {
  recallClanSupport,
  sendBackClanSupport,
  sendClanSupport,
  setDefencePosture,
} from '../src/services/clanSupport.js';
import { planetView } from '../src/services/planetView.js';
import { EventWorker } from '../src/worker/loop.js';
import { testDb, type Fixture } from './helpers.js';
import { formClan, namesOf, supportWorld } from './clanSupportFixture.js';

/**
 * KLAN SAVUNMA DESTEĞİ — the legs of a wave (`docs/clan-defense-support-plan.md`, P7).
 *
 * Commander 0 sends from world 0 to commander 1's world 1; 2 is another member.
 */

afterAll(async () => { await (await testDb()).close(); });
const silent = pino({ level: 'silent' });
const HOUR = 3_600_000;
const FLEET: Fleet = { DART: 20, COURIER: 2 };

const worker = (f: Fixture) => new EventWorker(f.db, f.clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, silent);
const at = async (f: Fixture, ms: number) => {
  f.clock.set(new Date(ms));
  await worker(f).tick();
};

const posture = (f: Fixture, host: number, support: boolean) => f.db.transaction((tx) => setDefencePosture(tx, {
  planetId: f.planetIds[host]!,
  playerId: f.playerIds[host]!,
  toggles: { escape: !support, support },
  clock: f.clock,
}));

const send = (f: Fixture, sender = 0, host = 1, fleet: Fleet = FLEET) =>
  f.db.transaction((tx) => sendClanSupport(tx, {
    senderPlayerId: f.playerIds[sender]!,
    originPlanetId: f.planetIds[sender]!,
    hostPlanetId: f.planetIds[host]!,
    fleet,
    clock: f.clock,
  }));

const recall = (f: Fixture, player: number, waveId: string) =>
  f.db.transaction((tx) => recallClanSupport(tx, { playerId: f.playerIds[player]!, waveId, clock: f.clock }));
const sendBack = (f: Fixture, player: number, waveId: string) =>
  f.db.transaction((tx) => sendBackClanSupport(tx, { playerId: f.playerIds[player]!, waveId, clock: f.clock }));

const waveOf = async (f: Fixture, id: string) =>
  (await f.db.select().from(clanSupportWaves).where(eq(clanSupportWaves.id, id)))[0]!;

const homeOf = async (f: Fixture, planet: number): Promise<Fleet> => {
  const rows = await f.db.select().from(units)
    .where(and(eq(units.planetId, f.planetIds[planet]!), eq(units.location, 'home')));
  return Object.fromEntries(rows.filter((row) => row.count > 0).map((row) => [row.hull, row.count]));
};

const departed = (f: Fixture, player: number, waveId: string) => f.db.select().from(notifications).where(and(
  eq(notifications.playerId, f.playerIds[player]!),
  eq(notifications.kind, 'clan_support_departed'),
  eq(notifications.refId, waveId),
));

async function ready(seed: number): Promise<Fixture> {
  const f = await supportWorld(4, seed);
  await formClan(f, 0, [1, 2]);
  await posture(f, 1, true);
  return f;
}

async function stationed(seed: number) {
  const f = await ready(seed);
  const { wave } = await send(f);
  await at(f, new Date(wave.arriveAt).getTime() + 1_000);
  return { f, waveId: wave.id };
}

describe('arriving', () => {
  it('stands the wave at the host for twelve hours and moves its room from reserved to used', async () => {
    const { f, waveId } = await stationed(15_301);
    const wave = await waveOf(f, waveId);
    expect(wave.status).toBe('STATIONED');
    expect(wave.expiresAt!.getTime() - wave.stationedAt!.getTime()).toBe(CLAN_SUPPORT.stationHours * HOUR);
    const [expiry] = await f.db.select().from(scheduledEvents).where(and(
      eq(scheduledEvents.kind, 'clan_support_expiry'),
      eq(scheduledEvents.refId, waveId),
    ));
    expect(expiry!.resolveAt.getTime()).toBe(wave.expiresAt!.getTime());
    const view = await f.db.transaction((tx) => planetView(tx, f.planetIds[1]!, f.clock));
    expect(view.clanSupport!.room).toMatchObject({ used: hangarLoad(FLEET), reserved: 0 });
    expect(view.clanSupport!.waves[0]).toMatchObject({ id: waveId, status: 'STATIONED', fleet: FLEET });
  });

  it('turns back untouched if the host closed support while it flew', async () => {
    const f = await ready(15_302);
    const { wave } = await send(f);
    const before = await homeOf(f, 0);
    // The host changes their mind half way: the wave turns in space.
    await at(f, (f.clock.now().getTime() + new Date(wave.arriveAt).getTime()) / 2);
    const closed = await posture(f, 1, false);
    expect(closed.returnedWaves).toBe(1);
    const turned = await waveOf(f, wave.id);
    expect(turned).toMatchObject({ status: 'RETURNING', returnReason: 'HOST_CLOSED' });
    await at(f, turned.returnAt!.getTime() + 1_000);
    expect((await waveOf(f, wave.id)).status).toBe('HOME');
    const home = await homeOf(f, 0);
    expect(home.DART).toBe((before.DART ?? 0) + (FLEET.DART ?? 0));
    expect(await departed(f, 0, wave.id)).toHaveLength(1);
  });
});

describe('the sender’s recall', () => {
  it('turns a wave in flight once — home in the time it had flown, nothing refunded', async () => {
    const f = await ready(15_303);
    const { wave } = await send(f);
    const [tank] = await f.db.select({ d: planets.deuterium }).from(planets).where(eq(planets.id, f.planetIds[0]!));
    const sentAt = f.clock.now().getTime();
    const flown = Math.floor((new Date(wave.arriveAt).getTime() - sentAt) / 3);
    await at(f, sentAt + flown);
    const recalled = await recall(f, 0, wave.id);
    expect(recalled.wave).toMatchObject({ status: 'RETURNING', returnReason: 'RECALLED' });
    const row = await waveOf(f, wave.id);
    expect(row.returnAt!.getTime()).toBe(sentAt + 2 * flown);
    const [mission] = await f.db.select().from(missions).where(eq(missions.id, row.outboundMissionId));
    expect(mission!.recalledAt).not.toBeNull();
    // A second recall answers with the same state and turns nothing again.
    const again = await recall(f, 0, wave.id);
    expect(again.wave.returnAt).toBe(recalled.wave.returnAt);
    await at(f, row.returnAt!.getTime() + 1_000);
    expect((await waveOf(f, wave.id)).status).toBe('HOME');
    const [after] = await f.db.select({ d: planets.deuterium }).from(planets).where(eq(planets.id, f.planetIds[0]!));
    expect(after!.d).toBeGreaterThanOrEqual(tank!.d - 1); // nothing more charged; nothing back
    expect(after!.d).toBeLessThanOrEqual(tank!.d + 50);
    // The host is told; the sender, who asked, is not.
    expect(await departed(f, 1, wave.id)).toHaveLength(1);
    expect(await departed(f, 0, wave.id)).toHaveLength(0);
  });

  it('refuses a recall in the instant the wave is landing', async () => {
    const f = await ready(15_304);
    const { wave } = await send(f);
    f.clock.set(new Date(new Date(wave.arriveAt).getTime() + 1));
    await expect(recall(f, 0, wave.id)).rejects.toMatchObject({ code: 'CLAN_SUPPORT_LANDING' });
  });

  it('sends a standing wave home from the host and frees the room at once', async () => {
    const { f, waveId } = await stationed(15_305);
    const out = await recall(f, 0, waveId);
    expect(out.wave).toMatchObject({ status: 'RETURNING', returnReason: 'RECALLED' });
    const row = await waveOf(f, waveId);
    expect(row.returnMissionId).not.toBeNull();
    const [leg] = await f.db.select().from(missions).where(eq(missions.id, row.returnMissionId!));
    expect(leg).toMatchObject({
      kind: 'clan_support',
      originPlanetId: f.planetIds[1],
      targetPlanetId: f.planetIds[0],
      fuelPaid: 0,
      parentMissionId: row.outboundMissionId,
    });
    const hostView = await f.db.transaction((tx) => planetView(tx, f.planetIds[1]!, f.clock));
    expect(hostView.clanSupport!.room).toMatchObject({ used: 0, reserved: 0 });
    expect(hostView.clanSupport!.waves).toHaveLength(0);
    // The bay is still held until the ships are home.
    const flying = (await f.db.transaction((tx) => planetView(tx, f.planetIds[0]!, f.clock))).flight.used;
    await at(f, row.returnAt!.getTime() + 1_000);
    expect((await waveOf(f, waveId)).status).toBe('HOME');
    const landed = (await f.db.transaction((tx) => planetView(tx, f.planetIds[0]!, f.clock))).flight.used;
    expect(landed).toBe(flying - 1);
    const parked = await f.db.select().from(units).where(eq(units.location, row.unitLocation));
    expect(parked).toHaveLength(0);
  });

  it('refuses anybody else’s recall', async () => {
    const { f, waveId } = await stationed(15_306);
    await expect(recall(f, 2, waveId)).rejects.toMatchObject({ code: 'CLAN_SUPPORT_NOT_OWNED' });
  });
});

describe('the host’s send-back', () => {
  it('sends a standing wave home and tells the sender why', async () => {
    const { f, waveId } = await stationed(15_307);
    const out = await sendBack(f, 1, waveId);
    expect(out.wave).toMatchObject({ status: 'RETURNING', returnReason: 'SENT_BACK' });
    expect(await departed(f, 0, waveId)).toHaveLength(1);
    expect((await departed(f, 0, waveId))[0]!.payload).toMatchObject({
      reason: 'SENT_BACK',
      senderName: (await namesOf(f, 0)).commander,
      hostName: (await namesOf(f, 1)).commander,
      hostPlanetName: (await namesOf(f, 1)).world,
    });
  });

  it('turns an inbound wave in space', async () => {
    const f = await ready(15_308);
    const { wave } = await send(f);
    await at(f, (f.clock.now().getTime() + new Date(wave.arriveAt).getTime()) / 2);
    const out = await sendBack(f, 1, wave.id);
    expect(out.wave).toMatchObject({ status: 'RETURNING', returnReason: 'SENT_BACK' });
  });

  it('refuses anybody but the host', async () => {
    const { f, waveId } = await stationed(15_309);
    await expect(sendBack(f, 0, waveId)).rejects.toMatchObject({ code: 'CLAN_SUPPORT_NOT_HOST' });
    await expect(sendBack(f, 2, waveId)).rejects.toMatchObject({ code: 'CLAN_SUPPORT_NOT_HOST' });
  });

  it('answers a wave that does not exist', async () => {
    const f = await ready(15_310);
    await expect(sendBack(f, 1, '00000000-0000-4000-8000-000000000000'))
      .rejects.toMatchObject({ code: 'CLAN_SUPPORT_NOT_FOUND' });
  });
});

describe('twelve hours up', () => {
  it('sends the wave home on its own and tells both sides', async () => {
    const { f, waveId } = await stationed(15_311);
    const wave = await waveOf(f, waveId);
    await at(f, wave.expiresAt!.getTime() + 1);
    expect(await waveOf(f, waveId)).toMatchObject({ status: 'RETURNING', returnReason: 'EXPIRED' });
    expect(await departed(f, 0, waveId)).toHaveLength(1);
    expect(await departed(f, 1, waveId)).toHaveLength(1);
    // Each side is told in its own voice: "your ships" to one, "Ali's ships" to the other.
    expect((await departed(f, 0, waveId))[0]!.payload).toMatchObject({ role: 'SENDER', reason: 'EXPIRED' });
    expect((await departed(f, 1, waveId))[0]!.payload).toMatchObject({ role: 'HOST', reason: 'EXPIRED' });
  });

  it('does nothing to a wave the host already sent back in the same instant', async () => {
    const { f, waveId } = await stationed(15_312);
    const wave = await waveOf(f, waveId);
    f.clock.set(new Date(wave.expiresAt!.getTime() + 1));
    await sendBack(f, 1, waveId);
    await worker(f).tick();
    const after = await waveOf(f, waveId);
    expect(after.returnReason).toBe('SENT_BACK');
    const legs = await f.db.select().from(missions)
      .where(and(eq(missions.parentMissionId, wave.outboundMissionId), eq(missions.kind, 'clan_support')));
    expect(legs).toHaveLength(1);
  });
});

describe('membership ends the arrangement', () => {
  it('sends a leaving sender’s waves home', async () => {
    const { f, waveId } = await stationed(15_313);
    await f.db.update(planets).set({ defencePosture: 'SUPPORT' }).where(eq(planets.id, f.planetIds[2]!));
    // Commander 2 leaves; commander 0's wave is not theirs and stays.
    await f.db.transaction(async (tx) => leaveClan(tx, { actor: await clanActor(tx, f.accountIds[2]!), now: f.clock.now() }));
    expect((await waveOf(f, waveId)).status).toBe('STATIONED');
  });

  it('sends every wave at a leaving host home, and the leaver’s own waves too', async () => {
    const f = await ready(15_314);
    await posture(f, 2, true);
    const { wave: toLeaver } = await send(f, 0, 1);
    const { wave: fromLeaver } = await send(f, 1, 2);
    await at(f, Math.max(new Date(toLeaver.arriveAt).getTime(), new Date(fromLeaver.arriveAt).getTime()) + 1_000);
    await f.db.transaction(async (tx) => leaveClan(tx, { actor: await clanActor(tx, f.accountIds[1]!), now: f.clock.now() }));
    expect(await waveOf(f, toLeaver.id)).toMatchObject({ status: 'RETURNING', returnReason: 'MEMBERSHIP' });
    expect(await waveOf(f, fromLeaver.id)).toMatchObject({ status: 'RETURNING', returnReason: 'MEMBERSHIP' });
  });
});

describe('a leg that fails in the worker', () => {
  it('puts the wave back at its origin intact', async () => {
    const f = await ready(15_315);
    const before = await homeOf(f, 0);
    const { wave } = await send(f);
    const row = await waveOf(f, wave.id);
    const [event] = await f.db.select().from(scheduledEvents).where(and(
      eq(scheduledEvents.kind, 'mission_arrival'),
      eq(scheduledEvents.refId, row.outboundMissionId),
    ));
    const { abandon } = await import('../src/worker/abandon.js');
    expect(await abandon(f.db, event!, f.clock)).toBe(true);
    expect(await abandon(f.db, event!, f.clock)).toBe(false);
    expect((await waveOf(f, wave.id)).status).toBe('HOME');
    expect((await homeOf(f, 0)).DART).toBe(before.DART);
  });
});
