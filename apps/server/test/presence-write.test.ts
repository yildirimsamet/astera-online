import { setTimeout as delay } from 'node:timers/promises';
import { eq } from 'drizzle-orm';
import { afterAll, expect, it, vi } from 'vitest';
import { countStatements } from '../src/db/client.js';
import { players } from '../src/db/schema.js';
import { Presence } from '../src/services/presence.js';
import { seedWorld, testDb, type Fixture } from './helpers.js';

/**
 * THE STAMP IS ONE GUARDED WRITE. Capacity fix plan, item 2 (2026-11-02).
 *
 * It opened a transaction and locked the commander's row, once a minute in each API
 * process: 2,320 locked reads for 200 commanders in three minutes, each one queueing
 * behind whatever game write held that row. The guard lives in the row now, so three
 * processes write once between them, and a locked row is left for the next request.
 */
afterAll(async () => { await (await testDb()).close(); });

const stampOf = async (f: Fixture): Promise<Date | undefined> => {
  const [row] = await f.db.select({ at: players.lastActiveAt }).from(players).where(eq(players.id, f.playerIds[0]!));
  return row?.at;
};

it('stamps a commander in one statement', async () => {
  const f = await seedWorld(1);
  f.clock.advance(2);
  const scope = { statements: 0 };
  expect(await countStatements(scope, () => new Presence(f.db, f.clock).touch(f.accountIds[0]!))).toBe(true);
  expect(scope.statements).toBe(1);
  expect(await stampOf(f)).toEqual(f.clock.now());
});

it('writes once between three processes in the same minute', async () => {
  const f = await seedWorld(1);
  f.clock.advance(2);
  const wrote = await Promise.all([1, 2, 3].map(() => new Presence(f.db, f.clock).touch(f.accountIds[0]!)));
  expect(wrote.filter(Boolean)).toHaveLength(1);

  const stamped = await stampOf(f);
  f.clock.set(new Date(f.clock.now().getTime() + 59_999));
  expect(await new Presence(f.db, f.clock).touch(f.accountIds[0]!)).toBe(false);
  expect(await stampOf(f)).toEqual(stamped);

  f.clock.set(new Date(f.clock.now().getTime() + 1));
  expect(await new Presence(f.db, f.clock).touch(f.accountIds[0]!)).toBe(true);
  expect(await stampOf(f)).toEqual(f.clock.now());
});

it('does not touch another commander', async () => {
  const f = await seedWorld(2);
  const [before] = await f.db.select({ at: players.lastActiveAt }).from(players).where(eq(players.id, f.playerIds[1]!));
  f.clock.advance(2);
  await new Presence(f.db, f.clock).touch(f.accountIds[0]!);
  const [after] = await f.db.select({ at: players.lastActiveAt }).from(players).where(eq(players.id, f.playerIds[1]!));
  expect(after?.at).toEqual(before?.at);
});

it('leaves a row a game write holds, and stamps it on a later request', async () => {
  const f = await seedWorld(1);
  const seeded = await stampOf(f);
  f.clock.advance(2);
  const presence = new Presence(f.db, f.clock);
  await f.db.transaction(async (tx) => {
    await tx.select({ id: players.id }).from(players).where(eq(players.id, f.playerIds[0]!)).for('update');
    const answer = await Promise.race([presence.touch(f.accountIds[0]!), delay(2_000, 'waited')]);
    expect(answer).toBe(false);
  });
  expect(await stampOf(f)).toEqual(seeded);

  f.clock.advance(1);
  expect(await presence.touch(f.accountIds[0]!)).toBe(true);
  expect(await stampOf(f)).toEqual(f.clock.now());
});

it('stamps a commander whose row only a new row refers to', async () => {
  const f = await seedWorld(1);
  f.clock.advance(2);
  await f.db.transaction(async (tx) => {
    // The lock every insert with a foreign key to the commander takes: a mission, a report, a message.
    await tx.select({ id: players.id }).from(players).where(eq(players.id, f.playerIds[0]!)).for('key share');
    const answer = await Promise.race([new Presence(f.db, f.clock).touch(f.accountIds[0]!), delay(2_000, 'waited')]);
    expect(answer).toBe(true);
  });
  expect(await stampOf(f)).toEqual(f.clock.now());
});

it('reports a failed write and lets the next request try again', async () => {
  const f = await seedWorld(1);
  f.clock.advance(2);
  const error = new Error('presence database failure');
  const report = vi.fn();
  const presence = new Presence(f.db, f.clock, 60_000, report);
  const update = vi.spyOn(f.db, 'update').mockImplementationOnce(() => { throw error; });
  try {
    expect(await presence.touch(f.accountIds[0]!)).toBe(false);
    expect(report).toHaveBeenCalledWith(error);
    expect(await presence.touch(f.accountIds[0]!)).toBe(true);
  } finally { update.mockRestore(); }
});
