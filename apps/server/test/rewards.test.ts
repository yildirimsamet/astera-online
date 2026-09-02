import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { REWARD_CHAINS, SERVERS, alloyRate, rewardId, storageCap } from '@astera/rules';
import {
  accountRewards,
  accounts,
  buildings,
  miningRuns,
  missions,
  planets,
  players,
  rewardGrants,
} from '../src/db/schema.js';
import { buildUnits } from '../src/services/build.js';
import { launchAttack } from '../src/services/mission.js';
import { launchProbe } from '../src/services/intel.js';
import { claimReward, grantReward, rewardsView } from '../src/services/rewards.js';
import { reclaimIdleSeats } from '../src/services/reclaim.js';
import { createSeason } from '../src/services/season.js';
import { joinSeason } from '../src/services/player.js';
import { GameError } from '../src/services/planet.js';
import {
  giveInstrument,
  giveSatellite,
  giveUnits,
  grant,
  levelWorld,
  seedWorld,
  settleBuilds,
  setLevel,
  testDb,
  type Fixture,
} from './helpers.js';

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

/**
 * REWARDS — the newest place in the game where resources come from nowhere.
 *
 * Two properties carry everything here, and neither is "the numbers are right".
 *
 *   PROGRESS IS COUNTED, NEVER ACCUMULATED. There is no counter table and no
 *   listener on the event queue: ten of the eleven chains are read off rows the
 *   game keeps anyway. So the tests below arrange the WORLD — fly a probe, raid a
 *   neighbour, finish a run — and assert the panel notices, because that is the
 *   only mechanism there is.
 *
 *   A TIER IS PAID ONCE. It is the only path in the game that hands out alloy and
 *   crystal on request, so "twice" is the failure that matters and it is attacked
 *   from three directions: the same claim repeated, two claims racing, and the
 *   same tier addressed by a differently-spelt id.
 */
describe('rewards', () => {
  let f: Fixture;
  let mine: string;
  let other: string;

  const chainOf = async (id: string) => {
    const view = await rewardsView(f.db, mine, f.clock);
    return view.chains.find((c) => c.id === id)!;
  };

  const stateOf = async (id: string, goal: number) =>
    (await chainOf(id)).tiers.find((t) => t.goal === goal)?.state;

  beforeEach(async () => {
    f = await seedWorld(3);
    mine = f.planetIds[0]!;
    other = f.planetIds[1]!;
    await levelWorld(f.db, f.planetIds);
  });

  /* ── what the panel counts ─────────────────────────────────── */

  it('starts a fresh commander with everything locked and nothing to claim', async () => {
    const view = await rewardsView(f.db, mine, f.clock);
    expect(view.claimable).toBe(0);
    expect(view.chains).toHaveLength(REWARD_CHAINS.length);
    expect(view.chains.every((c) => c.tiers.every((t) => t.state === 'locked'))).toBe(true);
  });

  it('counts a probe the moment it launches, because sending it IS the act', async () => {
    await grant(f.db, mine, 5_000, 2_000);
    await giveSatellite(f.db, mine, 'UPLINK');
    await giveInstrument(f.db, mine, 'TELESCOPE', 1);

    await launchProbe(f.db, mine, other, f.clock);

    expect((await chainOf('PROBE')).progress).toBe(1);
    expect(await stateOf('PROBE', 1)).toBe('claimable');
    expect(await stateOf('PROBE', 3)).toBe('locked');
  });

  /**
   * THE RULE THE CHAIN EXISTS TO TEACH. Farming one neighbour is what
   * `BASH_LIMIT` suppresses, so a reward that paid for it would be the game
   * buying what the game refuses.
   */
  it('counts raided WORLDS, so hitting the same one twice is still one', async () => {
    await grant(f.db, mine, 20_000, 8_000);
    // `grant` raises the Core to whatever will hold the money, which on its own
    // puts this planet several development tiers above its neighbours and gets
    // every launch refused for a reason this test is not about. See the helper.
    await levelWorld(f.db, f.planetIds);
    await giveUnits(f.db, mine, { DART: 20 });

    await launchAttack(f.db, mine, other, { DART: 2 }, f.clock);
    expect((await chainOf('RAID')).progress).toBe(1);

    // Land the first one before sending the second: a planet may only have one
    // fleet committed to a given target at a time, which is a launch rule and not
    // the counting rule under test here.
    await f.db.update(missions).set({ status: 'resolved' }).where(eq(missions.originPlanetId, mine));
    await launchAttack(f.db, mine, other, { DART: 2 }, f.clock);
    expect((await chainOf('RAID')).progress).toBe(1);

    await launchAttack(f.db, mine, f.planetIds[2]!, { DART: 2 }, f.clock);
    expect((await chainOf('RAID')).progress).toBe(2);
  });

  /**
   * A run that is still outbound has decided nothing — the rock may be stripped
   * before the craft arrives, which is the whole race D19 creates. The status flip
   * happens in the arrival handler, at the moment the ore is actually claimed.
   */
  it('counts a drill that ARRIVED, never one that merely left', async () => {
    const [run] = await f.db
      .insert(miningRuns)
      .values({
        seasonId: f.seasonId,
        planetId: mine,
        targetKind: 'asteroid',
        asteroidIndex: 3,
        status: 'outbound',
        craft: 1,
        holdEach: 100,
        interceptX: 0,
        interceptY: 0,
        interceptZ: 0,
        departAt: f.clock.now(),
        arriveAt: f.clock.now(),
      })
      .returning();

    expect((await chainOf('MINE')).progress).toBe(0);

    await f.db.update(miningRuns).set({ status: 'returning' }).where(eq(miningRuns.id, run!.id));
    expect((await chainOf('MINE')).progress).toBe(1);
    expect(await stateOf('MINE', 1)).toBe('claimable');
    // A rock is not a wreck. One counter per target kind, or salvaging would pay twice.
    expect((await chainOf('SALVAGE')).progress).toBe(0);
  });

  /**
   * `abandon()` cancels a flight whose scheduled event failed for good and hands
   * the ships back. Nothing was scouted and nothing was fought, so paying for it
   * would mean the game handing out alloy for its own worker falling over.
   */
  it('does not count a flight the server had to abandon', async () => {
    await grant(f.db, mine, 20_000, 8_000);
    await levelWorld(f.db, f.planetIds);
    await giveUnits(f.db, mine, { DART: 20 });
    await launchAttack(f.db, mine, other, { DART: 2 }, f.clock);
    expect((await chainOf('RAID')).progress).toBe(1);

    await f.db
      .update(missions)
      .set({ status: 'cancelled' })
      .where(eq(missions.originPlanetId, mine));
    expect((await chainOf('RAID')).progress).toBe(0);
  });

  it('reads a building level as it stands, with no history to replay', async () => {
    await setLevel(f.db, mine, 'CORE', 5);
    const core = await chainOf('CORE');
    expect(core.progress).toBe(5);
    expect(core.metric).toBe('level');
    expect(await stateOf('CORE', 3)).toBe('claimable');
    expect(await stateOf('CORE', 5)).toBe('claimable');
    expect(await stateOf('CORE', 7)).toBe('locked');
  });

  it('reads the Aegis as an instrument, not a satellite', async () => {
    expect((await chainOf('AEGIS')).progress).toBe(0);
    await giveInstrument(f.db, mine, 'AEGIS', 1);
    expect(await stateOf('AEGIS', 1)).toBe('claimable');
  });

  /**
   * THE ONE STORED TALLY, AND THE REASON IT HAS TO BE STORED.
   *
   * `units` is a live count that goes DOWN — a squadron that dies takes its row
   * with it — so "how many have you ever built" is unrecoverable from the world.
   * The second half of this test is the one that matters: losing the ships must
   * not lose the progress.
   */
  it('remembers ships that were built and then destroyed', async () => {
    await grant(f.db, mine, 20_000, 8_000);
    await setLevel(f.db, mine, 'SHIPYARD', 1);
    await buildUnits(f.db, mine, 'DART', 6, f.clock);
    await settleBuilds(f, mine);

    expect((await chainOf('SHIPS')).progress).toBe(6);
    expect(await stateOf('SHIPS', 5)).toBe('claimable');

    // Every Wasp dies.
    await giveUnits(f.db, mine, { DART: 0 });
    expect((await chainOf('SHIPS')).progress).toBe(6);
  });

  it('counts hulls separately, so a Prospector is not a Wasp', async () => {
    await grant(f.db, mine, 20_000, 8_000);
    await setLevel(f.db, mine, 'SHIPYARD', 2);
    await buildUnits(f.db, mine, 'DART', 2, f.clock);
    await buildUnits(f.db, mine, 'PROSPECTOR', 1, f.clock);
    await settleBuilds(f, mine);

    const [row] = await f.db.select().from(planets).where(eq(planets.id, mine));
    expect(row?.builtEver).toEqual({ DART: 2, PROSPECTOR: 1 });
    expect((await chainOf('SHIPS')).progress).toBe(2);
  });

  /* ── taking one ────────────────────────────────────────────── */

  it('pays what the tier says, into storage, and says so', async () => {
    await setLevel(f.db, mine, 'CORE', 3);
    const [before] = await f.db.select().from(planets).where(eq(planets.id, mine));

    const result = await claimReward(f.db, mine, rewardId('CORE', 3), f.clock);
    const tier = REWARD_CHAINS.find((c) => c.id === 'CORE')!.tiers[0]!.reward;

    expect(result.granted).toEqual({
      alloy: tier.alloy,
      crystal: tier.crystal,
      deuterium: tier.deuterium,
    });

    const [after] = await f.db.select().from(planets).where(eq(planets.id, mine));
    expect(after!.alloy).toBeCloseTo(before!.alloy + tier.alloy, 4);
    expect(after!.crystal).toBeCloseTo(before!.crystal + tier.crystal, 4);
  });

  /**
   * ABOVE THE CAP ON PURPOSE, and this is the test that keeps it that way.
   *
   * `OPENING_BONUS` already grants above the storage ceiling and its docblock
   * explains why: nothing in this game clamps stored resources downward, so the
   * grant is never silently lost, and a player who is briefly over their ceiling
   * has money to spend rather than money to sit on. Clamping instead would make a
   * reward evaporate at the exact moment it was earned.
   */
  it('grants above the storage ceiling rather than losing the difference', async () => {
    await setLevel(f.db, mine, 'CORE', 3);

    // Sit the store exactly ON its ceiling, so the whole grant has nowhere to go.
    const [refinery] = await f.db
      .select()
      .from(buildings)
      .where(and(eq(buildings.planetId, mine), eq(buildings.type, 'REFINERY')));
    const [vault] = await f.db
      .select()
      .from(buildings)
      .where(and(eq(buildings.planetId, mine), eq(buildings.type, 'VAULT')));
    const cap = storageCap(alloyRate(refinery?.level ?? 0), vault?.level ?? 0);
    await f.db.update(planets).set({ alloy: cap }).where(eq(planets.id, mine));

    const tier = REWARD_CHAINS.find((c) => c.id === 'CORE')!.tiers[0]!.reward;
    const result = await claimReward(f.db, mine, rewardId('CORE', 3), f.clock);

    // Every last unit landed, and the total is legitimately over the ceiling.
    expect(result.granted.alloy).toBe(tier.alloy);
    expect(result.planet.planet.alloy).toBe(Math.floor(cap + tier.alloy));
    expect(result.planet.planet.alloy).toBeGreaterThan(result.planet.planet.alloyCap);
  });

  it('answers with the rewards view as well as the planet, so nothing refetches', async () => {
    await setLevel(f.db, mine, 'CORE', 3);
    const result = await claimReward(f.db, mine, rewardId('CORE', 3), f.clock);

    const tier = result.rewards.chains
      .find((c) => c.id === 'CORE')!
      .tiers.find((t) => t.goal === 3)!;
    expect(tier.state).toBe('claimed');
    expect(result.rewards).toEqual(await rewardsView(f.db, mine, f.clock));
  });

  it('refuses a tier that has not been earned, and says how far off it is', async () => {
    await setLevel(f.db, mine, 'CORE', 3);
    await expect(claimReward(f.db, mine, rewardId('CORE', 9), f.clock)).rejects.toMatchObject({
      code: 'REWARD_LOCKED',
      params: { goal: 9, progress: 3 },
    });
  });

  it('refuses an id nobody authored', async () => {
    for (const id of ['', 'CORE', 'CORE:4', 'NOPE:1', 'CORE:3:3', 'CORE:3e0']) {
      await expect(claimReward(f.db, mine, id, f.clock)).rejects.toBeInstanceOf(GameError);
    }
  });

  /* ── and only once ─────────────────────────────────────────── */

  it('pays a tier once, however many times it is asked for', async () => {
    await setLevel(f.db, mine, 'CORE', 3);
    await claimReward(f.db, mine, rewardId('CORE', 3), f.clock);

    const [after] = await f.db.select().from(planets).where(eq(planets.id, mine));
    await expect(claimReward(f.db, mine, rewardId('CORE', 3), f.clock)).rejects.toMatchObject({
      code: 'REWARD_TAKEN',
    });

    const [still] = await f.db.select().from(planets).where(eq(planets.id, mine));
    expect(still!.alloy).toBeCloseTo(after!.alloy, 4);
  });

  /**
   * TWO TAPS THAT NEVER SEE EACH OTHER'S READ.
   *
   * The check that a tier is unclaimed happens before the write, which on its own
   * is exactly the check-then-act shape the planet row lock exists for. This is
   * the test that proves the lock and the primary key are both actually doing it —
   * with either one removed, both of these settle and the reward is paid twice.
   */
  it('pays once when two claims race', async () => {
    await setLevel(f.db, mine, 'CORE', 3);
    const [before] = await f.db.select().from(planets).where(eq(planets.id, mine));

    const results = await Promise.allSettled([
      claimReward(f.db, mine, rewardId('CORE', 3), f.clock),
      claimReward(f.db, mine, rewardId('CORE', 3), f.clock),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);

    const tier = REWARD_CHAINS.find((c) => c.id === 'CORE')!.tiers[0]!.reward;
    const [after] = await f.db.select().from(planets).where(eq(planets.id, mine));
    expect(after!.alloy).toBeCloseTo(before!.alloy + tier.alloy, 4);

    const rows = await f.db.select().from(rewardGrants).where(eq(rewardGrants.playerId, f.playerIds[0]!));
    expect(rows).toHaveLength(1);
  });

  /* ── the one a human decides ───────────────────────────────── */

  it('leaves the social bonus unclaimable until somebody writes the grant', async () => {
    expect(await stateOf('SOCIAL', 1)).toBe('locked');
    await expect(claimReward(f.db, mine, rewardId('SOCIAL', 1), f.clock)).rejects.toMatchObject({
      code: 'REWARD_NOT_GRANTED',
    });
  });

  it('becomes claimable when the operator grants it, and pays through the normal path', async () => {
    const [row] = await f.db.select().from(players).where(eq(players.id, f.playerIds[0]!));

    const granted = await grantReward(f.db, row!.name, rewardId('SOCIAL', 1));
    expect(granted.already).toBe(false);
    expect(await stateOf('SOCIAL', 1)).toBe('claimable');

    const result = await claimReward(f.db, mine, rewardId('SOCIAL', 1), f.clock);
    expect(result.granted.alloy).toBeGreaterThan(0);
    expect(await stateOf('SOCIAL', 1)).toBe('claimed');
  });

  /** The operator reads direct messages on a phone and WILL run it twice. */
  it('is idempotent when the operator grants the same commander twice', async () => {
    const [row] = await f.db.select().from(players).where(eq(players.id, f.playerIds[0]!));

    expect((await grantReward(f.db, row!.name, rewardId('SOCIAL', 1))).already).toBe(false);
    expect((await grantReward(f.db, row!.name, rewardId('SOCIAL', 1))).already).toBe(true);

    // Against the ACCOUNT: the follow bonus is `scope: 'account'`, so the row that
    // makes it once-only outlives the season this commander happens to be in.
    const rows = await f.db
      .select()
      .from(accountRewards)
      .where(eq(accountRewards.accountId, row!.accountId));
    expect(rows).toHaveLength(1);
  });

  /**
   * A GRANT THAT ARRIVES AFTER THE CLAIM MUST NOT RE-OPEN IT.
   *
   * The insert is `onConflictDoUpdate ... where claimed_at is null`, and this is
   * the case that clause exists for: an operator running the command a second time
   * on somebody who has already taken it.
   */
  it('does not un-claim a taken reward when the operator grants it again', async () => {
    const [row] = await f.db.select().from(players).where(eq(players.id, f.playerIds[0]!));

    await grantReward(f.db, row!.name, rewardId('SOCIAL', 1));
    await claimReward(f.db, mine, rewardId('SOCIAL', 1), f.clock);
    await grantReward(f.db, row!.name, rewardId('SOCIAL', 1));

    expect(await stateOf('SOCIAL', 1)).toBe('claimed');
    await expect(claimReward(f.db, mine, rewardId('SOCIAL', 1), f.clock)).rejects.toMatchObject({
      code: 'REWARD_TAKEN',
    });
  });

  /**
   * THE TURKISH TRAP, WHICH THIS CODEBASE HAS ALREADY PAID FOR ONCE.
   *
   * `'İ'.toLowerCase()` is `i` PLUS A COMBINING DOT — in JavaScript and in
   * Postgres alike — so the obvious `lower(name) = lower($1)` never matches a
   * commander whose name starts with a dotted capital I. Roughly half this game's
   * players are Turkish; the operator would be told no such commander exists
   * while looking at their message.
   *
   * The name is therefore compared AS WRITTEN. This test is what stops somebody
   * reintroducing the fold as a convenience.
   */
  it('finds a Turkish commander name written as the player writes it', async () => {
    const [row] = await f.db.select().from(players).where(eq(players.id, f.playerIds[0]!));
    await f.db.update(accounts).set({ displayName: 'İhsan' }).where(eq(accounts.id, row!.accountId));

    const granted = await grantReward(f.db, 'İhsan', rewardId('SOCIAL', 1));
    expect(granted.player).toBe('İhsan');
    expect(await stateOf('SOCIAL', 1)).toBe('claimable');
  });

  /**
   * And the convenience that IS safe: the username was folded on the way in by
   * `normaliseUsername`, so folding the operator's input with the same function
   * compares a value against itself rather than across an alphabet.
   */
  it('also accepts the username in any case, because that one was folded on the way in', async () => {
    const [account] = await f.db
      .select()
      .from(accounts)
      .where(eq(accounts.id, f.accountIds[0]!));

    const granted = await grantReward(f.db, account!.username.toUpperCase(), rewardId('SOCIAL', 1));
    expect(granted.already).toBe(false);
    expect(await stateOf('SOCIAL', 1)).toBe('claimable');
  });

  it('refuses a commander nobody has heard of', async () => {
    await expect(grantReward(f.db, 'nobody-at-all', rewardId('SOCIAL', 1))).rejects.toMatchObject({
      code: 'PLAYER_NOT_FOUND',
    });
  });

  /**
   * THE RACE THE PLANET LOCK DOES NOT COVER, AND THE ONLY GUARD LEFT STANDING.
   *
   * Every other claim test races two requests at ONE world, so `withPlanetLock`
   * serialises them and the insert's conflict clause is never actually reached.
   * Since D97 a commander holds a capital and up to three colonies, so two taps
   * on two worlds take two DIFFERENT row locks — and for a reward paid once per
   * account there is nothing between them but `ON CONFLICT ... WHERE claimed_at
   * IS NULL` and the check on what it returned. That is exactly the pair the
   * docblock calls belt and braces; this is the test that takes the belt off.
   *
   * One payment, one row, and the second request refused rather than quietly
   * paying a second world.
   */
  it('pays the follow bonus once when two of a commander\'s worlds claim it at once', async () => {
    const [row] = await f.db.select().from(players).where(eq(players.id, f.playerIds[0]!));
    await grantReward(f.db, row!.name, rewardId('SOCIAL', 1));

    // A second world under the same commander. Any world they control may open
    // the panel, and the reward lands wherever it was claimed from.
    const colony = f.planetIds[2]!;
    await f.db
      .update(planets)
      .set({ kind: 'COLONY', controllerPlayerId: f.playerIds[0]! })
      .where(eq(planets.id, colony));

    const [capitalBefore] = await f.db.select().from(planets).where(eq(planets.id, mine));
    const [colonyBefore] = await f.db.select().from(planets).where(eq(planets.id, colony));

    const results = await Promise.allSettled([
      claimReward(f.db, mine, rewardId('SOCIAL', 1), f.clock),
      claimReward(f.db, colony, rewardId('SOCIAL', 1), f.clock),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);

    expect(
      await f.db
        .select()
        .from(accountRewards)
        .where(eq(accountRewards.accountId, f.accountIds[0]!)),
    ).toHaveLength(1);

    const tier = REWARD_CHAINS.find((c) => c.id === 'SOCIAL')!.tiers[0]!.reward;
    const [capitalAfter] = await f.db.select().from(planets).where(eq(planets.id, mine));
    const [colonyAfter] = await f.db.select().from(planets).where(eq(planets.id, colony));
    const paid =
      (capitalAfter!.alloy - capitalBefore!.alloy) + (colonyAfter!.alloy - colonyBefore!.alloy);
    expect(paid).toBeCloseTo(tier.alloy, 4);
  });

  /* ── once per person, not once per season ──────────────────── */

  /**
   * THE BONUS IS PAID TO A HUMAN BEING, AND HUMANS OUTLIVE GALAXIES. Owner
   * instruction: *"twitter takip bonusu kişiye 1 kez verilebilmeli. her sezon her
   * sezon alamaz."*
   *
   * The whole failure was one key. `reward_grants` is keyed on `players`, and a
   * player row is deleted by a wipe and by the idle-seat reclaim — so the moment
   * the seat turned over, the ledger said this account had never been paid, and
   * the operator's command said `already: false` and wrote a second grant. A
   * follower who joined in the first galaxy could collect 1,000 alloy and 500
   * crystal every fortnight for ever, for one follow they performed once.
   *
   * These three tests are the fix seen from its three surfaces: where the row is
   * written, what the panel says in the NEXT galaxy, and what the operator is told
   * when the direct message arrives a second time.
   */
  it('writes the follow bonus against the account, not against the season player', async () => {
    const [row] = await f.db.select().from(players).where(eq(players.id, f.playerIds[0]!));
    await grantReward(f.db, row!.name, rewardId('SOCIAL', 1));

    expect(
      await f.db
        .select()
        .from(accountRewards)
        .where(eq(accountRewards.accountId, f.accountIds[0]!)),
    ).toHaveLength(1);
    // Nothing season-scoped was written: the two ledgers must not both hold it,
    // because two records of one payment is how a second payment starts.
    expect(
      await f.db.select().from(rewardGrants).where(eq(rewardGrants.playerId, f.playerIds[0]!)),
    ).toHaveLength(0);
  });

  /**
   * The real thing, end to end: take the bonus, lose the seat to the idle sweep,
   * join the next galaxy with the same account, and find the card already taken.
   */
  it('stays taken in the next galaxy, after the seat has been reclaimed', async () => {
    const [row] = await f.db.select().from(players).where(eq(players.id, f.playerIds[0]!));
    await grantReward(f.db, row!.name, rewardId('SOCIAL', 1));
    await claimReward(f.db, mine, rewardId('SOCIAL', 1), f.clock);

    const away = new Date(f.clock.now().getTime() - (SERVERS.idleDays + 1) * 24 * 60 * 60_000);
    await f.db
      .update(players)
      .set({ lastActiveAt: away, joinedAt: away })
      .where(eq(players.id, f.playerIds[0]!));
    expect((await reclaimIdleSeats(f.db, f.clock)).reclaimed).toHaveLength(1);

    const { season } = await createSeason(f.db, {
      shardCode: 'EU-TEST-NEXT',
      seed: 909,
      startsAt: f.clock.now(),
      playerCap: 60,
      rulesetVersion: 1,
    });
    const next = await joinSeason(f.db, f.accountIds[0]!, season.id, f.clock);

    const view = await rewardsView(f.db, next.planetId, f.clock);
    const social = view.chains.find((c) => c.id === 'SOCIAL')!;
    expect(social.scope).toBe('account');
    expect(social.progress).toBe(1);
    expect(social.tiers[0]?.state).toBe('claimed');
    await expect(
      claimReward(f.db, next.planetId, rewardId('SOCIAL', 1), f.clock),
    ).rejects.toMatchObject({ code: 'REWARD_TAKEN' });
  });

  /**
   * And the operator's side of it. They are reading a direct message on a phone
   * and have no way to know this commander was paid two galaxies ago — so the
   * command has to be the thing that knows.
   */
  it('tells the operator the bonus is already theirs, seasons later', async () => {
    const [row] = await f.db.select().from(players).where(eq(players.id, f.playerIds[0]!));
    await grantReward(f.db, row!.name, rewardId('SOCIAL', 1));
    await claimReward(f.db, mine, rewardId('SOCIAL', 1), f.clock);

    const away = new Date(f.clock.now().getTime() - (SERVERS.idleDays + 1) * 24 * 60 * 60_000);
    await f.db
      .update(players)
      .set({ lastActiveAt: away, joinedAt: away })
      .where(eq(players.id, f.playerIds[0]!));
    await reclaimIdleSeats(f.db, f.clock);

    // Between galaxies, with no world at all — the account is still the person who
    // followed us, and the grant still knows it.
    const again = await grantReward(f.db, row!.name, rewardId('SOCIAL', 1));
    expect(again.already).toBe(true);
    expect(
      await f.db
        .select()
        .from(accountRewards)
        .where(eq(accountRewards.accountId, f.accountIds[0]!)),
    ).toHaveLength(1);
  });

  /* ── the badge ─────────────────────────────────────────────── */

  it('counts what is waiting, and stops counting it once taken', async () => {
    await setLevel(f.db, mine, 'CORE', 5);
    expect((await rewardsView(f.db, mine, f.clock)).claimable).toBe(2);

    await claimReward(f.db, mine, rewardId('CORE', 3), f.clock);
    expect((await rewardsView(f.db, mine, f.clock)).claimable).toBe(1);
  });

  /** One planet's progress is its own. Nothing here reads across the galaxy. */
  it('does not count a neighbour’s work as yours', async () => {
    await grant(f.db, other, 20_000, 8_000);
    await setLevel(f.db, other, 'SHIPYARD', 1);
    await buildUnits(f.db, other, 'DART', 9, f.clock);
    await settleBuilds(f, other);

    expect((await chainOf('SHIPS')).progress).toBe(0);
  });
});
