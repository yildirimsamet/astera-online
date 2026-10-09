import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { Queryable } from '../db/client.js';
import { clanMemberships, players } from '../db/schema.js';
import type { Contact, TrafficSnapshot } from './traffic.js';
import { accountCosmeticEquipment, clanCosmeticFlags } from './cosmeticEquipment.js';
import { MOBILE_HULLS, shipCosmeticForHull, type ShipCosmeticEquipment } from '@astera/rules';

type Appearance = NonNullable<Contact['appearance']>;

/** Loaded once with the shared traffic snapshot, never queried separately per observer. */
export async function loadCosmeticTraffic(db: Queryable, seasonId: string, snapshot: TrafficSnapshot): Promise<ReadonlyMap<string, Appearance>> {
  const ownerByFlight = new Map<string, string>();
  for (const { mission } of snapshot.missionRows) if (mission.ownerPlayerId) ownerByFlight.set(mission.id, mission.ownerPlayerId);
  for (const { raid } of snapshot.pirateRaidRows) if (raid.ownerPlayerId) ownerByFlight.set(raid.id, raid.ownerPlayerId);
  for (const { run } of snapshot.tradeRunRows) ownerByFlight.set(run.id, run.ownerPlayerId);
  for (const { run } of snapshot.convoyRunRows) ownerByFlight.set(run.id, run.ownerPlayerId);
  for (const flight of snapshot.monumentTraffic?.flights ?? []) ownerByFlight.set(flight.id, flight.ownerPlayerId);
  const ids = [...new Set(ownerByFlight.values())];
  if (!ids.length) return new Map();
  const commanders = await db.select({ id: players.id, accountId: players.accountId, clanId: clanMemberships.clanId })
    .from(players).leftJoin(clanMemberships, and(eq(clanMemberships.playerId, players.id), isNull(clanMemberships.leftAt)))
    .where(and(eq(players.seasonId, seasonId), inArray(players.id, ids)));
  const [equipment, flags] = await Promise.all([
    accountCosmeticEquipment(db, commanders.map(commander => commander.accountId)), clanCosmeticFlags(db, seasonId),
  ]);
  const byPlayer = new Map(commanders.map(commander => [commander.id, commander]));
  const byFlight = new Map<string, Appearance>();
  for (const [id, playerId] of ownerByFlight) {
    const owner = byPlayer.get(playerId);
    if (!owner) continue;
    const look = equipment.get(owner.accountId);
    const appearance = {
      ...(look?.ENGINE ? { engineId: look.ENGINE } : {}),
      ...(look?.PROBE ? { probeId: look.PROBE } : {}),
      ...(look?.SHIP ? { shipSkins: look.SHIP } : {}),
      ...(owner.clanId ? { flagId: flags.get(owner.clanId) } : {}),
    };
    if (Object.keys(appearance).length) byFlight.set(id, appearance);
  }
  return byFlight;
}

/** The observer's sight decision happens first. Cosmetics never upgrade an anonymous contact. */
export function decorateCosmeticContacts(contacts: Contact[], appearances?: ReadonlyMap<string, Appearance>): Contact[] {
  if (!appearances?.size) return contacts;
  return contacts.map(contact => {
    if (contact.kind === 'unknown' || contact.effectOnly) return contact;
    const look = appearances.get(contact.id);
    if (!look) return contact;
    const shipSkins: ShipCosmeticEquipment = {};
    if (contact.kind === 'fleet' && contact.fleet) for (const hull of MOBILE_HULLS) {
      const id = look.shipSkins?.[hull];
      if ((contact.fleet[hull] ?? 0) > 0 && id && shipCosmeticForHull(hull, id)) shipSkins[hull] = id;
    }
    const appearance: Appearance = {
      ...(contact.kind === 'fleet' && look.engineId ? { engineId: look.engineId } : {}),
      ...(contact.kind === 'fleet' && look.flagId ? { flagId: look.flagId } : {}),
      ...(contact.kind === 'probe' && look.probeId ? { probeId: look.probeId } : {}),
      ...(Object.keys(shipSkins).length ? { shipSkins } : {}),
    };
    return Object.keys(appearance).length ? { ...contact, appearance } : contact;
  });
}
