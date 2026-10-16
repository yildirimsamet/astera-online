import { coreTier, pvpBalanceForTier, type PvpBalance } from '@astera/rules';
import type { SimNeutralWorld, SimPlayer } from './season.js';

export interface SimPvpHoldings {
  neutrals: readonly Pick<SimNeutralWorld, 'controllerId' | 'buildings'>[];
}

/** Same commander-wide peak as the server; a captured small world cannot lower it. */
export function simCommanderPeakCore(
  world: SimPvpHoldings,
  player: Pick<SimPlayer, 'id' | 'buildings'>,
): number {
  let peak = player.buildings.CORE;
  for (const colony of world.neutrals) {
    if (colony.controllerId === player.id) peak = Math.max(peak, colony.buildings.CORE);
  }
  return peak;
}

export const simCommanderPvpBalance = (
  world: SimPvpHoldings,
  player: Pick<SimPlayer, 'id' | 'buildings'>,
): PvpBalance => pvpBalanceForTier(coreTier(simCommanderPeakCore(world, player)));

