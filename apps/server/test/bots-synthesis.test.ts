import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { SYNTHESIS } from '@astera/rules';
import { planets, playerAsterium, playerCapsules, seasons, synthesisJobs } from '../src/db/schema.js';
import { BOT_PERSONAS } from '../src/services/bots/personas.js';
import { raidCapsules, tendBotSynthesis } from '../src/services/bots/synthesis.js';
import { seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

/*
  THE LABORATORY IN A SERVER-PLAYED COMMANDER'S HANDS (plan 2026-11-24 step 7). The same services a person
  uses, from the commander's own stock and nothing else, at a persona's pace: a raider brews silence and
  wears it, a builder brews rarely. Nobody can tell a commander apart by whether they use capsules.
*/
let f: Fixture;
let player: string;
const RAIDER = BOT_PERSONAS.RAIDER.synthesis;

afterAll(async () => { await (await testDb()).close(); });

beforeEach(async () => {
  f = await seedWorld(1, 7_717);
  player = f.playerIds[0]!;
  await f.db.update(seasons).set({ synthesisStartsAt: f.clock.now() }).where(eq(seasons.id, f.seasonId));
  await setLevel(f.db, f.planetIds[0]!, 'CORE', SYNTHESIS.requiredCore);
  await f.db.update(planets).set({ alloy: 100_000, crystal: 100_000, deuterium: 10_000 }).where(eq(planets.id, f.planetIds[0]!));
  await f.db.insert(playerAsterium).values({ playerId: player, balance: 60, updatedAt: f.clock.now() });
});

describe('brewing', () => {
  it('starts the persona’s batch when the roll comes up, through the laboratory itself', async () => {
    expect(await tendBotSynthesis(f.db, f.clock, player, RAIDER, () => 0)).toBe(true);
    const [job] = await f.db.select().from(synthesisJobs);
    expect(job).toMatchObject({ capsuleId: RAIDER.prefer, quantity: RAIDER.batch });
  });

  it('waits on a bad roll, a busy laboratory, or a galaxy without one', async () => {
    expect(await tendBotSynthesis(f.db, f.clock, player, RAIDER, () => 0.999)).toBe(false);
    await tendBotSynthesis(f.db, f.clock, player, RAIDER, () => 0);
    expect(await tendBotSynthesis(f.db, f.clock, player, RAIDER, () => 0)).toBe(false);
    await f.db.delete(synthesisJobs);
    await f.db.update(seasons).set({ synthesisStartsAt: null }).where(eq(seasons.id, f.seasonId));
    expect(await tendBotSynthesis(f.db, f.clock, player, RAIDER, () => 0)).toBe(false);
    expect(await f.db.select().from(synthesisJobs)).toHaveLength(0);
  });
});

describe('wearing', () => {
  it('presses on only what its own stock fully covers for this wing', async () => {
    await f.db.insert(playerCapsules).values([
      { playerId: player, capsuleId: 'SILENT_THRUST', quantity: 2 },
      { playerId: player, capsuleId: 'OPTIC_VEIL', quantity: 1 },
    ]);
    // 200 Darts: 600 bulk, two of each.
    expect(await raidCapsules(f.db, player, { DART: 200 }, RAIDER, () => 0)).toEqual(['SILENT_THRUST']);
    expect(await raidCapsules(f.db, player, { DART: 100 }, RAIDER, () => 0)).toEqual(['OPTIC_VEIL', 'SILENT_THRUST']);
    expect(await raidCapsules(f.db, player, { DART: 100 }, RAIDER, () => 0.999)).toEqual([]);
  });
});
