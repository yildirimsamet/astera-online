import { hullReach, nearestObstacle, type ArenaLayout, type Contact, type FlightTuning, type Vec3 } from '@astera/rules/arena';

const contact: Contact = { index: -1, nx: 0, ny: 0, nz: 0, depth: 0 };

/** Where a scrape sparks: the nearest real surface (Y2) within the ship's hull reach of its centre. */
export function scrapePoint(layout: ArenaLayout, p: Vec3, tuning: FlightTuning, out: Vec3): boolean {
  if (nearestObstacle(layout, p, hullReach(tuning) + 1, contact) < 0) return false;
  out.x = p.x - contact.nx * contact.depth; out.y = p.y - contact.ny * contact.depth; out.z = p.z - contact.nz * contact.depth;
  return true;
}
