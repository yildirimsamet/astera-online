import { eq } from 'drizzle-orm';
import { MOON } from '@astera/rules';
import type { Clock } from '../clock.js';
import type { Db, Tx } from '../db/client.js';
import { moons } from '../db/schema.js';
import { buildQueueContext, placeBuildOrder } from './buildQueue.js';
import { holdsLunarCapture, seasonHasMoons } from './moon.js';
import { GameError, assertWorldOperational, loadLocked } from './planet.js';
import { buildPlanetResult, loadPlanetViewData } from './planetView.js';

/**
 * BUILD A COMMON MOON (Ay S7, S8, V29; plan §6.4). On the world's CONSTRUCTION line, for the owner's set price
 * and time. One moon a world: refused while one stands or one is already ordered. A moon born in battle while
 * this order stands takes its place and pays the order back in full (V1, `abandonMoonOrders`).
 */
export async function orderMoonTx(tx: Tx, planetId: string, clock: Clock, expectedPlayerId?: string) {
  const planet = await loadLocked(tx, planetId, clock, { expectedPlayerId });
  assertWorldOperational(planet);
  if (!await seasonHasMoons(tx, planet.seasonId)) throw new GameError('MOONS_DISABLED', 'This galaxy has no moons', 409);
  if (!await holdsLunarCapture(tx, planet.playerId)) {
    throw new GameError('RESEARCH_LOCKED', 'Research Lunar Capture first', 403, { projectId: 'LUNAR_CAPTURE' });
  }
  const [standing] = await tx.select({ planetId: moons.planetId }).from(moons).where(eq(moons.planetId, planetId));
  if (standing) throw new GameError('MOON_EXISTS', 'This world already has a moon', 409);
  const context = await buildQueueContext(tx, planet, 'CONSTRUCTION');
  if (context.orders.some((order) => order.kind === 'MOON')) {
    throw new GameError('MOON_ALREADY_ORDERED', 'A moon is already being built here', 409);
  }
  const order = await placeBuildOrder(tx, planet, context, {
    kind: 'MOON', subject: 'COMMON', count: 1, cost: MOON.build.cost, minutes: MOON.build.minutes,
  });
  return { orderId: order.id, planet: await loadPlanetViewData(tx, planetId, clock) };
}

export async function orderMoon(db: Db, planetId: string, clock: Clock, expectedPlayerId?: string) {
  // `orderMoonTx` takes the world's lock itself (`loadLocked`); a second lock around it read the world twice (review B1).
  return db.transaction((tx) => orderMoonTx(tx, planetId, clock, expectedPlayerId)).then(buildPlanetResult);
}
