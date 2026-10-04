import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { MOBILE_HULLS, type Fleet } from '@astera/rules';
import { clanMemberships, clans, monumentBattles, monumentBattleParticipants, monuments, monumentShipLots, monumentWaves, notifications, planets, seasons, units } from '../src/db/schema.js';
import { resolveMonumentArrival } from '../src/services/monumentArrival.js';
import { readBattleReports } from '../src/services/reports.js';
import { recallMonument, resolveMonumentReturn } from '../src/services/monumentMovement.js';
import { seedWorld, testDb, type Fixture } from './helpers.js';

let f: Fixture;
let target: typeof monuments.$inferSelect;
let start: Date;
const eta = () => new Date(start.getTime() + 60_000);

async function addWave(owner: number, fleet: Fleet, hold = false) {
  const id = randomUUID();
  const [home] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[owner]!));
  const [wave] = await f.db.insert(monumentWaves).values({ id, seasonId: f.seasonId, monumentId: target.id,
    playerId: f.playerIds[owner]!, originPlanetId: home!.id, unitLocation: `monument:${id}`, purpose: 'ATTACK',
    sentFleet: fleet, tech: {}, sentAt: start, radiationSettledAt: start, fuelPaid: 0,
    status: hold ? 'HOLD' : 'OUTBOUND', arriveAt: hold ? null : eta(), heldAt: hold ? start : null,
    route: [{ from: { x: home!.x, y: home!.y, z: home!.z }, to: { x: target.x, y: target.y, z: target.z },
      startMs: start.getTime(), endMs: eta().getTime() }] }).returning();
  for (const hull of MOBILE_HULLS) {
    const count = fleet[hull] ?? 0;
    if (count === 0) continue;
    await f.db.insert(monumentShipLots).values({ waveId: id, hull, count, damageBp: 0, remainderBp: 0, deuterium: 0 });
    await f.db.insert(units).values({ planetId: home!.id, ownerPlayerId: f.playerIds[owner]!, location: `monument:${id}`, hull, count });
  }
  return wave!;
}

const resolve = (wave: typeof monumentWaves.$inferSelect) => f.db.transaction(tx => resolveMonumentArrival(tx,
  { waveId: wave.id, generation: wave.generation, at: eta(), adminUsernames: [] }));

beforeEach(async () => {
  f = await seedWorld(3, 20261004);
  start = f.clock.now();
  await f.db.update(seasons).set({ rulesetVersion: 16 }).where(eq(seasons.id, f.seasonId));
  target = (await f.db.insert(monuments).values({ seasonId: f.seasonId, ordinal: 3, x: 6000, y: 410, z: -500,
    capacity: 7270, productionPerMinute: 60, garrison: { DART: 1 }, garrisonTemplate: { DART: 1 }, settledAt: start }).returning())[0]!;
});
afterAll(async () => { await (await testDb()).close(); });

describe('monument participant reports and result delivery', () => {
  it('announces a physical return only after landing, with actual cargo and target identity, once', async () => {
    const wave = await addWave(0, { CATACLYSM: 20, COURIER: 2 });
    await resolve(wave);
    f.clock.set(new Date(eta().getTime() + 60_000));
    const lots = await f.db.select().from(monumentShipLots).where(eq(monumentShipLots.waveId, wave.id));
    const result = await f.db.transaction(tx => recallMonument(tx, { playerId: f.playerIds[0]!, waveId: wave.id,
      selections: lots.map(lot => ({ lotId: lot.id, count: lot.count })), clock: f.clock }));
    expect(await f.db.select().from(notifications).where(eq(notifications.kind, 'fleet_returned'))).toHaveLength(0);
    const land = () => f.db.transaction(tx => resolveMonumentReturn(tx, { waveId: wave.id, generation: result.wave.generation, at: result.wave.arriveAt! }));
    const landed = await land();
    await land();
    const notices = await f.db.select().from(notifications).where(eq(notifications.kind, 'fleet_returned'));
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({ playerId: f.playerIds[0], createdAt: result.wave.arriveAt,
      payload: { trip: 'monument', targetKind: 'MONUMENT', monumentId: target.id, monumentOrdinal: 3,
        craft: 22, deuterium: landed!.deliveredDeuterium } });
  });
  it('shows a native NPC report when there is no planet battle, retaining target identity after cleanup', async () => {
    const wave = await addWave(0, { CATACLYSM: 20 });
    await resolve(wave);
    const [battle] = await f.db.select().from(monumentBattles);
    await f.db.delete(monuments).where(eq(monuments.id, target.id));
    const view = await readBattleReports(f.db, f.playerIds[0]!);
    expect(view.reports).toHaveLength(1);
    expect(view.reports[0]).toMatchObject({ kind: 'MONUMENT', id: battle!.id, at: eta(), attacking: true,
      monument: { id: target.id, ordinal: 3, position: { x: 6000, y: 410, z: -500 } }, dominion: 0,
      yourFleet: { CATACLYSM: 20 }, theirLosses: { DART: 1 } });
    expect(view.reports[0]).not.toHaveProperty('missionId');
    expect(view.reports[0]).not.toHaveProperty('opponentPlanetId');
    expect((await readBattleReports(f.db, f.playerIds[2]!)).reports).toEqual([]);
  });

  it('serves only each participant’s own roster, wounds, loot and points and sends one result per owner', async () => {
    await f.db.update(monuments).set({ garrison: {}, controllerPlayerId: f.playerIds[1]! }).where(eq(monuments.id, target.id));
    await addWave(1, { DART: 30, COURIER: 2 }, true);
    const wave = await addWave(0, { CATACLYSM: 20, COURIER: 2 });
    await resolve(wave);
    await resolve(wave);
    const [battle] = await f.db.select().from(monumentBattles);
    const participants = await f.db.select().from(monumentBattleParticipants);
    for (const owner of [0, 1]) {
      const own = participants.find(row => row.playerId === f.playerIds[owner])!;
      const [report] = (await readBattleReports(f.db, f.playerIds[owner]!)).reports;
      expect(report?.kind).toBe('MONUMENT');
      if (report?.kind !== 'MONUMENT') throw new Error('expected a monument report');
      expect(report).toMatchObject({ kind: 'MONUMENT', id: battle!.id, attacking: owner === 0,
        yourFleet: own.fleet, yourLosses: own.losses, yourSurvivors: own.survivors,
        yourDamage: own.damage, lootDeuterium: own.lootDeuterium, dominion: own.dominionDelta });
      expect(report).not.toHaveProperty('theirFleet');
      expect(report).not.toHaveProperty('theirSurvivors');
      expect(report).not.toHaveProperty('theirDamage');
      expect(report.opponents).toEqual(owner === 0
        ? [{ kind: 'PLAYER', playerId: f.playerIds[1], name: 'Tester1', clanName: null, clanTag: null }]
        : [{ kind: 'PLAYER', playerId: f.playerIds[0], name: 'Tester0', clanName: null, clanTag: null }]);
      const notices = await f.db.select().from(notifications).where(and(eq(notifications.playerId, f.playerIds[owner]!), eq(notifications.refId, battle!.id)));
      expect(notices).toHaveLength(1);
      expect(notices[0]).toMatchObject({ kind: 'raid_result', payload: { targetKind: 'MONUMENT', monumentId: target.id, monumentOrdinal: 3,
        attacking: owner === 0, dominion: own.dominionDelta } });
      expect(notices[0]!.payload).not.toHaveProperty('theirFleet');
      expect(notices[0]!.payload).toMatchObject({ opponents: owner === 0
        ? [{ kind: 'PLAYER', name: 'Tester1', clanName: null, clanTag: null }]
        : [{ kind: 'PLAYER', name: 'Tester0', clanName: null, clanTag: null }] });
    }
    expect((await readBattleReports(f.db, f.playerIds[2]!)).reports).toEqual([]);
  });

  it('freezes opponent commander and clan identity into the report and result notice', async () => {
    const [clan] = await f.db.insert(clans).values({ seasonId: f.seasonId, name: 'Report Guard', nameKey: 'report guard', tag: 'RPG', level: 1, createdAt: start }).returning();
    for (const [slot, owner] of [0, 1].entries()) await f.db.insert(clanMemberships).values({ seasonId: f.seasonId, clanId: clan!.id,
      playerId: f.playerIds[owner]!, slot, role: slot === 0 ? 'LEADER' : 'MEMBER', joinedAt: start, matureAt: start, aidPolicyChangedAt: start });
    await f.db.update(monuments).set({ garrison: {}, controllerPlayerId: f.playerIds[1]! }).where(eq(monuments.id, target.id));
    await addWave(1, { DART: 2 }, true);
    const attacker = await addWave(0, { CATACLYSM: 20 });
    await resolve(attacker);
    const [report] = (await readBattleReports(f.db, f.playerIds[0]!)).reports;
    expect(report?.kind).toBe('MONUMENT');
    if (report?.kind !== 'MONUMENT') throw new Error('expected a monument report');
    expect(report.opponents).toEqual([{ kind: 'PLAYER', playerId: f.playerIds[1], name: 'Tester1', clanName: 'Report Guard', clanTag: 'RPG' }]);
    const notice = (await f.db.select().from(notifications).where(and(eq(notifications.playerId, f.playerIds[0]!), eq(notifications.kind, 'raid_result'))))[0];
    expect(notice?.payload).toMatchObject({ opponents: [{ kind: 'PLAYER', name: 'Tester1', clanName: 'Report Guard', clanTag: 'RPG' }] });
  });
});
