/**
 * Every number the design can be wrong about, in one place.
 *
 * Values marked PROVISIONAL are settled by the Phase 8 playtest, not by argument.
 * Values marked INVARIANT have a stated relationship that must never be broken;
 * `test/invariants.test.ts` enforces each one.
 */

export const ECON = {
  alloyBase: 40,
  alloyMult: 1.45,
  crystalBase: 14,
  crystalMult: 1.42,

  costBase: 200,
  costMult: 1.55,
  /**
   * PROVISIONAL. INVARIANT: the crystal share of an upgrade must track the
   * crystal share of INCOME, or the scarce resource is not scarce.
   *
   * The first draft charged crystal only from L4 upward and at 22% of the alloy
   * price, against a crystal income that is 33% of alloy income. Crystal
   * therefore arrived half again as fast as it could be spent: it filled its
   * twelve-hour store during the first night of every account and wasted from
   * then on, and for the whole opening — no crystal in the Wasp, none in a
   * probe, none in the first three upgrades — it bought literally nothing.
   * A resource the player watches accumulate and never spends is not scarcity,
   * it is decoration.
   *
   * The multiplier is DERIVED, not chosen: `costMult * (crystalMult / alloyMult)`.
   * Two independently hand-picked multipliers drift — the old 1.58 against a
   * 1.55 alloy curve pushed the crystal share from 0.21 to 0.37 across ten
   * levels while the income share fell, so the late game slowly inverted which
   * resource was scarce. Tying it to the income curve holds the ratio flat at
   * every level, and the base is then the only number a playtest has to move.
   *
   * The base is set at about four fifths of income parity, not at parity: the
   * simulator showed that charging crystal as fast as it arrives empties the
   * stores, and an empty store is nothing to raid. Raid returns fell through
   * their floor and the informed archetype lost the ladder. Crystal must be
   * spent AND worth stealing.
   *
   * `test/invariants.test.ts` holds the cost ratio to the income ratio.
   */
  crystalCostBase: 55,
  crystalCostMult: 1.518,
  crystalCostFromLevel: 1,

  /** Storage ceiling, expressed as hours of production at the current level. */
  capHours: 12,

  /**
   * PROVISIONAL. INVARIANT: vaultMult MUST stay below alloyMult.
   *
   * If protection compounds faster than the stock it protects, the vault
   * eventually covers 100% of storage and nothing in the galaxy is raidable —
   * silently, with no other symptom. The first draft shipped 1.50 against an
   * alloyMult of 1.45 and killed the entire PvP economy for a whole season
   * before the simulator caught it.
   */
  vaultBase: 300,
  vaultMult: 1.3,
} as const;

export const COMBAT = {
  rounds: 3,
  varianceMin: 0.92,
  varianceMax: 1.08,

  /** Counter cycle: WASP ▸ BULWARK ▸ LANCE ▸ WASP. */
  strongMult: 1.6,
  weakMult: 0.625,

  /** Value-loss share below DECISIVE that still earns a partial haul. */
  partialThreshold: 0.6,
  lootDecisive: 0.5,
  lootPartial: 0.25,

  /**
   * Share of destroyed ground defence rebuilt free from wreckage.
   *
   * With consumable defence the simulator resolved ~95% of attacks as DECISIVE,
   * and if blind raiding never fails there is nothing for information to reduce.
   * Only safe because the ladder is Dominion — under a wealth ladder, durable
   * defence recreates the turtle exploit.
   */
  defenceSalvage: 0.6,
} as const;

export const TRAVEL = {
  /** Launch and landing overhead, in minutes. */
  baseMinutes: 3,
  distanceFactor: 1.2,
} as const;

export const INTEL = {
  detectBase: 0.25,
  detectSlope: 0.18,
  detectMin: 0.05,
  detectMax: 0.95,

  accuracyBase: 0.55,
  accuracySlope: 0.12,
  accuracyMin: 0.3,
  accuracyMax: 1.0,

  /** Clarity 0: a reading refreshes at most this often... */
  intermittentRefreshMin: 20,
  /** ...and this share of refreshes are silently dropped. */
  intermittentDropRate: 0.25,
  /** Clarity −1: reads UNKNOWN this often. */
  degradedUnknownRate: 0.7,

  /** Minutes of warning before impact, by radar level. Index 0-2 give none. */
  radarLeadMinutes: [0, 0, 0, 5, 8, 12] as readonly number[],
} as const;

/**
 * Explorer probes.
 *
 * Fast and cheap relative to a fleet, because the decision they exist to create is
 * "spend 7 minutes to know, or strike blind now" — not "can I afford to look".
 * Shipyard level supplies BOTH probe accuracy and probe stealth: one building
 * gates the whole active-intel path, which keeps the player's model small.
 */
export const PROBE = {
  alloy: 220,
  crystal: 0,
  /** Faster than any hull — a probe is a sensor package, not a ship. */
  speed: 90,
} as const;

/** PROVISIONAL — shield curve is settled by playtest. */
export const SHIELD = {
  base: 700,
  mult: 1.42,
  regenPerHour: 0.05,
} as const;

/**
 * PROVISIONAL. A successful raid also knocks the target's surface works offline.
 * Buildings are never damaged — the ownership pillar holds — but the victim now
 * loses COMPOUNDING rather than merely stock, which is the only thing that makes
 * raiding competitive with building over a season.
 */
export const DISRUPTION = {
  decisiveMinutes: 180,
  partialMinutes: 60,
  /** You can never be disrupted more than this far into the future. */
  maxPendingMinutes: 240,
} as const;

export const ABUSE = {
  bashLimit: 3,
  bashWindowMinutes: 720,
  graceMinutes: 240,
  graceUntilCoreLevel: 4,
  /** Cannot attack anyone below this share of your own Wealth. */
  rankFloor: 0.4,
} as const;

export const GALAXY = {
  radius: 1000,
  /** Vertical half-thickness of the disc. */
  thickness: 120,
  minSeparation: 90,
  defaultSlots: 200,

  asteroidMin: 8,
  asteroidMax: 14,
  /**
   * Orbital period in minutes. PROVISIONAL.
   *
   * Quartered from 15–40. At the old rate a rock crossed its own width in about
   * twenty seconds, so the disc looked static in any session short enough to
   * actually play — and a living galaxy that only moves while you are not watching
   * is not doing its job. Nothing reads these but the renderer: impacts are not
   * scheduled and the season simulator does not model asteroids at all.
   */
  asteroidPeriodMin: 4,
  asteroidPeriodMax: 10,
  asteroidMassMin: 200,
  asteroidMassMax: 1400,
  asteroidDamagePerMass: 8,
  maxImpactsPerPlanet: 2,
} as const;

export const SEASON = {
  days: 14,
  /** Above this, an upgrade no longer repays before the wipe — the sunset phase. */
  investmentHorizonShare: 0.4,
} as const;
