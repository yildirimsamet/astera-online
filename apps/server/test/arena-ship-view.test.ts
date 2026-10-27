import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, expect, it } from 'vitest';
import { arenaShips } from '../src/db/schema.js';
import { chooseShip } from '../src/services/arenaShips.js';
import { readCommanderShip } from '../src/services/arenaShipState.js';
import { seedWorld, setLevel, testDb, type Fixture } from './helpers.js';
let f: Fixture;
beforeEach(async () => { f = await seedWorld(2, 9034); await setLevel(f.db, f.planetIds[0]!, 'CORE', 9); await chooseShip(f.db, f.clock, f.accountIds[0]!, 'kilavuz'); });
afterAll(async () => { const { close } = await testDb(); await close(); });
it('shows only the asking commander’s parked ship and its actual capital', async () => {
  expect(await readCommanderShip(f.db, f.accountIds[0]!, f.clock)).toMatchObject({ capitalPlanetId: f.planetIds[0], ship: { class: 'kilavuz', level: 1, status: 'ready' }, homeward: null });
  expect((await readCommanderShip(f.db, f.accountIds[1]!, f.clock)).ship).toBeNull();
});
it('keeps the ship away while flying or accompanying a fleet, and derives readiness without a worker', async () => {
  const read = () => readCommanderShip(f.db, f.accountIds[0]!, f.clock);
  await f.db.update(arenaShips).set({ sortieId: randomUUID() }); expect((await read()).ship?.status).toBe('yarik');
  await f.db.update(arenaShips).set({ sortieId: null, admiralId: randomUUID() }); expect((await read()).ship?.status).toBe('admiral');
  await f.db.update(arenaShips).set({ admiralId: null, readyAt: new Date(f.clock.now().getTime() + 600_000), readyReason: 'service' }).where(eq(arenaShips.playerId, f.playerIds[0]!));
  expect((await read()).ship?.status).toBe('service'); f.clock.advance(10);
  expect((await read()).ship?.status).toBe('ready');
});
