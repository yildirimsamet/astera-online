import { eq, sql as query } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { pino } from 'pino';
import { afterAll, afterEach, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import * as schema from '../src/db/schema.js';
import { planetView } from '../src/services/planetView.js';
import * as viewModule from '../src/services/planetView.js';
import { collectWorks } from '../src/services/build.js';
import { landShips } from '../src/services/shipDamage.js';
import { maintenanceAction } from '../src/services/maintenance.js';
import { seedWorld, testDb, testEnv, TEST_DATABASE_URL } from './helpers.js';

const queries: string[] = [];
const wireQueries: string[] = [];
const sql = postgres(TEST_DATABASE_URL, { max: 4, onnotice: () => undefined,
  debug: (_connection, query) => { wireQueries.push(query); },
});
const db = drizzle(sql, { schema, logger: { logQuery: query => { queries.push(query); } } });
let built: ReturnType<typeof buildApp> | undefined;
afterEach(async () => { vi.restoreAllMocks(); await built?.close(); built = undefined; });
afterAll(async () => { await sql.end(); await (await testDb()).close(); });

it('reads commander research and clan membership once for a multi-world response', async () => {
  const f = await seedWorld(3);
  await f.db.update(schema.seasons).set({ rulesetVersion: 15 }).where(eq(schema.seasons.id, f.seasonId));
  await f.db.update(schema.planets).set({ kind: 'COLONY', controllerPlayerId: f.playerIds[0]! })
    .where(eq(schema.planets.id, f.planetIds[1]!));
  built = buildApp({ db, env: testEnv(), clock: f.clock, logger: pino({ level: 'silent' }) });
  const authorization = `Bearer ${await built.app.tokens.issueAccess(f.accountIds[0]!)}`;
  // Compare the complete list against independently prepared single-world views.
  const expected = [];
  for (const id of f.planetIds.slice(0, 2)) expected.push(await db.transaction(tx => planetView(tx, id, f.clock)));
  queries.length = 0;
  const response = await built.app.inject({ url: '/api/planets', headers: { authorization } });
  expect(response.statusCode).toBe(200);
  const expectedJson: unknown = JSON.parse(JSON.stringify(expected));
  expect(response.json<unknown>()).toMatchObject({ planets: expectedJson });
  const reads = (table: string) => queries.filter(q => q.startsWith('select ') && q.includes(`from "${table}"`));
  expect(reads('player_research')).toHaveLength(1);
  expect(reads('clan_memberships')).toHaveLength(1);
  expect(reads('strategic_assets')).toHaveLength(2);
  expect(reads('research_orders')).toHaveLength(1);
  expect((await built.app.inject({ url: `/api/planets/${f.planetIds[2]!}`, headers: { authorization } })).statusCode).toBe(403);
});

it('loads every further world concurrently once the commander snapshot is known', async () => {
  // Resource analysis follow-up 2026-10-14: worlds were loaded one after another,
  // ~8 dependent round trips each, inside one snapshot that does not need the order.
  const f = await seedWorld(3);
  await f.db.update(schema.seasons).set({ rulesetVersion: 15 }).where(eq(schema.seasons.id, f.seasonId));
  for (const id of [f.planetIds[1]!, f.planetIds[2]!]) {
    await f.db.update(schema.planets).set({ kind: 'COLONY', controllerPlayerId: f.playerIds[0]! })
      .where(eq(schema.planets.id, id));
  }
  built = buildApp({ db, env: testEnv(), clock: f.clock, logger: pino({ level: 'silent' }) });
  const authorization = `Bearer ${await built.app.tokens.issueAccess(f.accountIds[0]!)}`;
  const events: string[] = [];
  const load = viewModule.loadPlanetViewData;
  vi.spyOn(viewModule, 'loadPlanetViewData').mockImplementation(async (...args) => {
    events.push(`start:${args[1]}`);
    const data = await load(...args);
    events.push(`end:${args[1]}`);
    return data;
  });
  const response = await built.app.inject({ url: '/api/planets', headers: { authorization } });
  expect(response.statusCode).toBe(200);
  const colonies = [f.planetIds[1]!, f.planetIds[2]!];
  const firstColonyEnd = Math.min(...colonies.map(id => events.indexOf(`end:${id}`)));
  for (const id of colonies) expect(events.indexOf(`start:${id}`)).toBeLessThan(firstColonyEnd);
  expect(events.slice(0, 2)).toEqual([`start:${f.planetIds[0]!}`, `end:${f.planetIds[0]!}`]);
});

it('reads each world unit inventory once when preparing a private view', async () => {
  const f = await seedWorld(1);
  queries.length = 0;
  await db.transaction(tx => planetView(tx, f.planetIds[0]!, f.clock));
  expect(queries.filter(q => q.startsWith('select ') && q.includes('from "units"'))).toHaveLength(1);
});

it.each(['/api/planet', '/api/planets', '/api/planets/:id'])('renders %s only after its gameplay transaction commits', async url => {
  const f = await seedWorld(1);
  built = buildApp({ db, env: testEnv(), clock: f.clock, logger: pino({ level: 'silent' }) });
  const authorization = `Bearer ${await built.app.tokens.issueAccess(f.accountIds[0]!)}`;
  const precedingStatements: (string | undefined)[] = [];
  const render = viewModule.buildPlanetView;
  vi.spyOn(viewModule, 'buildPlanetView').mockImplementation(data => {
    precedingStatements.push(wireQueries.at(-1));
    return render(data);
  });
  const response = await built.app.inject({ url: url.replace(':id', f.planetIds[0]!), headers: { authorization } });
  expect(response.statusCode).toBe(200);
  expect(precedingStatements).toEqual(['commit']);
});

it('renders the committed collect result after releasing its transaction', async () => {
  const f = await seedWorld(1);
  const render = viewModule.buildPlanetResult;
  const precedingStatements: (string | undefined)[] = [];
  vi.spyOn(viewModule, 'buildPlanetResult').mockImplementation(result => {
    precedingStatements.push(wireQueries.at(-1));
    return render(result);
  });
  const result = await collectWorks(db, f.planetIds[0]!, f.clock, f.playerIds[0]);
  expect(result.planet.planet.alloy).toBe(Math.floor(result.alloy));
  expect(precedingStatements).toEqual(['commit']);
});

it('renders manual maintenance only after releasing its transaction', async () => {
  const f = await seedWorld(1);
  const planetId = f.planetIds[0]!;
  await db.transaction(tx => landShips(tx, { planetId, ownerPlayerId: f.playerIds[0]!,
    fleet: { BALLISTA: 2 }, damage: [{ hull: 'BALLISTA', count: 2, damageBp: 6500 }], at: f.clock.now() }));
  const render = viewModule.buildPlanetView;
  const precedingStatements: (string | undefined)[] = [];
  vi.spyOn(viewModule, 'buildPlanetView').mockImplementation(data => {
    precedingStatements.push(wireQueries.at(-1));
    return render(data);
  });
  await maintenanceAction(db, f.playerIds[0]!, planetId, 'DOCK', { source: 'HOME',
    groups: [{ hull: 'BALLISTA', count: 1, damageBp: 6500 }] }, randomUUID(), f.clock);
  expect(precedingStatements).toEqual(['commit']);
});

it('keeps home, away and docked inventory separate in the captured response', async () => {
  const f = await seedWorld(1);
  const planetId = f.planetIds[0]!;
  const ownerPlayerId = f.playerIds[0]!;
  await f.db.insert(schema.units).values({ planetId, ownerPlayerId, hull: 'DART', location: 'cost-test-flight', count: 3 });
  await f.db.transaction(tx => landShips(tx, { planetId, ownerPlayerId,
    fleet: { BALLISTA: 2 }, damage: [{ hull: 'BALLISTA', count: 2, damageBp: 6500 }], at: f.clock.now() }));
  await maintenanceAction(db, ownerPlayerId, planetId, 'DOCK', { source: 'HOME',
    groups: [{ hull: 'BALLISTA', count: 2, damageBp: 6500 }] }, randomUUID(), f.clock);
  queries.length = 0;
  const view = await db.transaction(tx => planetView(tx, planetId, f.clock));
  expect(view.fleetAway.DART).toBe(3);
  expect(view.fleetAway.BALLISTA).toBeUndefined();
  expect(view.fleet.BALLISTA).toBeUndefined();
  expect(view.fleetDocked.BALLISTA).toBe(2);
  expect(view.dock).toBeDefined();
  expect(queries.filter(q => q.startsWith('select ') && q.includes('from "units"'))).toHaveLength(1);
});

it('releases the world lock before rendering and retains the captured state', async () => {
  const f = await seedWorld(1);
  const captured = await db.transaction(tx => viewModule.loadPlanetViewData(tx, f.planetIds[0]!, f.clock));
  await f.db.transaction(async tx => {
    await tx.execute(query`set local lock_timeout = '250ms'`);
    await tx.update(schema.planets).set({ name: 'Later name' }).where(eq(schema.planets.id, f.planetIds[0]!));
  });
  queries.length = 0;
  const view = viewModule.buildPlanetView(captured);
  expect(view.planet.name).toBe(captured.p.name);
  expect(view.planet.name).not.toBe('Later name');
  expect(queries).toHaveLength(0);
});

// Owned-world GETs no longer lock the season or a world at all; the stronger
// rule (they never wait for a lifecycle writer) is in planet-read-locks.test.ts.
