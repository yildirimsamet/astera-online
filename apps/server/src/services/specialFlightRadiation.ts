import { createHash } from 'node:crypto';
import { hpRadiationApplies, type HpDamageLots, type Segment, type TechLevels, type Vec3 } from '@astera/rules';
import type { Tx } from '../db/client.js';
import { recomputePlayerWealth } from './planet.js';
import { radiationChanged, settleFlightRadiation, tellRadiationLoss } from './radiation.js';

/** Distinct deterministic notification subjects for a run's two physical legs. */
const lossRef = (id: string, leg: 'OUT' | 'HOME'): string => {
  const hex = createHash('sha256').update(`radiation:${id}:${leg}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};

export const flightSegment = (from: Vec3, to: Vec3, start: Date, end: Date): Segment => ({ from, to, startMs: start.getTime(), endMs: end.getTime() });

/** Keep the route's original velocity when recovery cuts a leg before its ETA. */
export const flightPrefix = (path: readonly Segment[], at: Date): Segment[] => path.flatMap((segment) => {
  const endMs = Math.min(segment.endMs, at.getTime());
  if (endMs <= segment.startMs) return [];
  const fraction = (endMs - segment.startMs) / (segment.endMs - segment.startMs);
  const to = { x: segment.from.x + (segment.to.x - segment.from.x) * fraction,
    y: segment.from.y + (segment.to.y - segment.from.y) * fraction,
    z: segment.from.z + (segment.to.z - segment.from.z) * fraction };
  return [{ ...segment, to, endMs }];
});

/** Family status claims serialize callers; their parked units are the physical roster. */
export async function settleSpecialFlightRadiation(tx: Tx, input: {
  id: string; leg: 'OUT' | 'HOME'; seasonId: string; rulesetVersion: number;
  planetId: string; playerId: string; location: string; path: readonly Segment[];
  damage: HpDamageLots | null; tech: TechLevels; radiationSettledAt: Date | null;
}) {
  const start = input.path[0]?.startMs ?? 0;
  const outcome = await settleFlightRadiation(tx, { ...input, fromMs: Math.max(start, input.radiationSettledAt?.getTime() ?? start) });
  if (hpRadiationApplies(input.rulesetVersion)) {
    await tellRadiationLoss(tx, { playerId: input.playerId, refId: lossRef(input.id, input.leg), toPlanetId: input.planetId },
      outcome, new Date(input.path.at(-1)?.endMs ?? start));
    if (radiationChanged(outcome)) await recomputePlayerWealth(tx, input.playerId);
  }
  return { ...outcome, radiationSettledAt: hpRadiationApplies(input.rulesetVersion)
    ? new Date(Math.max(input.radiationSettledAt?.getTime() ?? start, input.path.at(-1)?.endMs ?? start)) : input.radiationSettledAt };
}
