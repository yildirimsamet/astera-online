import { eq } from 'drizzle-orm';
import { GALAXY, monumentFuelReserves, type Fleet, type Vec3 } from '@astera/rules';
import type { Queryable } from '../db/client.js';
import { planets } from '../db/schema.js';

/** Include any existing out-of-disc operator fixture and the entire legal future home disc. */
export async function reserveMonumentHome(db: Queryable, playerId: string, point: Vec3, fleet: Fleet) {
  const homes = await db.select({ x: planets.x, y: planets.y, z: planets.z }).from(planets).where(eq(planets.controllerPlayerId, playerId));
  const radius = Math.max(GALAXY.radius, ...homes.map(home => Math.hypot(home.x, home.y, home.z)));
  // An outbound recall starts anywhere between the origin and the meeting.
  return monumentFuelReserves(fleet, Math.max(Math.hypot(point.x, point.y, point.z), radius) + radius);
}
