import { randomInt, randomUUID } from 'node:crypto';
import { STARTER, openingEconomy, openingProgress, pickVesselSlot, starterSlots, vesselHull, type PlanetSlot, type VesselHull } from '@astera/rules';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import type { Clock } from '../../clock.js';
import type { Db, Queryable, Tx } from '../../db/client.js';
import { accounts, shards, starterGalaxies, vessels } from '../../db/schema.js';
import { isAdminAccount } from '../admin.js';
import { GameError } from '../planet.js';
import { accountHasPlayHistory } from '../player.js';
import type { VesselRow } from './vessel.js';

/** A seed makes the same berths every time, and they are read on every enlistment. */
const berths = new Map<number, PlanetSlot[]>();
const berthsOf = (seed: number): PlanetSlot[] => {
  let found = berths.get(seed);
  if (!found) {
    found = starterSlots(seed);
    berths.set(seed, found);
  }
  return found;
};

/** Who holds a place. A sleeping ship and one that has left do not. */
const ABOARD = inArray(vessels.status, ['ACTIVE', 'DEPARTING']);

const mainShard = async (q: Queryable): Promise<string | null> =>
  (await q.select({ id: shards.id }).from(shards).where(eq(shards.role, 'MAIN')).orderBy(asc(shards.ordinal)).limit(1))[0]?.id ?? null;

const openGalaxy = async (q: Queryable) =>
  (await q.select().from(starterGalaxies).where(eq(starterGalaxies.status, 'OPEN')).orderBy(asc(starterGalaxies.ordinal)).limit(1))[0] ?? null;

const peopleAboard = async (q: Queryable, galaxyId: string): Promise<number> =>
  (await q.select({ n: sql<number>`count(*)::int` }).from(vessels).where(and(eq(vessels.starterGalaxyId, galaxyId), ABOARD)))[0]?.n ?? 0;

/** A newcomer can always have a ship, unless the door was closed by hand: a full galaxy opens the next. */
async function hasRoom(q: Queryable): Promise<boolean> {
  if (await openGalaxy(q)) return true;
  const [any] = await q.select({ id: starterGalaxies.id }).from(starterGalaxies).limit(1);
  return !any && (await mainShard(q)) !== null;
}

/** How many times one enlistment looks again, through galaxies filling around it, before it gives up. */
const OPENINGS = 8;

/**
 * THE GALAXY THE NEXT SHIP GOES TO, created on first use and locked: places are handed out one at a
 * time. The oldest with room comes first, so a place that came free is filled before another galaxy
 * opens. All are locked in one order, so that two enlistments cannot wait on each other. Not a key
 * lock: a command writing a row that names the galaxy has no business waiting for a berth.
 */
export async function lockGalaxyWithRoom(tx: Tx, clock: Clock, prefer?: string) {
  const shardId = await mainShard(tx);
  if (!shardId) return null;
  const open = (ordinal: number) => tx.insert(starterGalaxies).values({
    shardId, ordinal, seed: randomInt(1, 2 ** 31), epoch: clock.now(), capacity: STARTER.capacity,
  }).onConflictDoNothing();
  await open(1);
  for (let attempt = 0; attempt < OPENINGS; attempt++) {
    const galaxies = await tx.select().from(starterGalaxies).where(eq(starterGalaxies.status, 'OPEN'))
      .orderBy(asc(starterGalaxies.ordinal)).for('no key update');
    if (galaxies.length === 0) return null;
    const ordered = [...galaxies.filter(galaxy => galaxy.id === prefer), ...galaxies.filter(galaxy => galaxy.id !== prefer)];
    for (const galaxy of ordered) if (await peopleAboard(tx, galaxy.id) < galaxy.capacity) return galaxy;
    // The list above was read before the lock came through: whoever held it may have opened one already.
    const newestSeen = galaxies.at(-1)?.ordinal ?? 0;
    const [{ newestOpen, last } = { newestOpen: 0, last: 0 }] = await tx.select({
      newestOpen: sql<number>`coalesce(max(${starterGalaxies.ordinal}) filter (where ${starterGalaxies.status} = 'OPEN'), 0)::int`,
      last: sql<number>`max(${starterGalaxies.ordinal})::int`,
    }).from(starterGalaxies);
    if (newestOpen <= newestSeen) await open(last + 1);
  }
  return null;
}

/** Where a ship can stand in this galaxy, near whoever is active, or none. */
export async function pickBerth(q: Queryable, galaxy: { id: string; seed: number }) {
  const aboard = await q.select({ slot: vessels.slotIndex, status: vessels.status, x: vessels.x, y: vessels.y, z: vessels.z })
    .from(vessels).where(and(eq(vessels.starterGalaxyId, galaxy.id), ABOARD));
  const taken = new Set(aboard.flatMap(ship => ship.slot === null ? [] : [ship.slot]));
  return pickVesselSlot(berthsOf(galaxy.seed), taken, aboard.filter(ship => ship.status === 'ACTIVE'));
}

export interface StarterStanding {
  /** A ship still in this galaxy. One that has left is a planet now, and no longer named. */
  vessel: { id: string; name: string; status: VesselRow['status']; starterGalaxyId: string } | null;
  /** May take a ship if they ask: the door is open, they have never played, and there is room. */
  eligible: boolean;
}

/**
 * ONE ANSWER TO "WHICH DOOR?", for `me`, the claim and the join. An account with a ship always has
 * its ship; the flag only stops new ones, so that nobody is stranded when it is turned off (§7).
 */
export async function starterStanding(db: Db, accountId: string, enabled: boolean, admins: ReadonlySet<string>): Promise<StarterStanding> {
  const [ship] = await db.select({ id: vessels.id, name: vessels.name, status: vessels.status, starterGalaxyId: vessels.starterGalaxyId })
    .from(vessels).where(eq(vessels.accountId, accountId));
  if (ship) return { vessel: ship.status === 'DEPARTED' ? null : ship, eligible: false };
  if (!enabled || await accountHasPlayHistory(db, accountId) || await isAdminAccount(db, accountId, admins)) {
    return { vessel: null, eligible: false };
  }
  return { vessel: null, eligible: await hasRoom(db) };
}

const notEligible = () => new GameError('VESSEL_NOT_ELIGIBLE', 'This account cannot take a colony ship', 403);

/**
 * A SHIP FOR A NEW ACCOUNT, built from the constant and never from anything a browser says. Two
 * requests make one row: the unique account index decides, and the loser reads what the winner
 * wrote. Answered again later with the same ship, unless it has already left: one ship, ever.
 */
/**
 * An id that wears this hull. The hull is read off the id (`vesselHull`) and needs no column, so
 * the prologue's ship is kept by drawing ids until one matches: three hulls, a few draws at most.
 */
export function idForHull(hull: VesselHull): string {
  for (;;) {
    const id = randomUUID();
    if (vesselHull(id) === hull) return id;
  }
}

export async function enlistVessel(db: Db, accountId: string, clock: Clock, admins: ReadonlySet<string> = new Set(), prefer?: string, hull?: VesselHull): Promise<string> {
  const held = async (q: Queryable) => {
    const [ship] = await q.select({ id: vessels.id, status: vessels.status }).from(vessels).where(eq(vessels.accountId, accountId));
    if (ship?.status === 'DEPARTED') throw notEligible();
    return ship?.id ?? null;
  };
  const existing = await held(db);
  if (existing) return existing;
  if (await accountHasPlayHistory(db, accountId) || await isAdminAccount(db, accountId, admins)) throw notEligible();

  return db.transaction(async (tx) => {
    const galaxy = await lockGalaxyWithRoom(tx, clock, prefer);
    if (!galaxy) throw notEligible();
    // Read under the galaxy's lock: whoever held it before us has committed its berth.
    const raced = await held(tx);
    if (raced) return raced;

    const slot = await pickBerth(tx, galaxy);
    if (!slot) throw notEligible();

    const [account] = await tx.select({ name: accounts.displayName }).from(accounts).where(eq(accounts.id, accountId));
    const now = clock.now();
    const economy = openingEconomy((now.getTime() - galaxy.epoch.getTime()) / 60_000);
    const [ship] = await tx.insert(vessels).values({
      ...(hull ? { id: idForHull(hull) } : {}),
      accountId,
      starterGalaxyId: galaxy.id,
      slotIndex: slot.index,
      x: slot.x, y: slot.y, z: slot.z,
      name: account?.name ?? 'Commander',
      alloy: economy.alloy,
      crystal: economy.crystal,
      deuterium: economy.deuterium,
      bufferAlloy: economy.bufferAlloy,
      lastTickMinutes: economy.lastTickMinutes,
      modules: openingProgress().modules,
      sightSince: now,
      enlistedAt: now,
      lastSeenAt: now,
      lastProgressAt: now,
    }).onConflictDoNothing({ target: vessels.accountId }).returning({ id: vessels.id });
    if (ship) return ship.id;
    const winner = await held(tx);
    if (!winner) throw notEligible();
    return winner;
  });
}
