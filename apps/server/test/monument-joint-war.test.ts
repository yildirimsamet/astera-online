import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { CLAN, hangarLoad, MONUMENT_CAPACITY, MONUMENT_SEASON_DEFAULTS, type Fleet } from '@astera/rules';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { accounts, clanMemberships, clanWarContributions, clanWarOperations, clans, hpRadiationSources, missions, monumentBattleParticipants, monumentBattles, monuments, monumentShipLots, monumentWaves, notifications, planets, players, seasons, units } from '../src/db/schema.js';
import { acceptClanRequest, applyToClan, clanActor, createClan } from '../src/services/clan.js';
import { markClanWarMonumentTarget, openOperation, quoteClanWarContribution, readClanWar, sendClanWarContribution, startClanWar } from '../src/services/clanWar.js';
import { forceRecoveryShield } from '../src/services/attackProtection.js';
import { baysInUse } from '../src/services/flight.js';
import { closeSeasonMonuments } from '../src/services/monumentSeasonClose.js';
import { wipeAllServers } from '../src/services/servers.js';
import { EventWorker } from '../src/worker/loop.js';
import { fuelUp, giveNewcomerShield, giveUnits, grant, levelWorld, seedWorld, setLevel, testDb, testEnv, type Fixture } from './helpers.js';

let f: Fixture;
let m: typeof monuments.$inferSelect;
let clanId: string;
const silent = pino({ level: 'silent' });
const fleet: Fleet = { CITADEL: 2, ARGOSY: 1 };
const actor = (index: number) => clanActor(f.db, f.accountIds[index]!);
const mark = () => f.db.transaction(async (tx) => markClanWarMonumentTarget(tx, { actor: await actor(0), monumentId: m.id, clock: f.clock }));
const send = (index: number) => f.db.transaction(async (tx) => sendClanWarContribution(tx, { actor: await actor(index),
  originPlanetId: f.planetIds[index]!, fleet, acknowledgeShieldLoss: true, clock: f.clock }));
const start = () => f.db.transaction(async (tx) => startClanWar(tx, { actor: await actor(0), acknowledgeShieldLoss: true, clock: f.clock }));
async function stage() {
  await send(0);
  await send(1);
  const rows = await f.db.select().from(missions).where(eq(missions.status, 'in_flight'));
  const last = Math.max(f.clock.now().getTime(), ...rows.map((row) => row.arriveAt.getTime()));
  f.clock.set(new Date(last + 1000));
  await new EventWorker(f.db, f.clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, silent).tick();
}
async function arrive(at: string) {
  f.clock.set(new Date(new Date(at).getTime() + 1000));
  await new EventWorker(f.db, f.clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, silent).tick();
}
beforeEach(async () => {
  f = await seedWorld(3, 20_261_010);
  await f.db.update(seasons).set({ rulesetVersion: 16 }).where(eq(seasons.id, f.seasonId));
  await levelWorld(f.db, f.planetIds);
  for (const [index, id] of f.planetIds.entries()) {
    await setLevel(f.db, id, 'HANGAR', 10);
    await grant(f.db, id, 600_000, 300_000);
    await fuelUp(f.db, id);
    await giveUnits(f.db, id, fleet);
    await f.db.update(planets).set({ x: 3500, y: 0, z: index * 50 }).where(eq(planets.id, id));
  }
  const leader = await actor(0);
  const created = await f.db.transaction((tx) => createClan(tx, { actor: leader, name: 'Outer Horizon', tag: 'OH',
    description: 'Together at the rim.', recruiting: true, clock: f.clock }));
  clanId = created.clanId;
  const member = await actor(1);
  const application = await f.db.transaction((tx) => applyToClan(tx, { actor: member, clanId, now: f.clock.now() }));
  await f.db.transaction((tx) => acceptClanRequest(tx, { actor: leader, requestId: application.requestId, acknowledgeHostile: true, now: f.clock.now() }));
  const joinedAt = new Date(f.clock.now().getTime() - 13 * 3_600_000);
  for (const id of f.playerIds.slice(0, 2)) await f.db.update(clanMemberships).set({ joinedAt,
    matureAt: new Date(joinedAt.getTime() + CLAN.adaptationMinutes * 60_000) }).where(eq(clanMemberships.playerId, id));
  await f.db.update(clans).set({ level: 5 }).where(eq(clans.id, clanId));
  m = (await f.db.insert(monuments).values({ seasonId: f.seasonId, ordinal: 1, x: 6000, y: 0, z: 0,
    capacity: MONUMENT_CAPACITY, productionPerMinute: 60, settledAt: f.clock.now(), garrison: {} }).returning())[0]!;
});
afterAll(async () => { await (await testDb()).close(); });

describe('the existing clan preparation with a real monument target', () => {
  it('rejects a shielded member contribution without consent at the HTTP boundary, before staging any ships', async () => {
    await mark();
    const shieldUntil = new Date(f.clock.now().getTime() + 3_600_000);
    await giveNewcomerShield(f.db, f.playerIds[1]!, shieldUntil);
    const built = buildApp({ env: testEnv(), logger: silent, db: f.db, clock: f.clock });
    const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);
    const authorization = `Bearer ${await tokens.issueAccess(f.accountIds[1]!)}`;
    try {
      const response = await built.app.inject({ method: 'POST', url: '/api/clan/war/contributions',
        headers: { authorization, 'idempotency-key': randomUUID() },
        payload: { originPlanetId: f.planetIds[1]!, fleet, acknowledgeShieldLoss: false, acknowledgeRadiationLoss: false } });
      expect(response.statusCode, response.body).toBe(409);
      expect(response.json<{ error: string }>().error).toBe('SHIELD_WOULD_DROP');
      expect(await f.db.select().from(clanWarContributions)).toEqual([]);
      expect((await f.db.select().from(players).where(eq(players.id, f.playerIds[1]!)))[0]?.newcomerShieldUntil).toEqual(shieldUntil);
      await send(1);
      expect((await f.db.select().from(clanWarContributions))[0]?.shieldLossAcknowledged).toBe(true);
    } finally { await built.close(); }
  });

  it('requires and consumes shield consent for a neutral monument joint launch', async () => {
    const shieldUntil = new Date(f.clock.now().getTime() + 3_600_000);
    await giveNewcomerShield(f.db, f.playerIds[0]!, shieldUntil);
    await mark();
    const quote = await quoteClanWarContribution(f.db, { actor: await actor(0), originPlanetId: f.planetIds[0]!, fleet, clock: f.clock });
    expect(quote.shieldWouldDrop).toMatchObject({ kind: 'NEWCOMER', until: shieldUntil.toISOString() });
    await stage();
    expect((await readClanWar(f.db, await actor(0), f.clock.now())).operation?.startShieldWouldDrop).toMatchObject({ kind: 'NEWCOMER' });
    expect((await f.db.select().from(players).where(eq(players.id, f.playerIds[0]!)))[0]?.newcomerShieldUntil).toEqual(shieldUntil);
    await start();
    expect((await f.db.select().from(players).where(eq(players.id, f.playerIds[0]!)))[0]?.newcomerShieldUntil).toBeNull();
  });

  it('does not treat a neutral monument wave as an outbound PvP strike when granting recovery protection', async () => {
    await mark();
    await stage();
    expect((await f.db.select().from(clanWarOperations))[0]?.targetKind).toBe('MONUMENT');
    const result = await f.db.transaction((tx) => forceRecoveryShield(tx, {
      playerId: f.playerIds[1]!, planetId: f.planetIds[1]!, now: f.clock.now(),
    }));
    expect(result).not.toBeNull();
  });

  it('passes the member’s own HP consent through the strict contribution HTTP boundary', async () => {
    await mark();
    await f.db.insert(hpRadiationSources).values({ seasonId: f.seasonId, anchorKind: 'MONUMENT', anchorId: m.id,
      x: 5000, y: 0, z: 0, radius: 5000, intensityHpPerMinute: 1_000_000, mode: 'EMIT', activeFrom: f.clock.now() });
    const built = buildApp({ env: testEnv(), logger: silent, db: f.db, clock: f.clock });
    const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);
    const authorization = `Bearer ${await tokens.issueAccess(f.accountIds[1]!)}`;
    try {
      for (const acknowledgeRadiationLoss of [false, true]) {
        const response = await built.app.inject({ method: 'POST', url: '/api/clan/war/contributions',
          headers: { authorization, 'idempotency-key': randomUUID() },
          payload: { originPlanetId: f.planetIds[1]!, fleet, acknowledgeShieldLoss: true, acknowledgeRadiationLoss } });
        expect(response.statusCode, response.body).toBe(acknowledgeRadiationLoss ? 200 : 409);
        if (!acknowledgeRadiationLoss) {
          expect(response.json<{ error: string }>().error).toBe('RADIATION_LETHAL');
          expect(await f.db.select().from(clanWarContributions)).toEqual([]);
        }
      }
      expect((await f.db.select().from(clanWarContributions))[0]?.radiationLossAcknowledged).toBe(true);
    } finally { await built.close(); }
  });

  it('passes the leader’s own HP consent through start without granting consent for other members', async () => {
    await mark();
    await stage();
    await f.db.update(clanWarContributions).set({ radiationLossAcknowledged: true })
      .where(eq(clanWarContributions.playerId, f.playerIds[1]!));
    await f.db.insert(hpRadiationSources).values({ seasonId: f.seasonId, anchorKind: 'MONUMENT', anchorId: m.id,
      x: 5000, y: 0, z: 0, radius: 5000, intensityHpPerMinute: 1_000_000, mode: 'EMIT', activeFrom: f.clock.now() });
    const built = buildApp({ env: testEnv(), logger: silent, db: f.db, clock: f.clock });
    const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);
    const authorization = `Bearer ${await tokens.issueAccess(f.accountIds[0]!)}`;
    try {
      for (const acknowledgeRadiationLoss of [false, true]) {
        const response = await built.app.inject({ method: 'POST', url: '/api/clan/war/start',
          headers: { authorization, 'idempotency-key': randomUUID() },
          payload: { acknowledgeShieldLoss: true, acknowledgeRadiationLoss } });
        expect(response.statusCode, response.body).toBe(acknowledgeRadiationLoss ? 200 : 409);
        if (!acknowledgeRadiationLoss) expect(await f.db.select().from(monumentWaves)).toEqual([]);
      }
      expect(await f.db.select().from(monumentWaves)).toHaveLength(2);
    } finally { await built.close(); }
  });

  it('shows lethal planned HP exposure in a member’s contribution quote and refuses an unacknowledged send', async () => {
    await mark();
    await f.db.insert(hpRadiationSources).values({ seasonId: f.seasonId, anchorKind: 'MONUMENT', anchorId: m.id,
      x: 5000, y: 0, z: 0, radius: 5000, intensityHpPerMinute: 1_000_000, mode: 'EMIT', activeFrom: f.clock.now() });
    const quote = await quoteClanWarContribution(f.db, { actor: await actor(1), originPlanetId: f.planetIds[1]!, fleet, clock: f.clock });
    expect(quote).toMatchObject({ ok: false, radiation: { destroyed: 3, doseHp: expect.any(Number) as number } });
    expect(quote.refusals).toContainEqual(expect.objectContaining({ code: 'RADIATION_LETHAL' }));
    await expect(send(1)).rejects.toMatchObject({ code: 'RADIATION_LETHAL' });
    expect(await f.db.select().from(clanWarContributions)).toEqual([]);
    const sent = await f.db.transaction(async tx => sendClanWarContribution(tx, { actor: await actor(1),
      originPlanetId: f.planetIds[1]!, fleet, acknowledgeShieldLoss: true, acknowledgeRadiationLoss: true, clock: f.clock }));
    expect((await f.db.select().from(clanWarContributions))[0]).toMatchObject({ radiationLossAcknowledged: true, id: sent.contributionId });
  });

  it('cannot use the leader’s HP loss consent for a member who staged before a lethal cloud appeared', async () => {
    await mark();
    await stage();
    await f.db.insert(hpRadiationSources).values({ seasonId: f.seasonId, anchorKind: 'MONUMENT', anchorId: m.id,
      x: 5000, y: 0, z: 0, radius: 5000, intensityHpPerMinute: 1_000_000, mode: 'EMIT', activeFrom: f.clock.now() });
    await expect(f.db.transaction(async tx => startClanWar(tx, { actor: await actor(0), acknowledgeShieldLoss: true,
      acknowledgeRadiationLoss: true, clock: f.clock }))).rejects.toMatchObject({
        code: 'RADIATION_LETHAL', params: { playerId: f.playerIds[1]!, count: 3 },
      });
    expect(await f.db.select().from(monumentWaves)).toEqual([]);
    expect((await openOperation(f.db, clanId))?.status).toBe('ASSEMBLING');
    const view = await readClanWar(f.db, await actor(0), f.clock.now());
    expect(view.operation).toMatchObject({ radiationByPace: expect.arrayContaining([{
      pace: 1, own: expect.any(Array) as unknown[], missingConsents: [{ playerId: f.playerIds[1]!, username: expect.any(String) as string, count: 3 }],
    }]) as unknown[] });
  });

  it('carries configured operator exclusion into a delayed battle resolved by a clan read', async () => {
    await mark();
    await f.db.update(accounts).set({ username: 'operator' }).where(eq(accounts.id, f.accountIds[2]!));
    await f.db.update(monuments).set({ controllerPlayerId: f.playerIds[2]! }).where(eq(monuments.id, m.id));
    const at = f.clock.now(), eta = new Date(at.getTime() + 60_000);
    for (const [index, hull, count, status] of [[0, 'CATACLYSM', 20, 'OUTBOUND'], [2, 'DART', 10, 'HOLD']] as const) {
      const id = randomUUID();
      await f.db.insert(monumentWaves).values({ id, seasonId: f.seasonId, monumentId: m.id, playerId: f.playerIds[index]!,
        originPlanetId: f.planetIds[index]!, unitLocation: `monument:${id}`, purpose: 'ATTACK', sentFleet: { [hull]: count }, tech: {},
        sentAt: at, radiationSettledAt: at, fuelPaid: 0, status, heldAt: status === 'HOLD' ? at : null, arriveAt: status === 'OUTBOUND' ? eta : null,
        route: [{ from: { x: 3500, y: 0, z: 0 }, to: { x: m.x, y: m.y, z: m.z }, startMs: at.getTime(), endMs: eta.getTime() }] });
      await f.db.insert(monumentShipLots).values({ waveId: id, hull, count, damageBp: 0, remainderBp: 0, deuterium: 0 });
      await f.db.insert(units).values({ planetId: f.planetIds[index]!, ownerPlayerId: f.playerIds[index]!, location: `monument:${id}`, hull, count });
    }
    f.clock.set(new Date(eta.getTime() + 1000));
    await readClanWar(f.db, await actor(0), f.clock.now(), ['operator']);
    expect((await f.db.select().from(monumentBattles))[0]).toMatchObject({ eligible: false, transfer: 0, rawExchange: 0 });
    expect((await f.db.select().from(monumentBattleParticipants)).every(row => row.dominionDelta === 0)).toBe(true);
  });
  it('reconciles a delayed native ATTACKING operation before drawing the clan screen', async () => {
    await mark();
    await stage();
    const launched = await start();
    f.clock.set(new Date(new Date(launched.arriveAt).getTime() + 1000));
    const view = await readClanWar(f.db, await actor(0), f.clock.now());
    expect(view.operation).toBeNull();
    expect((await f.db.select().from(monumentWaves)).every(wave => wave.status === 'HOLD')).toBe(true);
    expect(await f.db.select().from(monumentBattles)).toHaveLength(1);
    await readClanWar(f.db, await actor(0), f.clock.now());
    expect(await f.db.select().from(monumentBattles)).toHaveLength(1);
  });
  it('releases preparation as soon as its last native outbound wave is fully recalled', async () => {
    await mark();
    await stage();
    await start();
    const native = await f.db.select().from(monumentWaves);
    const { recallMonument } = await import('../src/services/monumentMovement.js');
    for (const [index, wave] of native.entries()) {
      const lots = await f.db.select().from(monumentShipLots).where(eq(monumentShipLots.waveId, wave.id));
      await f.db.transaction(tx => recallMonument(tx, { playerId: wave.playerId, waveId: wave.id,
        selections: lots.map(lot => ({ lotId: lot.id, count: lot.count })), clock: f.clock }));
      expect(await openOperation(f.db, clanId) === null).toBe(index === native.length - 1);
    }
    expect((await f.db.select().from(monumentWaves)).every(wave => wave.status === 'RETURNING')).toBe(true);
    expect(await f.db.select().from(monumentBattles)).toEqual([]);
    expect((await f.db.select().from(clanWarOperations))[0]).toMatchObject({ status: 'COMPLETED', closeReason: 'MONUMENT', resolvedAt: f.clock.now() });
  });
  it('marks a monument without a fake planet, enemy roster or preparation warning', async () => {
    const before = await f.db.select().from(planets);
    const marked = await mark();
    expect(marked.operation.target).toMatchObject({ kind: 'MONUMENT', monumentId: m.id, monumentOrdinal: 1,
      username: '', planetId: null, playerId: null });
    expect((await f.db.select().from(clanWarOperations))[0]).toMatchObject({ targetKind: 'MONUMENT', targetMonumentId: m.id, targetPlanetId: null, targetPlayerId: null });
    expect(await f.db.select().from(planets)).toEqual(before);
    expect(await f.db.select().from(notifications).where(eq(notifications.kind, 'monument_inbound'))).toEqual([]);
    await expect(mark()).rejects.toMatchObject({ code: 'CLAN_WAR_ALREADY_OPEN' });
  });

  it('uses normal staging, one explicit combined battle and each owner’s native HOLD', async () => {
    await mark();
    await stage();
    const waves = await f.db.select().from(clanWarContributions);
    expect(waves.every((wave) => wave.status === 'STAGED')).toBe(true);
    const launched = await start();
    expect(await f.db.select().from(missions).where(and(eq(missions.kind, 'clan_war'), eq(missions.status, 'in_flight')))).toEqual([]);
    const native = await f.db.select().from(monumentWaves);
    expect(native).toHaveLength(2);
    expect(new Set(native.map((wave) => wave.jointOperationId))).toEqual(new Set([waves[0]?.operationId]));
    expect(new Set(native.map((wave) => wave.jointContributionId))).toEqual(new Set(waves.map((wave) => wave.id)));
    await arrive(launched.arriveAt);
    expect(await f.db.select().from(monumentBattles)).toHaveLength(1);
    expect(await f.db.select().from(monumentBattleParticipants)).toHaveLength(2);
    expect((await f.db.select().from(monumentWaves)).every((wave) => wave.status === 'HOLD')).toBe(true);
    expect((await f.db.select().from(monuments))[0]?.controllerClanId).toBe(clanId);
    expect(await openOperation(f.db, clanId)).toBeNull();
    expect((await f.db.select().from(clanWarContributions)).every((wave) => wave.status === 'TRANSFERRED')).toBe(true);
    for (const index of [0, 1]) {
      expect(await baysInUse(f.db, f.planetIds[index]!)).toBe(1);
      const physical = await f.db.select().from(units).where(eq(units.ownerPlayerId, f.playerIds[index]!));
      expect(physical.reduce((sum, row) => sum + row.count, 0)).toBe(3);
    }
  });

  it('carries each contributor’s exact wound and own research through a combined walkover', async () => {
    await mark();
    await stage();
    const waves = await f.db.select().from(clanWarContributions);
    for (const [index, wave] of waves.entries()) await f.db.update(clanWarContributions).set({ tech: { SHIP_ARMOR: index + 1 },
      damage: [{ hull: 'CITADEL', count: 2, damageBp: 3000, remainderBp: 0.125 + index * 0.25 }] }).where(eq(clanWarContributions.id, wave.id));
    const launched = await start();
    await arrive(launched.arriveAt);
    for (const [index, wave] of waves.entries()) {
      const [native] = await f.db.select().from(monumentWaves).where(eq(monumentWaves.jointContributionId, wave.id));
      expect(native?.tech).toEqual({ SHIP_ARMOR: index + 1 });
      expect(await f.db.select().from(monumentShipLots).where(and(eq(monumentShipLots.waveId, native!.id), eq(monumentShipLots.hull, 'CITADEL'))))
        .toMatchObject([{ count: 2, damageBp: 3000, remainderBp: 0.125 + index * 0.25 }]);
    }
  });

  it('does not impose a planet tier band on the monument preparation or launch', async () => {
    await setLevel(f.db, f.planetIds[1]!, 'CORE', 1);
    await mark();
    await stage();
    await expect(start()).resolves.toMatchObject({ participants: 2 });
  });

  it('spends each participant’s PvP shield only at the actual combined dispatch and warns the existing holder once', async () => {
    const holder = randomUUID();
    await f.db.update(monuments).set({ controllerPlayerId: f.playerIds[2]! }).where(eq(monuments.id, m.id));
    await f.db.insert(monumentWaves).values({ id: holder, seasonId: f.seasonId, monumentId: m.id, playerId: f.playerIds[2]!, originPlanetId: f.planetIds[2]!,
      unitLocation: `monument:${holder}`, purpose: 'REINFORCE', sentFleet: { DART: 1 }, tech: {}, route: [], fuelPaid: 0,
      sentAt: f.clock.now(), heldAt: f.clock.now(), radiationSettledAt: f.clock.now(), status: 'HOLD' });
    await f.db.insert(monumentShipLots).values({ waveId: holder, hull: 'DART', count: 1, damageBp: 0, remainderBp: 0, deuterium: 0 });
    await giveUnits(f.db, f.planetIds[2]!, { DART: 1 }, `monument:${holder}`);
    for (const id of f.playerIds.slice(0, 2)) await giveNewcomerShield(f.db, id, new Date(f.clock.now().getTime() + 3_600_000));
    await mark();
    await stage();
    expect((await f.db.select().from(players).where(eq(players.id, f.playerIds[0]!)))[0]?.newcomerShieldUntil).not.toBeNull();
    expect(await f.db.select().from(notifications).where(eq(notifications.kind, 'monument_inbound'))).toEqual([]);
    await start();
    for (const id of f.playerIds.slice(0, 2)) expect((await f.db.select().from(players).where(eq(players.id, id)))[0]?.newcomerShieldUntil).toBeNull();
    const warnings = await f.db.select().from(notifications).where(eq(notifications.kind, 'monument_inbound'));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.playerId).toBe(f.playerIds[2]);
    expect(JSON.stringify(warnings[0]?.payload)).not.toContain('CITADEL');
  });

  it('fights at full size before native capacity overflow and still releases the operation', async () => {
    await f.db.update(monuments).set({ capacity: hangarLoad({ CITADEL: 2 }) }).where(eq(monuments.id, m.id));
    await mark();
    await stage();
    const launched = await start();
    await arrive(launched.arriveAt);
    const [battle] = await f.db.select().from(monumentBattles);
    expect(battle?.attackerFleet).toEqual({ CITADEL: 4, ARGOSY: 2 });
    const native = await f.db.select().from(monumentWaves);
    expect(native.some((wave) => wave.status === 'RETURNING')).toBe(true);
    expect(await openOperation(f.db, clanId)).toBeNull();
  });

  it('cannot use the leader’s consent for a member when a neutral target becomes PvP', async () => {
    await mark();
    await send(0);
    await f.db.transaction(async (tx) => sendClanWarContribution(tx, { actor: await actor(1), originPlanetId: f.planetIds[1]!,
      fleet, acknowledgeShieldLoss: false, clock: f.clock }));
    const [leg] = await f.db.select().from(missions).where(eq(missions.status, 'in_flight'));
    f.clock.set(new Date(leg!.arriveAt.getTime() + 1000));
    await new EventWorker(f.db, f.clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, silent).tick();
    const holder = randomUUID();
    await f.db.update(monuments).set({ controllerPlayerId: f.playerIds[2]!, settledAt: f.clock.now() }).where(eq(monuments.id, m.id));
    await f.db.insert(monumentWaves).values({ id: holder, seasonId: f.seasonId, monumentId: m.id, playerId: f.playerIds[2]!, originPlanetId: f.planetIds[2]!,
      unitLocation: `monument:${holder}`, purpose: 'REINFORCE', sentFleet: { DART: 1 }, tech: {}, route: [], fuelPaid: 0,
      sentAt: f.clock.now(), heldAt: f.clock.now(), radiationSettledAt: f.clock.now(), status: 'HOLD' });
    await f.db.insert(monumentShipLots).values({ waveId: holder, hull: 'DART', count: 1, damageBp: 0, remainderBp: 0, deuterium: 0 });
    await giveUnits(f.db, f.planetIds[2]!, { DART: 1 }, `monument:${holder}`);
    for (const id of f.playerIds.slice(0, 2)) await giveNewcomerShield(f.db, id, new Date(f.clock.now().getTime() + 3_600_000));
    const before = await f.db.select().from(units);
    await expect(start()).rejects.toMatchObject({ code: 'SHIELD_WOULD_DROP' });
    expect(await f.db.select().from(units)).toEqual(before);
    expect((await f.db.select().from(monumentWaves))).toHaveLength(1);
    expect((await f.db.select().from(players).where(eq(players.id, f.playerIds[0]!)))[0]?.newcomerShieldUntil).not.toBeNull();
    expect((await openOperation(f.db, clanId))?.status).toBe('ASSEMBLING');
    expect(await f.db.select().from(notifications).where(eq(notifications.kind, 'monument_inbound'))).toEqual([]);
  });

  it('releases the operation when radiation kills the whole formation before arrival', async () => {
    await mark();
    await stage();
    const launched = await start();
    await f.db.insert(hpRadiationSources).values({ seasonId: f.seasonId, anchorKind: 'MONUMENT', anchorId: m.id,
      x: 5000, y: 0, z: 0, radius: 5000, intensityHpPerMinute: 1_000_000, mode: 'EMIT', activeFrom: f.clock.now() });
    // Advance partially: the native loss handler must finish the pool without waiting for its ETA.
    const native = await f.db.select().from(monumentWaves);
    const { resolveMonumentFlightLoss } = await import('../src/services/monumentMovement.js');
    f.clock.advance(1);
    for (const wave of native) await f.db.transaction((tx) => resolveMonumentFlightLoss(tx, { waveId: wave.id, generation: wave.generation, at: f.clock.now() }));
    expect(f.clock.now().getTime()).toBeLessThan(new Date(launched.arriveAt).getTime());
    expect((await f.db.select().from(monumentWaves)).every((wave) => wave.status === 'LOST')).toBe(true);
    expect(await openOperation(f.db, clanId)).toBeNull();
    expect(await f.db.select().from(monumentBattles)).toEqual([]);
    for (const id of f.planetIds.slice(0, 2)) expect(await baysInUse(f.db, id)).toBe(0);
  });

  it('releases an outbound formation when the season cutoff lands it directly at home', async () => {
    await mark();
    await stage();
    await start();
    f.clock.advance(1);
    await f.db.transaction((tx) => closeSeasonMonuments(tx, { seasonId: f.seasonId, cutoff: f.clock.now(), adminUsernames: [] }));
    expect((await f.db.select().from(monumentWaves)).every((wave) => wave.status === 'HOME')).toBe(true);
    expect(await openOperation(f.db, clanId)).toBeNull();
  });

  it('wipes the monument target FK after the joint operation history', async () => {
    await mark();
    await stage();
    const launched = await start();
    await arrive(launched.arriveAt);
    await f.db.update(seasons).set({ status: 'frozen' }).where(eq(seasons.id, f.seasonId));
    await wipeAllServers(f.db, f.clock, { count: 1, capacity: 3, seedBase: 20_261_005 });
    expect(await f.db.select().from(clanWarOperations)).toEqual([]);
    expect(await f.db.select().from(monuments).where(eq(monuments.seasonId, f.seasonId))).toEqual([]);
    expect(await f.db.select().from(monuments)).toHaveLength(MONUMENT_SEASON_DEFAULTS.count);
  });
});
