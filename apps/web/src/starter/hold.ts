import { STARTER, holdIsFull, jumpHold, jumpWindowOpen, type Resources, type VesselProgress } from '@astera/rules';

/** What the ship holds, as its own view carries it: the store, the works, work in progress and its crates. */
interface Held extends Resources {
  bufferAlloy: number;
  bufferCrystal: number;
  bufferDeuterium: number;
  queue: readonly { cost: Resources }[];
  crates: readonly { state: 'sealed' | 'ready' | 'opened'; alloy: number; crystal: number }[];
}

/** The hold as the jump and its panel count it (`jumpHold`): work in progress pays back, ready crates open. */
const heldForJump = (ship: Held): Resources => jumpHold(ship, ship.queue, ship.crates.filter(crate => crate.state === 'ready'));

/**
 * HOW FULL THE HOLD IS, 0 TO 1 (plan 2026-11-13 §4.4): alloy and crystal weigh the same, each up to what
 * the jump carries, so it reads 1 only when both are full (`holdIsFull`).
 */
export function holdShare(ship: Held): number {
  const held = heldForJump(ship);
  return (Math.min(1, held.alloy / STARTER.carry.alloy) + Math.min(1, held.crystal / STARTER.carry.crystal)) / 2;
}

/** Nothing more would go down with the ship: the advisor brings the jump to the front. */
export const holdFull = (ship: Held): boolean => holdIsFull(heldForJump(ship));

const fullKey = (id: string) => `astera.starter.holdFull.${id}`;

/**
 * THE HOLD FILLS (plan 2026-11-13 §4.5, a medium moment): from here on what the ship earns cannot go
 * down with it. Said once a ship, the first time it is seen full with the jump open, so a player who
 * was away while it filled hears it on the first look. A device that keeps nothing may hear it again.
 */
export function holdFullDue(ship: Held & VesselProgress & { id: string }): boolean {
  if (!jumpWindowOpen(ship) || !holdFull(ship)) return false;
  try { return window.localStorage.getItem(fullKey(ship.id)) === null; } catch { return true; }
}

export function rememberHoldFull(id: string): void {
  try { window.localStorage.setItem(fullKey(id), '1'); } catch { /* the moment may play again */ }
}
