import { STARTER, distance, orbitPosition, orbitSeedOf, starterAsteroidOrbit } from "@astera/rules";
import { and, eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { starterGalaxies, starterSites, vesselBotState, vesselMissions, vessels } from "../src/db/schema.js";
import { firstRockId, insertRock } from "../src/services/starter/rocks.js";
import { sweepStarterWorld } from "../src/services/starter/sites.js";
import { SCOUT_STANDOFF } from "../src/services/starter/npcRaids.js";
import { testDb } from "./helpers.js";
import { starterWorld } from "./starterFixture.js";
import { aboard, enrich, get, pass, post, type StarterWorld } from "./starterShips.js";

afterAll(async () => { await (await testDb()).close(); });

interface Rock { id: string }
interface MiningView { asteroids: Rock[] }
interface Contact { kind: string; fleet?: Record<string, number>; inbound?: boolean; scout?: boolean }

/**
 * WHAT THE FIRST TELESCOPE SHOWS (owner playtest 2026-11-08). Only what lies inside its ring, a few
 * rocks at first so nobody is lost among them, and other fleets crossing it so the player learns what
 * it is for. A scout comes to look, from a distance, and leaves.
 */
describe("the first telescope", () => {
  let world: StarterWorld;
  beforeEach(async () => { world = await starterWorld(); });
  afterEach(async () => { await world.built.close(); });

  const opened = async () => {
    const person = await aboard(world, "Pilot", { REFINERY: 2, EXTRACTOR: 1 });
    await enrich(world, person.vesselId);
    expect((await post(world, "/api/starter/repair", person.headers, { module: "TELESCOPE", stage: 1 })).statusCode).toBe(200);
    world.f.clock.advance(1);
    await get(world, "/api/starter/vessel", person.headers);
    return person;
  };
  const shipOf = async (id: string) => (await world.f.db.select().from(vessels).where(eq(vessels.id, id)))[0]!;
  const rocks = (headers: Record<string, string>) => get<MiningView>(world, "/api/starter/mining", headers);
  const passing = (galaxy: string) => world.f.db.select().from(vesselMissions).where(and(eq(vesselMissions.starterGalaxyId, galaxy), eq(vesselMissions.kind, "PASSING")));
  /** More rocks close by, as a busy galaxy would have. */
  const crowd = async (vesselId: string, count: number) => {
    const ship = await shipOf(vesselId);
    const [galaxy] = await world.f.db.select().from(starterGalaxies).where(eq(starterGalaxies.id, ship.starterGalaxyId));
    const minutes = (world.f.clock.now().getTime() - galaxy!.epoch.getTime()) / 60_000;
    for (let i = 0; i < count; i++) {
      const id = firstRockId(ship, minutes, (function* () { for (;;) yield crypto.randomUUID(); })())!;
      await world.f.db.transaction(tx => insertRock(tx, galaxy!, id, world.f.clock.now()));
    }
    return { ship, minutes };
  };

  it("shows three rocks, all inside its ring", async () => {
    const person = await opened();
    const view = await rocks(person.headers);
    expect(view.asteroids).toHaveLength(STARTER.sites.rocksInSight[1]);
    const ship = await shipOf(person.vesselId);
    const [galaxy] = await world.f.db.select().from(starterGalaxies).where(eq(starterGalaxies.id, ship.starterGalaxyId));
    const minutes = (world.f.clock.now().getTime() - galaxy!.epoch.getTime()) / 60_000;
    const sites = await world.f.db.select().from(starterSites).where(eq(starterSites.kind, "ASTEROID"));
    expect(sites.length).toBeGreaterThanOrEqual(3);
    for (const site of sites) {
      const at = orbitPosition(starterAsteroidOrbit(orbitSeedOf(site.id)), minutes);
      expect(distance(at, ship)).toBeLessThanOrEqual(STARTER.telescope[1]);
    }
  });

  it("shows no more than its stage allows, however many are near, and never more than six", async () => {
    const person = await opened();
    await crowd(person.vesselId, 8);
    expect((await rocks(person.headers)).asteroids).toHaveLength(3);
    const ship = await shipOf(person.vesselId);
    await world.f.db.update(vessels).set({ modules: { ...ship.modules, TELESCOPE: 2 } }).where(eq(vessels.id, ship.id));
    expect((await rocks(person.headers)).asteroids).toHaveLength(4);
    await world.f.db.update(vessels).set({ modules: { ...ship.modules, TELESCOPE: 3 } }).where(eq(vessels.id, ship.id));
    expect((await rocks(person.headers)).asteroids).toHaveLength(6);
  });

  it("keeps showing the rock its own Prospector is flying to", async () => {
    const person = await opened();
    const { ship } = await crowd(person.vesselId, 8);
    const shown = new Set((await rocks(person.headers)).asteroids.map(rock => rock.id));
    const launched = await post(world, "/api/starter/mining/launch", person.headers, { asteroidId: [...shown][2], craft: 1 });
    expect(launched.statusCode).toBe(200);
    const [flight] = await world.f.db.select().from(vesselMissions).where(and(eq(vesselMissions.ownerVesselId, ship.id), eq(vesselMissions.kind, "MINE")));
    await crowd(person.vesselId, 8);
    const after = await rocks(person.headers);
    expect(after.asteroids.length).toBeGreaterThanOrEqual(3);
    expect(flight).toBeDefined();
    expect(after.asteroids.map(rock => rock.id)).toContain([...shown][2]);
  });

  it("sends two different fleets across the ring, once, that fight nobody and are gone", async () => {
    const person = await opened();
    const ship = await shipOf(person.vesselId);
    await get(world, "/api/starter/vessel", person.headers);
    const flights = await passing(ship.starterGalaxyId);
    expect(flights).toHaveLength(2);
    expect(flights[0]!.fleet).not.toEqual(flights[1]!.fleet);
    world.f.clock.advance(0.5);
    const { contacts } = await get<{ contacts: Contact[] }>(world, "/api/starter/traffic", person.headers);
    const seen = contacts.filter(contact => contact.kind === "fleet");
    expect(seen).toHaveLength(2);
    expect(seen.every(contact => contact.fleet !== undefined && contact.inbound === undefined)).toBe(true);
    await pass(world, 10);
    expect((await passing(ship.starterGalaxyId)).every(flight => flight.status === "DONE")).toBe(true);
  });

  it("sends none for a crewless ship", async () => {
    const person = await aboard(world, "Pilot", { REFINERY: 2, EXTRACTOR: 1 });
    await enrich(world, person.vesselId);
    const at = world.f.clock.now();
    await world.f.db.insert(vesselBotState).values({ vesselId: person.vesselId, persona: "MINER", nextActionAt: at, sessionUntilAt: at, createdAt: at });
    expect((await post(world, "/api/starter/repair", person.headers, { module: "TELESCOPE", stage: 1 })).statusCode).toBe(200);
    world.f.clock.advance(1);
    await get(world, "/api/starter/vessel", person.headers);
    expect(await passing((await shipOf(person.vesselId)).starterGalaxyId)).toHaveLength(0);
  });
});

describe("a scout at the ship", () => {
  let world: StarterWorld;
  beforeEach(async () => { world = await starterWorld(); });
  afterEach(async () => { await world.built.close(); });

  const scoutFor = async (modules: Record<string, number>) => {
    const person = await aboard(world, "Pilot", modules);
    const ship = (await world.f.db.select().from(vessels).where(eq(vessels.id, person.vesselId)))[0]!;
    const now = world.f.clock.now();
    await world.f.db.insert(vesselMissions).values({
      starterGalaxyId: ship.starterGalaxyId, ownerVesselId: ship.id, kind: "MINE", status: "DONE",
      fromX: ship.x, fromY: ship.y, fromZ: ship.z, toX: ship.x + 100, toY: ship.y, toZ: ship.z, departAt: now, arriveAt: now, orderedAt: now,
    });
    await world.f.db.update(vessels).set({ lastSeenAt: now }).where(eq(vessels.id, ship.id));
    await sweepStarterWorld(world.f.db, world.f.clock);
    const [scout] = await world.f.db.select().from(vesselMissions).where(and(eq(vesselMissions.targetVesselId, ship.id), eq(vesselMissions.kind, "SCOUT")));
    return { person, ship, scout: scout! };
  };

  it("stops short of the ship and turns away", async () => {
    const { ship, scout } = await scoutFor({ REFINERY: 2, EXTRACTOR: 1, TELESCOPE: 1, RADAR: 1 });
    expect(distance({ x: scout.toX, y: scout.toY, z: scout.toZ }, ship)).toBeCloseTo(SCOUT_STANDOFF, 3);
    expect(distance({ x: scout.fromX, y: scout.fromY, z: scout.fromZ }, ship)).toBeGreaterThan(STARTER.radar[1]);
  });

  it("is told apart as a scout, not as a pirate coming for the ship", async () => {
    const { person, scout } = await scoutFor({ REFINERY: 2, EXTRACTOR: 1, TELESCOPE: 1, RADAR: 1 });
    await world.f.db.update(vesselMissions).set({ fromX: person.position.x + 300, fromY: person.position.y, fromZ: person.position.z }).where(eq(vesselMissions.id, scout.id));
    const { contacts } = await get<{ contacts: Contact[] }>(world, "/api/starter/traffic", person.headers);
    const contact = contacts.find(one => one.scout === true);
    expect(contact).toMatchObject({ kind: "fleet", scout: true });
    expect(contact).not.toHaveProperty("inbound");
  });
});
