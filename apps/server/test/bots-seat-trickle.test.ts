import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { pino } from 'pino';
import { eq, sql } from 'drizzle-orm';
import { botProfiles, players } from '../src/db/schema.js';
import { addBot } from '../src/services/bots/roster.js';
import { ensureBotSeats } from '../src/services/bots/sweep.js';
import { midSeasonSeatGapMs } from '../src/services/bots/population.js';
import { BOTS } from '../src/services/bots/personas.js';
import { seedWorld, testDb, type Fixture } from './helpers.js';

/**
 * A GALAXY PAST ITS FIRST DAY GETS NEW COMMANDERS THE WAY PEOPLE ARRIVE: one at a time,
 * hours apart. Owner plan 2026-11-26 (docs/bot-plani-2026-11-26.md F1.2): raising the
 * floor from 13 to 25 must not drop twelve new worlds onto the disc in one afternoon.
 */

const silent = pino({ level: 'silent' });
const HOUR = 60;
let f: Fixture;

afterAll(async () => { await (await testDb()).close(); });

const seatedHere = async (): Promise<number> => {
  const [row] = await f.db.select({ n: sql<number>`count(*)::int` })
    .from(players).innerJoin(botProfiles, eq(botProfiles.accountId, players.accountId))
    .where(eq(players.seasonId, f.seasonId));
  return row?.n ?? 0;
};

describe('seating bots into a galaxy', () => {
  beforeEach(async () => {
    f = await seedWorld(20);
    for (let i = 0; i < 6; i++) await addBot(f.db, `Trickle${String(i)}`, f.clock);
  });

  it('keeps four per half hour while the galaxy is in its first day', async () => {
    f.clock.advance(23 * HOUR);
    expect(await ensureBotSeats(f.db, f.clock, silent, 100, 6)).toBe(4);
  });

  it('seats one at a time once the first day is over, then waits out the gap', async () => {
    f.clock.advance(BOTS.trickleAfterMinutes + HOUR);
    expect(await ensureBotSeats(f.db, f.clock, silent, 100, 6)).toBe(1);
    expect(await ensureBotSeats(f.db, f.clock, silent, 100, 6)).toBe(0);

    const gapMinutes = midSeasonSeatGapMs(f.seasonId, 1) / 60_000;
    f.clock.advance(Math.ceil(gapMinutes) - 1);
    expect(await ensureBotSeats(f.db, f.clock, silent, 100, 6)).toBe(0);
    f.clock.advance(1);
    expect(await ensureBotSeats(f.db, f.clock, silent, 100, 6)).toBe(1);
    expect(await seatedHere()).toBe(2);
  });

  it('stops at the target however long it waits', async () => {
    f.clock.advance(BOTS.trickleAfterMinutes + HOUR);
    for (let i = 0; i < 4; i++) {
      // Operator cap 2: twenty people alone would ask for five.
      await ensureBotSeats(f.db, f.clock, silent, 2);
      f.clock.advance(9 * HOUR);
    }
    expect(await seatedHere()).toBe(2);
  });
});

describe('the gap between two mid-season arrivals', () => {
  it('is four to eight hours, the same answer every time it is asked', () => {
    const gaps: number[] = [];
    for (let n = 0; n < 40; n++) {
      const gap = midSeasonSeatGapMs('6b0c8f4e-0000-4000-8000-000000000001', n);
      expect(gap).toBe(midSeasonSeatGapMs('6b0c8f4e-0000-4000-8000-000000000001', n));
      expect(gap).toBeGreaterThanOrEqual(BOTS.trickleGapHours.min * 3_600_000);
      expect(gap).toBeLessThanOrEqual(BOTS.trickleGapHours.max * 3_600_000);
      gaps.push(gap);
    }
    // Not one fixed interval: a clock-regular arrival is a pattern somebody would notice.
    expect(new Set(gaps.map((gap) => Math.round(gap / 600_000))).size).toBeGreaterThan(5);
  });
});
