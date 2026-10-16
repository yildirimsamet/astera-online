import { afterAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { clanSupportWaves, clanWarContributions, clans, monumentShipLots, monuments, missions } from '../src/db/schema.js';
import { formClan, supportWorld } from './clanSupportFixture.js';
import { giveUnits, testDb } from './helpers.js';
import { landHpShips } from '../src/services/shipDamage.js';
import { readHomeHealth } from '../src/services/homeHealth.js';
import { sendClanSupport, setDefencePosture } from '../src/services/clanSupport.js';
import { markClanWarTarget, sendClanWarContribution } from '../src/services/clanWar.js';
import { clanActor } from '../src/services/clan.js';
import { quoteMonument, sendMonument } from '../src/services/monument.js';
import { launchClanAid } from '../src/services/clanAid.js';
import { secedeColony } from '../src/services/loyalty.js';
import { planets } from '../src/db/schema.js';

afterAll(async () => { await (await testDb()).close(); });
const damage = [{ hull: 'DART' as const, count: 4, damageBp: 1000, remainderBp: 0.25 }];
async function fixture() {
  const f = await supportWorld(3, 131028, 18);
  const clanId = await formClan(f);
  await giveUnits(f.db, f.planetIds[0]!, { DART: 0 });
  await f.db.transaction((tx) => landHpShips(tx, { planetId: f.planetIds[0]!, ownerPlayerId: f.playerIds[0]!,
    fleet: { DART: 4 }, damage, at: f.clock.now() }));
  return { f, clanId };
}

describe('home injuries follow owned combat dispatches', () => {
  it('quotes distinct health groups of the same hull without assigning one wound to every ship', async () => {
    const { f } = await fixture();
    await f.db.transaction(tx => landHpShips(tx, { planetId: f.planetIds[0]!, ownerPlayerId: f.playerIds[0]!,
      fleet: { DART: 2 }, damage: [], at: f.clock.now() }));
    const [monument] = await f.db.insert(monuments).values({ seasonId: f.seasonId, ordinal: 1, x: 300, y: 0, z: 0,
      capacity: 1000, productionPerMinute: 60, settledAt: f.clock.now() }).returning();
    const result = await f.db.transaction(tx => quoteMonument(tx, { senderPlayerId: f.playerIds[0]!,
      originPlanetId: f.planetIds[0]!, monumentId: monument!.id, purpose: 'ATTACK', fleet: { DART: 4 },
      clock: f.clock }));
    expect(result.outboundForecast.health.map(row => [row.count, row.damageBp, row.remainderBp])).toEqual([
      [2, 1000, 0.25], [2, 0, 0],
    ]);
  });
  it('carries civilian aid escorts’ wounds without converting delivery into healing', async () => {
    const { f } = await fixture();
    await giveUnits(f.db, f.planetIds[0]!, { COURIER: 0 });
    const injury = [{ hull: 'COURIER' as const, count: 2, damageBp: 3000, remainderBp: 0.75 }];
    await f.db.transaction((tx) => landHpShips(tx, { planetId: f.planetIds[0]!, ownerPlayerId: f.playerIds[0]!,
      fleet: { COURIER: 2 }, damage: injury, at: f.clock.now() }));
    await f.db.transaction((tx) => launchClanAid(tx, { senderPlayerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!,
      recipientPlayerId: f.playerIds[1]!, targetPlanetId: f.planetIds[1]!, fleet: { COURIER: 2 },
      cargo: { alloy: 40, crystal: 0, deuterium: 0 }, clock: f.clock }));
    const [flight] = await f.db.select().from(missions);
    expect(flight?.damage).toEqual(injury);
  });

  it('moves home wounds to the capital when a colony secedes', async () => {
    const { f } = await fixture();
    const colony = f.planetIds[1]!;
    await f.db.update(planets).set({ controllerPlayerId: f.playerIds[0]!, kind: 'COLONY' }).where(eq(planets.id, colony));
    await giveUnits(f.db, colony, { DART: 0 });
    await f.db.transaction((tx) => landHpShips(tx, { planetId: colony, ownerPlayerId: f.playerIds[0]!,
      fleet: { DART: 2 }, damage: [{ hull: 'DART', count: 2, damageBp: 6000, remainderBp: 0.5 }], at: f.clock.now() }));
    await f.db.transaction((tx) => secedeColony(tx, colony, f.clock.now(), colony));
    const health = await readHomeHealth(f.db, f.planetIds[0]!);
    expect(health.damage).toContainEqual({ hull: 'DART', count: 2, damageBp: 6000, remainderBp: 0.5 });
    expect(health.damage).toContainEqual(damage[0]);
  });
  it('copies exact health to both a clan support wave and its outbound mission', async () => {
    const { f } = await fixture();
    await f.db.transaction((tx) => setDefencePosture(tx, { planetId: f.planetIds[1]!, playerId: f.playerIds[1]!,
      toggles: { escape: false, support: true }, clock: f.clock }));
    const result = await f.db.transaction((tx) => sendClanSupport(tx, { senderPlayerId: f.playerIds[0]!,
      originPlanetId: f.planetIds[0]!, hostPlanetId: f.planetIds[1]!, fleet: { DART: 2 }, clock: f.clock }));
    const [wave] = await f.db.select().from(clanSupportWaves).where(eq(clanSupportWaves.id, result.wave.id));
    const [mission] = await f.db.select().from(missions).where(eq(missions.id, wave!.outboundMissionId));
    expect(wave?.damage).toEqual([{ ...damage[0], count: 2 }]);
    expect(mission?.damage).toEqual(wave?.damage);
    expect((await readHomeHealth(f.db, f.planetIds[0]!)).damage[0]?.count).toBe(2);
  });

  it('keeps the health of staged clan-war contributions', async () => {
    const { f, clanId } = await fixture();
    await f.db.update(clans).set({ level: 5 }).where(eq(clans.id, clanId));
    await f.db.transaction(async (tx) => markClanWarTarget(tx, { actor: await clanActor(tx, f.accountIds[0]!),
      targetPlanetId: f.planetIds[2]!, clock: f.clock }));
    await f.db.transaction(async (tx) => sendClanWarContribution(tx, { actor: await clanActor(tx, f.accountIds[0]!),
      originPlanetId: f.planetIds[0]!, fleet: { DART: 2 }, acknowledgeShieldLoss: true, clock: f.clock }));
    const [wave] = await f.db.select().from(clanWarContributions);
    expect(wave?.damage).toEqual([{ ...damage[0], count: 2 }]);
    expect((await readHomeHealth(f.db, f.planetIds[0]!)).damage[0]?.count).toBe(2);
  });

  it('creates wounded physical monument lots rather than resetting their HP at launch', async () => {
    const { f } = await fixture();
    const [monument] = await f.db.insert(monuments).values({ seasonId: f.seasonId, ordinal: 1, x: 300, y: 0, z: 0,
      capacity: 1000, productionPerMinute: 60, settledAt: f.clock.now() }).returning();
    const result = await f.db.transaction((tx) => sendMonument(tx, { senderPlayerId: f.playerIds[0]!,
      originPlanetId: f.planetIds[0]!, monumentId: monument!.id, purpose: 'ATTACK', fleet: { DART: 2 },
      acknowledgeShieldLoss: true, clock: f.clock }));
    const lots = await f.db.select().from(monumentShipLots).where(eq(monumentShipLots.waveId, result.wave.id));
    expect(lots).toHaveLength(1);
    expect(lots[0]).toMatchObject({ hull: 'DART', count: 2, damageBp: 1000, remainderBp: 0.25 });
    expect((await readHomeHealth(f.db, f.planetIds[0]!)).damage[0]?.count).toBe(2);
  });
});
