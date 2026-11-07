import { eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { vesselBotState, vessels } from '../src/db/schema.js';
import { addBot } from '../src/services/bots/roster.js';
import { sweepQuietShips } from '../src/services/starter/quiet.js';
import { crewGalaxies } from '../src/services/starter/shipBots.js';
import { testDb } from './helpers.js';
import { TOKENS, starterWorld } from './starterFixture.js';
import { aboard, enrich, get, pass, placeShip, post } from './starterShips.js';

afterAll(async () => { await (await testDb()).close(); });
const log = pino({ level: 'silent' });

interface Map { planets: { id: string; isSelf: boolean }[] }
interface Intel { probeReports: { targetName: string; [key: string]: unknown }[] }
const keys = (value: object | undefined): string[] => Object.keys(value ?? {}).sort();

describe('a neighbour the server plays, from a person\'s side', () => {
  let world: Awaited<ReturnType<typeof starterWorld>>;
  beforeEach(async () => { world = await starterWorld(); });
  afterEach(async () => { await world.built.close(); });

  const crewed = async () => {
    await addBot(world.f.db, 'Pilot Aa', world.f.clock);
    const me = await aboard(world, 'Me', { SURVEY: 3, TELESCOPE: 3, RADAR: 1, SHIPYARD: 1 });
    const person = await aboard(world, 'Person');
    await crewGalaxies(world.f.db, world.f.clock, log);
    const [state] = await world.f.db.select().from(vesselBotState);
    const [played] = await world.f.db.select().from(vessels).where(eq(vessels.id, state!.vesselId));
    return { me, person, played: played! };
  };

  it('opens crates through the same endpoint and returns the same crate view', async () => {
    const { person, played } = await crewed();
    const headers = { authorization: `Bearer ${await TOKENS.issueAccess(played.accountId)}` };
    for (const id of [person.vesselId, played.id]) {
      await world.f.db.update(vessels).set({ modules: { REFINERY: 2 }, cratesOpened: [] }).where(eq(vessels.id, id));
    }
    const human = await post(world, '/api/starter/crates/open', person.headers, {});
    const server = await post(world, '/api/starter/crates/open', headers, {});
    expect(human.statusCode).toBe(200);
    expect(server.statusCode).toBe(200);
    const a = human.json<{ vessel: { crates: unknown[] }; opened: string[] }>();
    const b = server.json<{ vessel: { crates: unknown[] }; opened: string[] }>();
    expect(b.vessel.crates).toEqual(a.vessel.crates);
    expect(b.opened).toEqual(a.opened);
    expect(keys(b.vessel)).toEqual(keys(a.vessel));
    expect(server.body).not.toMatch(/persona|"bot|isBot|nextAction|session_until/i);
  });

  it('has the same fields on the map as a person, seen or unseen', async () => {
    const { me, person, played } = await crewed();
    const near = { x: me.position.x + 30, y: me.position.y, z: me.position.z };
    await placeShip(world, person.vesselId, near);
    await placeShip(world, played.id, { ...near, x: near.x + 5 });
    const read = async () => (await get<Map>(world, '/api/starter/galaxy', me.headers)).planets;
    const seen = await read();
    expect(keys(seen.find(ship => ship.id === played.id))).toEqual(keys(seen.find(ship => ship.id === person.vesselId)));

    const far = { x: me.position.x + 5000, y: me.position.y, z: me.position.z };
    await placeShip(world, person.vesselId, far);
    await placeShip(world, played.id, { ...far, x: far.x + 5 });
    const unseen = await read();
    expect(keys(unseen.find(ship => ship.id === played.id))).toEqual(keys(unseen.find(ship => ship.id === person.vesselId)));
  });

  it('reads the same through a probe', async () => {
    const { me, person, played } = await crewed();
    await enrich(world, me.vesselId);
    await post(world, '/api/starter/probe', me.headers, { targetPlanetId: person.vesselId });
    await post(world, '/api/starter/probe', me.headers, { targetPlanetId: played.id });
    await pass(world, 60);
    const { probeReports } = await get<Intel>(world, '/api/starter/intel', me.headers);
    expect(probeReports.length).toBeGreaterThanOrEqual(2);
    const ofPerson = probeReports.find(report => report.targetName === 'Person');
    const ofPlayed = probeReports.find(report => report.targetName === played.name);
    expect(keys(ofPlayed)).toEqual(keys(ofPerson));
  });

  it('sends nothing that says what it is, in any payload a person reads', async () => {
    const { me } = await crewed();
    for (const url of ['/api/starter/galaxy', '/api/starter/intel', '/api/starter/traffic', '/api/starter/season', '/api/starter/mining', '/api/starter/vessel']) {
      expect(JSON.stringify(await get(world, url, me.headers))).not.toMatch(/persona|"bot|isBot|nextAction|session_until/i);
    }
  });

  it('keeps the rule a person keeps: quiet for two days, and it leaves the map', async () => {
    const { me, played } = await crewed();
    world.f.clock.advance(49 * 60);
    await world.f.db.update(vessels).set({ lastProgressAt: world.f.clock.now() }).where(eq(vessels.id, me.vesselId));
    await sweepQuietShips(world.f.db, world.f.clock);
    const [after] = await world.f.db.select().from(vessels).where(eq(vessels.id, played.id));
    expect(after!.status).toBe('DORMANT');
    const map = await get<Map>(world, '/api/starter/galaxy', me.headers);
    expect(map.planets.some(ship => ship.id === played.id)).toBe(false);
  });

  it('comes back with its own name when a galaxy needs a neighbour again', async () => {
    const { played } = await crewed();
    await world.f.db.update(vessels).set({ status: 'DORMANT', slotIndex: null }).where(eq(vessels.id, played.id));
    world.f.clock.advance(11);
    await crewGalaxies(world.f.db, world.f.clock, log);
    const [after] = await world.f.db.select().from(vessels).where(eq(vessels.id, played.id));
    expect(after!.status).toBe('ACTIVE');
    expect(after!.name).toBe(played.name);
    expect(after!.slotIndex).not.toBeNull();
  });
});
