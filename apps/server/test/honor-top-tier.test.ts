import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { coreTier, honorChallenge } from '@astera/rules';
import { accounts, botProfiles, honorCommitments, honorObservations, honorSeasons, planets, players, seasons } from '../src/db/schema.js';
import { commitHonor, honorCommitmentSchema } from '../src/services/honorCommitment.js';
import { honorBattleEvidence } from '../src/services/honorBattleEvidence.js';
import { honorEvidenceSchema, replayHonor } from '../src/services/honorAccounting.js';
import { prepareHonorSeason } from '../src/services/honorLedger.js';
import { observeHonorOwner } from '../src/services/honorReference.js';
import { strategicHonorEvidence } from '../src/services/honorStrategic.js';
import { honorTargetPreview } from '../src/services/honorTarget.js';
import { launchAttack } from '../src/services/mission.js';
import { giveUnits, fuelUp, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

describe('galaxy top tier frozen with Honor dispatch', () => {
  let f: Fixture;
  beforeEach(async () => {
    f = await seedWorld(3, 7719);
    await setLevel(f.db, f.planetIds[0]!, 'CORE', 22); // tier 8
    await setLevel(f.db, f.planetIds[1]!, 'CORE', 19); // tier 7
    await giveUnits(f.db, f.planetIds[0]!, { DART: 100 });
    // 74 %: just below the weak-target band (2026-10-30), so lifting the leader exception still makes it weak.
    await giveUnits(f.db, f.planetIds[1]!, { DART: 74 });
    await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'SHADOW', f.clock, 4));
    await f.db.update(honorSeasons).set({ mode: 'ACTIVE', rankedAt: f.clock.now() });
  });
  afterAll(async () => { await (await testDb()).close(); });
  const preview = (a = 0, d = 1) => honorTargetPreview(f.db, f.playerIds[a]!, f.planetIds[d]!, f.clock, new Set());
  const request = () => ({ seasonId: f.seasonId, source: 'WORLD' as const, id: randomUUID(),
    attack: [f.playerIds[0]!], defence: [f.playerIds[1]!], at: f.clock.now(), adminUsernames: new Set<string>() });

  it('previews the top-to-adjacent exception and keeps the reverse upward advantage', async () => {
    const before = await f.db.select().from(honorObservations);
    expect(await preview()).toMatchObject({ kind: 'PEER', militaryReturn: 'HALF', topTierPeer: true });
    expect(await preview(1, 0)).toMatchObject({ kind: 'UPPER', militaryReturn: 'FULL' });
    expect(await f.db.select().from(honorObservations)).toEqual(before);
    expect(JSON.stringify(await preview())).not.toMatch(/galaxyTopTier|navy|playerId|accountId/);
  });

  it('does not penalise tied galaxy leaders, and observes a new higher commander before their first action', async () => {
    await setLevel(f.db, f.planetIds[2]!, 'CORE', 22);
    expect(await preview()).toMatchObject({ kind: 'PEER', topTierPeer: true });
    await setLevel(f.db, f.planetIds[2]!, 'CORE', 25);
    expect(await preview()).toMatchObject({ kind: 'WEAK' });
    expect(await preview()).not.toMatchObject({ topTierPeer: true });
  });

  it('honours the existing season peak after a commander loses a high-Core holding', async () => {
    await setLevel(f.db, f.planetIds[2]!, 'CORE', 25);
    await f.db.transaction(tx => observeHonorOwner(tx, f.playerIds[2]!, f.clock.now()));
    await setLevel(f.db, f.planetIds[2]!, 'CORE', 1);
    expect(await preview()).toMatchObject({ kind: 'WEAK' });
  });

  it('does not let a non-competing admin raise the Honor ceiling', async () => {
    await setLevel(f.db, f.planetIds[2]!, 'CORE', 25);
    await f.db.transaction(tx => observeHonorOwner(tx, f.playerIds[2]!, f.clock.now()));
    const [account] = await f.db.select().from(accounts).where(eq(accounts.id, f.accountIds[2]!));
    const excluded = new Set([account!.username]);
    expect(await honorTargetPreview(f.db, f.playerIds[0]!, f.planetIds[1]!, f.clock, excluded))
      .toMatchObject({ kind: 'PEER', topTierPeer: true });
    expect(await f.db.transaction(tx => commitHonor(tx, { ...request(), adminUsernames: excluded })))
      .toMatchObject({ galaxyTopTier: 8 });
  });

  it('lets a bot set the Honor ceiling like any commander', async () => {
    await setLevel(f.db, f.planetIds[2]!, 'CORE', 25);
    await f.db.transaction(tx => observeHonorOwner(tx, f.playerIds[2]!, f.clock.now()));
    await f.db.insert(botProfiles).values({ accountId: f.accountIds[2]!, ordinal: 1, persona: 'RAIDER',
      nextActionAt: f.clock.now(), createdAt: f.clock.now() });
    expect(await preview()).toMatchObject({ kind: 'WEAK' });
    expect(await f.db.transaction(tx => commitHonor(tx, request())))
      .toMatchObject({ galaxyTopTier: coreTier(25) });
  });

  it('ignores high neutral worlds', async () => {
    await setLevel(f.db, f.planetIds[2]!, 'CORE', 25);
    await f.db.update(planets).set({ controllerPlayerId: null, kind: 'NEUTRAL' }).where(eq(planets.id, f.planetIds[2]!));
    expect(await preview()).toMatchObject({ kind: 'PEER', topTierPeer: true });
  });

  it('ignores a different galaxy and the observations of departed commanders', async () => {
    await setLevel(f.db, f.planetIds[2]!, 'CORE', 25);
    await f.db.transaction(tx => observeHonorOwner(tx, f.playerIds[2]!, f.clock.now()));
    const [original] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    const otherId = randomUUID();
    await f.db.insert(seasons).values({ id: otherId, shardId: original!.shardId, cycleId: original!.cycleId,
      seed: 7720, startsAt: original!.endsAt, endsAt: new Date(original!.endsAt.getTime() + 86_400_000) });
    await f.db.update(players).set({ seasonId: otherId }).where(eq(players.id, f.playerIds[2]!));
    await f.db.update(planets).set({ seasonId: otherId }).where(eq(planets.id, f.planetIds[2]!));
    expect(await preview()).toMatchObject({ kind: 'PEER', topTierPeer: true });
  });

  it('freezes the actual raid and a retry cannot replace it after a higher tier appears', async () => {
    await fuelUp(f.db, f.planetIds[0]!);
    const launch = await launchAttack(f.db, f.planetIds[0]!, f.planetIds[1]!, { DART: 5 }, f.clock);
    const [row] = await f.db.select().from(honorCommitments).where(eq(honorCommitments.sourceId, launch.missionId));
    expect(row?.snapshot).toMatchObject({ galaxyTopTier: 8 });
    await setLevel(f.db, f.planetIds[2]!, 'CORE', 25);
    const frozen = await f.db.transaction(tx => commitHonor(tx, { ...request(), id: launch.missionId }));
    expect(frozen).toEqual(row!.snapshot);
    expect(await f.db.transaction(tx => commitHonor(tx, request()))).toMatchObject({ galaxyTopTier: 9 });
  });

  it('carries the frozen tier into military and strategic evidence, preserving reverse defensive credit', async () => {
    const frozen = await f.db.transaction(tx => commitHonor(tx, request()));
    if (!frozen) throw new Error('Missing commitment');
    await setLevel(f.db, f.planetIds[2]!, 'CORE', 25);
    expect(await preview()).toMatchObject({ kind: 'WEAK' });
    const [config] = await f.db.select().from(honorSeasons);
    const stack = (id: string, losses: number) => ({ id, sent: { DART: 5 }, active: { DART: 5 },
      losses: { DART: losses }, rebuilt: {}, lootLost: { alloy: 0, crystal: 0, deuterium: 0 }, defenceNavy: frozen.defence[0]!.navy });
    const military = honorBattleEvidence({ catalogue: config!.catalogue, commitment: frozen,
      source: 'WORLD', id: 'military', at: frozen.at + 1,
      attack: [stack(f.playerIds[0]!, 1)], defence: [stack(f.playerIds[1]!, 4)] });
    const strategic = strategicHonorEvidence(frozen, 'strategic', new Date(frozen.at + 2));
    expect(military).toMatchObject({ galaxyTopTier: 8 });
    expect(strategic).toMatchObject({ galaxyTopTier: 8 });
    strategic.tactical = [{ actor: f.playerIds[0]!, enemy: f.playerIds[1]!, base: 4_000_000, pressureFifths: 160_000 }];
    const result = replayHonor([strategic, military], 4);
    expect(result.events[0]!.pool.attack.exposures[0]?.bullying).toBe(false);
    expect(result.events[0]!.attack.total).toBeGreaterThan(0);
    expect(result.events[1]!.attack.total).toBeGreaterThan(0);
    const { galaxyTopTier: _top, ...legacy } = honorEvidenceSchema.parse(military);
    expect(replayHonor([legacy], 4).events[0]!.attack.total).toBeLessThan(0);
    expect(replayHonor([legacy], 4).events[0]!.pool.defence).toEqual(result.events[0]!.pool.defence);
  });

  it('serialises duplicate dispatch and rolls back a failed dispatch with its tier snapshot', async () => {
    const input = request();
    const rows = await Promise.allSettled([f.db.transaction(tx => commitHonor(tx, input)), f.db.transaction(tx => commitHonor(tx, input))]);
    expect(rows[0]).toEqual(rows[1]);
    expect(rows[0]).toMatchObject({ status: 'fulfilled', value: { galaxyTopTier: 8 } });
    await expect(f.db.transaction(async tx => { await commitHonor(tx, request()); throw new Error('abort'); }))
      .rejects.toThrow('abort');
    expect(await f.db.select().from(honorCommitments)).toHaveLength(1);
  });

  it('keeps simultaneous and delayed replay deterministic', () => {
    const member = (id: string, tier: number, navy: number, loss = 0) => ({ id, tier, navy, weight: 100_000,
      civilianWeight: 0, loss, combatLoss: loss, lootLost: 0 });
    const event = (id: string, at: number) => ({ source: 'WORLD' as const, id, at, galaxyTopTier: 8, eligible: true,
      attack: [member('A', 8, 100_000)], defence: [member('D', 7, 99_000, 1000)],
      relations: [{ a: 'A', b: 'D', related: false }] });
    const events = [event('a', 1), event('b', 1), event('c', 2)];
    const result = replayHonor(events, 4);
    expect(result).toEqual(replayHonor([...events].reverse(), 4));
    expect(result.events.every(row => row.attack.total > 0 && !row.pool.attack.exposures[0]!.bullying)).toBe(true);
    expect(result.repeats).toHaveLength(0);
  });

  it('preserves retaliation credit and historical outcomes when the leader exception is introduced', () => {
    const member = (id: string, tier: number, navy: number, loss = 0) => ({ id, tier, navy, weight: 100_000,
      civilianWeight: 0, loss, combatLoss: loss, lootLost: 0 });
    const prior = { source: 'WORLD' as const, id: 'prior', at: 1, eligible: true,
      attack: [member('D', 7, 99_000)], defence: [member('A', 8, 100_000, 1000)],
      relations: [{ a: 'D', b: 'A', related: false }] };
    const counter = { source: 'WORLD' as const, id: 'counter', at: 2, eligible: true, galaxyTopTier: 8,
      attack: [member('A', 8, 100_000)], defence: [member('D', 7, 99_000, 1000)],
      relations: [{ a: 'A', b: 'D', related: false }] };
    const before = replayHonor([prior], 4), after = replayHonor([counter, prior], 4);
    expect(after.events[0]).toEqual(before.events[0]);
    expect(after.retaliations.filter(row => row.holder === 'A')).toEqual(before.retaliations);
    expect(after.retaliations.some(row => row.holder === 'D' && row.opponent === 'A' && row.remaining === 5000)).toBe(true);
    expect(after.repeats).toHaveLength(0);
    expect(after.events[1]!.pool.attack.exposures[0]).toMatchObject({ bullying: false, retaliationSpentFifths: 0 });
    expect(after.events[1]!.attack.total).toBeGreaterThan(0);
  });

  it('accepts old snapshots and rejects malformed top-tier evidence', () => {
    const base = { version: 4, at: 1, referenceOrder: 0, eligible: true,
      attack: [{ id: 'A', tier: 8, navy: 100 }], defence: [{ id: 'D', tier: 7, navy: 99 }],
      relations: [{ a: 'A', b: 'D', related: false }] };
    expect(honorCommitmentSchema.parse(base)).not.toHaveProperty('galaxyTopTier');
    for (const galaxyTopTier of [0, -1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1, '8', null]) {
      expect(() => honorCommitmentSchema.parse({ ...base, galaxyTopTier })).toThrow();
    }
    const legacy = honorCommitmentSchema.parse(base);
    expect(honorChallenge({ ownTier: legacy.attack[0]!.tier, enemyTier: legacy.defence[0]!.tier,
      ownNavy: 100, enemyNavy: 99 }).kind).toBe('WEAK');
  });
});
