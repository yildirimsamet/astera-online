import { FAULT } from './constants.js';
import { FAULT_KINDS, type FaultKind, type FaultSet, type Resources, type Rng } from './types.js';

/**
 * KOLONİ ARIZALARI — the whole rule, as pure arithmetic. `docs/colony-faults-plan.md`.
 *
 * A colony nobody looks after BREAKS: eight faults arrive at random, each shutting one
 * capability off, and while they stand the world's loyalty falls. At zero it secedes.
 *
 * WHAT THE EIGHT HAVE IN COMMON IS EVERYTHING EXCEPT THEIR EFFECT. Nothing in this
 * file branches on which fault it is holding apart from `faultTier` (a price band) and
 * `eligibleFaults` (one world may have no deuterium plant to break). Their effects live
 * where the effect lives — a rate in `economy.ts`, a shield at the battle, a departure
 * at the flight bay — and never here.
 *
 * THE NUMBERS ARE ALL IN `FAULT`, and two of them are the owner's: eight faults empty
 * loyalty in twelve hours, and a neglected world collects all eight in forty-eight.
 * Everything else was derived from those two and measured against them.
 */

/** A world's fault-relevant identity. Nothing here is secret; it is shape, not state. */
export interface FaultWorld {
  kind: 'CAPITAL' | 'COLONY' | 'NEUTRAL';
  coreLevel: number;
  /** Zero on a world that has never built one — there is no plant to break. */
  plantLevel: number;
}

/**
 * CAN THIS WORLD BREAK AT ALL?
 *
 * Colonies only, and only from `FAULT.minCoreLevel`. A CAPITAL is exempt by owner
 * decision — it is the one world the design protects, and an outage that dropped its
 * Aegis would be changing the attack risk on the only world a commander cannot lose
 * by neglect. A NEUTRAL world has no commander to repair it, so a fault there would be
 * a permanent debuff on a public landmark rather than a decision anybody makes.
 */
export const faultsPossible = (world: FaultWorld): boolean =>
  world.kind === 'COLONY' && world.coreLevel >= FAULT.minCoreLevel;

/**
 * WHICH FAULTS MAY BE DRAWN HERE, RIGHT NOW.
 *
 * "The same fault cannot happen twice at once" is not a check anywhere — it is the
 * structural consequence of this list, which is the only thing a draw ever sees.
 */
export function eligibleFaults(world: FaultWorld, active: FaultSet): FaultKind[] {
  if (!faultsPossible(world)) return [];
  return FAULT_KINDS.filter((kind) => {
    if (active.includes(kind)) return false;
    // A world with no plant has no plant to break. Every other fault's hardware is
    // either always present or the fault is about the world rather than a building.
    if (kind === 'PLANT_OUTAGE' && world.plantLevel < 1) return false;
    return true;
  });
}

/** The next thing to go wrong, or null when there is nothing left to break. */
export function drawFault(world: FaultWorld, active: FaultSet, rng: Rng): FaultKind | null {
  const pool = eligibleFaults(world, active);
  if (pool.length === 0) return null;
  return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))] ?? null;
}

/**
 * SEVERAL DISTINCT FAULTS AT ONCE, as many as fit. A heavy defeat draws two.
 *
 * Without replacement: the pool shrinks as it is drawn from, so one blow can never land
 * the same fault twice — the unique index would refuse the second row, and a report that
 * said "two things broke" over one broken thing would be describing a battle that did not
 * happen. Fewer than `count` come back when fewer are eligible, and none on a world that
 * cannot break; the caller does not need to know which case it is in.
 */
export function drawFaults(
  world: FaultWorld,
  active: FaultSet,
  count: number,
  rng: Rng,
): FaultKind[] {
  if (!(count > 0)) return [];
  const pool = eligibleFaults(world, active);
  const drawn: FaultKind[] = [];
  while (drawn.length < count && pool.length > 0) {
    const [picked] = pool.splice(Math.min(pool.length - 1, Math.floor(rng() * pool.length)), 1);
    if (picked === undefined) break;
    drawn.push(picked);
  }
  return drawn;
}

/** One exponential draw with the given mean. `rng()` is [0,1), so this never diverges. */
const exponential = (rng: Rng, mean: number): number => -Math.log(1 - rng()) * mean;

/**
 * HOW LONG UNTIL THE NEXT THING BREAKS. Owner instruction, and the shape is the point:
 *
 *   *"Arızaların hepsi 6 saatte bir gibi belirli saat ayarlama. Biraz randomize
 *   olmalı. Bazen bir kaç'ı daha erken arka arkaya falan gelmeli. Yoksa kullanıcı
 *   6 saatte bir açıp bakar oyuna."*
 *
 * Two arms. Three times in ten the next fault lands right behind the last one, which is
 * the "arka arkaya" the owner asked for and which no single-rate process makes visible.
 * The rest of the time it is a Gamma(2) around eight and a half hours — see
 * `FAULT.calmMeanHours` for why not an exponential.
 *
 * The mixture means six hours, so eight faults take forty-eight. Measured over 200k
 * draws: mean 6.02h, 29% of gaps under an hour, coefficient of variation 1.03, and no
 * correlation at all between one gap and the next. There is no cadence to learn.
 */
export function nextFaultGapMinutes(rng: Rng): number {
  const burst = rng() < FAULT.burstChance;
  const gap = burst
    ? exponential(rng, FAULT.burstMeanMinutes)
    // Gamma(2) is two exponentials of half the mean added together.
    : exponential(rng, FAULT.calmMeanHours * 30) + exponential(rng, FAULT.calmMeanHours * 30);
  return Math.max(FAULT.minGapSeconds / 60, gap);
}

/* ── loyalty ─────────────────────────────────────────────────────────── */

/**
 * LOYALTY PER HOUR, SIGNED. Positive with nothing broken, negative otherwise.
 *
 * The cube is what reconciles the owner's two constants; `FAULT.loyaltyCurveExponent`
 * carries the measurement. What it means on the screen: every fault accelerates the
 * loss more than the one before it, so the question is never "is something broken" but
 * "how many at once am I willing to carry".
 */
export function loyaltyRatePerHour(activeCount: number): number {
  if (activeCount <= 0) return FAULT.loyaltyMax / FAULT.loyaltyRecoverHours;
  const share = Math.min(1, activeCount / FAULT_KINDS.length);
  return -(FAULT.loyaltyMax / FAULT.loyaltyCollapseHours)
    * share ** FAULT.loyaltyCurveExponent;
}

/**
 * Advance loyalty across a span. Clamped at both ends, and a span that does not move
 * forward moves nothing — the planet's tick may be replayed and must be idempotent.
 */
export function advanceLoyalty(loyalty: number, activeCount: number, minutes: number): number {
  if (!(minutes > 0)) return loyalty;
  const next = loyalty + loyaltyRatePerHour(activeCount) * (minutes / 60);
  return Math.max(0, Math.min(FAULT.loyaltyMax, next));
}

/**
 * HOW LONG THIS WORLD HAS, or null when it is not losing any.
 *
 * The figure the interface leads with. A loyalty bar on its own SHOWS; what a commander
 * has to decide with is the time left, and 34% is not a time.
 */
export function minutesUntilLoyaltyZero(loyalty: number, activeCount: number): number | null {
  if (loyalty <= 0) return 0;
  const rate = loyaltyRatePerHour(activeCount);
  if (rate >= 0) return null;
  return (loyalty / -rate) * 60;
}

/**
 * THE NEXT FIGURE THIS WORLD WILL REACH ON ITS WAY DOWN, or null if it is not falling.
 *
 * Zero is a milestone like any other and is always the last one, which is what lets one
 * scheduled event carry the whole descent: it fires at a warning, books the next, and
 * the final booking is the secession itself. Four stops, one row.
 */
export function nextLoyaltyMilestone(loyalty: number, activeCount: number): number | null {
  if (activeCount <= 0 || loyalty <= 0) return null;
  const stops = [...FAULT.loyaltyWarnAt, 0];
  return stops.find((stop) => stop < loyalty) ?? null;
}

/** Minutes until this world's loyalty reaches `target`, or null if it never will. */
export function minutesUntilLoyalty(
  loyalty: number,
  activeCount: number,
  target: number,
): number | null {
  if (loyalty <= target) return 0;
  const rate = loyaltyRatePerHour(activeCount);
  if (rate >= 0) return null;
  return ((loyalty - target) / -rate) * 60;
}

/* ── repair ──────────────────────────────────────────────────────────── */

export const faultTier = (kind: FaultKind): 1 | 2 | 3 => FAULT.tiers[kind];

/**
 * WHAT ONE REPAIR COSTS. Small, and it grows with the Core rather than with the fault.
 *
 * Asked below `minCoreLevel` it answers with the gate's price rather than throwing:
 * a caller quoting a world that cannot break yet is asking a hypothetical, and the
 * honest hypothetical is "what it would cost on the day it can".
 */
export function repairCost(kind: FaultKind, coreLevel: number): Resources {
  const ladder = FAULT.priceLadder;
  const index = Math.max(0, Math.min(ladder.length - 1, Math.floor(coreLevel) - FAULT.minCoreLevel));
  const tier = faultTier(kind);
  const alloy = ladder[index]?.[tier - 1] ?? 0;
  return {
    alloy,
    crystal: Math.round(alloy * (FAULT.tierCrystalShare[tier - 1] ?? 0)),
    deuterium: 0,
  };
}

/**
 * Five to fifteen minutes, drawn. The sheet quotes the RANGE and never a figure:
 * an outcome the player can predict exactly is one the game has already decided for
 * them, and the range is enough to plan a session around.
 */
export const repairMinutes = (rng: Rng): number =>
  FAULT.repairMinMinutes + rng() * (FAULT.repairMaxMinutes - FAULT.repairMinMinutes);

/*
  SIZINTININ ARİTMETİĞİ BU DOSYADA DEĞİL, `economy.ts`'DE.

  `leakRates` deponun tavanını bilmek zorunda ve o tavan `storageCap`. Bu dosya arıza
  ÖMRÜNÜ tutuyor — kimde çıkar, ne zaman gelir, ne kadara onarılır, sadakate ne yapar —
  ekonomiyi değil. İki yönden birinin var olmaması gerekiyordu; var olmayan bu.
*/
