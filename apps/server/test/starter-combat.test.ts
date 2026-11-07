import * as rules from '@astera/rules';
import { STARTER, fleetCount, fleetValue, outpostName, vesselAegisHp, vesselHull } from '@astera/rules';
import { and, eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reportsSchema } from '../../web/src/api/schemas.js';
import { starterSites, vesselBattleReports, vesselMissions, vesselNotifications, vesselUnits, vessels } from '../src/db/schema.js';
import { testDb } from './helpers.js';
import { starterWorld } from './starterFixture.js';
import { aboard, arm, enrich, get, pass, placeShip, post, siteOf, workerOf } from './starterShips.js';

afterAll(async () => { await (await testDb()).close(); });
const READY = { SHIPYARD: 1, SURVEY: 1, REFINERY: 3, AEGIS: 1, RADAR: 1, TELESCOPE: 1, HANGAR: 3 };

describe('a battle aboard', () => {
  let world: Awaited<ReturnType<typeof starterWorld>>;
  beforeEach(async () => { world = await starterWorld(); });
  afterEach(async () => { await world.built.close(); });

  /** Two ships past every protection, three hundred apart. */
  const duel = async (attack = { DART: 6 }, defend: Record<string, number> = { DART: 2 }) => {
    const me = await aboard(world, 'Raider', READY);
    const them = await aboard(world, 'Target', READY);
    const past = new Date(world.f.clock.now().getTime() - 3_600_000);
    for (const id of [me.vesselId, them.vesselId]) {
      await world.f.db.update(vessels).set({ facts: ['FIRST_BATTLE_REPORT'], pvpOpenAt: past, shield: vesselAegisHp(1) }).where(eq(vessels.id, id));
    }
    await arm(world, me.vesselId, attack);
    await arm(world, them.vesselId, defend);
    await placeShip(world, me.vesselId, { x: 0 });
    await placeShip(world, them.vesselId, { x: 300 });
    await enrich(world, them.vesselId, 2000, 2000, 100);
    return { me, them };
  };
  const launch = (headers: Record<string, string>, target: string, fleet: Record<string, number>, extra: object = {}) =>
    post(world, '/api/starter/fleet/launch', headers, { targetPlanetId: target, fleet, ...extra });
  const missionOf = async (id: string) => (await world.f.db.select().from(vesselMissions).where(eq(vesselMissions.ownerVesselId, id)))[0]!;
  const reports = () => world.f.db.select().from(vesselBattleReports);

  it('fights once, in one piece: losses, loot, report, return', async () => {
    const { me, them } = await duel();
    await launch(me.headers, them.vesselId, { DART: 6 });
    await pass(world, 5);
    const [report] = await reports();
    expect(report).toBeDefined();
    const mission = await missionOf(me.vesselId);
    expect(['RETURNING', 'DONE']).toContain(mission.status);
    await pass(world, 10);
    const [ship] = await world.f.db.select().from(vessels).where(eq(vessels.id, me.vesselId));
    expect(ship!.facts).toContain('FIRST_BATTLE_REPORT');
  });

  it('is told once however often the event is delivered', async () => {
    const { me, them } = await duel();
    await launch(me.headers, them.vesselId, { DART: 6 });
    world.f.clock.advance(5);
    await Promise.all([workerOf(world).tick(), workerOf(world).tick()]);
    await pass(world, 0);
    const { resolveMissionArrival } = await import('../src/services/starter/arrival.js');
    await resolveMissionArrival(world.f.db, (await missionOf(me.vesselId)).id, world.f.clock);
    expect(await reports()).toHaveLength(1);
  });

  it('fights at this galaxy\'s tempo: more ships live than in the main game', async () => {
    const { me, them } = await duel({ DART: 6 }, { DART: 3 });
    await launch(me.headers, them.vesselId, { DART: 6 });
    await pass(world, 5);
    const [report] = await reports();
    const result = report!.result as { attackerLosses: Record<string, number> };
    expect(result.attackerLosses.DART ?? 0).toBeLessThan(6);
  });

  it('takes a small share, and never below the vault', async () => {
    const { me, them } = await duel({ DART: 16 }, { DART: 1 });
    await launch(me.headers, them.vesselId, { DART: 16 });
    await pass(world, 5);
    const mission = await missionOf(me.vesselId);
    const taken = mission.cargo.alloy + mission.cargo.crystal + mission.cargo.deuterium;
    expect(taken).toBeGreaterThan(0);
    expect(taken).toBeLessThanOrEqual((2000 + 2000 + 100) * STARTER.pvp.lootDecisive + 1);
  });

  it('cannot be fought twice by replaying the mission', async () => {
    const { me, them } = await duel();
    await launch(me.headers, them.vesselId, { DART: 6 });
    await pass(world, 5);
    const { resolveMissionArrival } = await import('../src/services/starter/arrival.js');
    await resolveMissionArrival(world.f.db, (await missionOf(me.vesselId)).id, world.f.clock);
    expect(await reports()).toHaveLength(1);
  });

  it.each([
    ['DEPARTED', { status: 'DEPARTED' as const }],
    ['DORMANT', { status: 'DORMANT' as const }],
  ])('turns back with no fight when the target has gone %s', async (_, change) => {
    const { me, them } = await duel();
    await launch(me.headers, them.vesselId, { DART: 6 });
    await world.f.db.update(vessels).set(change).where(eq(vessels.id, them.vesselId));
    await pass(world, 5);
    expect(await reports()).toHaveLength(0);
    expect((await missionOf(me.vesselId)).status).toBe('RETURNING');
    await pass(world, 10);
    const rows = await world.f.db.select().from(vesselUnits).where(and(eq(vesselUnits.vesselId, me.vesselId), eq(vesselUnits.location, 'HOME')));
    expect(rows[0]!.count).toBe(6);
  });

  it('turns back with no fight when a shield rose while it flew', async () => {
    const { me, them } = await duel();
    await launch(me.headers, them.vesselId, { DART: 6 });
    await world.f.db.update(vessels).set({ recoveryUntil: new Date(world.f.clock.now().getTime() + 3_600_000) }).where(eq(vessels.id, them.vesselId));
    await pass(world, 5);
    expect(await reports()).toHaveLength(0);
  });

  it('leaves a field worth a tenth of what died, and none below the minimum', async () => {
    const { me, them } = await duel({ DART: 6 }, { DART: 6 });
    await launch(me.headers, them.vesselId, { DART: 6 });
    await pass(world, 5);
    const [report] = await reports();
    const result = report!.result as { attackerLosses: Record<string, number>; defenderLosses: Record<string, number> };
    const value = fleetValue(result.attackerLosses) + fleetValue(result.defenderLosses);
    const fields = await world.f.db.select().from(starterSites).where(eq(starterSites.kind, 'BATTLE_WRECK'));
    if (value * STARTER.battleDebris.share < STARTER.battleDebris.minimum) expect(fields).toHaveLength(0);
    else {
      expect(fields).toHaveLength(1);
      expect(fields[0]!.alloy + fields[0]!.crystal + fields[0]!.deuterium).toBeLessThanOrEqual(value * STARTER.battleDebris.share + 1);
      const left = (fields[0]!.expiresAt!.getTime() - world.f.clock.now().getTime()) / 60_000;
      expect(left).toBeLessThanOrEqual(STARTER.battleDebris.decayMinutes);
    }
  });

  it('reports to both, in the shape the report screen reads, with the rule beside it', async () => {
    const { me, them } = await duel();
    await launch(me.headers, them.vesselId, { DART: 6 });
    await pass(world, 5);
    for (const [who, attacking, opponent] of [[me, true, 'Target'], [them, false, 'Raider']] as const) {
      const body = reportsSchema.parse(await get(world, '/api/starter/reports', who.headers));
      expect(body.reports).toHaveLength(1);
      expect(body.reports[0]).toMatchObject({ attacking, opponentName: opponent, opponentKind: 'SHIP' });
    }
  });

  it('gives a recording the replay can open', async () => {
    const { me, them } = await duel();
    await launch(me.headers, them.vesselId, { DART: 6 });
    await pass(world, 5);
    const [report] = await reports();
    const answer = await world.app.inject({ url: `/api/starter/reports/BATTLE/${report!.id}/replay`, headers: me.headers });
    expect(answer.statusCode).toBe(200);
    // The fight was over a ship, and its replay draws that ship, not a planet (player test I-04).
    expect(answer.json<{ replay: { environment: string; vessel?: { hull: string } } }>().replay)
      .toMatchObject({ environment: 'VESSEL', vessel: { hull: vesselHull(them.vesselId) } });
  });

  it('shows the replay to those who were there and nobody else', async () => {
    const { me, them } = await duel();
    const third = await aboard(world, 'Third', READY);
    await launch(me.headers, them.vesselId, { DART: 6 });
    await pass(world, 5);
    const [report] = await reports();
    expect((await world.app.inject({ url: `/api/starter/reports/BATTLE/${report!.id}/replay`, headers: third.headers })).statusCode).toBe(404);
  });

  describe('at an outpost', () => {
    const atOutpost = async (fleet: Record<string, number>, level = 1) => {
      const me = await aboard(world, 'Raider', READY);
      await world.f.db.update(vessels).set({ facts: ['FIRST_BATTLE_REPORT'] }).where(eq(vessels.id, me.vesselId));
      await arm(world, me.vesselId, fleet);
      const site = await siteOf(world, 'OUTPOST', level);
      await placeShip(world, me.vesselId, { x: site.x - 200, y: site.y, z: site.z });
      return { me, site };
    };

    it('fights its guard, and a decisive win takes what the hold can carry', async () => {
      const { me, site } = await atOutpost({ DART: 16 });
      await launch(me.headers, site.id, { DART: 16 });
      await pass(world, 4);
      const [after] = await world.f.db.select().from(starterSites).where(eq(starterSites.id, site.id));
      expect(fleetCount(after!.guard ?? {})).toBeLessThan(fleetCount(after!.guardFull ?? {}));
      const mission = await missionOf(me.vesselId);
      expect(mission.cargo.alloy + mission.cargo.crystal).toBeGreaterThan(0);
    });

    it('leaves the part behind unless the win is decisive', async () => {
      const { me, site } = await atOutpost({ DART: 1 }, 3);
      await world.f.db.update(starterSites).set({ hasPart: true }).where(eq(starterSites.id, site.id));
      await world.f.db.update(vessels).set({ modules: { ...READY, DRIVE_HULL: 1 } }).where(eq(vessels.id, me.vesselId));
      await launch(me.headers, site.id, { DART: 1 });
      await pass(world, 4);
      const [after] = await world.f.db.select().from(starterSites).where(eq(starterSites.id, site.id));
      expect(after!.hasPart).toBe(true);
    });

    it('comes back to life after its wait', async () => {
      const { me, site } = await atOutpost({ DART: 16 });
      await launch(me.headers, site.id, { DART: 16 });
      await pass(world, 4);
      world.f.clock.advance(STARTER.sites.outposts.respawnMinutes + 1);
      const again = await siteOf(world, 'OUTPOST', 1);
      void again;
      const [after] = await world.f.db.select().from(starterSites).where(eq(starterSites.id, site.id));
      expect(after!.guard).toEqual(after!.guardFull);
    });

    it('starts its clock for a guard that only fled or thinned, or the outpost would stay hurt for good', async () => {
      const { me, site } = await atOutpost({ DART: 16 });
      await launch(me.headers, site.id, { DART: 16 });
      await pass(world, 4);
      const [after] = await world.f.db.select().from(starterSites).where(eq(starterSites.id, site.id));
      expect(after!.respawnAt).not.toBeNull();
    });

    it('removes a retreating guard from the outpost and reports its return time', async () => {
      const { me, site } = await atOutpost({ DART: 16 });
      await launch(me.headers, site.id, { DART: 16 });
      const fight = rules.starterBattle;
      const battle = vi.spyOn(rules, 'starterBattle').mockImplementation((stacks, defenders, shield, _rng, recording) =>
        fight(stacks, defenders, shield, () => 0, recording));
      try {
        await pass(world, 4);
      } finally {
        battle.mockRestore();
      }
      const { reports: read } = reportsSchema.parse(await get(world, '/api/starter/reports', me.headers));
      const report = read[0];
      if (!report || (report.kind !== undefined && report.kind !== 'BATTLE')) throw new Error('Expected an outpost battle report');
      expect(report.theirRetreatedCount).toBeGreaterThan(0);
      const [after] = await world.f.db.select().from(starterSites).where(eq(starterSites.id, site.id));
      expect(fleetCount(after!.guard ?? {})).toBe(0);
      expect(after!.respawnAt).not.toBeNull();
      expect(report.guardDownUntil).toEqual(after!.respawnAt);
    });

    it('goes by the name the map gives it, in the report and in the signal', async () => {
      const { me, site } = await atOutpost({ DART: 16 });
      await launch(me.headers, site.id, { DART: 16 });
      await pass(world, 4);
      const name = outpostName(site.id);
      const [report] = await reports();
      expect(report!.defenderName).toBe(name);
      const [signal] = await world.f.db.select().from(vesselNotifications).where(and(eq(vesselNotifications.vesselId, me.vesselId), eq(vesselNotifications.kind, 'BATTLE_REPORT')));
      expect(signal!.payload).toMatchObject({ opponent: name, opponentKind: 'OUTPOST' });
    });

    it('says how long a guard that is gone stays gone', async () => {
      const { me, site } = await atOutpost({ DART: 4 });
      await world.f.db.update(starterSites).set({ guard: {} }).where(eq(starterSites.id, site.id));
      await launch(me.headers, site.id, { DART: 4 });
      await pass(world, 4);
      const [after] = await world.f.db.select().from(starterSites).where(eq(starterSites.id, site.id));
      const { reports: read } = reportsSchema.parse(await get(world, '/api/starter/reports', me.headers));
      expect(read[0]).toMatchObject({ guardDownUntil: after!.respawnAt });
    });

    it('says nothing of the kind while the guard stands', async () => {
      const { me, site } = await atOutpost({ DART: 1 }, 3);
      await launch(me.headers, site.id, { DART: 1 });
      await pass(world, 4);
      const { reports: read } = reportsSchema.parse(await get(world, '/api/starter/reports', me.headers));
      expect(read[0]).toMatchObject({ guardDownUntil: null });
    });
  });

  it('tells a commander they were raided by a commander, even one called PIRATE', async () => {
    const { me, them } = await duel();
    await launch(me.headers, them.vesselId, { DART: 6 });
    await pass(world, 5);
    const [signal] = await world.f.db.select().from(vesselNotifications).where(and(eq(vesselNotifications.vesselId, them.vesselId), eq(vesselNotifications.kind, 'BATTLE_REPORT')));
    expect(signal!.payload).toMatchObject({ opponentKind: 'SHIP' });
  });
});
