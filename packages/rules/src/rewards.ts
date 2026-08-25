import type { Resources } from './types.js';

/**
 * WHAT THE GAME PAYS YOU FOR DOING THE LOOP. Owner decision.
 *
 * The problem this solves is stated plainly in the report that produced it:
 * *"onboardingden sonra user'a yapıcak bişey kalmıyor"* — the rehearsal ends, the
 * opening grant is spent, and a commander is left holding a world with no next
 * thing to press. `OPENING_BONUS` (D58) bought one more decision; this buys a
 * ladder of them.
 *
 * IT IS NOT A DAILY BONUS, A STREAK OR A LOGIN REWARD, and the distinction is the
 * whole design. `game-design.md` forbids all three by name, because each of them
 * pays for ATTENDANCE — being present at the right hour — and manufactures a
 * reason to open the app that has nothing to do with the game. Every goal below
 * instead pays for an ACT that is already part of the loop:
 *
 *   DEVELOP → ACCUMULATE → GATHER INTEL → SPOT OPPORTUNITY → CHOOSE TARGET
 *      → TAKE RISK → DISPATCH → OUTCOME → NEW DECISION
 *
 * Nothing here can be earned by waiting. A player who leaves the tab open for a
 * week completes none of it; a player who probes a neighbour completes one in
 * ninety seconds. That is the correct direction for a game whose recorded risk is
 * *"nobody scouts — the game degrades into a worse OGame"*: two of the eleven
 * chains pay for probing and raiding specifically, and they are the two with the
 * largest purses.
 *
 * WHY THE GRANT IS RESOURCES AND NOT ANYTHING ELSE. A permanent upgrade, a
 * cosmetic or a discount would all be UN-LOSABLE, and the invariant table refuses
 * new un-losable sinks by name: what a raid cannot take drains the pressure the
 * whole PvP model runs on. Alloy and crystal land in STORAGE, above the vault
 * floor, where anybody can come and take them. A reward that can be stolen is a
 * reward that stays inside the game.
 *
 * ── the amounts ──────────────────────────────────────────────────────────────
 *
 * The brief was *"orta iyi arası"* — the player should not be disappointed and
 * should not be overjoyed. Two anchors fix the scale:
 *
 *   · A fresh planet's alloy store holds 1,392 and a Wasp costs 260. So a first
 *     tier at 200 alloy is "most of a warship, right now" — felt immediately, and
 *     gone by the second upgrade.
 *   · The whole table pays 13,600 alloy and 4,740 crystal if every tier is taken,
 *     against a fourteen-day season that produces well over 100,000. Roughly a
 *     tenth, front-loaded — enough to change the first day and nothing like enough
 *     to replace the economy.
 *
 * CRYSTAL IS HELD AT ~35% OF ALLOY THROUGHOUT, which is the income share
 * (`crystalBase / alloyBase` = 28/80) and not a taste. Paying crystal faster than
 * it is earned would quietly undo the scarcity `ECON.crystalCostBase` exists to
 * create — the constant that took a whole pass to derive, because a resource that
 * arrives faster than it can be spent is decoration rather than a constraint.
 *
 * ── the shape ────────────────────────────────────────────────────────────────
 *
 * A CHAIN is a goal that keeps going: probe once, then twice more, then twice
 * more again. Progress is a single cumulative number and every TIER it has passed
 * is claimable independently — reaching 5 with none claimed leaves all three
 * waiting, and none of them expires. That is the owner's rule verbatim: *"Çoklu
 * görevler toplanarak ilerler."*
 *
 * NOTHING HERE IS STORED AS PROGRESS except one tally the world genuinely cannot
 * reconstruct (see `WASP`). The other ten metrics are counted off rows that exist
 * anyway — missions flown, runs completed, levels standing — which keeps this
 * table inside the architectural rule that nothing is stored which a formula can
 * derive, and means a chain added later is retroactive for free.
 */

/** Every chain, in the order the panel lists them. */
export const REWARD_CHAIN_IDS = [
  /**
   * FIRST, BY OWNER INSTRUCTION, and it is the one entry that is not ordered by
   * when a commander meets it. It is the only reward that asks the player to do
   * something OUTSIDE the game, so it is the only one that has to be seen rather
   * than found — everything below it is discovered by playing anyway.
   */
  'SOCIAL',
  'PROBE',
  'RAID',
  'CORE',
  'SHIPYARD',
  'REFINERY',
  'EXTRACTOR',
  'SHIPS',
  'AEGIS',
  'MINE',
  'SALVAGE',
] as const;

export type RewardChainId = (typeof REWARD_CHAIN_IDS)[number];

/**
 * HOW A CHAIN'S PROGRESS IS COUNTED, as a value rather than as a comment.
 *
 * The server switches on this to build the figure, and the client switches on it
 * to write the sentence under the goal — "3 of 5 probes sent" against "Command
 * Core L5". They are different sentences because they are different KINDS of
 * number, and a single "progress / goal" would have read as nonsense on half the
 * list.
 *
 *   `count`  something you have done, and doing it again adds one.
 *   `level`  a level a structure is standing at. It only goes up.
 *   `grant`  nothing the game can see. A human decides, off-platform (see SOCIAL).
 */
export type RewardMetric = 'count' | 'level' | 'grant';

/**
 * HOW LONG A CHAIN REMEMBERS, and it is the difference between a reward that is
 * earned and one that is given. Owner instruction: *"twitter takip bonusu kişiye
 * 1 kez verilebilmeli. her sezon her sezon alamaz."*
 *
 *   `season`   the ten counted chains. Progress is read off THIS season's world —
 *              probes flown, levels standing — so it necessarily starts again
 *              when the world does, and it should: a new galaxy is a new game and
 *              the first probe in it is a real first probe.
 *   `account`  the commander behind the seat, for ever. Following @JoinAstera is
 *              done ONCE by a person; a galaxy rolling over does not un-follow
 *              anybody, so paying for it again would be paying twice for one act
 *              — and paying every fortnight for ever to somebody who pressed a
 *              button in April.
 *
 * IT IS A PROPERTY OF THE CHAIN AND NOT OF `metric`. The two happen to coincide
 * today — the only account-scoped chain is also the only hand-granted one — and
 * writing `metric === 'grant'` at the four sites that need this would have tied
 * "a human confirms it" to "it is paid once ever", which are different facts. A
 * hand-checked reward for a single season is a thing this table must stay able to
 * express.
 */
export type RewardScope = 'season' | 'account';

export interface RewardTier {
  /** The cumulative figure that unlocks it. */
  goal: number;
  reward: Resources;
}

export interface RewardChain {
  id: RewardChainId;
  metric: RewardMetric;
  /** Where the once-only record lives: the season's player, or the account. */
  scope: RewardScope;
  tiers: readonly RewardTier[];
}

/** 200 : 70 is the ratio every line below is built on. See the docblock. */
const reward = (alloy: number, crystal: number): Resources => ({
  alloy,
  crystal,
  deuterium: 0,
});

const CHAINS: Record<RewardChainId, RewardChain> = {
  /**
   * THE BIGGEST PURSE IN THE TABLE, WITH `RAID`, AND ON PURPOSE.
   *
   * "The information is the game" is the product's own sentence, and the recorded
   * risk against it is that nobody scouts. A probe costs 25 alloy and 25 crystal
   * and takes minutes; paying 200 for the first one is the cheapest lesson the
   * game can buy, and it is a lesson rather than a bribe because the reward is
   * for the ACT and the act is what teaches the fog.
   */
  PROBE: {
    id: 'PROBE',
    metric: 'count',
    scope: 'season',
    tiers: [
      { goal: 1, reward: reward(200, 70) },
      { goal: 3, reward: reward(350, 120) },
      { goal: 5, reward: reward(600, 210) },
    ],
  },

  /**
   * DISTINCT PLANETS, NEVER RAIDS FLOWN. Farming one neighbour five times is the
   * exact behaviour `BASH_LIMIT` exists to stop, and a counter that rewarded it
   * would be the game paying for what the game refuses.
   */
  RAID: {
    id: 'RAID',
    metric: 'count',
    scope: 'season',
    tiers: [
      { goal: 1, reward: reward(300, 100) },
      { goal: 3, reward: reward(550, 190) },
      { goal: 5, reward: reward(900, 320) },
    ],
  },

  /**
   * The Core is the ceiling every other structure obeys and the thing that opens
   * orbit slots at 1, 3, 5 and 9 — so its tiers sit ON those slots wherever they
   * can. L9 pays 1,600 because L8→L9 costs 13,960 alloy on its own.
   */
  CORE: {
    id: 'CORE',
    metric: 'level',
    scope: 'season',
    tiers: [
      { goal: 3, reward: reward(250, 90) },
      { goal: 5, reward: reward(500, 175) },
      { goal: 7, reward: reward(900, 315) },
      { goal: 9, reward: reward(1600, 560) },
    ],
  },

  SHIPYARD: {
    id: 'SHIPYARD',
    metric: 'level',
    scope: 'season',
    tiers: [
      { goal: 2, reward: reward(200, 70) },
      { goal: 3, reward: reward(400, 140) },
      { goal: 4, reward: reward(700, 245) },
    ],
  },

  REFINERY: {
    id: 'REFINERY',
    metric: 'level',
    scope: 'season',
    tiers: [
      { goal: 3, reward: reward(200, 70) },
      { goal: 5, reward: reward(400, 140) },
      { goal: 7, reward: reward(750, 260) },
    ],
  },

  EXTRACTOR: {
    id: 'EXTRACTOR',
    metric: 'level',
    scope: 'season',
    tiers: [
      { goal: 3, reward: reward(200, 70) },
      { goal: 5, reward: reward(400, 140) },
      { goal: 7, reward: reward(750, 260) },
    ],
  },

  /**
   * WASPS EVER BUILT — the one metric with a stored tally behind it.
   *
   * Every other chain is counted off rows that survive: a mission is still there
   * when it lands, a level does not fall. A ship is not — it dies in combat, and
   * the `units` row goes down with it. "How many have you ever built" is
   * genuinely unrecoverable from the world, so `planets.builtEver` records it,
   * and it is the only counter this feature adds.
   *
   * IT COUNTS THE WASP ALONE, not hulls in general. 50 Bulwarks is 125,000 alloy
   * and 50 Wasps is 13,000; one number cannot mean both. The Wasp is also the
   * hull the opening hands you two of, so the chain starts where the player
   * already is.
   */
  SHIPS: {
    id: 'SHIPS',
    metric: 'count',
    scope: 'season',
    tiers: [
      { goal: 5, reward: reward(200, 70) },
      { goal: 10, reward: reward(350, 120) },
      { goal: 20, reward: reward(600, 210) },
      { goal: 50, reward: reward(1200, 420) },
    ],
  },

  /** One tier. Either the shield generator is on the ground or it is not. */
  AEGIS: {
    id: 'AEGIS',
    metric: 'level',
    scope: 'season',
    tiers: [{ goal: 1, reward: reward(500, 175) }],
  },

  /**
   * REACHED, NOT LAUNCHED — and the two mining chains say so together.
   *
   * A run that is still outbound has decided nothing: the rock may be stripped by
   * the time it arrives, which is the entire race D19 exists to create. Counting
   * the launch would pay for pressing a button; counting the arrival pays for
   * winning, or at least for turning up.
   */
  MINE: {
    id: 'MINE',
    metric: 'count',
    scope: 'season',
    tiers: [{ goal: 1, reward: reward(300, 100) }],
  },

  SALVAGE: {
    id: 'SALVAGE',
    metric: 'count',
    scope: 'season',
    tiers: [{ goal: 1, reward: reward(300, 100) }],
  },

  /**
   * THE ONE THING ON THIS LIST THE GAME CANNOT SEE. Owner decision.
   *
   * Follow @JoinAstera and send the commander name by direct message; the operator
   * confirms it and the seat becomes claimable. There is no Twitter API in this
   * project and there is not going to be one — a marketing integration is not a
   * game system, and the honest implementation of "a human checked" is a human
   * checking. `season reward <commander>` writes the grant row.
   *
   * IT IS STILL CLAIMED BY THE PLAYER RATHER THAN CREDITED BY THE OPERATOR, which
   * is what keeps it inside the one claim path everything else uses: same lock,
   * same idempotency, same toast. It also means the resources arrive when the
   * player is looking at them, which is the difference between a reward and a
   * balance that changed overnight.
   *
   * 1,000 / 500 is the owner's figure, raised from 500 / 250. It is by some way
   * the largest single grant in the table — the same size as `OPENING_BONUS`, the
   * cushion a brand-new commander is handed — and that is the point: it is paid
   * once, to a few dozen people, and it is marketing rather than economy.
   *
   * It is deliberately NOT scaled to the ~35% crystal share the rest of the table
   * holds to, and `rewardPurse()` excludes it, so it cannot drag the economy's
   * ratios around from outside the game.
   */
  SOCIAL: {
    id: 'SOCIAL',
    metric: 'grant',
    scope: 'account',
    tiers: [{ goal: 1, reward: reward(1000, 500) }],
  },
};

export const REWARD_CHAINS: readonly RewardChain[] = REWARD_CHAIN_IDS.map((id) => CHAINS[id]);

/**
 * A TIER'S ID, AND IT IS THE CHAIN AND THE GOAL WITH A COLON BETWEEN THEM.
 *
 * Derived rather than listed, so a tier cannot be given an id that does not match
 * the thing it pays for — and so adding a tier never means editing a second list
 * that a test would have to keep honest.
 */
export const rewardId = (chain: RewardChainId, goal: number): string =>
  `${chain}:${String(goal)}`;

export interface RewardTierRef {
  /**
   * THE CANONICAL ID, AND CALLERS MUST STORE THIS ONE RATHER THAN WHAT THEY WERE
   * SENT.
   *
   * It exists because of a double-pay bug the parser below now refuses. A claim
   * is made idempotent by a primary key on `(player, rewardId)` — so if two
   * different strings can address one tier, they are two different keys and the
   * same reward is paid twice. `PROBE:1e0` and `PROBE:1:1` both resolved to
   * `PROBE:1` before the strict parse below existed, and a caller that stored the
   * string it received would have banked all three.
   *
   * Rejecting the aliases is the fix; handing back the canonical form is the belt
   * to its braces, so a future caller cannot reintroduce the hole by storing its
   * input.
   */
  id: string;
  chain: RewardChain;
  tier: RewardTier;
}

/**
 * Resolve an id the client sent back. Returns null for anything unknown.
 *
 * A NULL HERE IS A REFUSAL, NEVER A DEFAULT. This is the boundary between "a
 * string arrived over the wire" and "a payment is about to be made", so an id
 * that does not name a real tier must fail the claim rather than fall through to
 * a first entry.
 *
 * IT PARSES STRICTLY, AND THAT IS THE WHOLE OF THE ONCE-ONLY GUARANTEE.
 * `Number('1e0')` is 1 and `Number.isInteger` is happy with it; `'A:1:1'.split`
 * gives three parts and destructuring quietly drops the third. Both used to
 * resolve, which made three spellings of one tier — and the claim's primary key
 * cannot tell three spellings apart. Exactly two segments, and the goal must
 * round-trip through `String`, so there is one id per tier and no other.
 */
export function findRewardTier(id: string): RewardTierRef | null {
  const parts = id.split(':');
  if (parts.length !== 2) return null;
  const [chainId, goalText] = parts;
  const chain = REWARD_CHAINS.find((c) => c.id === chainId);
  if (!chain || goalText === undefined) return null;
  const goal = Number(goalText);
  if (!Number.isInteger(goal) || String(goal) !== goalText) return null;
  const tier = chain.tiers.find((t) => t.goal === goal);
  return tier ? { id: rewardId(chain.id, tier.goal), chain, tier } : null;
}

/** How many tiers of a chain a given progress figure has passed. */
export const tiersReached = (chain: RewardChain, progress: number): number =>
  chain.tiers.filter((t) => progress >= t.goal).length;

/**
 * WHAT THE WHOLE TABLE IS WORTH, for the balance tests and for anyone checking
 * the docblock's arithmetic against the numbers rather than trusting it.
 *
 * `SOCIAL` is excluded: it is not earned in the galaxy, only a handful of players
 * will ever hold it, and folding a marketing grant into the economy's total would
 * make every ratio derived from this figure slightly wrong.
 */
export const rewardPurse = (): Resources =>
  REWARD_CHAINS.filter((c) => c.metric !== 'grant').reduce(
    (sum, chain) => {
      for (const t of chain.tiers) {
        sum.alloy += t.reward.alloy;
        sum.crystal += t.reward.crystal;
      }
      return sum;
    },
    { alloy: 0, crystal: 0, deuterium: 0 },
  );
