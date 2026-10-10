import { and, eq, isNull } from 'drizzle-orm';
import { COSMETIC_CATEGORIES, MOBILE_HULLS, cosmeticById, type CosmeticEquipment, type CosmeticId,
  planetSkinById, type PlanetSkinId, type ShipCosmeticEquipment } from '@astera/rules';
import type { Db, Queryable } from '../db/client.js';
import { accounts, planets, cosmeticEntitlements, players, clanMemberships } from '../db/schema.js';
import { publishShard } from '../stream/bus.js';
import { GameError } from './planet.js';
import { commanderForAccount } from './ownership.js';
import { accountCosmeticEquipment, clanCosmeticFlags } from './cosmeticEquipment.js';
import { normaliseUsername } from '../auth/credentials.js';

/** Frozen inventory vocabulary of clients released before wave two. Never expand this list. */
export const LEGACY_COSMETIC_IDS = [
  'planet-lava', 'planet-ice', 'planet-toxic', 'planet-desert', 'planet-turkey',
  'planet-germany', 'planet-france', 'planet-spain', 'planet-japan',
  'ring-aurora', 'ring-helios', 'ring-singularity',
  'engine-aurora', 'engine-helios', 'engine-singularity', 'engine-titan',
  'flag-vanguard', 'flag-orbit', 'flag-aurora', 'flag-helios', 'flag-singularity',
  'flag-reaper', 'flag-ravager', 'flag-serpent', 'flag-phoenix', 'flag-ironfang',
  'probe-ufo', 'ship-red-dragon', 'ship-scorpion', 'ship-shark', 'ship-stingray',
] as const satisfies readonly CosmeticId[];

/** Rights are account scoped; planet choices belong to a seasonal world. */
export async function skinCollection(db: Queryable, accountId: string, supportedCosmetics?: ReadonlySet<string>) {
  // This limits the response vocabulary only. Ownership and equipment validation still use all rights.
  const supports = (id: string): boolean => supportedCosmetics?.has(id) ?? true;
  const rights = await db.select({ skinId: cosmeticEntitlements.cosmeticId })
    .from(cosmeticEntitlements)
    .where(and(eq(cosmeticEntitlements.accountId, accountId), isNull(cosmeticEntitlements.revokedAt)));
  const worlds = await db.select({
    id: planets.id,
    name: planets.name,
    skinId: planets.equippedSkinId,
  }).from(planets)
    .innerJoin(players, eq(players.id, planets.controllerPlayerId))
    .where(eq(players.accountId, accountId));
  const equipment = await accountCosmeticEquipment(db, [accountId]);
  const equipped = equipment.get(accountId) ?? {};
  const visibleEquipment: CosmeticEquipment = {};
  for (const category of COSMETIC_CATEGORIES) {
    if (category === 'SHIP') continue;
    const id = equipped[category];
    if (id && supports(id)) visibleEquipment[category] = id;
  }
  const ships: ShipCosmeticEquipment = {};
  for (const hull of MOBILE_HULLS) {
    const id = equipped.SHIP?.[hull];
    if (id && supports(id)) ships[hull] = id;
  }
  if (Object.keys(ships).length) visibleEquipment.SHIP = ships;
  const [membership] = await db.select({ clanId: clanMemberships.clanId, role: clanMemberships.role, seasonId: players.seasonId })
    .from(players).innerJoin(clanMemberships, and(eq(clanMemberships.playerId, players.id), isNull(clanMemberships.leftAt)))
    .where(eq(players.accountId, accountId)).limit(1);
  const clanFlags = membership ? await clanCosmeticFlags(db, membership.seasonId) : new Map<string, string>();
  const clanFlagId = membership ? clanFlags.get(membership.clanId) ?? null : null;
  return {
    clanFlagId: clanFlagId && !supports(clanFlagId)
      ? supports('flag-vanguard') ? 'flag-vanguard' : null : clanFlagId,
    canEquipFlag: membership?.role === 'LEADER',
    ownedCosmeticIds: rights.map(right => right.skinId).filter((id): id is CosmeticId => cosmeticById(id) !== null && supports(id)),
    equipment: visibleEquipment,
    ownedSkinIds: rights.map((right) => right.skinId).filter((id): id is PlanetSkinId => planetSkinById(id) !== null && supports(id)),
    planets: worlds.map((world) => ({
      ...world,
      skinId: world.skinId && planetSkinById(world.skinId) && supports(world.skinId) ? world.skinId : null,
    })),
  };
}

export async function equipPlanetSkin(
  db: Db,
  accountId: string,
  planetId: string,
  skinId: PlanetSkinId | null,
): Promise<{ id: string; skinId: PlanetSkinId | null }> {
  return db.transaction(async (tx) => {
    const commander = await commanderForAccount(tx, accountId);
    if (skinId !== null) {
      const [right] = await tx.select({ id: cosmeticEntitlements.id })
        .from(cosmeticEntitlements)
        .where(and(
          eq(cosmeticEntitlements.accountId, accountId),
          eq(cosmeticEntitlements.cosmeticId, skinId),
          isNull(cosmeticEntitlements.revokedAt),
        )).limit(1);
      if (!right) throw new GameError('SKIN_NOT_OWNED', 'You do not own this skin', 403);
    }
    // The conditional update and control-transfer write both lock this planet row.
    const [updated] = await tx.update(planets)
      .set({ equippedSkinId: skinId })
      .where(and(
        eq(planets.id, planetId),
        eq(planets.seasonId, commander.seasonId),
        eq(planets.controllerPlayerId, commander.playerId),
      ))
      .returning({ id: planets.id });
    if (!updated) throw new GameError('PLANET_NOT_OWNED', 'You do not control that world', 403);
    await publishShard(tx, commander.seasonId, 'world');
    return { id: updated.id, skinId };
  });
}

/** Operator records an externally verified purchase. A replay is harmless. */
export async function grantPlanetSkin(
  db: Db,
  operatorAccountId: string,
  username: string,
  skinId: CosmeticId,
  orderRef: string,
) {
  return db.transaction(async (tx) => {
    const [account] = await tx.select({ id: accounts.id }).from(accounts)
      .where(eq(accounts.username, normaliseUsername(username))).limit(1);
    if (!account) throw new GameError('ACCOUNT_NOT_FOUND', 'Account not found', 404);
    const accountId = account.id;
    const [existing] = await tx.select().from(cosmeticEntitlements)
      .where(and(
        eq(cosmeticEntitlements.accountId, accountId),
        eq(cosmeticEntitlements.cosmeticId, skinId),
        isNull(cosmeticEntitlements.revokedAt),
      )).limit(1);
    if (existing) {
      if (existing.source === 'MANUAL' && existing.orderRef === orderRef) return { accountId, skinId, grantedAt: existing.grantedAt };
      throw new GameError('SKIN_ALREADY_OWNED', 'This account already owns the skin', 409);
    }
    const [inserted] = await tx.insert(cosmeticEntitlements).values({
      accountId, cosmeticId: skinId, source: 'MANUAL', orderRef, grantedByAccountId: operatorAccountId,
    }).onConflictDoNothing().returning({ grantedAt: cosmeticEntitlements.grantedAt });
    if (!inserted) {
      // A concurrent replay can win the unique insert after our first read.
      // Read the committed row before deciding whether this is a replay or a
      // reused order for a different entitlement.
      const [committed] = await tx.select().from(cosmeticEntitlements)
        .where(and(
          eq(cosmeticEntitlements.accountId, accountId),
          eq(cosmeticEntitlements.cosmeticId, skinId),
          isNull(cosmeticEntitlements.revokedAt),
        )).limit(1);
      if (committed?.source === 'MANUAL' && committed.orderRef === orderRef) {
        return { accountId, skinId, grantedAt: committed.grantedAt };
      }
      throw new GameError('SKIN_ORDER_CONFLICT', 'This order was already used', 409);
    }
    return { accountId, skinId, grantedAt: inserted.grantedAt };
  });
}
