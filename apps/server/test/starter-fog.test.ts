import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { accounts } from '../src/db/schema.js';
import { testDb } from './helpers.js';
import { starterWorld } from './starterFixture.js';
import { aboard, get, pass, placeShip, post, type StarterWorld } from './starterShips.js';

afterAll(async () => { await (await testDb()).close(); });

interface Node { id: string; intel: string; country?: string; name?: string; owner?: string; body?: string; look?: string; seenAt?: string; modules?: unknown; progress?: unknown; alloy?: unknown; [k: string]: unknown }
interface Map { planets: Node[] }

/** The map shows what this ship has earned to see, and nothing that a modified client could read. Plan §6. */
describe('what the map shows of another ship', () => {
  let world: StarterWorld;
  const near = 300, far = 800;
  const map = async (headers: Record<string, string>) => (await get<Map>(world, '/api/starter/galaxy', headers)).planets;
  const pair = async (distance: number, modules: Record<string, number>) => {
    const me = await aboard(world, 'Me', { SURVEY: 1, ...modules });
    const other = await aboard(world, 'Secret', { SURVEY: 2, EXTRACTOR: 3 });
    await placeShip(world, me.vesselId, { x: 0 });
    await placeShip(world, other.vesselId, { x: distance });
    return { me, other };
  };

  beforeEach(async () => { world = await starterWorld(); });
  afterEach(async () => { await world.built.close(); });

  // Owner 2026-11-09: a name carries its flag here as it does in the main galaxy.
  it('flies its commander\'s flag once it is named, and none before', async () => {
    const { me, other } = await pair(near, { TELESCOPE: 1 });
    await world.f.db.update(accounts).set({ countryCode: 'DE' }).where(eq(accounts.id, other.id));
    await world.f.db.update(accounts).set({ countryCode: 'FR' }).where(eq(accounts.id, me.id));
    const nodes = await map(me.headers);
    expect(nodes.find(n => n.id === other.vesselId)?.country).toBe('DE');
    expect(nodes.find(n => n.id === me.vesselId)?.country).toBe('FR');
  });

  it('beyond every sensor it is a point: an id, a place and that it is a ship', async () => {
    const { me, other } = await pair(far, {});
    const node = (await map(me.headers)).find(n => n.id === other.vesselId)!;
    expect(Object.keys(node).sort()).toEqual(['body', 'id', 'intel', 'isOwned', 'isSelf', 'position', 'state']);
    expect(node).toMatchObject({ intel: 'UNKNOWN', body: 'VESSEL' });
  });

  it('never carries repair progress, resources or a state of repair, near or far', async () => {
    const { me } = await pair(near, { TELESCOPE: 1 });
    const text = JSON.stringify(await map(me.headers));
    for (const word of ['modules', 'progress', 'alloy', 'crystal', 'facts', 'parts', 'fuel']) expect(text).not.toContain(word);
  });

  it('inside the telescope it has a name, and its hull still reads as a wreck until a probe says otherwise', async () => {
    const { me, other } = await pair(near, { TELESCOPE: 1 });
    const node = (await map(me.headers)).find(n => n.id === other.vesselId)!;
    expect(node).toMatchObject({ intel: 'RESOLVED', name: 'Secret', owner: 'Secret', body: 'VESSEL', look: 'WRECKED', isSelf: false });
  });

  it('just outside the telescope it is still a point', async () => {
    const { me, other } = await pair(460, { TELESCOPE: 1 });
    expect((await map(me.headers)).find(n => n.id === other.vesselId)!.intel).toBe('UNKNOWN');
  });

  it('after a probe it is remembered beyond sensors, as it looked that day', async () => {
    const { me, other } = await pair(far, {});
    await post(world, '/api/starter/probe', me.headers, { targetPlanetId: other.vesselId });
    await pass(world, 3);
    const node = (await map(me.headers)).find(n => n.id === other.vesselId)!;
    expect(node).toMatchObject({ intel: 'REMEMBERED', name: 'Secret' });
    expect(node.seenAt).toBeTruthy();
    expect(['WRECKED', 'PATCHED', 'RENEWED']).toContain(node.look);
  });

  it('holds every ship at Core 1, so the tier band stays shut', async () => {
    const { me, other } = await pair(near, { TELESCOPE: 1 });
    expect((await map(me.headers)).find(n => n.id === other.vesselId)).toMatchObject({ coreLevel: 1, coreTier: 1 });
  });
});
