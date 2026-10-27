import type { ShipClass } from '@astera/rules/arena';
import type { ArenaAssets, PreparedModel } from './assets/load.js';

/**
 * The model drawn for a pilot: the ship of the class it flies (Y4), else one of the older
 * rivals — the bots by their role, anyone else by id; null when the pack has neither.
 */
export function shipModelFor(assets: ArenaAssets, ship: ShipClass, role: string | undefined, id: number): PreparedModel | null {
  const classed = assets.classes.get(ship);
  if (classed) return classed;
  const rivals = assets.rivals;
  if (rivals.length === 0) return null;
  const pick = role === 'miner' ? rivals.length - 1 : role === 'hunter' ? 0 : role === 'patrol' ? 1 % rivals.length : (id * 7) % rivals.length;
  return rivals[pick] ?? rivals[0] ?? null;
}
