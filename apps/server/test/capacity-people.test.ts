import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { pino } from 'pino';
import { FixedClock } from '../src/clock.js';
import { createSeason } from '../src/services/season.js';
import { joinSeason } from '../src/services/player.js';
import { GameError } from '../src/services/planet.js';
import { addBot } from '../src/services/bots/roster.js';
import { ensureBotSeats } from '../src/services/bots/sweep.js';
import { listServers } from '../src/services/servers.js';
import { makeAccount, testDb, truncateAll } from './helpers.js';

/**
 * A GALAXY'S CAPACITY IS PEOPLE. Owner instruction, 2026-09-19: the server's own
 * commanders stand on their own band of addresses and must not take a person's
 * seat — a thousand-seat galaxy with a hundred bots admits a thousand people.
 */

const START = new Date('2026-09-01T21:00:00.000Z');
const silent = pino({ level: 'silent' });

beforeEach(async () => { await truncateAll((await testDb()).db); });
afterAll(async () => { await (await testDb()).close(); });

async function galaxyOfTwo() {
  const { db } = await testDb();
  const clock = new FixedClock(new Date(START.getTime() + 5 * 60_000));
  const { season } = await createSeason(db, {
    shardCode: 'EU-1', seed: 4513, startsAt: START, playerCap: 2,
  });
  const person = async (name: string) => joinSeason(db, (await makeAccount(db, name)).id, season.id, clock);
  const bot = async (name: string) => {
    await addBot(db, name, clock);
    return ensureBotSeats(db, clock, silent, 8);
  };
  return { db, clock, season, person, bot };
}

describe('the seats a galaxy counts', () => {
  it('never lets a bot take a person’s seat', async () => {
    const { db, clock, person, bot } = await galaxyOfTwo();
    expect(await bot('Poyraz')).toBe(0);
    await person('Ada');
    expect(await ensureBotSeats(db, clock, silent, 8)).toBe(1);
    await person('Bora');
    await expect(person('Cem')).rejects.toSatisfy(
      (err: unknown) => err instanceof GameError && err.code === 'SHARD_FULL',
    );
  });

  it('still seats a bot in a galaxy full of people', async () => {
    const { person, bot } = await galaxyOfTwo();
    await person('Ada');
    await person('Bora');
    expect(await bot('Poyraz')).toBe(1);
  });

  it('lists a galaxy by the people in it', async () => {
    const { db, clock, person, bot } = await galaxyOfTwo();
    await person('Ada');
    expect(await bot('Poyraz')).toBe(1);
    const [row] = await listServers(db, clock);
    expect(row?.planets).toBe(1);
    expect(row?.status).not.toBe('full');
  });
});
