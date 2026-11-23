import { cosmeticById, welcomeBox, welcomeNext, type CosmeticId } from '@astera/rules';
import { eq } from 'drizzle-orm';
import type { Clock } from '../clock.js';
import type { Db, Queryable, Tx } from '../db/client.js';
import { accounts, cosmeticEntitlements, players, vessels, welcomeWeek } from '../db/schema.js';
import { publishShard } from '../stream/bus.js';
import { capitalPlanet } from './ownership.js';
import { GameError, refreshWealth, saveResources, withPlanetLock } from './planet.js';

/**
 * Where the box goes: the capital of a commander who came by colony ship and has landed. Null aboard
 * (plan 2026-11-18 S6: the week starts at the landing) and for an account that never had a ship.
 */
async function destination(q: Queryable, accountId: string) {
  const [ship] = await q.select({ status: vessels.status }).from(vessels).where(eq(vessels.accountId, accountId));
  if (ship?.status !== 'DEPARTED') return null;
  const [player] = await q.select({ id: players.id, seasonId: players.seasonId }).from(players).where(eq(players.accountId, accountId)).limit(1);
  if (!player) return null;
  const capital = await capitalPlanet(q, player.id);
  return { planetId: capital.id, seasonId: player.seasonId };
}

/** The welcome week as the panel draws it, or null for an account it is not for. */
export async function welcomeView(db: Db, accountId: string, now: Date) {
  const to = await destination(db, accountId);
  if (!to) return { welcome: null };
  const [row] = await db.select().from(welcomeWeek).where(eq(welcomeWeek.accountId, accountId));
  const opened = row?.opened ?? 0;
  const next = welcomeNext(opened, row ? row.lastOpenedAt.getTime() : null);
  return {
    welcome: {
      opened,
      box: next.box,
      // Ready "now" reads as now; a later moment as itself.
      readyAt: next.readyAtMs === null ? null : new Date(Math.max(next.readyAtMs, now.getTime())).toISOString(),
      preview: next.box === null ? null : welcomeBox(next.box),
    },
  };
}

/** Counts the box under the row's lock: two presses at once open one. */
async function takeBox(tx: Tx, accountId: string, now: Date): Promise<number> {
  await tx.insert(welcomeWeek).values({ accountId, opened: 0, lastOpenedAt: now }).onConflictDoNothing();
  const [row] = await tx.select().from(welcomeWeek).where(eq(welcomeWeek.accountId, accountId)).for('update');
  const next = welcomeNext(row!.opened, row!.opened === 0 ? null : row!.lastOpenedAt.getTime());
  if (next.box === null) throw new GameError('WELCOME_DONE', 'Every welcome box is open', 409);
  if (next.readyAtMs! > now.getTime()) throw new GameError('WELCOME_NOT_READY', 'The next box is not ready yet', 409, { readyAt: new Date(next.readyAtMs!).toISOString() });
  await tx.update(welcomeWeek).set({ opened: next.box, lastOpenedAt: now }).where(eq(welcomeWeek.accountId, accountId));
  return next.box;
}

/** Grants a welcome-box cosmetic entitlement and auto-equips it if its slot is currently empty. */
async function grantWelcomeCosmetic(
  tx: Tx,
  accountId: string,
  seasonId: string,
  boxIndex: number,
  cosmeticId: CosmeticId,
  now: Date,
): Promise<void> {
  await tx.insert(cosmeticEntitlements).values({
    accountId,
    cosmeticId,
    source: 'WELCOME_WEEK',
    orderRef: `welcome:${accountId}:${String(boxIndex)}`,
    grantedAt: now,
  }).onConflictDoNothing();

  const item = cosmeticById(cosmeticId);
  if (!item || (item.category !== 'RING' && item.category !== 'ENGINE')) return;
  const [owner] = await tx.select({ equipment: accounts.cosmeticEquipment })
    .from(accounts).where(eq(accounts.id, accountId)).for('update');
  if (!owner || owner.equipment[item.category]) return;
  await tx.update(accounts)
    .set({ cosmeticEquipment: { ...owner.equipment, [item.category]: cosmeticId } })
    .where(eq(accounts.id, accountId));
  await publishShard(tx, seasonId, 'world');
}

/** Opens the next box into the capital's store (and cosmetic inventory on days 3 & 7), in the transaction that counts it. */
export async function openWelcomeBox(db: Db, accountId: string, clock: Clock) {
  const to = await destination(db, accountId);
  if (!to) throw new GameError('WELCOME_NOT_ELIGIBLE', 'This account has no welcome week', 404);
  const now = clock.now();
  const granted = await withPlanetLock(db, to.planetId, clock, async (tx, planet) => {
    const boxIndex = await takeBox(tx, accountId, now);
    const box = welcomeBox(boxIndex);
    planet.alloy += box.alloy;
    planet.crystal += box.crystal;
    planet.deuterium += box.deuterium;
    await saveResources(tx, to.planetId, { alloy: planet.alloy, crystal: planet.crystal, deuterium: planet.deuterium });
    await refreshWealth(tx, planet);
    if (box.cosmeticId) {
      await grantWelcomeCosmetic(tx, accountId, to.seasonId, boxIndex, box.cosmeticId, now);
    }
    return box;
  });
  return { granted, ...(await welcomeView(db, accountId, now)) };
}

