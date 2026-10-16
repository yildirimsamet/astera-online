import { and, eq } from 'drizzle-orm';
import { ANTI_STRATEGIC, pointAlong } from '@astera/rules';
import type { Tx } from '../db/client.js';
import { radiationBombFlights, strategicAssets } from '../db/schema.js';
import { schedule } from '../worker/queue.js';
import { firstShotSince, interceptionLeg, nextCheckAt, publishInterceptionSight, triggerAt, type InterceptionLeg } from './strategicInterception.js';
import { noteRadiationInventoryChange } from './planetRadiation.js';
import { ownedHonorNavy } from './honorNavy.js';
import { strategicHonorIntent, settleStrategicInterceptionHonor } from './honorStrategic.js';
import { honorStrategicValue, RADIATION_BOMB } from '@astera/rules';

type Flight = typeof radiationBombFlights.$inferSelect;

export async function bombInterceptionLeg(tx: Tx, flight: Flight): Promise<InterceptionLeg | null> {
  if (flight.targetPlanetId === null) return null;
  return interceptionLeg(tx, { id: flight.id, seasonId: flight.seasonId, ownerPlayerId: flight.ownerPlayerId,
    originPlanetId: flight.originPlanetId, targetPlanetId: flight.targetPlanetId,
    departAt: flight.departAt, arriveAt: flight.arriveAt }, { from: flight.originPosition, to: flight.targetPosition });
}

/** Caller holds season → sorted worlds → flight locks, shared with Death Star charge claims. */
export async function interceptRadiationBomb(tx: Tx, flight: Flight, now: Date, observedAt = now): Promise<boolean> {
  const leg = await bombInterceptionLeg(tx, flight);
  if (!leg) return false;
  const honor = await strategicHonorIntent(tx, flight.seasonId, `bomb:${flight.id}`);
  const defenceNavy = honor ? await ownedHonorNavy(tx, leg.target.controllerPlayerId, honor.config) : 0;
  const charges = await tx.select().from(strategicAssets).where(and(
    eq(strategicAssets.planetId, leg.target.id), eq(strategicAssets.type, 'INTERCEPTOR'),
    eq(strategicAssets.status, 'READY'))).for('update');
  const readySince = (charge: typeof strategicAssets.$inferSelect) => charge.readyAt ?? charge.startedAt;
  const ordered = charges.toSorted((a, b) => readySince(a).getTime() - readySince(b).getTime());
  for (const charge of ordered) {
    let shot = firstShotSince(leg, readySince(charge));
    if (shot && shot.at > now && readySince(charge) <= now) {
      const trigger = triggerAt(leg, now);
      if (trigger) shot = { at: now, trigger };
    }
    if (!shot || shot.at > now) continue;
    const spent = await tx.update(strategicAssets).set({ status: 'CONSUMED' })
      .where(and(eq(strategicAssets.id, charge.id), eq(strategicAssets.status, 'READY'))).returning({ id: strategicAssets.id });
    if (!spent[0]) continue;
    if (honor) {
      const catalogue = honor.config.strategicCatalogue;
      if (!catalogue) throw new Error('Missing strategic Honor catalogue');
      await settleStrategicInterceptionHonor(tx, { seasonId: flight.seasonId, commitmentId: `bomb:${flight.id}`,
        sourceId: `bomb:${flight.id}`, defender: leg.target.controllerPlayerId, at: shot.at,
        weaponValue: honorStrategicValue(catalogue, RADIATION_BOMB.levels[flight.level].type),
        chargeValue: catalogue.INTERCEPTOR, defenderNavy: defenceNavy });
    }
    const impactAt = new Date(Math.min(flight.arriveAt.getTime(), shot.at.getTime() + ANTI_STRATEGIC.flightSeconds * 1000));
    const positionAt = (at: Date) => pointAlong(leg.drawn.from, leg.drawn.to,
      (at.getTime() - flight.departAt.getTime()) / leg.totalMs);
    const claimed = await tx.update(radiationBombFlights).set({ status: 'INTERCEPTED', resolvedAt: shot.at,
      chargeId: charge.id, interception: { defenderPlayerId: leg.target.controllerPlayerId, trigger: shot.trigger,
        launchAt: shot.at.toISOString(), impactAt: impactAt.toISOString(), launchPosition: { x: leg.target.x, y: leg.target.y, z: leg.target.z },
        weaponPosition: positionAt(shot.at), collisionPosition: positionAt(impactAt) } })
      .where(and(eq(radiationBombFlights.id, flight.id), eq(radiationBombFlights.status, 'OUTBOUND'))).returning({ id: radiationBombFlights.id });
    if (!claimed[0]) throw new Error('bomb interception lost its locked flight after claiming ammunition');
    await tx.update(strategicAssets).set({ status: 'CONSUMED' }).where(eq(strategicAssets.id, flight.assetId));
    for (const playerId of [flight.ownerPlayerId, leg.target.controllerPlayerId]) {
      noteRadiationInventoryChange(tx, playerId, observedAt);
    }
    await schedule(tx, { seasonId: flight.seasonId, kind: 'radiation_bomb_intercept_impact', refId: flight.id,
      dedupeKey: `radiation-bomb-intercept-impact:${flight.id}`, resolveAt: impactAt });
    await publishInterceptionSight(tx, flight.seasonId, positionAt(impactAt), [flight.ownerPlayerId, leg.target.controllerPlayerId]);
    return true;
  }
  return false;
}

export async function scheduleBombInterception(tx: Tx, flight: Flight, now: Date, immediate = true): Promise<void> {
  const leg = await bombInterceptionLeg(tx, flight);
  if (!leg) return;
  const next = immediate && triggerAt(leg, now) !== null ? now : nextCheckAt(leg, now);
  if (next) await schedule(tx, { seasonId: flight.seasonId, kind: 'radiation_bomb_intercept', refId: flight.id,
    dedupeKey: `radiation-bomb-intercept:${flight.id}:${String(next.getTime())}`, resolveAt: next });
}
