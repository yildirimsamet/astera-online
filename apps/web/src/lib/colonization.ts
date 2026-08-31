import type { GalaxyPlanet } from '../api/schemas.js';

/**
 * The one question every colonization surface answers: what can this commander
 * do with this world right now?
 *
 * Keep this independent from presentation. The focus rail, action label and
 * confirmation sheet must not each invent their own version of the rules.
 */
export type ColonizationPhase =
  | 'UNKNOWN'
  | 'OWNED'
  | 'CLANMATE'
  | 'NEUTRAL_PREP'
  | 'NEUTRAL_RACE'
  | 'SETTLEMENT_IN_FLIGHT'
  | 'FOREIGN_COLONY'
  | 'FOREIGN_COLONY_RECOVERY'
  | 'FOREIGN_CAPITAL';

export function colonizationPhase(
  target: GalaxyPlanet,
  now: number,
  settlementInFlight = false,
): ColonizationPhase {
  if (target.isOwned === true) return 'OWNED';
  if (target.clanmate === true) return 'CLANMATE';

  const claimUntil = target.neutral?.claimUntil?.getTime() ?? 0;
  const activeRace = claimUntil > now;

  // A claim is public information. It remains actionable even when this
  // commander has never surveyed the world and therefore does not know its kind.
  if (settlementInFlight && activeRace) return 'SETTLEMENT_IN_FLIGHT';
  if (activeRace) return 'NEUTRAL_RACE';

  if (target.intel === 'UNKNOWN') return 'UNKNOWN';
  if (target.kind === 'NEUTRAL') return 'NEUTRAL_PREP';
  if (target.kind === 'CAPITAL') return 'FOREIGN_CAPITAL';

  if (
    target.kind === 'COLONY'
    && target.state.kind === 'RECOVERY'
    && target.state.until.getTime() > now
  ) {
    return 'FOREIGN_COLONY_RECOVERY';
  }

  return 'FOREIGN_COLONY';
}
