import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, expect, it } from 'vitest';
import { arenaShips } from '../src/db/schema.js';
import { EventBus, type StreamEvent } from '../src/stream/bus.js';
import { pino } from 'pino';
import { seedWorld, testDb, type Fixture } from './helpers.js';

let f: Fixture;
beforeEach(async () => { f = await seedWorld(1); });
afterAll(async () => { await (await testDb()).close(); });
it('wakes observers on a committed physical change, without publishing the owner or ship state', async () => {
  const bus = new EventBus(process.env.DATABASE_URL!, pino({ level: 'silent' }));
  const events: StreamEvent[] = [];
  await bus.start();
  const unsubscribe = bus.subscribeShard(f.seasonId, event => { if (event.kind === 'shard:commander-ship') events.push(event); });
  try {
    await f.db.insert(arenaShips).values({ playerId: f.playerIds[0]!, ship: 'akinci', chosenAt: f.clock.now(), fuel: 100, ammo: 100 });
    await expect.poll(() => events.length).toBe(1);
    expect(events[0]).toEqual({ shard: f.seasonId, kind: 'shard:commander-ship' });
    await f.db.update(arenaShips).set({ fuel: 50 }).where(eq(arenaShips.playerId, f.playerIds[0]!));
    await f.db.update(arenaShips).set({ level: 2 }).where(eq(arenaShips.playerId, f.playerIds[0]!));
    await expect.poll(() => events.length).toBe(2);
  } finally { unsubscribe(); await bus.stop(); }
});
