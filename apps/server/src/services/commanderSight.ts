import { and, eq, gt, inArray, isNotNull, isNull } from 'drizzle-orm';
import type { AdmiralSnapshot } from '@astera/rules/arena';
import type { Queryable } from '../db/client.js';
import { arenaAdmirals, arenaAdmiralLegs, arenaShips, clanSupportWaves, planets } from '../db/schema.js';
import type { Contact } from './traffic.js';

/** Only physical appearance; repair clocks, resources and arena state stay private. */
export async function visibleParkedShips(db: Queryable, capitalIds: string[], now: Date) {
  if (!capitalIds.length) return new Map<string, AdmiralSnapshot & { docked: boolean }>();
  const rows = await db.select({ planetId: planets.id, ship: arenaShips.ship, level: arenaShips.level, readyAt: arenaShips.readyAt })
    .from(planets).innerJoin(arenaShips, eq(arenaShips.playerId, planets.controllerPlayerId))
    .leftJoin(arenaAdmirals, and(eq(arenaAdmirals.playerId, arenaShips.playerId), eq(arenaAdmirals.status, 'returned'),
      isNotNull(arenaAdmirals.homeDepartAt), gt(arenaAdmirals.finishedAt, now)))
    .where(and(inArray(planets.id, capitalIds), eq(planets.kind, 'CAPITAL'), isNull(arenaShips.sortieId),
      isNull(arenaShips.admiralId), isNull(arenaAdmirals.id)));
  return new Map(rows.map(row => [row.planetId, { ship: row.ship, level: row.level, docked: row.readyAt !== null && row.readyAt > now }]));
}

/** Once per shared galaxy snapshot. Read the departure snapshot, never the mutable hangar level. */
export async function loadTrafficEscorts(db: Queryable, seasonId: string): Promise<ReadonlyMap<string, AdmiralSnapshot>> {
  const legs = await db.select({ kind: arenaAdmiralLegs.kind, refId: arenaAdmiralLegs.refId, ship: arenaAdmirals.ship, level: arenaAdmirals.level })
    .from(arenaAdmiralLegs).innerJoin(arenaAdmirals, eq(arenaAdmirals.id, arenaAdmiralLegs.admiralId))
    .where(and(eq(arenaAdmirals.seasonId, seasonId), eq(arenaAdmirals.status, 'active'), isNull(arenaAdmiralLegs.finishedAt)));
  const escorts = new Map<string, AdmiralSnapshot>();
  for (const leg of legs) if (leg.kind !== 'defence') escorts.set(leg.refId, { ship: leg.ship, level: leg.level });
  const support = legs.filter(leg => leg.kind === 'defence');
  if (support.length) {
    const waves = await db.select({ id: clanSupportWaves.id, out: clanSupportWaves.outboundMissionId, back: clanSupportWaves.returnMissionId })
      .from(clanSupportWaves).where(inArray(clanSupportWaves.id, support.map(leg => leg.refId)));
    const byWave = new Map(support.map(leg => [leg.refId, { ship: leg.ship, level: leg.level }]));
    for (const wave of waves) {
      const escort = byWave.get(wave.id);
      if (escort) for (const id of [wave.out, wave.back]) if (id) escorts.set(id, escort);
    }
  }
  return escorts;
}

/** Identification is earned before this projection: Radar and public battle effects carry no escort. */
export function decorateTrafficEscorts(contacts: Contact[], escorts?: ReadonlyMap<string, AdmiralSnapshot>): Contact[] {
  if (!escorts?.size) return contacts;
  return contacts.map(contact => {
    const admiral = contact.kind === 'fleet' && !contact.effectOnly ? escorts.get(contact.id) : undefined;
    return admiral ? { ...contact, admiral } : contact;
  });
}
