import { readFileSync } from 'node:fs';
import { eq, sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, expect, it } from 'vitest';
import { vesselMissions, vessels } from '../src/db/schema.js';
import { testDb } from './helpers.js';
import { starterWorld } from './starterFixture.js';
import { aboard, arm, enrich, pass, post, siteOf } from './starterShips.js';

afterAll(async () => { await (await testDb()).close(); });

/**
 * A RUN IN THE AIR AT THE DEPLOY (code review 2026-11-13). Only a run that dug opens the first loop's
 * mining fact (plan 2026-11-13 §5.1), and `dug` came in with the deploy as false for every row. A run
 * that had dug and was on its way home would land as if called back, and its ship's jump window would
 * stay shut with nothing saying why. A recall rewrites the flight to turn at that instant (depart = arrive);
 * a dig keeps the outbound leg, so the two can be told apart afterwards.
 */
let world: Awaited<ReturnType<typeof starterWorld>>;
beforeEach(async () => { world = await starterWorld(); });
afterEach(async () => { await world.built.close(); });

const MIGRATION = new URL('../drizzle/0249_mining_run_dug.sql', import.meta.url);
async function backfill(): Promise<void> {
  // The column itself is already there: only what the migration does to the rows runs again.
  for (const statement of readFileSync(MIGRATION, 'utf8').split('--> statement-breakpoint')) {
    if (/^UPDATE/im.test(statement)) await world.f.db.execute(sql.raw(statement));
  }
}
const opaque = (uuid: string) => Buffer.from(uuid.replace(/-/g, ''), 'hex').toString('base64url');
const runOf = async (vesselId: string) => (await world.f.db.select().from(vesselMissions).where(eq(vesselMissions.ownerVesselId, vesselId)))[0]!;
const factsOf = async (vesselId: string) => (await world.f.db.select().from(vessels).where(eq(vessels.id, vesselId)))[0]!.facts;

async function launched() {
  const me = await aboard(world, 'Me', { SHIPYARD: 1, SURVEY: 1, REFINERY: 3, TELESCOPE: 1 });
  await arm(world, me.vesselId, { PROSPECTOR: 2 });
  await enrich(world, me.vesselId, 100, 100, 0);
  const site = await siteOf(world, 'ASTEROID');
  const { runId } = (await post(world, '/api/starter/mining/launch', me.headers, { asteroidId: opaque(site.id), craft: 1 })).json<{ runId: string }>();
  return { me, runId };
}

it('counts a run that dug before the deploy and is still on its way home', async () => {
  const { me } = await launched();
  const out = await runOf(me.vesselId);
  await pass(world, (out.arriveAt.getTime() - world.f.clock.now().getTime()) / 60_000 + 0.01);
  const home = await runOf(me.vesselId);
  expect(home.status).toBe('RETURNING');
  // The row as the deploy found it.
  await world.f.db.update(vesselMissions).set({ dug: false }).where(eq(vesselMissions.id, home.id));
  await backfill();
  expect((await runOf(me.vesselId)).dug).toBe(true);
  await pass(world, 60);
  expect(await factsOf(me.vesselId)).toContain('FIRST_MINING_RETURN');
});

it('leaves a run called back before the rock as it was', async () => {
  const { me, runId } = await launched();
  expect((await post(world, `/api/starter/mining/runs/${runId}/recall`, me.headers)).statusCode).toBe(200);
  await backfill();
  expect((await runOf(me.vesselId)).dug).toBe(false);
  await pass(world, 60);
  expect(await factsOf(me.vesselId)).not.toContain('FIRST_MINING_RETURN');
});

it('leaves a run still on its way out to dig as it was', async () => {
  const { me } = await launched();
  await backfill();
  expect((await runOf(me.vesselId)).dug).toBe(false);
});
