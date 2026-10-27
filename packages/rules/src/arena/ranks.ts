import type { ShipClass } from './classes.js';
import type { Tactic } from './pilot.js';
import { levelOf } from './progression.js';
import { ARENA_TUNING as T } from './tuning.js';

/** Y6c: each tactic keeps its own purchases; changing the selected tactic moves no points. */
export const ABILITIES = ['signature', 'turbo', 'smoke', 'cloak', 'illusion', 'radar'] as const;
/** Owner 2026-10-24: ranks four and five wait for the Essence system. Affinity counts in this cap. */
export const MAX_POINT_RANK = 3;
export type Ability = typeof ABILITIES[number];
export type AbilityPoints = Partial<Record<Ability, number>>;
export interface FlightRanks { signature: number; tactic: number; turbo: number }
export const AFFINITY: Readonly<Record<ShipClass, Tactic>> = { akinci: 'illusion', muhafiz: 'smoke', kilavuz: 'radar' };
export const SIGNATURE_COOLDOWN: Readonly<Record<ShipClass, number>> = Object.freeze({ akinci: 14, muhafiz: 22, kilavuz: 20 });
const rankOf = (rank: number): number => Number.isFinite(rank) ? Math.min(5, Math.max(1, Math.floor(rank))) : 1;

export const abilityRank = (ship: ShipClass, ability: Ability, points: AbilityPoints): number =>
  rankOf(1 + (points[ability] ?? 0) + Number(AFFINITY[ship] === ability));
export const pointsLeft = (level: number, points: AbilityPoints): number =>
  Math.max(0, levelOf(level) - 1 - ABILITIES.reduce((sum, key) => sum + (points[key] ?? 0), 0));
export const flightRanks = (ship: ShipClass, tactic: Tactic, points: AbilityPoints): FlightRanks => ({
  signature: abilityRank(ship, 'signature', points), tactic: abilityRank(ship, tactic, points), turbo: abilityRank(ship, 'turbo', points),
});

export interface AbilityStats { duration: number; cooldown: number; power: number }
function base(ship: ShipClass, ability: Ability): AbilityStats {
  switch (ability) {
    case 'signature': return { duration: ship === 'muhafiz' ? T.wardDuration : ship === 'kilavuz' ? T.mendDuration : T.missileLife,
      cooldown: SIGNATURE_COOLDOWN[ship], power: ship === 'muhafiz' ? T.wardHp : ship === 'kilavuz' ? T.mendHp : T.missileDamage };
    case 'turbo': return { duration: T.turboCharge, cooldown: T.turboCharge / T.turboRegen, power: 0 };
    case 'smoke': return { duration: T.smokeEmitDuration, cooldown: T.smokeCooldown, power: 0 };
    case 'cloak': return { duration: T.cloakDuration, cooldown: T.cloakCooldown, power: 0 };
    case 'illusion': return { duration: T.illusionDuration, cooldown: T.illusionCooldown, power: 0 };
    case 'radar': return { duration: T.radarDuration, cooldown: T.radarCooldown, power: 0 };
  }
}
const atRanks = (ship: ShipClass, ability: Ability): readonly AbilityStats[] => {
  const first = base(ship, ability);
  return Array.from({ length: 5 }, (_, step) => Object.freeze({
    duration: first.duration * (ability === 'signature' ? 1 : 1 + 0.1 * step),
    cooldown: first.cooldown * (1 - 0.05 * step), power: first.power * (1 + 0.1 * step),
  }));
};
const forShip = (ship: ShipClass): Record<Ability, readonly AbilityStats[]> => ({
  signature: atRanks(ship, 'signature'), turbo: atRanks(ship, 'turbo'), smoke: atRanks(ship, 'smoke'),
  cloak: atRanks(ship, 'cloak'), illusion: atRanks(ship, 'illusion'), radar: atRanks(ship, 'radar'),
});
const STATS = { akinci: forShip('akinci'), muhafiz: forShip('muhafiz'), kilavuz: forShip('kilavuz') };
/** Cached: the flight loop allocates nothing to read its ability. Turbo speed never changes. */
export const abilityStats = (ship: ShipClass, ability: Ability, rank: number): Readonly<AbilityStats> =>
  STATS[ship][ability][rankOf(rank) - 1] ?? base(ship, ability);
