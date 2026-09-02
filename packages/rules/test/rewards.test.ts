import { describe, expect, it } from 'vitest';
import {
  ECON,
  REWARD_CHAINS,
  REWARD_CHAIN_IDS,
  findRewardTier,
  rewardId,
  rewardPurse,
  tiersReached,
} from '../src/index.js';

/**
 * THE REWARD TABLE, HELD TO THE THINGS THAT MAKE IT SAFE.
 *
 * This is the newest place in the game where resources come out of nowhere, so
 * what is tested here is not "the numbers are the numbers" — that would just be
 * the table written twice. It is the four properties a grant table has to have
 * before it is allowed near a PvP economy:
 *
 *   · IT CANNOT PAY TWICE FOR ONE THING. Ids are unique and derived.
 *   · IT CANNOT BE ADDRESSED BY A STRING NOBODY AUTHORED. `findRewardTier` is the
 *     boundary between the wire and a payment.
 *   · IT CANNOT UNLOCK BACKWARDS. Tiers ascend, so "passed" is monotonic.
 *   · IT CANNOT QUIETLY REBAPIKE THE ECONOMY. The purse is bounded and the
 *     crystal share tracks income.
 */
describe('the reward table', () => {
  it('gives every tier a unique id, and derives it from what it pays for', () => {
    const ids = REWARD_CHAINS.flatMap((c) => c.tiers.map((t) => rewardId(c.id, t.goal)));
    expect(new Set(ids).size).toBe(ids.length);

    for (const chain of REWARD_CHAINS) {
      for (const tier of chain.tiers) {
        const found = findRewardTier(rewardId(chain.id, tier.goal));
        expect(found?.chain.id).toBe(chain.id);
        expect(found?.tier.goal).toBe(tier.goal);
      }
    }
  });

  /**
   * The id arrives from a client. Every one of these has to be a refusal rather
   * than a lookup that lands somewhere — the caller turns null into a 404 and
   * anything else into a payment.
   */
  it.each([
    ['', 'empty'],
    ['PROBE', 'no goal'],
    ['PROBE:', 'blank goal'],
    ['PROBE:2', 'a goal that is not a tier'],
    ['PROBE:1.5', 'a fractional goal'],
    ['PROBE:1e0', 'a goal that is not written as an integer'],
    ['NOPE:1', 'an unknown chain'],
    ['probe:1', 'the right chain in the wrong case'],
    ['PROBE:1:1', 'a third field'],
    ['PROBE:-1', 'a negative goal'],
    ['__proto__:1', 'a prototype key'],
  ])('refuses %j — %s', (id) => {
    expect(findRewardTier(id)).toBeNull();
  });

  it('orders every chain by ascending goal, so passing one can never un-pass another', () => {
    for (const chain of REWARD_CHAINS) {
      expect(chain.tiers.length).toBeGreaterThan(0);
      const goals = chain.tiers.map((t) => t.goal);
      expect(goals).toEqual([...goals].sort((a, b) => a - b));
      expect(new Set(goals).size).toBe(goals.length);
      expect(goals.every((g) => Number.isInteger(g) && g > 0)).toBe(true);
    }
  });

  it('pays more for a deeper tier, on every chain', () => {
    for (const chain of REWARD_CHAINS) {
      for (let i = 1; i < chain.tiers.length; i++) {
        expect(chain.tiers[i]!.reward.alloy).toBeGreaterThan(chain.tiers[i - 1]!.reward.alloy);
        expect(chain.tiers[i]!.reward.crystal).toBeGreaterThan(chain.tiers[i - 1]!.reward.crystal);
      }
    }
  });

  it('counts tiers reached, and never more than there are', () => {
    const probe = REWARD_CHAINS.find((c) => c.id === 'PROBE')!;
    expect(tiersReached(probe, 0)).toBe(0);
    expect(tiersReached(probe, 1)).toBe(1);
    expect(tiersReached(probe, 2)).toBe(1);
    expect(tiersReached(probe, 4)).toBe(2);
    expect(tiersReached(probe, 5)).toBe(3);
    expect(tiersReached(probe, 5_000)).toBe(probe.tiers.length);
  });

  /**
   * THE ONE THAT MATTERS TO THE BAPIKE.
   *
   * The whole table is worth about a tenth of what a fourteen-day season
   * produces, and the ceiling here is what stops a future tier being added at a
   * figure that quietly makes rewards the economy. Deliberately a wide bound —
   * this is a guard rail, not a re-statement of the numbers.
   */
  it('keeps the whole purse to a size a season absorbs', () => {
    const purse = rewardPurse();
    expect(purse.alloy).toBeGreaterThan(5_000);
    expect(purse.alloy).toBeLessThan(25_000);
  });

  /**
   * CRYSTAL IS THE SCARCE RESOURCE AND MUST STAY SCARCE.
   *
   * `ECON.crystalCostBase` was derived across a whole balance pass on the finding
   * that a resource arriving faster than it can be spent is decoration rather than
   * a constraint. A grant table that paid crystal at, say, alloy parity would undo
   * that silently — nothing would fail, crystal would simply stop mattering.
   * Pinned to the INCOME share rather than to a literal, so it moves if the
   * economy does.
   */
  it('pays crystal at roughly its share of income, and never at parity', () => {
    const purse = rewardPurse();
    const incomeShare = ECON.crystalBase / ECON.alloyBase;
    const paidShare = purse.crystal / purse.alloy;
    expect(paidShare).toBeGreaterThan(incomeShare * 0.8);
    expect(paidShare).toBeLessThan(incomeShare * 1.2);
  });

  /**
   * A GRANT IS NOT AN ACHIEVEMENT, and exactly one chain is allowed to be one.
   *
   * `grant` means "no progress exists in the galaxy; a human decides" — the
   * @JoinAstera bonus. If a second one ever appears it is either a second manual
   * process nobody has built, or an earned chain wearing the wrong metric and
   * therefore permanently unclaimable.
   */
  it('has exactly one hand-granted chain, and leaves it out of the purse', () => {
    const granted = REWARD_CHAINS.filter((c) => c.metric === 'grant');
    expect(granted.map((c) => c.id)).toEqual(['SOCIAL']);

    const social = granted[0]!.tiers[0]!.reward;
    const withSocial = REWARD_CHAINS.reduce(
      (n, c) => n + c.tiers.reduce((m, t) => m + t.reward.alloy, 0),
      0,
    );
    expect(rewardPurse().alloy).toBe(withSocial - social.alloy);
  });

  /**
   * WHAT IS PAID ONCE PER PERSON, AND WHAT STARTS AGAIN WITH THE GALAXY. Owner
   * instruction: *"twitter takip bonusu kişiye 1 kez verilebilmeli. her sezon her
   * sezon alamaz."*
   *
   * The ten counted chains MUST be season-scoped: their progress is read off a
   * world that ceases to exist, so an account-scoped one would be permanently
   * stuck at whatever the first galaxy reached. The follow bonus must be the
   * other way round for the same reason in reverse — the act happened on Twitter
   * and no rollover un-does it.
   *
   * The server keys the once-only row on this value, so a chain that changed
   * scope silently would either pay a follower every fortnight or lock a probe
   * reward out of every galaxy after the first.
   */
  it('pays exactly one chain per person rather than per galaxy', () => {
    const forever = REWARD_CHAINS.filter((c) => c.scope === 'account');
    expect(forever.map((c) => c.id)).toEqual(['SOCIAL']);
    expect(REWARD_CHAINS.filter((c) => c.metric !== 'grant').every((c) => c.scope === 'season'))
      .toBe(true);
  });

  it('exports every chain exactly once, in the declared order', () => {
    expect(REWARD_CHAINS.map((c) => c.id)).toEqual([...REWARD_CHAIN_IDS]);
    expect(new Set(REWARD_CHAIN_IDS).size).toBe(REWARD_CHAIN_IDS.length);
  });
});
