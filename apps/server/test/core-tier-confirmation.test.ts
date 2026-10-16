import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { buildOrders, planets } from '../src/db/schema.js';
import { upgradeBuilding } from '../src/services/build.js';
import { grant, seedWorld, setLevel, testDb } from './helpers.js';

afterAll(async () => { await (await testDb()).close(); });
describe('Core level 10 consent', () => {
  it('requires consent before spending or enqueuing, including projected level 9', async () => {
    const f = await seedWorld(1);
    const id = f.planetIds[0]!;
    await setLevel(f.db, id, 'CORE', 8);
    await setLevel(f.db, id, 'VAULT', 18);
    await grant(f.db, id, 10_000_000, 10_000_000);
    await setLevel(f.db, id, 'CORE', 8);
    await f.db.update(planets).set({ deuterium: 1_000_000 }).where(eq(planets.id, id));
    await upgradeBuilding(f.db, id, 'CORE', f.clock);
    const [before] = await f.db.select().from(planets).where(eq(planets.id, id));
    await expect(upgradeBuilding(f.db, id, 'CORE', f.clock)).rejects.toMatchObject({ code: 'CORE_TIER_CONFIRMATION_REQUIRED' });
    expect(await f.db.select().from(buildOrders)).toHaveLength(1);
    const [after] = await f.db.select().from(planets).where(eq(planets.id, id));
    expect(after?.alloy).toBe(before?.alloy);
    await expect(upgradeBuilding(f.db, id, 'CORE', f.clock, undefined, { confirmedLevel: 10 })).resolves.toMatchObject({ level: 10 });
    await expect(upgradeBuilding(f.db, id, 'CORE', f.clock, undefined, { confirmedLevel: 10 })).rejects.toMatchObject({ code: 'UPGRADE_TARGET_CHANGED' });
  });
});
