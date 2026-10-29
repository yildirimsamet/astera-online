import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { honorEvents, players } from '../src/db/schema.js';
import { prepareHonorSeason } from '../src/services/honorLedger.js';
import { beforeCommit } from '../src/db/finalizers.js';
import { deferHonor } from '../src/services/honorDeferred.js';
import type { HonorEvidence } from '../src/services/honorAccounting.js';
import { sealHonor } from '../src/services/honorSeason.js';
import { seedWorld, testDb, type Fixture } from './helpers.js';

describe('deferred Honor is part of the same gameplay commit', () => {
  let f: Fixture;
  beforeEach(async () => {
    f = await seedWorld(2, 7719);
    await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'SHADOW', f.clock));
  });
  afterAll(async () => { await (await testDb()).close(); });
  const evidence = (): HonorEvidence => {
    const member = (id: string) => ({ id, tier: 3, navy: 100_000, weight: 10_000, civilianWeight: 0, loss: 0, combatLoss: 0, lootLost: 0 });
    return { source: 'WORLD', id: randomUUID(), at: f.clock.now().getTime(), eligible: true,
      attack: [member(f.playerIds[0]!)], defence: [{ ...member(f.playerIds[1]!), loss: 1000, combatLoss: 1000 }],
      relations: [{ a: f.playerIds[0]!, b: f.playerIds[1]!, related: false }] };
  };

  it('freezes queued evidence, writes after all game actions and awards before commit returns', async () => {
    const e = evidence();
    await f.db.transaction(async tx => {
      deferHonor(tx, f.seasonId, e);
      e.defence[0]!.loss = 999_999;
      expect(await tx.select().from(honorEvents)).toHaveLength(0);
      await tx.update(players).set({ name: 'game mutation' }).where(eq(players.id, f.playerIds[0]!));
    });
    const [event] = await f.db.select().from(honorEvents);
    expect(event?.evidence.defence[0]?.loss).toBe(1000);
    expect(event?.outcome.attack.total).toBeGreaterThan(0);
  });

  it('finishes inventory finalizers registered after radiation evidence before taking the Honor journal lock', async () => {
    await f.db.transaction(tx => {
      deferHonor(tx, f.seasonId, evidence());

      beforeCommit(tx, 'late-radiation-inventory', async () => {
        expect(await tx.select().from(honorEvents)).toHaveLength(0);
        await tx.update(players).set({ name: 'final physical inventory' }).where(eq(players.id, f.playerIds[0]!));
      });
      return Promise.resolve();
    });
    expect(await f.db.select().from(honorEvents)).toHaveLength(1);
  });

  it('a conflicting duplicate rolls back the battle writes and every queued award', async () => {
    const e = evidence();
    const [before] = await f.db.select().from(players).where(eq(players.id, f.playerIds[0]!));
    await expect(f.db.transaction(async tx => {
      await tx.update(players).set({ name: 'uncommitted battle' }).where(eq(players.id, f.playerIds[0]!));
      deferHonor(tx, f.seasonId, e);
      deferHonor(tx, f.seasonId, { ...e, eligible: false });
    })).rejects.toThrow('Conflicting Honor');
    expect(await f.db.select().from(honorEvents)).toHaveLength(0);
    expect((await f.db.select().from(players).where(eq(players.id, f.playerIds[0]!)))[0]).toEqual(before);
  });

  it('flushes a closing battle before sealing and never grants a rank from stale totals', async () => {
    await f.db.transaction(async tx => {
      const e = evidence();
      deferHonor(tx, f.seasonId, e);
      await sealHonor(tx, { seasonId: f.seasonId, at: f.clock.now(), playerIds: f.playerIds });
      expect(await tx.select().from(honorEvents)).toHaveLength(1);
    });
    expect(await f.db.select().from(honorEvents)).toHaveLength(1);
  });
});
