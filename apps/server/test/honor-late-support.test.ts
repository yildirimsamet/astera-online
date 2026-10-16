import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildings, honorCommitments, players, units } from '../src/db/schema.js';
import { prepareHonorSeason } from '../src/services/honorLedger.js';
import { commitHonor, worldHonorCommitment, monumentHonorCommitment } from '../src/services/honorCommitment.js';
import { observeHonorOwner, honorOwnerReference } from '../src/services/honorReference.js';
import { seedWorld, testDb, type Fixture } from './helpers.js';

describe('support arriving after the raid was committed', () => {
  let f: Fixture;
  beforeEach(async () => {
    f = await seedWorld(3, 7719);
    await f.db.transaction(async tx => {
      await prepareHonorSeason(tx, f.seasonId, 'SHADOW', f.clock);
      for (const id of [...f.playerIds].sort()) await observeHonorOwner(tx, id, f.clock.now());
    });
  });
  afterAll(async () => { await (await testDb()).close(); });
  const commit = (id: string) => f.db.transaction(tx => commitHonor(tx, { seasonId: f.seasonId, source: 'WORLD', id,
    attack: [f.playerIds[0]!], defence: [f.playerIds[1]!], at: f.clock.now(), adminUsernames: new Set() }));
  const expand = (id: string, host = f.playerIds[1]!) => f.db.transaction(tx => worldHonorCommitment(tx, {
    seasonId: f.seasonId, missionId: id, host, supporters: [f.playerIds[2]!], adminUsernames: new Set(),
  }));

  it('uses the supporter’s reference at raid launch, even if later state shares the same millisecond', async () => {
    const id = randomUUID();
    const old = await honorOwnerReference(f.db, f.seasonId, f.playerIds[2]!, f.clock.now());
    const committed = await commit(id);
    await f.db.update(buildings).set({ level: 15 }).where(and(eq(buildings.planetId, f.planetIds[2]!), eq(buildings.type, 'CORE')));
    await f.db.insert(units).values({ planetId: f.planetIds[2]!, ownerPlayerId: f.playerIds[2]!, location: randomUUID(), hull: 'DART', count: 100 });
    await f.db.transaction(tx => observeHonorOwner(tx, f.playerIds[2]!, f.clock.now()));
    const expanded = await expand(id);
    expect(expanded?.defence.find(row => row.id === f.playerIds[2])).toEqual({ id: f.playerIds[2]!, ...old });
    expect(expanded?.attack).toEqual(committed?.attack);
    expect(expanded?.selectedDefenders).toEqual([f.playerIds[1]]);
    expect(expanded?.relations).toHaveLength(2);
    const [stored] = await f.db.select().from(honorCommitments);
    expect(stored?.snapshot).toEqual(committed);
  });

  it('refuses to give a replacement planet owner the original target’s conditions', async () => {
    const id = randomUUID(); await commit(id);
    await expect(expand(id, f.playerIds[2])).rejects.toThrow('Honor target owner changed');
  });

  it('records an explicitly unscored changed owner instead of stalling the real battle', async () => {
    const id = randomUUID(); await commit(id);
    const result = await f.db.transaction(tx => worldHonorCommitment(tx, { seasonId: f.seasonId,
      missionId: id, host: f.playerIds[2]!, supporters: [], adminUsernames: new Set(), observedAt: f.clock.now() }));
    expect(result?.eligible).toBe(false);
    expect(result?.exclusion).toBe('TARGET_CHANGED');
    expect(result?.defence.map(row => row.id)).toEqual([f.playerIds[2]!]);
  });

  it('does not substitute today’s fleet if the supporter’s launch-time history is missing', async () => {
    const id = randomUUID(); await commit(id);
    const { honorObservations } = await import('../src/db/schema.js');
    await f.db.delete(honorObservations).where(eq(honorObservations.playerId, f.playerIds[2]!));
    await expect(expand(id)).rejects.toThrow('Missing Honor reference history');
  });

  it('adds a monument defender using historical conditions and removes holders who already left', async () => {
    const id = randomUUID();
    await f.db.transaction(tx => commitHonor(tx, { seasonId: f.seasonId, source: 'MONUMENT', id,
      attack: [f.playerIds[0]!], defence: [f.playerIds[1]!], at: f.clock.now(), adminUsernames: new Set() }));
    const result = await f.db.transaction(tx => monumentHonorCommitment(tx, { seasonId: f.seasonId, sourceId: id,
      defence: [f.playerIds[1]!, f.playerIds[2]!], at: f.clock.now(), adminUsernames: new Set() }));
    expect(result?.eligible).toBe(true);
    expect(result?.relations).toHaveLength(2);
    expect(result?.selectedDefenders).toEqual([f.playerIds[1]]);
    const changed = await f.db.transaction(tx => monumentHonorCommitment(tx, { seasonId: f.seasonId, sourceId: id,
      defence: [f.playerIds[2]!], at: f.clock.now(), adminUsernames: new Set() }));
    expect(changed?.eligible).toBe(false);
    expect(changed?.exclusion).toBe('TARGET_CHANGED');
    expect(changed?.defence.map(row => row.id)).toEqual([f.playerIds[2]!]);
  });

  it('a genuinely later entrant cannot cause retroactive Honor conditions or stall an earlier attack', async () => {
    const id = randomUUID();
    await f.db.transaction(tx => commitHonor(tx, { seasonId: f.seasonId, source: 'MONUMENT', id,
      attack: [f.playerIds[0]!], defence: [f.playerIds[1]!], at: f.clock.now(), adminUsernames: new Set() }));
    const { honorObservations } = await import('../src/db/schema.js');
    await f.db.delete(honorObservations).where(eq(honorObservations.playerId, f.playerIds[2]!));
    await f.db.update(players).set({ joinedAt: new Date(f.clock.now().getTime() + 1) }).where(eq(players.id, f.playerIds[2]!));
    f.clock.advance(1);
    await f.db.transaction(tx => observeHonorOwner(tx, f.playerIds[2]!, f.clock.now()));
    const result = await f.db.transaction(tx => monumentHonorCommitment(tx, { seasonId: f.seasonId, sourceId: id,
      defence: [f.playerIds[1]!, f.playerIds[2]!], at: f.clock.now(), adminUsernames: new Set() }));
    expect(result?.eligible).toBe(false);
    expect(result?.exclusion).toBe('PARTICIPANT_JOINED_LATE');
    expect(result?.defence).toHaveLength(2);
  });
  it('keeps an ordinary world battle moving when a genuine new entrant supplies late support', async () => {
    const id = randomUUID(); await commit(id);
    const { honorObservations } = await import('../src/db/schema.js');
    await f.db.delete(honorObservations).where(eq(honorObservations.playerId, f.playerIds[2]!));
    await f.db.update(players).set({ joinedAt: new Date(f.clock.now().getTime() + 1) }).where(eq(players.id, f.playerIds[2]!));
    f.clock.advance(1);
    await f.db.transaction(tx => observeHonorOwner(tx, f.playerIds[2]!, f.clock.now()));
    const result = await f.db.transaction(tx => worldHonorCommitment(tx, { seasonId: f.seasonId,
      missionId: id, host: f.playerIds[1]!, supporters: [f.playerIds[2]!], adminUsernames: new Set(), observedAt: f.clock.now() }));
    expect(result?.eligible).toBe(false);
    expect(result?.exclusion).toBe('PARTICIPANT_JOINED_LATE');
    expect(result?.defence.map(member => member.id).sort()).toEqual([f.playerIds[1], f.playerIds[2]].sort());
  });
});
