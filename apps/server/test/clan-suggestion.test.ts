import { CLAN } from '@astera/rules';
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { players, seasons, starterDepartures, starterGalaxies } from '../src/db/schema.js';
import { clanActor, createClan } from '../src/services/clan.js';
import { clanSuggestion, pickClan } from '../src/services/clanSuggestion.js';
import { grant, levelWorld, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

afterAll(async () => { await (await testDb()).close(); });

const HOUR = 3_600_000;

/**
 * A CLAN ON THE FIRST DAY (plan 2026-11-06 §7.3, Faz 4.5). The landing day suggests one clan: first one
 * where a former starter neighbour is, active in the last three days and with a free seat; else any active
 * clan with a free seat. Never to a commander already in one, never after the first day.
 */
describe('the clan suggested on the landing day', () => {
  let f: Fixture;
  let galaxyId: string;
  const me = () => f.accountIds[3]!;

  const found = async (index: number, tag: string, recruiting = true) => {
    const actor = await clanActor(f.db, f.accountIds[index]!);
    const result = await f.db.transaction(tx => createClan(tx, { actor, name: `Clan ${tag}`, tag, description: '', recruiting, clock: f.clock }));
    return result.clanId;
  };
  const departed = async (index: number, hoursAgo: number, galaxy = galaxyId) => {
    await f.db.insert(starterDepartures).values({ starterGalaxyId: galaxy, accountId: f.accountIds[index]!, displayName: `C${String(index)}`, countryCode: 'TR', x: 0, y: 0, z: 0, at: new Date(f.clock.now().getTime() - hoursAgo * HOUR) });
  };

  beforeEach(async () => {
    f = await seedWorld(5, 515151);
    await f.db.update(seasons).set({ rulesetVersion: 3 }).where(eq(seasons.id, f.seasonId));
    await levelWorld(f.db, f.planetIds);
    for (const planetId of f.planetIds) { await grant(f.db, planetId, 120_000, 60_000); await setLevel(f.db, planetId, 'CORE', CLAN.founderCoreLevel); }
    const [season] = await f.db.select({ shardId: seasons.shardId }).from(seasons).where(eq(seasons.id, f.seasonId));
    const [galaxy] = await f.db.insert(starterGalaxies).values({ shardId: season!.shardId, ordinal: 1, seed: 7, epoch: f.clock.now(), capacity: 30 }).returning();
    galaxyId = galaxy!.id;
  });

  it('prefers the clan a former neighbour is in', async () => {
    await found(0, 'AAA');
    const neighbours = await found(1, 'BBB');
    await departed(1, 30);
    await departed(3, 2);
    expect(await clanSuggestion(f.db, me(), f.clock.now())).toMatchObject({ id: neighbours, tag: 'BBB', neighbours: 1 });
  });

  it('falls back to any active clan with a seat', async () => {
    const any = await found(0, 'AAA');
    await departed(3, 2);
    expect(await clanSuggestion(f.db, me(), f.clock.now())).toMatchObject({ id: any, neighbours: 0 });
  });

  it('suggests nothing after the first day, or without a landing', async () => {
    await found(0, 'AAA');
    expect(await clanSuggestion(f.db, me(), f.clock.now())).toBeNull();
    await departed(3, 25);
    expect(await clanSuggestion(f.db, me(), f.clock.now())).toBeNull();
  });

  it('suggests nothing to a commander already in a clan, and skips a closed or idle one', async () => {
    await found(0, 'AAA', false);
    const idle = await found(1, 'BBB');
    await f.db.update(players).set({ lastActiveAt: new Date(f.clock.now().getTime() - 4 * 24 * HOUR) }).where(eq(players.id, f.playerIds[1]!));
    await departed(3, 2);
    expect(await clanSuggestion(f.db, me(), f.clock.now())).toBeNull();
    expect(idle).toBeTruthy();
    await found(3, 'MEE');
    expect(await clanSuggestion(f.db, me(), f.clock.now())).toBeNull();
  });
});

describe('which clan wins', () => {
  const now = new Date('2026-11-17T12:00:00Z');
  const clan = (id: string, members: number, neighbours: number, activeHoursAgo: number) => ({ id, name: id, tag: id, members, neighbours, lastActiveAt: new Date(now.getTime() - activeHoursAgo * HOUR) });
  it('passes over a full clan, then ranks neighbours, then recent activity', () => {
    expect(pickClan([clan('full', 5, 3, 1), clan('near', 2, 1, 50), clan('busy', 4, 0, 1)], now)?.id).toBe('near');
    expect(pickClan([clan('old', 2, 0, 60), clan('new', 2, 0, 1)], now)?.id).toBe('new');
    expect(pickClan([clan('full', 5, 0, 1)], now)).toBeNull();
  });
});
