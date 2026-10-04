import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { CLAN, MONUMENT_CAPACITY, MULTI_WORLD } from '@astera/rules';
import { accounts, clanMemberships, clans, monumentBattles, monumentBattleParticipants, monuments, monumentShipLots, monumentWaves, planets, players, scheduledEvents, seasons, units } from '../src/db/schema.js';
import { acceptClanRequest, clanActor, createClan, disbandClan, inviteToClan, kickClanMember, leaveClan, reconcileClanPlayerReclaim } from '../src/services/clan.js';
import { recallMonument } from '../src/services/monumentMovement.js';
import { reclaimIdleSeats } from '../src/services/reclaim.js';
import { grant, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

let f: Fixture;
let m: typeof monuments.$inferSelect;
let clanId: string;
let waves: (typeof monumentWaves.$inferSelect)[];
async function hold(owner: number, target = m) {
  const id = randomUUID();
  const [row] = await f.db.insert(monumentWaves).values({ id, seasonId: f.seasonId, monumentId: target.id,
    playerId: f.playerIds[owner]!, originPlanetId: f.planetIds[owner]!, unitLocation: `monument:${id}`,
    purpose: 'REINFORCE', sentFleet: { DART: 1, COURIER: 1 }, tech: {}, route: [], fuelPaid: 0, status: 'HOLD',
    sentAt: target.settledAt, heldAt: target.settledAt, radiationSettledAt: target.settledAt }).returning();
  await f.db.insert(monumentShipLots).values([
    { waveId: id, hull: 'DART', count: 1, damageBp: 1000, remainderBp: 0.25, deuterium: 0 },
    { waveId: id, hull: 'COURIER', count: 1, damageBp: 2000, remainderBp: 0.5, deuterium: 200.125 },
  ]);
  await f.db.insert(units).values([
    { planetId: row!.originPlanetId, ownerPlayerId: row!.playerId, location: row!.unitLocation, hull: 'DART', count: 1 },
    { planetId: row!.originPlanetId, ownerPlayerId: row!.playerId, location: row!.unitLocation, hull: 'COURIER', count: 1 },
  ]);
  return row!;
}
const leave = (owner = 1) => f.db.transaction(async (tx) => leaveClan(tx, { actor: await clanActor(tx, f.accountIds[owner]!), now: f.clock.now() }));
const storedWave = (row: typeof monumentWaves.$inferSelect) => f.db.select().from(monumentWaves).where(eq(monumentWaves.id, row.id)).then((rows) => rows[0]!);
beforeEach(async () => {
  f = await seedWorld(3, 20_261_003);
  await f.db.update(seasons).set({ rulesetVersion: MULTI_WORLD.rulesetVersion }).where(eq(seasons.id, f.seasonId));
  for (const planetId of f.planetIds) await setLevel(f.db, planetId, 'CORE', CLAN.founderCoreLevel);
  clanId = (await f.db.insert(clans).values({ seasonId: f.seasonId, name: 'Hold Pact', nameKey: 'hold pact', tag: 'HP', level: 1, createdAt: f.clock.now() }).returning())[0]!.id;
  for (const owner of [0, 1]) await f.db.insert(clanMemberships).values({ seasonId: f.seasonId, clanId,
    playerId: f.playerIds[owner]!, slot: owner, role: owner === 0 ? 'LEADER' : 'MEMBER', joinedAt: f.clock.now(), matureAt: f.clock.now(), aidPolicyChangedAt: f.clock.now() });
  m = (await f.db.insert(monuments).values({ seasonId: f.seasonId, ordinal: 1, x: 6000, y: 0, z: 0,
    capacity: MONUMENT_CAPACITY, productionPerMinute: 60, controllerClanId: clanId, settledAt: f.clock.now() }).returning())[0]!;
  waves = [await hold(0), await hold(1)];
  f.clock.advance(2);
});
afterAll(async () => { await (await testDb()).close(); });

describe('monument membership changes', () => {
  it('returns dormant members’ HOLD fleets when reclaiming their idle leader dissolves the clan', async () => {
    await f.db.delete(units).where(eq(units.location, waves[0]!.unitLocation));
    await f.db.delete(monumentWaves).where(eq(monumentWaves.id, waves[0]!.id));
    f.clock.advance(4 * 24 * 60);
    await f.db.update(players).set({ lastActiveAt: f.clock.now() }).where(eq(players.id, f.playerIds[2]!));
    const result = await reclaimIdleSeats(f.db, f.clock);
    expect(result).toMatchObject({ reclaimed: [expect.any(String)], deferred: 1, failed: 0 });
    expect((await f.db.select().from(players)).some((row) => row.id === f.playerIds[0])).toBe(false);
    expect(await storedWave(waves[1]!)).toMatchObject({ status: 'RETURNING', returnReason: 'MEMBERSHIP' });
    expect((await f.db.select().from(monuments))[0]?.controllerClanId).toBeNull();
    expect((await f.db.select().from(monumentShipLots)).find((row) => row.hull === 'COURIER')!.deuterium).toBeGreaterThan(200.125);
  });

  it('keeps the monument and member fleet in place when an active member succeeds the reclaimed leader', async () => {
    await f.db.delete(units).where(eq(units.location, waves[0]!.unitLocation));
    await f.db.delete(monumentWaves).where(eq(monumentWaves.id, waves[0]!.id));
    await f.db.transaction((tx) => reconcileClanPlayerReclaim(tx, { playerId: f.playerIds[0]!, seasonId: f.seasonId,
      displayName: 'Departing', now: f.clock.now(), activeCutoff: m.settledAt }));
    expect(await storedWave(waves[1]!)).toMatchObject({ status: 'HOLD' });
    expect((await f.db.select().from(monuments))[0]?.controllerClanId).toBe(clanId);
    expect((await f.db.select().from(clanMemberships)).find((row) => row.playerId === f.playerIds[1])?.role).toBe('LEADER');
  });

  it('keeps an operator exempt when leaving settles a delayed hostile arrival first', async () => {
    const id = randomUUID();
    const origin = (await f.db.select().from(planets).where(eq(planets.id, f.planetIds[2]!)))[0]!;
    const eta = new Date(m.settledAt.getTime() + 60_000);
    await f.db.insert(monumentWaves).values({ id, seasonId: f.seasonId, monumentId: m.id,
      playerId: f.playerIds[2]!, originPlanetId: origin.id, unitLocation: `monument:${id}`,
      purpose: 'ATTACK', sentFleet: { CATACLYSM: 20 }, tech: {}, fuelPaid: 0, status: 'OUTBOUND',
      route: [{ from: { x: origin.x, y: origin.y, z: origin.z }, to: { x: m.x, y: m.y, z: m.z }, startMs: m.settledAt.getTime(), endMs: eta.getTime() }],
      sentAt: m.settledAt, arriveAt: eta, radiationSettledAt: m.settledAt });
    await f.db.insert(monumentShipLots).values({ waveId: id, hull: 'CATACLYSM', count: 20, damageBp: 0, remainderBp: 0, deuterium: 0 });
    await f.db.insert(units).values({ planetId: origin.id, ownerPlayerId: f.playerIds[2]!, location: `monument:${id}`, hull: 'CATACLYSM', count: 20 });
    const [operator] = await f.db.select().from(accounts).where(eq(accounts.id, f.accountIds[2]!));
    await f.db.transaction(async (tx) => leaveClan(tx, { actor: await clanActor(tx, f.accountIds[1]!), now: f.clock.now(), adminUsernames: [operator!.username] }));
    expect((await f.db.select().from(monumentBattles))[0]).toMatchObject({ eligible: false, transfer: 0, createdAt: eta });
    expect((await f.db.select().from(monumentBattleParticipants)).every((row) => row.dominionDelta === 0)).toBe(true);
    expect((await f.db.select().from(players)).every((row) => row.dominionTaken === 0 && row.dominionLost === 0)).toBe(true);
  });

  it('settles old production and returns only a leaving member’s own damaged ships and cargo', async () => {
    await leave();
    expect(await storedWave(waves[0]!)).toMatchObject({ status: 'HOLD' });
    expect(await storedWave(waves[1]!)).toMatchObject({ status: 'RETURNING', returnReason: 'MEMBERSHIP' });
    expect((await f.db.select().from(monuments))[0]?.controllerClanId).toBe(clanId);
    for (const row of waves) {
      const [cargo] = await f.db.select().from(monumentShipLots).where(eq(monumentShipLots.waveId, row.id)).then((rows) => rows.filter((lot) => lot.hull === 'COURIER'));
      expect(cargo).toMatchObject({ damageBp: 2000, remainderBp: 0.5, deuterium: 260.125 });
    }
  });

  it('applies the same personal return when kicked by the clan leader', async () => {
    await f.db.transaction(async (tx) => kickClanMember(tx, { actor: await clanActor(tx, f.accountIds[0]!), playerId: f.playerIds[1]!, now: f.clock.now() }));
    expect(await storedWave(waves[1]!)).toMatchObject({ status: 'RETURNING', returnReason: 'MEMBERSHIP' });
    expect(await storedWave(waves[0]!)).toMatchObject({ status: 'HOLD' });
  });

  it('rolls every attempted wave change back when a non-leader tries to kick another member', async () => {
    await expect(f.db.transaction(async (tx) => kickClanMember(tx, { actor: await clanActor(tx, f.accountIds[1]!), playerId: f.playerIds[0]!, now: f.clock.now() })))
      .rejects.toMatchObject({ code: 'CLAN_LEADER_REQUIRED' });
    expect((await f.db.select().from(monumentWaves)).every((row) => row.status === 'HOLD')).toBe(true);
    expect((await f.db.select().from(monumentShipLots).where(eq(monumentShipLots.hull, 'COURIER'))).every((lot) => lot.deuterium === 200.125)).toBe(true);
  });

  it('returns every member on disband and starts the target’s empty period once', async () => {
    await f.db.transaction(async (tx) => disbandClan(tx, { actor: await clanActor(tx, f.accountIds[0]!), now: f.clock.now() }));
    expect((await f.db.select().from(monumentWaves)).every((row) => row.status === 'RETURNING' && row.returnReason === 'MEMBERSHIP')).toBe(true);
    expect((await f.db.select().from(monuments))[0]).toMatchObject({ controllerClanId: null, emptySince: f.clock.now(), generation: 1 });
    expect(await f.db.select().from(scheduledEvents).where(eq(scheduledEvents.kind, 'monument_respawn'))).toHaveLength(1);
  });

  it('lets manual recall and leaving race without deadlock, duplicate ships or duplicate return legs', async () => {
    const own = waves[1]!;
    const lots = await f.db.select().from(monumentShipLots).where(eq(monumentShipLots.waveId, own.id));
    const results = await Promise.allSettled([leave(), f.db.transaction((tx) => recallMonument(tx, {
      playerId: own.playerId, waveId: own.id, selections: lots.map((lot) => ({ lotId: lot.id, count: lot.count })), clock: f.clock,
    }))]);
    for (const row of results) if (row.status === 'rejected') expect(String(row.reason)).not.toMatch(/deadlock/i);
    expect(await storedWave(own)).toMatchObject({ status: 'RETURNING' });
    expect(await f.db.select().from(monumentWaves)).toHaveLength(2);
    expect((await f.db.select().from(units).where(eq(units.location, own.unitLocation))).reduce((sum, row) => sum + row.count, 0)).toBe(2);
  });

  it('releases a member at two monuments under one ordered target/clan/player lock batch', async () => {
    const [second] = await f.db.insert(monuments).values({ seasonId: f.seasonId, ordinal: 2, x: -6000, y: 0, z: 0,
      capacity: MONUMENT_CAPACITY, productionPerMinute: 60, controllerClanId: clanId, settledAt: f.clock.now() }).returning();
    const leader = await hold(0, second);
    const member = await hold(1, second);
    await leave();
    expect(await storedWave(waves[1]!)).toMatchObject({ status: 'RETURNING', returnReason: 'MEMBERSHIP' });
    expect(await storedWave(member)).toMatchObject({ status: 'RETURNING', returnReason: 'MEMBERSHIP' });
    expect(await storedWave(leader)).toMatchObject({ status: 'HOLD' });
    expect((await f.db.select().from(monuments)).every((row) => row.controllerClanId === clanId)).toBe(true);
  });

  it('promotes a solo monument to clan control when its holder accepts a membership', async () => {
    const [solo] = await f.db.insert(monuments).values({ seasonId: f.seasonId, ordinal: 2, x: -6000, y: 0, z: 0,
      capacity: MONUMENT_CAPACITY, productionPerMinute: 60, controllerPlayerId: f.playerIds[2]!, settledAt: f.clock.now() }).returning();
    const own = await hold(2, solo);
    const invitation = await f.db.transaction(async (tx) => inviteToClan(tx, { actor: await clanActor(tx, f.accountIds[0]!), playerId: own.playerId, now: f.clock.now() }));
    await f.db.transaction(async (tx) => acceptClanRequest(tx, { actor: await clanActor(tx, f.accountIds[2]!), requestId: invitation.requestId, acknowledgeHostile: false, now: f.clock.now() }));
    expect((await f.db.select().from(monuments).where(eq(monuments.id, solo!.id)))[0]).toMatchObject({ controllerPlayerId: null, controllerClanId: clanId });
    expect(await storedWave(own)).toMatchObject({ status: 'HOLD', playerId: f.playerIds[2] });
  });

  it('does the same on clan creation without transferring ships or their cargo to the clan', async () => {
    const [solo] = await f.db.insert(monuments).values({ seasonId: f.seasonId, ordinal: 2, x: -6000, y: 0, z: 0,
      capacity: MONUMENT_CAPACITY, productionPerMinute: 60, controllerPlayerId: f.playerIds[2]!, settledAt: f.clock.now() }).returning();
    const own = await hold(2, solo);
    await grant(f.db, own.originPlanetId, CLAN.creationCost.alloy * 2, CLAN.creationCost.crystal * 2);
    const created = await f.db.transaction(async (tx) => createClan(tx, { actor: await clanActor(tx, f.accountIds[2]!),
      name: 'Solo Hold', tag: 'SH', description: '', recruiting: true, clock: f.clock }));
    expect((await f.db.select().from(monuments).where(eq(monuments.id, solo!.id)))[0]).toMatchObject({ controllerPlayerId: null, controllerClanId: created.clanId });
    expect((await f.db.select().from(monumentShipLots).where(eq(monumentShipLots.waveId, own.id))).find((lot) => lot.hull === 'COURIER')?.deuterium).toBe(200.125);
  });
});
