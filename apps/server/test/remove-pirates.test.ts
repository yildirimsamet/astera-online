import { afterAll, describe, expect, it } from 'vitest';
import { pirateState, pirateRaids, battleReports, debrisFields } from '../src/db/schema.js';
import { removePirates } from '../src/cli/removePirates.js';
import { loadPirateSnapshot, pirateId } from '../src/services/pirateField.js';
import { seedWorld, testDb } from './helpers.js';

afterAll(async () => { await (await testDb()).close(); });

async function fixture() {
  const f = await seedWorld(1, 4242, { pirates: true });
  const snapshot = await loadPirateSnapshot(f.db, f.seasonId, f.clock.now());
  for (let hour = 1; hour < 14 * 24; hour++) {
    const now = new Date(snapshot.startsAt.getTime() + hour * 3_600_000);
    const standing = snapshot.standing(now);
    if (standing.length < 12) continue;
    f.clock.set(now);
    return { ...f, ids: standing.slice(0, 10).map(spec => pirateId(snapshot.key, spec.index)),
      targets: standing.slice(0, 10), snapshot, count: standing.length };
  }
  throw new Error('No fixture window with twelve pirates');
}

describe('owner-authorized pirate removal', () => {
  it('previews ten, changes no state, then removes them without rewards, reports or debris', async () => {
    const f = await fixture();
    const input = { seasonId: f.seasonId, pirateIds: f.ids, now: f.clock.now() };
    expect(await removePirates(f.db, input)).toMatchObject({ dryRun: true, removing: 10,
      visibleBefore: f.count, visibleAfter: f.count - 10 });
    expect(await f.db.select().from(pirateState)).toEqual([]);
    const reports = await f.db.select().from(battleReports);
    const debris = await f.db.select().from(debrisFields);
    await removePirates(f.db, { ...input, dryRun: false });
    const after = await loadPirateSnapshot(f.db, f.seasonId, f.clock.now());
    expect(after.pirates).toEqual(f.snapshot.pirates);
    expect(after.standing(f.clock.now())).toHaveLength(f.count - 10);
    expect(after.standing(f.clock.now()).every(spec => !f.ids.includes(pirateId(after.key, spec.index)))).toBe(true);
    const rows = await f.db.select().from(pirateState);
    expect(rows).toHaveLength(10);
    expect(rows.every(row => row.destroyedAt?.getTime() === f.clock.now().getTime() && row.destroyedByPlayerId === null)).toBe(true);
    expect(await f.db.select().from(battleReports)).toEqual(reports);
    expect(await f.db.select().from(debrisFields)).toEqual(debris);
  });

  it('preserves existing damage and is idempotent under concurrent retries', async () => {
    const f = await fixture();
    await f.db.insert(pirateState).values({ seasonId: f.seasonId, index: f.targets[0]!.index,
      losses: { DART: 1 }, updatedAt: f.clock.now() });
    const input = { seasonId: f.seasonId, pirateIds: f.ids, now: f.clock.now(), dryRun: false };
    const results = await Promise.all([removePirates(f.db, input), removePirates(f.db, input)]);
    expect(results.map(result => result.removing).sort((a, b) => a - b)).toEqual([0, 10]);
    expect((await f.db.select().from(pirateState)).find(row => row.index === f.targets[0]!.index)?.losses).toEqual({ DART: 1 });
  });

  it.each(['outbound', 'returning'] as const)('protects a pirate targeted by a %s raid without partial removal', async status => {
    const f = await fixture();
    await f.db.insert(pirateRaids).values({ seasonId: f.seasonId, planetId: f.planetIds[0]!,
      ownerPlayerId: f.playerIds[0]!, pirateIndex: f.targets[0]!.index, status, fleet: { DART: 1 },
      interceptX: 0, interceptY: 0, interceptZ: 0, departAt: f.clock.now(),
      arriveAt: new Date(f.clock.now().getTime() + 60_000) });
    const raids = await f.db.select().from(pirateRaids);
    await expect(removePirates(f.db, { seasonId: f.seasonId, pirateIds: f.ids, now: f.clock.now(), dryRun: false })).rejects.toThrow('active raid');
    expect(await f.db.select().from(pirateState)).toEqual([]);
    expect(await f.db.select().from(pirateRaids)).toEqual(raids);
  });

  it('rejects unknown ids, duplicate ids and an empty list without changing state', async () => {
    const f = await fixture();
    for (const ids of [[], [f.ids[0]!, f.ids[0]!], [f.ids[0]!, 'another-season-id']]) {
      await expect(removePirates(f.db, { seasonId: f.seasonId, pirateIds: ids, now: f.clock.now(), dryRun: false })).rejects.toThrow();
    }
    expect(await f.db.select().from(pirateState)).toEqual([]);
  });
});
