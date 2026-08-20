import {
  DISRUPTION,
  ECON,
  INSTRUMENT_COST_MULT,
  INSTRUMENT_LEVEL_WORTH,
  SATELLITES,
  SEASON,
  SHIELD,
} from './constants.js';
import {
  INSTRUMENT_IDS,
  type InstrumentId,
  type InstrumentLevels,
  type Resources,
  type SatelliteId,
  type SatelliteSet,
} from './types.js';

/**
 * Instrument levels, by known key.
 *
 * `Object.values()` on a `Partial<Record<K, number>>` is typed `number[]`, which
 * quietly hides the fact that a value can be undefined at runtime. Iterating the
 * key list keeps the types honest and matches how hulls are handled.
 */
export function instrumentEntries(kit: InstrumentLevels): [InstrumentId, number][] {
  const out: [InstrumentId, number][] = [];
  for (const id of INSTRUMENT_IDS) {
    const level = kit[id];
    if (level !== undefined && level > 0) out.push([id, level]);
  }
  return out;
}

/** Whether a satellite is in orbit. Presence is the whole state — D25, no levels. */
export const hasSatellite = (orbit: SatelliteSet, id: SatelliteId): boolean =>
  orbit.includes(id);

/**
 * HOW MANY BODIES A PLANET MAY KEEP IN ORBIT. D25.
 *
 * Owner's figure: the Command Core opens a slot at levels 1, 3, 5 and 9. Nothing
 * else grants one, and there is no separate building to detour through — capacity
 * arrives as a by-product of the growth every player is doing anyway.
 *
 * FOUR SLOTS AND FOUR SATELLITES IS NOT A CHECKLIST, because the fourth arrives at
 * Core 9. For most of a fourteen-day season a planet runs one, two or three of
 * them, so the live question is WHICH — and answering it is what makes two
 * developed worlds different from each other. Owning the set is a late-game state
 * you work toward, not the state you play in.
 */
export const satelliteSlots = (coreLevel: number): number =>
  coreLevel >= 9 ? 4 : coreLevel >= 5 ? 3 : coreLevel >= 3 ? 2 : coreLevel >= 1 ? 1 : 0;

/**
 * HOW MANY CRAFT A PLANET MAY HAVE IN THE AIR AT ONCE. D28.
 *
 * Every craft that leaves — an attack, a probe, a mining run — holds one slot for
 * the WHOLE ROUND TRIP, and gives it back when it lands. One mining run is one
 * slot however many Prospectors are in it: a squadron is a decision, not five.
 *
 * THIS IS THE UNIT OF PACING, and it replaces nothing that was working. D4 ruled
 * out build timers, correctly, and then nothing took over the job of occupying
 * time — so a session is "collect, buy the one thing you can afford, close", and
 * closes with nothing pending. A slot count is the honest version of the return
 * hook: a dark bay on your own dashboard says *you have not finished your turn*
 * without a notification, a streak or a bonus.
 *
 * IT REMOVES MORE RULES THAN IT ADDS. `PROBE.maxInFlight` was a special case for
 * one craft type; this is the general form of it, and the general form also closes
 * the mining exploit — unlimited concurrent runs — without a second special case.
 *
 * BASE THREE, NOT TWO. Owner decision, and the conservative one: three is exactly
 * today's probe cap, so nothing a player can do now becomes impossible. It means
 * scarcity is not felt in the first hour, which is the cost; what it buys is that
 * the mechanic can never read as a wall to somebody who has just arrived.
 */
export const flightSlots = (coreLevel: number): number =>
  3 + Math.floor(Math.max(0, coreLevel) / 3);

/* ── what a satellite changes ───────────────────────────────────── */

/**
 * The multiplier on everything the works produce. D25.
 *
 * Applied to the RATE, so it lifts storage caps and collector caps with it — a
 * Foundry makes a planet bigger, not merely faster, which is what stops it being a
 * flat bonus a player forgets they own.
 */
export const productionMult = (orbit: SatelliteSet): number =>
  hasSatellite(orbit, 'FOUNDRY') ? SATELLITES.FOUNDRY.production : 1;

/** Whether the two seeing instruments may be built at all. The Uplink's whole job. */
export const seeingUnlocked = (orbit: SatelliteSet): boolean =>
  hasSatellite(orbit, 'UPLINK');

/** Every mining craft the planet owns carries this much more. */
export const drillHoldMult = (orbit: SatelliteSet): number =>
  hasSatellite(orbit, 'DERRICK') ? SATELLITES.DERRICK.hold : 1;

/** ...and crosses the disc this much faster. */
export const drillSpeedMult = (orbit: SatelliteSet): number =>
  hasSatellite(orbit, 'DERRICK') ? SATELLITES.DERRICK.speed : 1;

/** Every fleet that leaves this planet flies this much faster. */
export const fleetSpeedMult = (orbit: SatelliteSet): number =>
  hasSatellite(orbit, 'BEACON') ? SATELLITES.BEACON.speed : 1;

export const alloyRate = (level: number): number =>
  ECON.alloyBase * Math.pow(ECON.alloyMult, level);

export const crystalRate = (level: number): number =>
  ECON.crystalBase * Math.pow(ECON.crystalMult, level);

/** Cost to go from `level` to `level + 1`. */
export function upgradeCost(level: number): Resources {
  return {
    alloy: Math.round(ECON.costBase * Math.pow(ECON.costMult, level)),
    crystal:
      level >= ECON.crystalCostFromLevel
        ? Math.round(ECON.crystalCostBase * Math.pow(ECON.crystalCostMult, level))
        : 0,
  };
}

/**
 * Cost to take an instrument from `level` to `level + 1`. D22.
 *
 * A building's price with the instrument's own multiplier on it. Price is the only
 * gate on an instrument — any of the four, in any order, at any time — so it is
 * what has to make choosing between them cost something.
 */
export function instrumentCost(id: InstrumentId, level: number): Resources {
  const mult = INSTRUMENT_COST_MULT[id];
  // An instrument level is worth more than one building level, because there are
  // only five of them against a building's twelve-plus. D30.
  const base = upgradeCost(level * INSTRUMENT_LEVEL_WORTH);
  return {
    alloy: Math.round(base.alloy * mult),
    crystal: Math.round(base.crystal * mult),
  };
}

/** What a satellite costs. Flat — it is bought once and never raised. D25. */
export const satelliteCost = (id: SatelliteId): Resources => ({
  alloy: SATELLITES[id].alloy,
  crystal: SATELLITES[id].crystal,
});

/** Everything sunk into a building to reach `level`. Feeds the Wealth display. */
export function investedInBuilding(level: number): number {
  let total = 0;
  for (let l = 0; l < level; l++) {
    const c = upgradeCost(l);
    total += c.alloy + c.crystal;
  }
  return total;
}

/**
 * Everything sunk into one instrument to reach `level`.
 *
 * Separate from `investedInBuilding` because instruments are priced differently
 * (D22), and Wealth has to reflect what was actually spent — a Telescope L3 costs
 * three times a Vault L3 and would otherwise be valued at a third of its price,
 * which quietly makes the rank floor wrong for every player who invested in
 * looking rather than in producing.
 */
export function investedInInstrument(id: InstrumentId, level: number): number {
  let total = 0;
  for (let l = 0; l < level; l++) {
    const c = instrumentCost(id, l);
    total += c.alloy + c.crystal;
  }
  return total;
}

/** What a satellite in orbit is worth. One purchase, so one price. */
export const investedInSatellite = (id: SatelliteId): number =>
  SATELLITES[id].alloy + SATELLITES[id].crystal;

export const storageCap = (ratePerHour: number): number =>
  Math.round(ECON.capHours * ratePerHour);

/**
 * What the works hold before they stop. D16.
 *
 * This is a SECOND ceiling, in front of the storage ceiling rather than instead of
 * it. Production fills this one; a tap moves it into storage, which has its own.
 */
export const collectorCap = (ratePerHour: number): number =>
  Math.round(ECON.collectorHours * ratePerHour);

/** Level 0 still protects the base amount — nobody is ever lootable to zero. */
export const vaultProtects = (level: number): number =>
  Math.round(ECON.vaultBase * Math.pow(ECON.vaultMult, Math.max(0, level)));

export const shieldHp = (level: number): number =>
  level <= 0 ? 0 : Math.round(SHIELD.base * Math.pow(SHIELD.mult, level));

/**
 * Hours for an upgrade at `level` to repay its own cost.
 *
 * Grows by (costMult / alloyMult) per level, which is the brake that stops a
 * 14-day season running away — and the reason investment stops being rational
 * on the final day, producing the sunset phase.
 */
export function paybackHours(level: number): number {
  const cost = ECON.costBase * Math.pow(ECON.costMult, level);
  const gain = ECON.alloyBase * Math.pow(ECON.alloyMult, level) * (ECON.alloyMult - 1);
  return cost / gain;
}

/** Is building still rational, this many hours before the season ends? */
export const worthInvesting = (level: number, hoursRemaining: number): boolean =>
  paybackHours(level) < hoursRemaining * SEASON.investmentHorizonShare;

/* ── Disruption ─────────────────────────────────────────────────── */

export const disruptionMinutes = (grade: 'DECISIVE' | 'PARTIAL' | 'REPELLED'): number =>
  grade === 'DECISIVE'
    ? DISRUPTION.decisiveMinutes
    : grade === 'PARTIAL'
      ? DISRUPTION.partialMinutes
      : 0;

/** Refreshes rather than stacks, and is capped — chain-raiding cannot bury a player. */
export function applyDisruption(
  disruptedUntil: number,
  now: number,
  grade: 'DECISIVE' | 'PARTIAL' | 'REPELLED',
): number {
  const add = disruptionMinutes(grade);
  if (add === 0) return disruptedUntil;
  return Math.min(now + DISRUPTION.maxPendingMinutes, Math.max(disruptedUntil, now + add));
}

/** Producing minutes inside [from, to), given surface works offline until `until`. */
export function productiveMinutes(from: number, to: number, until = 0): number {
  const span = Math.max(0, to - from);
  const lost = Math.max(0, Math.min(to, until) - from);
  return Math.max(0, span - lost);
}

/* ── The lazy tick ──────────────────────────────────────────────── */

export interface PlanetEconomyState {
  /** In STORAGE. Spendable, raidable in full, protected by the vault floor. */
  alloy: number;
  crystal: number;
  /**
   * Sitting in the works, uncollected. D16.
   *
   * Not spendable until the player empties it, raidable at
   * `COMBAT.lootBufferShare`, and it stops growing at `collectorCap` — which is
   * what makes emptying it the reason to open the game.
   */
  bufferAlloy: number;
  bufferCrystal: number;
  shield: number;
  lastTickMinutes: number;
  disruptedUntilMinutes: number;
}

export interface PlanetEconomyInput {
  refineryLevel: number;
  extractorLevel: number;
  aegisLevel: number;
  /**
   * The Foundry's multiplier on everything the works make. D25. Defaults to 1.
   *
   * Applied to the RATE, so the storage ceiling and the collector ceiling move with
   * it — a Foundry makes a planet bigger rather than merely faster. Optional so
   * every caller that predates the satellite reads exactly the number it always
   * did.
   */
  production?: number;
}

/**
 * Advance a planet's continuous state to `nowMinutes`.
 *
 * This is the entire offline-progression system. It is called at the top of any
 * transaction that touches a planet, and never on a timer — production for 300
 * players costs exactly zero background compute.
 *
 * PRODUCTION GOES INTO THE WORKS, NOT INTO STORAGE (D16). The buffer fills to
 * `collectorCap` and then the works stand idle; `collect()` is the only thing that
 * moves ore into storage. Two consequences worth stating, because both look like
 * bugs from the outside:
 *
 *   · Storage does not grow on its own any more. A planet nobody touches for a
 *     week has a full buffer and exactly the storage it started with.
 *   · The clamp is what stops time. Because the buffer is capped, an absence of a
 *     day and an absence of a month produce the same state — which is the honest
 *     version of a storage cap and the reason the ceiling is worth showing.
 *
 * Shield regeneration deliberately uses wall-clock minutes rather than productive
 * ones: it is a separate system and disruption should not freeze it.
 */
export function advanceEconomy(
  state: PlanetEconomyState,
  input: PlanetEconomyInput,
  nowMinutes: number,
): PlanetEconomyState {
  if (nowMinutes <= state.lastTickMinutes) return state;

  const producing = productiveMinutes(
    state.lastTickMinutes,
    nowMinutes,
    state.disruptedUntilMinutes,
  ) / 60;
  const wall = (nowMinutes - state.lastTickMinutes) / 60;

  const boost = input.production ?? 1;
  const ra = alloyRate(input.refineryLevel) * boost;
  const rc = crystalRate(input.extractorLevel) * boost;
  const maxShield = shieldHp(input.aegisLevel);

  return {
    alloy: state.alloy,
    crystal: state.crystal,
    bufferAlloy: Math.min(collectorCap(ra), state.bufferAlloy + ra * producing),
    bufferCrystal: Math.min(collectorCap(rc), state.bufferCrystal + rc * producing),
    shield:
      maxShield > 0
        ? Math.min(maxShield, state.shield + maxShield * SHIELD.regenPerHour * wall)
        : 0,
    lastTickMinutes: nowMinutes,
    disruptedUntilMinutes: state.disruptedUntilMinutes,
  };
}

export interface Collection {
  state: PlanetEconomyState;
  /** What actually moved into storage. */
  moved: Resources;
  /**
   * What would not fit and STAYED IN THE WORKS.
   *
   * Deliberately not destroyed. Collecting into a full store would otherwise
   * punish the player for pressing the button the interface is asking them to
   * press, and the honest answer — "your storage is full, spend something" — is
   * one the buffer can hold on to indefinitely.
   */
  blocked: Resources;
}

/**
 * Empty the works into storage. D16.
 *
 * The one manual step in the economy, and the whole reason to open the game when
 * nothing is in flight. Idempotent in the sense that matters: collecting twice in
 * a row moves nothing the second time.
 */
export function collect(
  state: PlanetEconomyState,
  input: PlanetEconomyInput,
): Collection {
  const boost = input.production ?? 1;
  const ra = alloyRate(input.refineryLevel) * boost;
  const rc = crystalRate(input.extractorLevel) * boost;

  const roomA = Math.max(0, storageCap(ra) - state.alloy);
  const roomC = Math.max(0, storageCap(rc) - state.crystal);
  const takeA = Math.min(state.bufferAlloy, roomA);
  const takeC = Math.min(state.bufferCrystal, roomC);

  return {
    state: {
      ...state,
      alloy: state.alloy + takeA,
      crystal: state.crystal + takeC,
      bufferAlloy: state.bufferAlloy - takeA,
      bufferCrystal: state.bufferCrystal - takeC,
    },
    moved: { alloy: takeA, crystal: takeC },
    blocked: {
      alloy: state.bufferAlloy - takeA,
      crystal: state.bufferCrystal - takeC,
    },
  };
}

/**
 * Minutes until the works fill and stop, or null if they already have.
 *
 * The number the interface leads with: "full in 3h 20m" is a reason to come back,
 * and "FULL — you are wasting 160/h" is a reason to come back right now.
 */
export function minutesUntilCollectorFull(
  buffer: number,
  ratePerHour: number,
): number | null {
  if (ratePerHour <= 0) return null;
  const room = collectorCap(ratePerHour) - buffer;
  if (room <= 0) return null;
  return (room / ratePerHour) * 60;
}

