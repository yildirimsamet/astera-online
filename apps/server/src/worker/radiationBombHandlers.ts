import { eq } from 'drizzle-orm';
import type { Handler } from './handlers.js';
import { radiationBombFlights } from '../db/schema.js';
import { lockSeason } from '../services/planet.js';
import { beginPlanetRadiationBoundary, settlePlanetRadiationAt } from '../services/planetRadiation.js';
import { planets } from '../db/schema.js';
import { lockWorlds } from '../services/ownership.js';
import { resolveRadiationBomb } from '../services/radiationBomb.js';
import { interceptRadiationBomb, scheduleBombInterception } from '../services/radiationBombInterception.js';
import { notify } from '../services/notifications.js';
import { publishShard } from '../stream/bus.js';
import { warnRadiationBombInTx } from '../services/radiationBombWarning.js';

export const onRadiationBombArrival: Handler = async ({ db, clock }, event) => {
  if (!event.refId) throw new Error('radiation_bomb_arrival without refId');
  await resolveRadiationBomb(db, event.refId, clock);
};

export const onRadiationBombIntercept: Handler = async ({ db, clock }, event) => {
  if (!event.refId) throw new Error('radiation_bomb_intercept without refId');
  await db.transaction(async tx => {
    const [identity] = await tx.select().from(radiationBombFlights).where(eq(radiationBombFlights.id, event.refId!));
    if (identity?.status !== 'OUTBOUND' || !identity.targetPlanetId) return;
    const season = await lockSeason(tx, identity.seasonId, false);
    if (season.status !== 'live') return;
    await lockWorlds(tx, [identity.originPlanetId, identity.targetPlanetId], { requireLive: false });
    const [flight] = await tx.select().from(radiationBombFlights).where(eq(radiationBombFlights.id, identity.id)).for('update');
    if (flight?.status !== 'OUTBOUND') return;
    if (await interceptRadiationBomb(tx, flight, clock.now())) return;
    await warnRadiationBombInTx(tx, flight, clock.now());
    if (clock.now() < flight.arriveAt) await scheduleBombInterception(tx, flight, clock.now(), false);
  });
};

export const onRadiationBombInterceptImpact: Handler = async ({ db, clock }, event) => {
  if (!event.refId) throw new Error('radiation_bomb_intercept_impact without refId');
  await db.transaction(async tx => {
    const [flight] = await tx.select().from(radiationBombFlights).where(eq(radiationBombFlights.id, event.refId!));
    const interception = flight?.interception;
    if (flight?.status !== 'INTERCEPTED' || !interception) return;
    const at = new Date(interception.impactAt);
    if (at > clock.now()) return;
    for (const playerId of new Set([flight.ownerPlayerId, interception.defenderPlayerId])) {
      await notify(tx, { playerId, kind: 'strategic_intercepted', refId: flight.id, at,
        payload: { weaponKind: 'RADIATION_BOMB', level: flight.level, targetPlanetId: flight.targetPlanetId,
          defended: playerId === interception.defenderPlayerId,
          attackerPlayerId: flight.ownerPlayerId, defenderPlayerId: interception.defenderPlayerId } });
    }
    await publishShard(tx, flight.seasonId, 'impact');
  });
};

export const onPlanetRadiationBoundary: Handler = async ({ db, clock }, event) => {
  if (!event.refId) throw new Error('planet_radiation_boundary without refId');
  await db.transaction(async tx => {
    const season = await lockSeason(tx, event.seasonId, false);
    if (season.status !== 'live') return;
    const [planet] = await tx.select().from(planets).where(eq(planets.id, event.refId!));
    if (planet?.seasonId !== season.id) return;
    await lockWorlds(tx, [planet.id], { requireLive: false });
    await beginPlanetRadiationBoundary(tx, planet.id, event.resolveAt);
    await settlePlanetRadiationAt(tx, planet.id, clock.now());
  });
};
