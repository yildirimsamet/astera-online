import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { buildings, honorCommitments, units } from '../src/db/schema.js';
import { prepareHonorSeason } from '../src/services/honorLedger.js';
import { commitHonor } from '../src/services/honorCommitment.js';
import { seedWorld, testDb, giveUnits, setLevel, type Fixture } from './helpers.js';
import { launchAttack } from '../src/services/mission.js';

describe('Honor conditions frozen with the actual attack intent', () => {
  let f: Fixture;
  beforeEach(async () => { f = await seedWorld(2, 7719); });
  afterAll(async () => { await (await testDb()).close(); });
  const input = () => ({ seasonId: f.seasonId, source: 'WORLD' as const, id: randomUUID(),
    attack: [f.playerIds[0]!], defence: [f.playerIds[1]!], at: f.clock.now(), adminUsernames: new Set<string>() });
  const enable = () => f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'SHADOW', f.clock));

  it('does not write commitments in legacy seasons', async () => {
    expect(await f.db.transaction(tx => commitHonor(tx, input()))).toBeNull();
    expect(await f.db.select().from(honorCommitments)).toHaveLength(0);
  });

  it('freezes server references and replay cannot replace them with later tier or navy', async () => {
    await enable(); const request = input();
    const original = await f.db.transaction(tx => commitHonor(tx, request));
    expect(original?.eligible).toBe(true);
    expect(original?.attack[0]?.id).toBe(f.playerIds[0]);
    await f.db.update(buildings).set({ level: 15 }).where(eq(buildings.type, 'CORE'));
    await f.db.delete(units);
    expect(await f.db.transaction(tx => commitHonor(tx, request))).toEqual(original);
    expect(await f.db.select().from(honorCommitments)).toHaveLength(1);
    const next = await f.db.transaction(tx => commitHonor(tx, { ...request, id: randomUUID(), at: new Date(request.at.getTime() + 1) }));
    expect(next?.attack[0]?.tier).toBe(5);
    expect(original?.attack[0]?.tier).not.toBe(5);
  });

  it('serialises duplicate intent and rejects a conflicting identity or time', async () => {
    await enable(); const request = input();
    const results = await Promise.all([f.db.transaction(tx => commitHonor(tx, request)), f.db.transaction(tx => commitHonor(tx, request))]);
    expect(results[0]).toEqual(results[1]);
    expect(await f.db.select().from(honorCommitments)).toHaveLength(1);
    await expect(f.db.transaction(tx => commitHonor(tx, { ...request, attack: request.defence, defence: request.attack })))
      .rejects.toThrow('Conflicting Honor commitment');
    await expect(f.db.transaction(tx => commitHonor(tx, { ...request, at: new Date(request.at.getTime() + 1) })))
      .rejects.toThrow('Conflicting Honor commitment');
  });

  it('rolls the commitment and observations back with a failed launch', async () => {
    await enable();
    await expect(f.db.transaction(async tx => { await commitHonor(tx, input()); throw new Error('launch failed'); }))
      .rejects.toThrow('launch failed');
    expect(await f.db.select().from(honorCommitments)).toHaveLength(0);
  });

  it('records the actual raid launch and moving the dispatched ships does not change owned navy', async () => {
    await setLevel(f.db, f.planetIds[0]!, 'CORE', 6);
    await giveUnits(f.db, f.planetIds[0]!, { DART: 20 });
    await enable();
    const launch = await launchAttack(f.db, f.planetIds[0]!, f.planetIds[1]!, { DART: 5 }, f.clock);
    const [stored] = await f.db.select().from(honorCommitments);
    expect(stored?.sourceId).toBe(launch.missionId);
    expect(stored?.snapshot.attack[0]?.id).toBe(f.playerIds[0]);
    expect(stored?.snapshot.defence[0]?.id).toBe(f.playerIds[1]);
    const { honorOwnerReference } = await import('../src/services/honorReference.js');
    const reference = await honorOwnerReference(f.db, f.seasonId, f.playerIds[0]!, f.clock.now());
    expect(stored?.snapshot.attack[0]?.navy).toBe(reference.navy);
  });
});
