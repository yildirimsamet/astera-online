import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { fleetCount, hpLethalAtMs, type HpRadiationSource, type MonumentShipLot } from '@astera/rules';
import type { Tx } from '../db/client.js';
import { monuments, type monumentWaves } from '../db/schema.js';
import type { LockedMonument } from './monument.js';
import { GameError } from './planet.js';
import { schedule } from '../worker/queue.js';
import { publishShard } from '../stream/bus.js';

const point = z.object({ x: z.number().finite(), y: z.number().finite(), z: z.number().finite() });
export const monumentRouteSchema = z.array(z.object({ from: point, to: point,
  startMs: z.number().int().nonnegative().safe(), endMs: z.number().int().nonnegative().safe(),
}).refine((leg) => leg.endMs >= leg.startMs, 'A flight cannot end before it starts'))
  .nonempty().refine((legs) => legs.every((leg, index) => index === 0 || leg.startMs >= legs[index - 1]!.endMs), 'Flight legs overlap');

/** A loss event wakes the first cohort, rather than waiting for the entire wing to disappear. */
export async function scheduleFlightBoundary(tx: Tx, wave: typeof monumentWaves.$inferSelect, lots: readonly MonumentShipLot[], sources: readonly HpRadiationSource[], endsAt: Date): Promise<void> {
  if (wave.status !== 'OUTBOUND' && wave.status !== 'RETURNING') return;
  const parsed = monumentRouteSchema.safeParse(wave.route);
  if (!parsed.success) throw new GameError('MONUMENT_ROUTE_INVALID', 'That wave has no valid physical route', 409);
  const fromMs = wave.radiationSettledAt.getTime();
  const toMs = Math.min(wave.arriveAt?.getTime() ?? fromMs, endsAt.getTime());
  if (toMs <= fromMs) return;
  const windows = sources.flatMap((source) => {
    const activeFromMs = Math.max(source.activeFromMs, fromMs);
    const activeUntilMs = Math.min(source.activeUntilMs ?? toMs, toMs);
    return activeFromMs < activeUntilMs ? [{ ...source, activeFromMs, activeUntilMs }] : [];
  });
  let next: number | null = null;
  for (const lot of lots) {
    const death = hpLethalAtMs(parsed.data, windows, lot);
    if (death !== null) next = Math.min(next ?? death, death);
  }
  if (next === null) return;
  await schedule(tx, { seasonId: wave.seasonId, kind: 'monument_loss', refId: wave.id, resolveAt: new Date(next),
    dedupeKey: `monument-loss:flight:${wave.id}:${wave.generation}:${String(next)}`, payload: { scope: 'FLIGHT', generation: wave.generation } });
}

export async function scheduleHoldBoundary(tx: Tx, locked: LockedMonument, nextLossAt: Date | null): Promise<void> {
  const m = locked.monument;
  if (nextLossAt !== null && nextLossAt <= locked.season.endsAt) await schedule(tx, {
    seasonId: m.seasonId, kind: 'monument_loss', refId: m.id, resolveAt: nextLossAt,
    dedupeKey: `monument-loss:hold:${m.id}:${m.generation}:${String(nextLossAt.getTime())}`, payload: { scope: 'HOLD', generation: m.generation },
  });
  if (m.emptySince === null || m.controllerPlayerId !== null || m.controllerClanId !== null || fleetCount(m.garrison) > 0) return;
  const due = new Date(m.emptySince.getTime() + 86_400_000);
  if (due >= locked.season.endsAt) return;
  await schedule(tx, { seasonId: m.seasonId, kind: 'monument_respawn', refId: m.id, resolveAt: due,
    dedupeKey: `monument-respawn:${m.id}:${m.generation}`, payload: { generation: m.generation } });
}

/** Target advancement calls this before a later arrival, so an outage cannot skip the garrison. */
export async function restoreMonumentGarrison(tx: Tx, locked: LockedMonument, at: Date): Promise<boolean> {
  const m = locked.monument;
  if (m.emptySince === null || m.controllerPlayerId !== null || m.controllerClanId !== null
    || fleetCount(m.garrison) > 0 || m.emptySince.getTime() + 86_400_000 > at.getTime() || at >= locked.season.endsAt
    || locked.waves.some((wave) => wave.status === 'HOLD')) return false;
  m.garrison = m.garrisonTemplate;
  m.garrisonDamage = [];
  m.emptySince = null;
  m.generation += 1;
  await tx.update(monuments).set({ garrison: m.garrison, garrisonDamage: [], emptySince: null, generation: m.generation }).where(eq(monuments.id, m.id));
  await publishShard(tx, m.seasonId, 'control');
  return true;
}
