import { STARTER, STARTER_CRATES, shipBotTarget, type VesselModules } from '@astera/rules';
import { and, eq, inArray } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { players, starterDepartures, starterGalaxies, starterSites, vesselBotState, vesselMissions, vesselProbeReports, vessels } from '../src/db/schema.js';
import { addBot } from '../src/services/bots/roster.js';
import { ensureBotSeats } from '../src/services/bots/sweep.js';
import { crewGalaxies, sweepShipBots, takeShipBotTurn } from '../src/services/starter/shipBots.js';
import { resolveMiningLanding } from '../src/services/starter/mining.js';
import { sweepStarterWorld } from '../src/services/starter/sites.js';
import { testDb } from './helpers.js';
import { starterWorld } from './starterFixture.js';
import { aboard, arm, enrich, pass } from './starterShips.js';

afterAll(async () => { await (await testDb()).close(); });
const log = pino({ level: process.env.SHIP_BOT_LOG ?? 'silent' });
const READY: VesselModules = { REFINERY: 5, EXTRACTOR: 3, VAULT: 1, SURVEY: 2, AEGIS: 1, TELESCOPE: 1, RADAR: 1, SHIPYARD: 1, HANGAR: 2, DEUTERIUM_PLANT: 2, DRIVE_HULL: 1, DRIVE_THRUST: 1 };
const FACTS = ['FIRST_MINING_RETURN', 'FIRST_BATTLE_REPORT', 'FIRST_PROBE_REPORT'] as const;
/** The crates already opened, so a test about another choice is not decided by a crate's purse. */
const OPENED = STARTER_CRATES.map(crate => crate.id);

describe('how many neighbours', () => {
  it('follows the plan: 8 + 4 per active, between 12 and 60', () => {
    expect(shipBotTarget(0)).toBe(0);
    expect(shipBotTarget(1)).toBe(STARTER.bots.min);
    expect(shipBotTarget(3)).toBe(20);
    expect(shipBotTarget(100)).toBe(STARTER.bots.max);
  });
});

describe('the ships the server plays', () => {
  let world: Awaited<ReturnType<typeof starterWorld>>;
  beforeEach(async () => { world = await starterWorld(); });
  afterEach(async () => { await world.built.close(); });

  const names = async (count: number) => { for (let i = 0; i < count; i++) await addBot(world.f.db, `Pilot ${String.fromCharCode(65 + i)}${String.fromCharCode(97 + i)}`, world.f.clock); };
  const crew = () => crewGalaxies(world.f.db, world.f.clock, log);
  const bots = () => world.f.db.select({ state: vesselBotState, ship: vessels }).from(vesselBotState).innerJoin(vessels, eq(vessels.id, vesselBotState.vesselId));
  const turn = async (accountId: string) => takeShipBotTurn(world.f.db, accountId, world.f.clock, log);

  it('leaves an empty galaxy empty: no one is there to live beside', async () => {
    await names(3);
    await crew();
    expect(await bots()).toHaveLength(0);
  });

  it('draws neighbours for a real ship, a few at a time, from the owner\'s names', async () => {
    await names(20);
    await aboard(world, 'Me');
    await crew();
    const first = await bots();
    expect(first.length).toBeGreaterThan(0);
    expect(first.length).toBeLessThan(STARTER.bots.min);
    world.f.clock.advance(11);
    await crew();
    expect((await bots()).length).toBeGreaterThan(first.length);
  });

  it('invents no name when the owner\'s list runs out', async () => {
    await names(2);
    await aboard(world, 'Me');
    for (let i = 0; i < 6; i++) { await crew(); world.f.clock.advance(11); }
    expect(await bots()).toHaveLength(2);
  });

  it('keeps room for people in a galaxy that fills', async () => {
    await names(30);
    for (let i = 0; i < 5; i++) await aboard(world, `Person${String(i)}`);
    for (let i = 0; i < 12; i++) { await crew(); world.f.clock.advance(11); }
    const [galaxy] = await world.f.db.select().from(starterGalaxies);
    const here = await world.f.db.select({ id: vessels.id }).from(vessels).where(eq(vessels.starterGalaxyId, galaxy!.id));
    expect(here.length).toBeLessThanOrEqual(galaxy!.capacity - 12);
  });

  it('starts new ships at different stages, so someone is always ahead', async () => {
    await names(12);
    await aboard(world, 'Me');
    for (let i = 0; i < 4; i++) { await crew(); world.f.clock.advance(11); }
    const stages = new Set((await bots()).map(({ ship }) => Object.values(ship.modules).reduce((sum, stage) => sum + stage, 0)));
    expect(stages.size).toBeGreaterThan(1);
  });

  it('repairs through the same doors a person uses', async () => {
    await names(1);
    await aboard(world, 'Me');
    await crew();
    const [bot] = await bots();
    await world.f.db.update(vessels).set({ modules: { REFINERY: 1 }, alloy: 5000, crystal: 5000 }).where(eq(vessels.id, bot!.ship.id));
    await turn(bot!.ship.accountId);
    const [after] = await world.f.db.select().from(vessels).where(eq(vessels.id, bot!.ship.id));
    expect(after!.alloy).toBeLessThan(5000);
  });

  /** Retention plan §6.2: a person's purse grows by the crates, so a server ship's must too. */
  it('opens its salvage crates as a person does', async () => {
    await names(1);
    await aboard(world, 'Me');
    await crew();
    const [bot] = await bots();
    await world.f.db.update(vessels).set({ modules: { REFINERY: 2 }, cratesOpened: [] }).where(eq(vessels.id, bot!.ship.id));
    await turn(bot!.ship.accountId);
    const [after] = await world.f.db.select().from(vessels).where(eq(vessels.id, bot!.ship.id));
    expect(after!.cratesOpened).toContain('REFINERY:2');
  });

  it('sends a probe at a new neighbour on its first day', async () => {
    await names(1);
    const me = await aboard(world, 'Me');
    await crew();
    const [bot] = await bots();
    await world.f.db.update(vessels).set({ modules: { REFINERY: 1, SURVEY: 1 }, facts: [...FACTS], cratesOpened: OPENED }).where(eq(vessels.id, bot!.ship.id));
    await enrich(world, bot!.ship.id, 80, 80);
    await turn(bot!.ship.accountId);
    const flights = await world.f.db.select().from(vesselMissions).where(and(eq(vesselMissions.ownerVesselId, bot!.ship.id), eq(vesselMissions.kind, 'PROBE')));
    expect(flights[0]?.targetVesselId).toBe(me.vesselId);
  });

  it('attacks the same person at most once a day, and never without a reading', async () => {
    await names(1);
    const me = await aboard(world, 'Me', { SURVEY: 1, AEGIS: 1, SHIPYARD: 1 });
    await crew();
    const [bot] = await bots();
    const open = new Date(world.f.clock.now().getTime() - 1000);
    await world.f.db.update(vessels).set({ pvpOpenAt: open, facts: [...FACTS], cratesOpened: OPENED, modules: { REFINERY: 2, SURVEY: 1, AEGIS: 1, SHIPYARD: 1, HANGAR: 1 }, alloy: 0, crystal: 0, deuterium: 500 }).where(eq(vessels.id, bot!.ship.id));
    await world.f.db.update(vessels).set({ pvpOpenAt: open, recoveryUntil: null }).where(eq(vessels.id, me.vesselId));
    await arm(world, bot!.ship.id, { DART: 6 });
    const attacks = () => world.f.db.select().from(vesselMissions).where(and(eq(vesselMissions.ownerVesselId, bot!.ship.id), eq(vesselMissions.kind, 'ATTACK')));
    await turn(bot!.ship.accountId);
    expect(await attacks()).toHaveLength(0);

    await world.f.db.insert(vesselProbeReports).values({
      observerVesselId: bot!.ship.id, targetVesselId: me.vesselId, missionId: crypto.randomUUID(), targetName: 'Me', at: world.f.clock.now(), accuracy: 1,
      snapshot: { fleetSize: { low: 0, high: 0 }, defence: { low: 0, high: 0 } }, detected: false, deliveredAt: world.f.clock.now(),
    });
    await takeShipBotTurn(world.f.db, bot!.ship.accountId, world.f.clock, log, { attackRoll: 0 });
    expect(await attacks()).toHaveLength(1);
    await arm(world, bot!.ship.id, { DART: 6 });
    await takeShipBotTurn(world.f.db, bot!.ship.accountId, world.f.clock, log, { attackRoll: 0 });
    expect(await attacks()).toHaveLength(1);
  });

  it('leaves a scarce part for a person hunting one', async () => {
    await names(1);
    const me = await aboard(world, 'Me', READY);
    await world.f.db.update(vessels).set({ facts: [...FACTS] }).where(eq(vessels.id, me.vesselId));
    await crew();
    const [bot] = await bots();
    await world.f.db.update(vessels).set({ modules: READY, facts: [...FACTS], parts: 0 }).where(eq(vessels.id, bot!.ship.id));
    await sweepStarterWorld(world.f.db, world.f.clock);
    await world.f.db.update(starterSites).set({ hasPart: false });
    const [wreck] = await world.f.db.select().from(starterSites).where(eq(starterSites.kind, 'WRECK'));
    await world.f.db.update(starterSites).set({ hasPart: true }).where(eq(starterSites.id, wreck!.id));
    const [mission] = await world.f.db.insert(vesselMissions).values({
      starterGalaxyId: wreck!.starterGalaxyId, ownerVesselId: bot!.ship.id, kind: 'MINE', targetSiteId: wreck!.id,
      fromX: 0, fromY: 0, fromZ: 0, toX: wreck!.x, toY: wreck!.y, toZ: wreck!.z, fleet: { PROSPECTOR: 1 }, damage: [], departAt: world.f.clock.now(), arriveAt: world.f.clock.now(),
    }).returning();
    await world.f.db.transaction(tx => resolveMiningLanding(tx, mission!, world.f.clock));
    const [after] = await world.f.db.select().from(vessels).where(eq(vessels.id, bot!.ship.id));
    expect(after!.parts).toBe(0);
    const [site] = await world.f.db.select().from(starterSites).where(eq(starterSites.id, wreck!.id));
    expect(site!.hasPart).toBe(true);
  });

  describe('the main galaxy\'s seats', () => {
    const inMain = async (accountId: string) => (await world.f.db.select().from(players).where(eq(players.accountId, accountId))).length > 0;

    it('go first to a name with no ship', async () => {
      await names(6);
      await aboard(world, 'Me');
      await crew();
      const shipped = new Set((await bots()).map(({ ship }) => ship.accountId));
      await ensureBotSeats(world.f.db, world.f.clock, log);
      const seated = await world.f.db.select({ accountId: players.accountId }).from(players);
      expect(seated.filter(({ accountId }) => shipped.has(accountId))).toEqual([]);
    });

    it('then to a ship ready to jump: it lands, and the board is telling the truth', async () => {
      await names(2);
      await aboard(world, 'Me');
      for (let i = 0; i < 2; i++) { await crew(); world.f.clock.advance(11); }
      const crewed = await bots();
      expect(crewed).toHaveLength(2);
      for (const { ship } of crewed) {
        await world.f.db.update(vessels).set({ modules: READY, facts: [...FACTS], parts: 3, fuel: STARTER.fuelForJump, alloy: 100, crystal: 100, deuterium: 10 }).where(eq(vessels.id, ship.id));
      }
      await ensureBotSeats(world.f.db, world.f.clock, log);
      const board = await world.f.db.select().from(starterDepartures);
      expect(board.length).toBeGreaterThan(0);
      for (const line of board) expect(await inMain(line.accountId)).toBe(true);
    });

    it('take a ship that is not ready only last, and that ship goes quiet', async () => {
      await names(1);
      await aboard(world, 'Me');
      await crew();
      const [bot] = await bots();
      await ensureBotSeats(world.f.db, world.f.clock, log);
      expect(await inMain(bot!.ship.accountId)).toBe(true);
      const [ship] = await world.f.db.select().from(vessels).where(eq(vessels.id, bot!.ship.id));
      expect(ship!.status).toBe('DORMANT');
      expect(await world.f.db.select().from(vesselBotState).where(eq(vesselBotState.vesselId, ship!.id))).toHaveLength(0);
    });

    it('never open a new ship for a name that has landed', async () => {
      await names(1);
      await aboard(world, 'Me');
      await ensureBotSeats(world.f.db, world.f.clock, log);
      await crew();
      expect(await bots()).toHaveLength(0);
    });

    it('do not exist on the galaxy kept for people', async () => {
      await world.f.db.update(vessels).set({ status: 'ACTIVE' });
      const seats = await ensureBotSeats(world.f.db, world.f.clock, log);
      expect(seats).toBe(0);
    });
  });

  it('plays three fast days: it repairs, and with no seat it goes quiet rather than jump', async () => {
    await names(6);
    const me = await aboard(world, 'Me');
    for (let i = 0; i < 3; i++) { await crew(); world.f.clock.advance(11); }
    const crewed = await bots();
    const before = crewed.map(({ ship }) => Object.values(ship.modules).reduce((sum, stage) => sum + stage, 0));
    for (let hour = 0; hour < 72; hour++) {
      await world.f.db.update(vessels).set({ lastSeenAt: world.f.clock.now(), lastProgressAt: world.f.clock.now() }).where(eq(vessels.id, me.vesselId));
      await sweepShipBots(world.f.db, world.f.clock, log);
      await pass(world, 60);
    }
    const after = await world.f.db.select().from(vessels).where(inArray(vessels.id, crewed.map(({ ship }) => ship.id)));
    const total = (ship: (typeof after)[number]) => Object.values(ship.modules).reduce((sum, stage) => sum + stage, 0);
    expect(after.map(total).reduce((sum, value) => sum + value, 0)).toBeGreaterThan(before.reduce((sum, value) => sum + value, 0));
    expect(after.every(ship => ship.status !== 'DEPARTED')).toBe(true);
  }, 120_000);
});
