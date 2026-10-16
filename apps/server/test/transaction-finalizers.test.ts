import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { beforeCommit } from '../src/db/finalizers.js';
import { players } from '../src/db/schema.js';
import { seedWorld, testDb, type Fixture } from './helpers.js';

describe('transaction work deferred until game locks are complete', () => {
  let f: Fixture;
  beforeEach(async () => { f = await seedWorld(2, 7719); });
  afterAll(async () => { await (await testDb()).close(); });

  it('runs final work after the action callback and before the transaction is visible', async () => {
    const trace: string[] = [];
    const returned = await f.db.transaction(async tx => {
      beforeCommit(tx, 'test', async () => {
        trace.push('final');
        const [actor] = await tx.select().from(players).where(eq(players.id, f.playerIds[0]!));
        expect(actor?.name).toBe('from action');
        await tx.update(players).set({ name: 'from finalizer' }).where(eq(players.id, f.playerIds[0]!));
      });
      await tx.update(players).set({ name: 'from action' }).where(eq(players.id, f.playerIds[0]!));
      trace.push('action');
      return 7;
    });
    expect(returned).toBe(7);
    expect(trace).toEqual(['action', 'final']);
    expect((await f.db.select().from(players).where(eq(players.id, f.playerIds[0]!)))[0]?.name).toBe('from finalizer');
  });

  it('rolls back game writes and final writes together when accounting fails', async () => {
    const [before] = await f.db.select().from(players).where(eq(players.id, f.playerIds[0]!));
    await expect(f.db.transaction(async tx => {
      await tx.update(players).set({ name: 'uncommitted' }).where(eq(players.id, f.playerIds[0]!));
      beforeCommit(tx, 'failure', async () => {
        await tx.update(players).set({ wealth: 42 }).where(eq(players.id, f.playerIds[0]!));
        throw new Error('accounting failed');
      });
    })).rejects.toThrow('accounting failed');
    expect((await f.db.select().from(players).where(eq(players.id, f.playerIds[0]!)))[0]).toEqual(before);
  });

  it('never executes a rolled-back action’s final work and isolates concurrent transactions', async () => {
    const trace: string[] = [];
    await expect(f.db.transaction(tx => {
      beforeCommit(tx, 'key', () => { trace.push('aborted'); return Promise.resolve(); });
      throw new Error('action failed');
    })).rejects.toThrow('action failed');
    await Promise.all(f.playerIds.map((id, index) => f.db.transaction(async tx => {
      beforeCommit(tx, 'same-key', async () => {
        trace.push(id);
        await tx.update(players).set({ name: `final ${String(index)}` }).where(eq(players.id, id));
      });
      await tx.update(players).set({ name: randomUUID() }).where(eq(players.id, id));
    })));
    expect(trace.sort()).toEqual([...f.playerIds].sort());
  });
});
