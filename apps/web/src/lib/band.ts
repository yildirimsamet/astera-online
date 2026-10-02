import { ABUSE, coreTier } from '@astera/rules';
import type { GalaxyPlanet } from '../api/schemas.js';

/** A world the caller holds: the capital (`isSelf`) or any colony (`isOwned`). */
const isMine = (world: GalaxyPlanet): boolean => world.isSelf || world.isOwned === true;

/**
 * THE CALLER'S OWN PEAK, AS THE BAND READS IT: the tallest Core across every world
 * they hold. Never fogged, so it is exact. A Core LEVEL rather than a tier, because
 * the rules package states the band on levels (`withinTierBand`, `tierBandReach`).
 *
 * NULL, NOT 1, WHEN NOTHING OF THEIRS IS ON THE DISC. That is a payload that has
 * not arrived; a tier 1 answer would flash a wrong range and a refusal across every
 * surface for the frame before the galaxy loads.
 */
export function ownPeakCore(planets: readonly GalaxyPlanet[]): number | null {
  let peak = 0;
  for (const world of planets) {
    if (isMine(world)) peak = Math.max(peak, world.coreLevel);
  }
  return peak === 0 ? null : peak;
}

/**
 * THE HALF OF THE ATTACK BAND THE CLIENT IS ALLOWED TO STATE. D168 · D127.
 *
 * D168 refuses a raid unless the two COMMANDERS' development tiers are within
 * `ABUSE.tierBand`, each measured on the tallest Command Core they hold anywhere.
 * Its own note records the cost: the rule is invisible until the refusal, so a
 * commander opens the sheet, picks a fleet, presses launch and is told no — which
 * is D124's "a rule the player cannot see is not a usable rule", in the one place
 * it is most expensive.
 *
 * THE CLIENT CANNOT SIMPLY COMPUTE THE RULE, AND THAT IS D127 WORKING. The galaxy
 * route redacts every world outside the caller's own Telescope reach down to an id
 * and a position — no `coreLevel`, no controller. So what the client can read of
 * ANOTHER commander's peak is a LOWER BOUND; they may hold a taller Core somewhere
 * nobody has looked. The caller's own peak is exact, because their own worlds
 * always resolve — ALL of them: the capital arrives as `isSelf`, every colony as
 * `isOwned`, and reading only the first once told a commander whose colony had
 * out-built their capital that a legal target was "too developed".
 *
 * That asymmetry decides what may be drawn, and it is soundness rather than taste:
 *
 *   · WHAT IS VISIBLE IS ALREADY TOO FAR ABOVE — the true peak can only be higher
 *     and the gap can only grow, so the refusal is CERTAIN and the control may
 *     state it. This function.
 *   · WHAT IS VISIBLE LOOKS TOO FAR BELOW — the true peak may be anywhere above
 *     it, so the fight may well be legal. Nothing may be drawn. A control that
 *     refused here would be inventing a rule out of the caller's own blindness,
 *     and the player would never learn it was wrong: the launch they did not
 *     attempt teaches nothing.
 *
 * So the interface closes the half of D168 that fog can prove and leaves the
 * other half to the server's refusal, where it was. `attack-band.test.tsx` holds
 * the soundness property: anything this refuses, `canAttack` refuses too.
 *
 * THE ANSWER IS A BOOLEAN AND NOT A REASON, deliberately. A second value would be
 * the `TIER_BAND_WEAK` case, and there is no honest way for this side to produce
 * it — a shape that could carry it is a shape somebody fills in.
 */
export function outOfBandAbove(
  planets: readonly GalaxyPlanet[],
  target: GalaxyPlanet,
): boolean {
  // A neutral world, a redacted one and a rock have no commander to measure.
  if (target.controller?.kind !== 'PLAYER') return false;
  if (isMine(target)) return false;

  const mine = ownPeakCore(planets);
  if (mine === null) return false;

  const them = target.controller.playerId;
  let theirs = 0;
  for (const world of planets) {
    if (world.controller?.kind === 'PLAYER' && world.controller.playerId === them) {
      theirs = Math.max(theirs, world.coreLevel);
    }
  }

  return coreTier(theirs) - coreTier(mine) > ABUSE.tierBand;
}
