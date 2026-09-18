import { and, eq } from 'drizzle-orm';
import { planetSkinById, type PlanetSkinId } from '@astera/rules';
import type { Db, Queryable } from '../db/client.js';
import { accounts, planets, cosmeticEntitlements, players } from '../db/schema.js';
import { publishShard } from '../stream/bus.js';
import { GameError } from './planet.js';
import { commanderForAccount } from './ownership.js';
import { normaliseUsername } from '../auth/credentials.js';

/** Rights are account scoped; planet choices belong to a seasonal world. */
export async function skinCollection(db: Queryable, accountId: string) {
  const rights = await db.select({ skinId: cosmeticEntitlements.cosmeticId })
    .from(cosmeticEntitlements)
    .where(eq(cosmeticEntitlements.accountId, accountId));
  const worlds = await db.select({
    id: planets.id,
    name: planets.name,
    skinId: planets.equippedSkinId,
  }).from(planets)
    .innerJoin(players, eq(players.id, planets.controllerPlayerId))
    .where(eq(players.accountId, accountId));
  return {
    ownedSkinIds: rights.map((right) => right.skinId).filter((id): id is PlanetSkinId => planetSkinById(id) !== null),
    planets: worlds.map((world) => ({
      ...world,
      skinId: world.skinId && planetSkinById(world.skinId) ? world.skinId : null,
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
  skinId: PlanetSkinId,
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
        )).limit(1);
      if (committed?.source === 'MANUAL' && committed.orderRef === orderRef) {
        return { accountId, skinId, grantedAt: committed.grantedAt };
      }
      throw new GameError('SKIN_ORDER_CONFLICT', 'This order was already used', 409);
    }
    return { accountId, skinId, grantedAt: inserted.grantedAt };
  });
}
