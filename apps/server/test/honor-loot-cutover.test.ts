import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, expect, it } from 'vitest';
import { honorCommitments, honorEvents, honorSeasons, honorTotals, seasons, shards } from '../src/db/schema.js';
import { enableHonorLootWeight } from '../src/services/honorLootWeight.js';
import { commitHonor, worldHonorCommitment, monumentHonorCommitment } from '../src/services/honorCommitment.js';
import { honorBattleEvidence } from '../src/services/honorBattleEvidence.js';
import { prepareHonorSeason, settleHonor } from '../src/services/honorLedger.js';
import { replayHonor } from '../src/services/honorAccounting.js';
import { isSupportedHonorVersion } from '@astera/rules';
import { lockSeason } from '../src/services/planet.js';
import { giveUnits, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

let f: Fixture;
beforeEach(async () => {
  f = await seedWorld(2);
  for (const id of f.planetIds) { await setLevel(f.db, id, 'CORE', 9); await giveUnits(f.db, id, { DART: 100 }); }
  await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'ACTIVE', f.clock));
  await f.db.update(honorSeasons).set({ retaliationLootPercent: 20 });
});
afterAll(async () => { await (await testDb()).close(); });
const enable = (apply = false) => enableHonorLootWeight(f.db, { seasonId: f.seasonId, clock: f.clock, apply });
const snapshot = async () => ({ config: await f.db.select().from(honorSeasons),
  events: await f.db.select().from(honorEvents), totals: await f.db.select().from(honorTotals),
  commitments: await f.db.select().from(honorCommitments) });
const commit = (source: 'WORLD' | 'CLAN_WAR' | 'MONUMENT', id: string) => f.db.transaction(tx => commitHonor(tx, {
  seasonId: f.seasonId, source, id, at: f.clock.now(), attack: [f.playerIds[0]!], defence: [f.playerIds[1]!], adminUsernames: new Set(),
}));

it('previews without writes and preserves scored history, grants and old flights on a retried cutover', async () => {
  const id = randomUUID(), old = await commit('WORLD', id);
  // Simulate a snapshot written before the new optional field existed.
  const { retaliationLootPercent: _oldPercent, ...legacy } = old!;
  await f.db.update(honorCommitments).set({ snapshot: legacy });
  const pastMember = (id: string, loss: number, lootLost: number) => ({ id, tier: 3, navy: 100_000,
    weight: 10_000, civilianWeight: 0, loss, combatLoss: loss, lootLost });
  await f.db.transaction(tx => settleHonor(tx, f.seasonId, { source: 'WORLD', id: randomUUID(),
    at: f.clock.now().getTime(), eligible: true, attack: [pastMember(f.playerIds[0]!, 0, 0)],
    defence: [pastMember(f.playerIds[1]!, 1000, 1000)],
    relations: [{ a: f.playerIds[0]!, b: f.playerIds[1]!, related: false }] }));
  const before = await snapshot();
  expect(await enable()).toMatchObject({ applied: false, retaliationLootPercent: 40, previousPercent: 20 });
  expect(await snapshot()).toEqual(before);
  const results = await Promise.all([enable(true), enable(true)]);
  expect(results.filter(result => result.applied)).toHaveLength(1);
  expect(await snapshot()).toEqual({ ...before,
    config: before.config.map(row => ({ ...row, retaliationLootPercent: 40 })) });
  const readOld = await f.db.transaction(tx => worldHonorCommitment(tx, { seasonId: f.seasonId,
    missionId: id, host: f.playerIds[1]!, supporters: [], adminUsernames: new Set() }));
  expect(readOld?.retaliationLootPercent).toBeUndefined();
  const current = await commit('WORLD', randomUUID());
  expect(current?.retaliationLootPercent).toBe(40);
  const [config] = await f.db.select().from(honorSeasons);
  const evidence = (commitment: NonNullable<typeof current>, sourceId: string, at: number) => honorBattleEvidence({
    catalogue: config!.catalogue, commitment, source: 'WORLD', id: sourceId, at,
    attack: [{ id: f.playerIds[0]!, sent: { DART: 10 }, active: { DART: 10 }, losses: {}, rebuilt: {},
      lootLost: { alloy: 0, crystal: 0, deuterium: 0 } }],
    defence: [{ id: f.playerIds[1]!, sent: { DART: 10 }, active: { DART: 10 }, losses: { DART: 1 }, rebuilt: {},
      lootLost: { alloy: 100, crystal: 0, deuterium: 0 } }],
  });
  const at = f.clock.now().getTime();
  const historical = evidence(legacy, id, at + 1), fresh = evidence(current!, randomUUID(), at + 2);
  expect(historical.retaliationLootPercent).toBeUndefined();
  expect(fresh.retaliationLootPercent).toBe(40);
  await f.db.transaction(tx => settleHonor(tx, f.seasonId, fresh));
  await f.db.transaction(tx => settleHonor(tx, f.seasonId, historical));
  if (!config || !isSupportedHonorVersion(config.version)) throw new Error('Missing Honor policy');
  const { events: _events, ...expected } = replayHonor([...before.events.map(row => row.evidence), historical, fresh], config.version);
  expect((await f.db.select().from(honorSeasons))[0]?.state).toEqual(expected);
  const scored = await snapshot();
  expect(await enable(true)).toMatchObject({ applied: false });
  expect(await snapshot()).toEqual(scored);
  expect(await f.db.transaction(tx => settleHonor(tx, f.seasonId, historical))).toMatchObject({ status: 'REPLAYED' });
});

it.each(['WORLD', 'CLAN_WAR', 'MONUMENT'] as const)('freezes %s flights on either side of the cutover, including equal timestamps', async source => {
  const oldId = randomUUID(), old = await commit(source, oldId);
  await enable(true);
  const fresh = await commit(source, randomUUID());
  // Old workers reject unknown snapshot keys during a compatibility roll.
  expect(old).not.toHaveProperty('retaliationLootPercent');
  expect(fresh?.retaliationLootPercent).toBe(40);
  expect(await commit(source, oldId)).toEqual(old);
  const reread = await f.db.transaction(tx => source === 'MONUMENT'
    ? monumentHonorCommitment(tx, { seasonId: f.seasonId, sourceId: oldId, defence: [f.playerIds[1]!], at: f.clock.now(), adminUsernames: new Set() })
    : worldHonorCommitment(tx, { seasonId: f.seasonId, source, missionId: oldId, host: f.playerIds[1]!, supporters: [], adminUsernames: new Set() }));
  expect(reread).not.toHaveProperty('retaliationLootPercent');
});

it.each(['closed', 'ended', 'frozen', 'waiting', 'missing'] as const)('refuses %s seasons without writes', async kind => {
  if (kind === 'closed') await f.db.update(honorSeasons).set({ closedAt: f.clock.now() });
  else if (kind === 'missing') await f.db.delete(honorSeasons);
  else if (kind === 'frozen') await f.db.update(seasons).set({ status: 'frozen' });
  else if (kind === 'waiting') await f.db.update(shards).set({ role: 'WAITING' });
  else await f.db.update(seasons).set({ endsAt: f.clock.now() });
  const before = await snapshot();
  await expect(enable(true)).rejects.toThrow();
  expect(await snapshot()).toEqual(before);
});

it('changes a live SHADOW season without opening ranking or resetting observations', async () => {
  await f.db.update(honorSeasons).set({ mode: 'SHADOW' });
  const before = await snapshot();
  expect(await enable(true)).toMatchObject({ applied: true });
  expect((await snapshot()).config).toEqual(before.config.map(row => ({ ...row, retaliationLootPercent: 40 })));
});

it('waits for a dispatch season lock so an in-progress launch keeps its old rate', async () => {
  let applied = false;
  let pending: ReturnType<typeof enable> | undefined;
  await f.db.transaction(async tx => {
    await lockSeason(tx, f.seasonId);
    pending = enable(true).then(result => { applied = true; return result; });
    const old = await commitHonor(tx, { seasonId: f.seasonId, source: 'WORLD', id: randomUUID(), at: f.clock.now(),
      attack: [f.playerIds[0]!], defence: [f.playerIds[1]!], adminUsernames: new Set() });
    expect(old).not.toHaveProperty('retaliationLootPercent');
    expect(applied).toBe(false);
  });
  expect(await pending).toMatchObject({ applied: true });
  expect((await commit('WORLD', randomUUID()))?.retaliationLootPercent).toBe(40);
});

it('starts newly prepared seasons at 40% without upgrading their Honor policy version', async () => {
  await f.db.delete(honorSeasons);
  await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'ACTIVE', f.clock));
  expect((await f.db.select().from(honorSeasons))[0]).toMatchObject({ retaliationLootPercent: 40, version: 3 });
});
