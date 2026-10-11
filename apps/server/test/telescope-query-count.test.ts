import { and, eq, ne } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import { afterAll, afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createDb, schema } from '../src/db/client.js';
import { watches } from '../src/db/schema.js';
import { readTelescopes } from '../src/services/intel.js';
import {
  giveInstrument, giveSatellite, giveUnits, seedWorld, setLevel, testDb,
  TEST_DATABASE_URL, type Fixture,
} from './helpers.js';

const pool = createDb(TEST_DATABASE_URL, { max: 2 });
const queries: string[] = [];
const observedDb = drizzle(pool.sql, { schema, logger: {
  logQuery(query) { queries.push(query); },
} });
const writes = (): string[] => queries.filter(query => /\bupdate\s+"?watches"?\s/iu.test(query));
let f: Fixture;
let observerId: string;
let playerId: string;

beforeEach(async () => {
  f = await seedWorld(4);
  observerId = f.planetIds[0]!;
  playerId = f.playerIds[0]!;
  for (const id of f.planetIds) await setLevel(f.db, id, 'CORE', 8);
  await giveInstrument(f.db, observerId, 'TELESCOPE', 5);
  await giveSatellite(f.db, observerId, 'UPLINK');
  await f.db.insert(watches).values(f.planetIds.slice(1).map((id, slot) => ({
    observerPlayerId: playerId, observerPlanetId: observerId, targetPlanetId: id, slot,
  })));
  queries.length = 0;
});
afterEach(() => { vi.restoreAllMocks(); });
afterAll(async () => { await pool.close(); await (await testDb()).close(); });

it('confirms three watches with one SQL write and keeps each fleet result on its own slot', async () => {
  await giveUnits(f.db, f.planetIds[2]!, { DART: 1 }, 'mission:test');
  const views = await readTelescopes(observedDb, playerId, f.clock);
  expect(views.map(view => view.reading.status)).toEqual(['HOME', 'AWAY', 'HOME']);
  expect(writes()).toHaveLength(1);
  const stored = await f.db.select().from(watches).orderBy(watches.slot);
  expect(stored.map(row => row.lastStatus)).toEqual(['HOME', 'AWAY', 'HOME']);
  expect(stored.every(row => row.lastConfirmedAt?.getTime() === f.clock.now().getTime())).toBe(true);

  const threeWatchQueryCount = queries.length;
  // Keep the AWAY watch so the fleet-truth branch is the same for both reads.
  await f.db.delete(watches).where(ne(watches.slot, 1));
  await f.db.update(watches).set({ lastConfirmedAt: null, lastStatus: null });
  queries.length = 0;
  expect(await readTelescopes(observedDb, playerId, f.clock)).toHaveLength(1);
  expect(queries).toHaveLength(threeWatchQueryCount);
});

it('preserves the 15-second confirmation threshold at its exact boundary', async () => {
  const start = f.clock.now().getTime();
  await readTelescopes(observedDb, playerId, f.clock);
  queries.length = 0;
  f.clock.set(new Date(start + 14_999));
  await readTelescopes(observedDb, playerId, f.clock);
  expect(writes()).toHaveLength(0);
  f.clock.set(new Date(start + 15_000));
  await readTelescopes(observedDb, playerId, f.clock);
  expect(writes()).toHaveLength(1);
  const stored = await f.db.select().from(watches);
  expect(stored.every(row => row.lastConfirmedAt?.getTime() === start + 15_000)).toBe(true);
});

it('does not persist UNKNOWN readings or issue an empty update', async () => {
  for (const id of f.planetIds.slice(1)) await giveInstrument(f.db, id, 'VEIL', 8);
  const views = await readTelescopes(observedDb, playerId, f.clock);
  expect(views).toHaveLength(3);
  expect(views.every(view => view.reading.status === 'UNKNOWN')).toBe(true);
  expect(writes()).toHaveLength(0);
  expect((await f.db.select().from(watches)).every(row => row.lastConfirmedAt === null)).toBe(true);
  await f.db.delete(watches);
  queries.length = 0;
  expect(await readTelescopes(observedDb, playerId, f.clock)).toEqual([]);
  expect(writes()).toHaveLength(0);
});

it.each(['retarget', 'detach', 'newer confirmation'])('does not overwrite a %s while a confirmation waited', async change => {
  await f.db.delete(watches).where(and(eq(watches.observerPlanetId, observerId), eq(watches.slot, 2)));
  let locked = () => { /* assigned synchronously */ };
  const hasLock = new Promise<void>(resolve => { locked = resolve; });
  let release = () => { /* assigned synchronously */ };
  const proceed = new Promise<void>(resolve => { release = resolve; });
  const retarget = f.db.transaction(async tx => {
    await tx.select().from(watches)
      .where(and(eq(watches.observerPlanetId, observerId), eq(watches.slot, 0))).for('update');
    locked();
    await proceed;
    const update = change === 'retarget'
      ? { targetPlanetId: f.planetIds[3]!, lastStatus: null, lastConfirmedAt: null }
      : change === 'detach'
        ? { detachedAt: f.clock.now(), lastStatus: null, lastConfirmedAt: null }
        : { lastStatus: 'AWAY', lastConfirmedAt: new Date(f.clock.now().getTime() + 60_000) };
    await tx.update(watches).set(update)
      .where(and(eq(watches.observerPlanetId, observerId), eq(watches.slot, 0)));
  });
  await hasLock;
  const reading = readTelescopes(observedDb, playerId, f.clock);
  try {
    await vi.waitFor(() => { expect(writes().length).toBeGreaterThan(0); });
  } finally {
    release();
    await Promise.all([retarget, reading]);
  }
  const [changed] = await f.db.select().from(watches)
    .where(and(eq(watches.observerPlanetId, observerId), eq(watches.slot, 0)));
  if (change === 'retarget') {
    expect(changed).toMatchObject({ targetPlanetId: f.planetIds[3]!, lastStatus: null, lastConfirmedAt: null });
  } else if (change === 'detach') {
    expect(changed).toMatchObject({ detachedAt: f.clock.now(), lastStatus: null, lastConfirmedAt: null });
  } else {
    expect(changed).toMatchObject({ lastStatus: 'AWAY', lastConfirmedAt: new Date(f.clock.now().getTime() + 60_000) });
  }
});

it('allows concurrent readers to confirm the same slots without losing readings or deadlocking', async () => {
  const results = await Promise.all([
    readTelescopes(observedDb, playerId, f.clock),
    readTelescopes(observedDb, playerId, f.clock),
  ]);
  expect(results[0]).toHaveLength(3);
  expect(results[0]).toEqual(results[1]);
  expect(writes().length).toBeLessThanOrEqual(2);
  expect((await f.db.select().from(watches))
    .every(row => row.lastConfirmedAt?.getTime() === f.clock.now().getTime())).toBe(true);
});
