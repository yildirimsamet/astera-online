import { and, eq, inArray, isNull } from 'drizzle-orm';
import { COSMETIC_CATEGORIES, MOBILE_HULLS, SHIP_SKIN_IDS, canEquipCosmetic, cosmeticById, shipCosmeticForHull, type CosmeticCategory, type CosmeticId, type CosmeticEquipment, type MobileHullId, type ShipCosmeticEquipment } from '@astera/rules';
import type { Db, Queryable } from '../db/client.js';
import { accounts, clanMemberships, clans, cosmeticEntitlements, players } from '../db/schema.js';
import { GameError } from './planet.js';
import { publishShard } from '../stream/bus.js';

export type { CosmeticEquipment } from '@astera/rules';

function validateEquipment(source: CosmeticEquipment, owned: readonly string[]): CosmeticEquipment {
  const equipment: CosmeticEquipment = {};
  for (const category of COSMETIC_CATEGORIES) {
    if (category === 'SHIP') continue;
    const id = source[category];
    if (id && canEquipCosmetic(id, category, owned)) equipment[category] = id;
  }
  const ships: ShipCosmeticEquipment = {};
  for (const hull of MOBILE_HULLS) {
    const id = source.SHIP?.[hull];
    if (id && shipCosmeticForHull(hull, id) && owned.includes(id)) ships[hull] = id;
  }
  if (Object.keys(ships).length) equipment.SHIP = ships;
  return equipment;
}

/** Validate rights on reads too: refunded or revoked appearances never remain visible. */
export async function accountCosmeticEquipment(db: Queryable, accountIds: readonly string[]) {
  if (!accountIds.length) return new Map<string, CosmeticEquipment>();
  const [owners, rights] = await Promise.all([
    db.select({ id: accounts.id, equipment: accounts.cosmeticEquipment }).from(accounts).where(inArray(accounts.id, [...accountIds])),
    db.select({ accountId: cosmeticEntitlements.accountId, id: cosmeticEntitlements.cosmeticId }).from(cosmeticEntitlements)
      .where(and(inArray(cosmeticEntitlements.accountId, [...accountIds]), isNull(cosmeticEntitlements.revokedAt))),
  ]);
  const owned = new Map<string, string[]>();
  for (const right of rights) {
    if (!right.accountId) continue;
    const ids = owned.get(right.accountId) ?? [];
    ids.push(right.id); owned.set(right.accountId, ids);
  }
  return new Map(owners.map(owner => {
    const equipment = validateEquipment(owner.equipment, owned.get(owner.id) ?? []);
    return [owner.id, equipment];
  }));
}

/** The current leader lends their account-owned standard to the entire clan. */
export async function clanCosmeticFlags(db: Queryable, seasonId: string) {
  const leaders = await db.select({ clanId: clanMemberships.clanId, accountId: players.accountId })
    .from(clanMemberships).innerJoin(players, eq(players.id, clanMemberships.playerId))
    .innerJoin(clans, eq(clans.id, clanMemberships.clanId))
    .where(and(eq(clanMemberships.seasonId, seasonId), eq(clanMemberships.role, 'LEADER'),
      isNull(clanMemberships.leftAt), isNull(clans.disbandedAt)));
  const equipment = await accountCosmeticEquipment(db, leaders.map(leader => leader.accountId));
  return new Map(leaders.map(leader => [leader.clanId, equipment.get(leader.accountId)?.FLAG ?? 'flag-vanguard']));
}

export async function equipCosmetic(db: Db, accountId: string, category: CosmeticCategory, cosmeticId: CosmeticId | null, hull?: MobileHullId) {
  if (category === 'PLANET' || (cosmeticId && cosmeticById(cosmeticId)?.category !== category)) {
    throw new GameError('SKIN_SLOT_MISMATCH', 'This appearance does not fit that slot', 400);
  }
  const targetHull = category === 'SHIP' ? hull ?? (cosmeticId ? cosmeticById(cosmeticId)?.hull : undefined) : undefined;
  if ((category === 'SHIP' && (!targetHull || (cosmeticId && !shipCosmeticForHull(targetHull, cosmeticId)))) || (category !== 'SHIP' && hull)) {
    throw new GameError('SKIN_SLOT_MISMATCH', 'This appearance does not fit that ship', 400);
  }
  return db.transaction(async tx => {
    const [owner] = await tx.select().from(accounts).where(eq(accounts.id, accountId)).for('update');
    if (!owner) throw new GameError('ACCOUNT_NOT_FOUND', 'Account not found', 404);
    const [commander] = await tx.select({ id: players.id, seasonId: players.seasonId }).from(players)
      .where(eq(players.accountId, accountId)).limit(1);
    if (category === 'FLAG') {
      const [membership] = commander ? await tx.select({ id: clanMemberships.id }).from(clanMemberships)
        .innerJoin(clans, eq(clans.id, clanMemberships.clanId))
        .where(and(eq(clanMemberships.playerId, commander.id), eq(clanMemberships.role, 'LEADER'),
          isNull(clanMemberships.leftAt), isNull(clans.disbandedAt))).for('update', { of: clanMemberships }) : [];
      if (!membership) throw new GameError('CLAN_LEADER_REQUIRED', 'Only the clan leader can equip a standard', 403);
    }
    const rights = await tx.select({ id: cosmeticEntitlements.cosmeticId }).from(cosmeticEntitlements)
      .where(and(eq(cosmeticEntitlements.accountId, accountId), isNull(cosmeticEntitlements.revokedAt))).for('update');
    if (!canEquipCosmetic(cosmeticId, category, rights.map(right => right.id))) {
      throw new GameError('SKIN_NOT_OWNED', 'You do not own this appearance', 403);
    }
    let equipment = validateEquipment(owner.cosmeticEquipment, rights.map(right => right.id));
    if (category === 'SHIP' && targetHull) {
      const { [targetHull]: _previous, ...remaining } = equipment.SHIP ?? {};
      const ships: ShipCosmeticEquipment = { ...remaining };
      const shipId = SHIP_SKIN_IDS.find(id => id === cosmeticId);
      if (shipId) ships[targetHull] = shipId;
      if (Object.keys(ships).length) equipment.SHIP = ships;
      else delete equipment.SHIP;
    } else if (category !== 'SHIP') {
      if (cosmeticId) equipment[category] = cosmeticId;
      else {
        const { [category]: _previous, ...rest } = equipment;
        equipment = rest;
      }
    }
    await tx.update(accounts).set({ cosmeticEquipment: equipment }).where(eq(accounts.id, accountId));
    if (commander) await publishShard(tx, commander.seasonId, 'world');
    return { category, cosmeticId, ...(targetHull ? { hull: targetHull } : {}) };
  });
}
