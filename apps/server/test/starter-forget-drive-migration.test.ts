import { readFileSync } from 'node:fs';
import { eq, sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, expect, it } from 'vitest';
import { vesselSchema } from '../../web/src/api/starterSchemas.js';
import { vessels } from '../src/db/schema.js';
import { testDb } from './helpers.js';
import { starterWorld } from './starterFixture.js';
import { aboard, get } from './starterShips.js';

afterAll(async () => { await (await testDb()).close(); });

/**
 * THE DRIVE IS FORGOTTEN (plan 2026-11-13 §5.6, S2). Its two repairs are gone from the ladder, so a ship
 * that made them keeps nothing of them: a finished drive repair is worth nothing (§6), and the screen
 * reads only the modules the ladder knows. The opening card that was shown for it goes too.
 */
let world: Awaited<ReturnType<typeof starterWorld>>;
beforeEach(async () => { world = await starterWorld(); });
afterEach(async () => { await world.built.close(); });

const MIGRATION = new URL('../drizzle/0251_forget_drive.sql', import.meta.url);
async function migrate(): Promise<void> {
  for (const statement of readFileSync(MIGRATION, 'utf8').split('--> statement-breakpoint')) {
    if (statement.trim()) await world.f.db.execute(sql.raw(statement));
  }
}
const row = async (id: string) => (await world.f.db.select().from(vessels).where(eq(vessels.id, id)))[0]!;
const oldDrive = (id: string) => world.f.db.execute(sql`update vessels
  set modules = modules || '{"DRIVE_HULL": 1, "DRIVE_THRUST": 1}'::jsonb, unlocks_seen = unlocks_seen || '["drive"]'::jsonb
  where id = ${id}`);

it('drops the drive repairs and the drive opening, and keeps everything else', async () => {
  const me = await aboard(world, 'Me', { RADAR: 1, SHIPYARD: 1 });
  const { unlocksSeen } = await row(me.vesselId);
  await oldDrive(me.vesselId);
  await migrate();
  const after = await row(me.vesselId);
  expect(after.modules).toEqual({ REFINERY: 1, RADAR: 1, SHIPYARD: 1 });
  expect(after.unlocksSeen).toEqual(unlocksSeen);
});

it('lets the ship screen read the ship again', async () => {
  const me = await aboard(world, 'Me');
  await oldDrive(me.vesselId);
  await migrate();
  const { vessel } = await get<{ vessel: unknown }>(world, '/api/starter/vessel', me.headers);
  expect(vesselSchema.safeParse(vessel).success).toBe(true);
});

it('changes nothing the second time it runs, nor on a ship that never had a drive', async () => {
  const me = await aboard(world, 'Me');
  const untouched = await aboard(world, 'Other', { TELESCOPE: 1 });
  await oldDrive(me.vesselId);
  const before = await row(untouched.vesselId);
  await migrate();
  const once = await row(me.vesselId);
  await migrate();
  expect(await row(me.vesselId)).toEqual(once);
  expect(await row(untouched.vesselId)).toEqual(before);
});
