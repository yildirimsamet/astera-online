import { MULTI_WORLD, colonyCapacity, nextColonyCore, type Resources } from '@astera/rules';
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

/**
 * THE FIRST THING STANDING BETWEEN A COMMANDER AND A COLONY. D209, owner instruction.
 *
 * One statement, read by the disabled label AND the note above it, so the two can
 * never name different reasons. The order is the order the launch refuses in.
 * A missing slot names the Core the next one opens at (`nextColonyCore`), because
 * "slot full" alone left a commander with no number to build towards.
 */
export type SettlementBlock =
  | { code: 'RECOVERING' }
  | { code: 'COLONY_CORE'; requiredCore: number; currentCore: number }
  | { code: 'COLONY_MAX'; max: number }
  | { code: 'FLIGHT_BAY' }
  | { code: 'COURIER'; need: number; have: number }
  | { code: 'ALLOY'; need: number; have: number }
  | { code: 'CRYSTAL'; need: number; have: number }
  | { code: 'FUEL'; need: number; have: number }
  | { code: 'TOO_LATE' };

export interface SettlementBlockInput {
  originRecovering: boolean;
  colonies: { colonies: number; reservations: number; capacity: number; capitalCore: number };
  flight: { used: number; total: number };
  couriers: number;
  stock: Resources;
  /** What the settlers burn getting there, on top of the founding charge. */
  fuel: number;
  canArrive: boolean;
}

export function settlementBlock(input: SettlementBlockInput): SettlementBlock | null {
  const { colonies } = input;
  const charge = MULTI_WORLD.settlement.charge;
  if (input.originRecovering) return { code: 'RECOVERING' };
  if (colonies.colonies + colonies.reservations >= colonies.capacity) {
    const requiredCore = nextColonyCore(colonies.colonies, colonies.reservations);
    return requiredCore === null
      ? { code: 'COLONY_MAX', max: colonyCapacity(Infinity) }
      : { code: 'COLONY_CORE', requiredCore, currentCore: colonies.capitalCore };
  }
  if (input.flight.used >= input.flight.total) return { code: 'FLIGHT_BAY' };
  if (input.couriers < MULTI_WORLD.settlement.transports) {
    return { code: 'COURIER', need: MULTI_WORLD.settlement.transports, have: input.couriers };
  }
  if (input.stock.alloy < charge.alloy) return { code: 'ALLOY', need: charge.alloy, have: input.stock.alloy };
  if (input.stock.crystal < charge.crystal) {
    return { code: 'CRYSTAL', need: charge.crystal, have: input.stock.crystal };
  }
  // The founding stock and the flight both come off this world, so both are counted.
  const fuel = charge.deuterium + input.fuel;
  if (input.stock.deuterium < fuel) return { code: 'FUEL', need: fuel, have: input.stock.deuterium };
  if (!input.canArrive) return { code: 'TOO_LATE' };
  return null;
}
