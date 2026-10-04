import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { groundSlots, hullBulk } from '@astera/rules';
import { units } from '../src/db/schema.js';
import { buildUnits } from '../src/services/build.js';
import { giveUnits, grant, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

/**
 * The ground ceiling remains independent of ship berths. The obsolete D184
 * no-Hangar assertions were superseded by the restored Hangar: `hangar.test.ts`
 * covers ship orders, transfers, overflow and the client capacity projection.
 */
describe('the ground ceiling', () => {
  let f: Fixture;
  let home: string;

  beforeEach(async () => {
    f = await seedWorld(3);
    home = f.planetIds[0]!;
    await grant(f.db, home, 2_000_000, 600_000);
    await setLevel(f.db, home, 'CORE', 10);
    await setLevel(f.db, home, 'SHIPYARD', 4);
    await f.db.delete(units).where(eq(units.planetId, home));
  });

  it('refuses a gun the world has no room to stand', async () => {
    const room = groundSlots(10);
    await giveUnits(f.db, home, { THORN: Math.floor(room / hullBulk('THORN')) });

    await expect(buildUnits(f.db, home, 'BASTION', 1, f.clock)).rejects.toMatchObject({
      code: 'GROUND_SLOTS_FULL',
      params: { capacity: room },
    });
  });

  it('raising the Core opens more ground', async () => {
    await setLevel(f.db, home, 'CORE', 6);
    await giveUnits(f.db, home, { THORN: Math.floor(groundSlots(6) / hullBulk('THORN')) });
    await expect(buildUnits(f.db, home, 'THORN', 1, f.clock)).rejects.toMatchObject({
      code: 'GROUND_SLOTS_FULL',
    });

    await setLevel(f.db, home, 'CORE', 12);
    await expect(buildUnits(f.db, home, 'THORN', 1, f.clock)).resolves.toBeTruthy();
  });

  it('spends neither pool on the other', async () => {
    await giveUnits(f.db, home, { DART: 400 });
    await expect(buildUnits(f.db, home, 'THORN', 1, f.clock)).resolves.toBeTruthy();

    const fresh = f.planetIds[2]!;
    await setLevel(f.db, fresh, 'CORE', 10);
    await setLevel(f.db, fresh, 'SHIPYARD', 4);
    await grant(f.db, fresh, 2_000_000, 600_000);
    await f.db.delete(units).where(eq(units.planetId, fresh));
    await giveUnits(f.db, fresh, { THORN: Math.floor(groundSlots(10) / hullBulk('THORN')) });
    await expect(buildUnits(f.db, fresh, 'DART', 1, f.clock)).resolves.toBeTruthy();
  });
});
