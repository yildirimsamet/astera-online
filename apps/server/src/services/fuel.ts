import { GameError } from './planet.js';

/**
 * FULL FUEL OR NO LAUNCH, WRITTEN ONCE. T6 — owner instruction.
 *
 * Four launch paths charge fuel — the raid, the transfer, the settlement and clan
 * aid — and each of them used to state the rule for itself. Four copies of one
 * sentence is four chances to get it wrong, and the game has already spent one of
 * them: `launchTransfer` compared the tank against the flight, compared the tank
 * against the cargo one line above, and never compared it against the SUM. A
 * commander shipping their whole tank wrote a NEGATIVE store, and nothing
 * downstream defends against that — the lazy tick, the loot maths and the readout
 * all take the figure at face value.
 *
 * SO THE HOLD COMES OFF THE TOP, HERE, FOR EVERY PATH. Deuterium in a cargo bay
 * has already left this world as far as the flight is concerned. A path with no
 * hold passes nothing and reads exactly as it did before.
 *
 * WHAT IT DOES NOT DO is decide the amount: that is `missionFuel` in
 * `@astera/rules`, the one function the server, the launch screen and the
 * simulator all read. This is the guard and the refusal, which are server
 * business — the numbers in the refusal are the two the screens print.
 */

/** What is left to burn once the hold has taken its share. Never negative. */
export const fuelAvailable = (held: number, committedDeuterium = 0): number =>
  Math.max(0, held - committedDeuterium);

/**
 * Full fuel or no launch.
 *
 * The refusal carries `needed` and `have` because the client prints both — a
 * commander who is told only "not enough" cannot tell whether to leave one ship
 * behind or build a refinery. `have` is FLOORED: the store is a float and a
 * fraction of a drop buys nothing.
 */
export function assertFuel(fuel: number, held: number, committedDeuterium = 0): void {
  const have = fuelAvailable(held, committedDeuterium);
  if (have < fuel) {
    throw new GameError('INSUFFICIENT_FUEL', 'Not enough deuterium to fly that', 400, {
      needed: fuel,
      have: Math.floor(have),
    });
  }
}
