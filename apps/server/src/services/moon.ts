import { and, eq, gt, inArray, lte, or, sql } from 'drizzle-orm';
import { MOON, effectiveCracks, fleetSizeClass, hangarLoad, hashSeed, moonsEnabled, type FleetSizeClass, type MoonRarity, type SensorZone } from '@astera/rules';
import type { Queryable, Tx } from '../db/client.js';
import { moonMoves, moonSeedLedger, moons, planets, seasons, shards, units, type ProbeMoonReading } from '../db/schema.js';
import { MOON_LOCATION, PLANET_LOCATION } from './unitLocation.js';
import { GameError } from './planet.js';

/**
 * MOONS ON THE SERVER (ay entegrasyon planı §6). A moon row changes only under its planet's lock.
 */

/** Whether this season's galaxy has moons at all (ruleset 20+, MAIN galaxy; plan §6.2). */
export async function seasonHasMoons(tx: Queryable, seasonId: string): Promise<boolean> {
  const [row] = await tx.select({ rulesetVersion: seasons.rulesetVersion, role: shards.role })
    .from(seasons).innerJoin(shards, eq(shards.id, seasons.shardId)).where(eq(seasons.id, seasonId));
  return row !== undefined && moonsEnabled(row, row);
}

/**
 * A SEEDED MOON, AT MOST ONCE A SLOT A SEASON (§6.3, E14).
 *
 * The ledger row is written first and only the writer that created it places the moon, so a slot whose
 * seeded moon was destroyed (S54) or carried away never gets one again when the census reopens it.
 * Returns whether a moon was placed.
 */
export async function seedMoonAt(tx: Tx, input: {
  seasonId: string; planetId: string; slotIndex: number; rarity: MoonRarity; now: Date;
}): Promise<boolean> {
  const claimed = await tx.insert(moonSeedLedger).values({ seasonId: input.seasonId, slotIndex: input.slotIndex })
    .onConflictDoNothing().returning({ slotIndex: moonSeedLedger.slotIndex });
  if (claimed.length === 0) return false;
  await tx.insert(moons).values({
    planetId: input.planetId,
    rarity: input.rarity,
    origin: 'SEED',
    // The column is a signed int; the hash is unsigned.
    visualSeed: hashSeed('moon-visual', input.seasonId, input.slotIndex) % 2_147_483_647,
    bornAt: input.now,
  });
  return true;
}

export type MoonRow = typeof moons.$inferSelect;

/** The moons standing over these worlds, read before the worlds are pulled down. */
export async function moonsOf(tx: Tx, planetIds: readonly string[]): Promise<MoonRow[]> {
  if (planetIds.length === 0) return [];
  return tx.select().from(moons).where(inArray(moons.planetId, [...planetIds]));
}

/*
  A MOON STAYS IN ITS SLOT WHEN A NEW WORLD ROW TAKES THE SLOT (S56, §6.17). It keeps its rarity, origin,
  cracks, last hit and closure; the gate charge starts over (V19).
*/

/** For a world row that is already gone (account deletion): write the remembered moon onto its successor. */
export async function carryMoon(tx: Tx, moon: MoonRow, planetId: string): Promise<void> {
  await tx.insert(moons).values({ ...moon, planetId, gateReadyAt: null });
}

/** For a world row that leaves the slot alive (commander transfer). */
export async function moveMoon(tx: Tx, fromPlanetId: string, toPlanetId: string): Promise<void> {
  await tx.update(moons).set({ planetId: toPlanetId, gateReadyAt: null }).where(eq(moons.planetId, fromPlanetId));
}

/** Everything standing on these worlds' moons lands on their planets (V20), merging into the planet rows. */
export async function landMoonShips(tx: Tx, planetIds: readonly string[]): Promise<void> {
  if (planetIds.length === 0) return;
  const onMoon = and(inArray(units.planetId, [...planetIds]), eq(units.location, MOON_LOCATION));
  const rows = await tx.select().from(units).where(onMoon);
  if (rows.length === 0) return;
  await tx.insert(units).values(rows.map((row) => ({ ...row, location: PLANET_LOCATION }))).onConflictDoUpdate({
    target: [units.planetId, units.hull, units.location],
    set: { count: sql`${units.count} + excluded.count`, damage: sql`${units.damage} || excluded.damage` },
  });
  await tx.delete(units).where(onMoon);
}

/** A hop still in the air holds a transfer, a reclaim and an account deletion back, like any flight (E16). */
export async function moonMovePending(tx: Tx, playerId: string, planetIds: readonly string[]): Promise<boolean> {
  const [move] = await tx.select({ id: moonMoves.id }).from(moonMoves).where(and(
    eq(moonMoves.status, 'PENDING'),
    planetIds.length > 0
      ? or(eq(moonMoves.ownerPlayerId, playerId), inArray(moonMoves.fromPlanetId, [...planetIds]))
      : eq(moonMoves.ownerPlayerId, playerId),
  )).limit(1);
  return move !== undefined;
}

/**
 * THE GALAXY'S MOONS AS ONE OBSERVER MAY SEE THEM (S53, §8, §9.1). Existence, cracks, last hit and the visual
 * seed are public; rarity only for worlds the observer resolves right now (its own included) or remembers
 * from a probe or a battle. A destroyed moon is not in the list, so its remembered rarity is never drawn.
 * Origin never.
 */
export interface GateFlashes {
  arrivals: { planetId: string; at: Date }[];
  departures: { planetId: string; at: Date; size?: FleetSizeClass }[];
}

export async function moonsSeenBy(
  db: Queryable, seasonId: string, visible: ReadonlySet<string>, resolves: (planetId: string) => boolean,
  remembered: (planetId: string) => MoonRarity | undefined = () => undefined,
  /** How the observer's own sensors read each world (S16); their own worlds read IDENTIFIED. */
  zoneOf: (planetId: string) => SensorZone = () => 'NONE',
  now: Date = new Date(0),
): Promise<{
  list: { planetId: string; cracks: number; lastHitAt: Date | null; visualSeed: number }[];
  rarity: Record<string, MoonRarity>;
  flashes: GateFlashes;
}> {
  const rows = await db.select({ planetId: moons.planetId, rarity: moons.rarity, cracks: moons.cracks,
    lastHitAt: moons.lastHitAt, visualSeed: moons.visualSeed })
    .from(moons).innerJoin(planets, eq(planets.id, moons.planetId)).where(eq(planets.seasonId, seasonId));
  const shown = rows.filter((row) => visible.has(row.planetId));
  const rarity: Record<string, MoonRarity> = {};
  for (const row of shown) {
    // Live sight reads today's moon; a memory reads the moon as it was at the look (D127).
    const known = resolves(row.planetId) ? row.rarity : remembered(row.planetId);
    if (known) rarity[row.planetId] = known;
  }
  return {
    // Cracks heal at read time, a day after the last hit (plan §3 ilke 4).
    list: shown.map(({ planetId, cracks, lastHitAt, visualSeed }) => ({
      planetId, cracks: effectiveCracks({ cracks, lastHitAtMs: lastHitAt?.getTime() ?? null }, now.getTime()), lastHitAt, visualSeed,
    })),
    rarity,
    flashes: await gateFlashes(db, seasonId, visible, zoneOf, now),
  };
}

/**
 * THE GATE'S FLASHES (S16, S32, plan §6.22), each for `MOON.flashSeconds` after its instant. A jump's arrival
 * lights the far moon for the whole galaxy. Its departure is seen only where the observer's own sensors
 * reach the world — radar contact gives the flash, identification adds the fleet's rough size. Nobody's name.
 */
async function gateFlashes(
  db: Queryable, seasonId: string, visible: ReadonlySet<string>, zoneOf: (planetId: string) => SensorZone, now: Date,
): Promise<GateFlashes> {
  const since = new Date(now.getTime() - MOON.flashSeconds * 1_000);
  const jumps = await db.select({ from: moonMoves.fromPlanetId, to: moonMoves.toPlanetId, fleet: moonMoves.fleet,
    departAt: moonMoves.departAt, arriveAt: moonMoves.arriveAt, status: moonMoves.status })
    .from(moonMoves).where(and(eq(moonMoves.seasonId, seasonId), eq(moonMoves.kind, 'JUMP'),
      gt(moonMoves.arriveAt, since), lte(moonMoves.departAt, now)));
  const arrivals: GateFlashes['arrivals'] = [];
  const departures: GateFlashes['departures'] = [];
  for (const jump of jumps) {
    if (jump.status === 'LANDED' && jump.arriveAt <= now && visible.has(jump.to)) arrivals.push({ planetId: jump.to, at: jump.arriveAt });
    const zone = visible.has(jump.from) ? zoneOf(jump.from) : 'NONE';
    if (zone === 'NONE' || jump.departAt <= since) continue;
    departures.push({ planetId: jump.from, at: jump.departAt, ...(zone === 'IDENTIFIED' ? { size: fleetSizeClass(hangarLoad(jump.fleet)) } : {}) });
  }
  return { arrivals, departures };
}

/**
 * WHAT A PROBE SEES OF A WORLD'S MOON (S23, V10): rarity, cracks and closure exactly, the fleet standing on
 * it through the probe's own band, and whether a hop was under way. Neutral moons too.
 */
export async function probeMoon(
  tx: Queryable, planetId: string, band: (count: number) => { low: number; high: number }, now: Date,
): Promise<ProbeMoonReading | undefined> {
  const [moon] = await tx.select().from(moons).where(eq(moons.planetId, planetId));
  if (!moon) return undefined;
  const standing = await tx.select({ count: units.count }).from(units)
    .where(and(eq(units.planetId, planetId), eq(units.location, MOON_LOCATION), gt(units.count, 0)));
  const [hop] = await tx.select({ id: moonMoves.id }).from(moonMoves)
    .where(and(eq(moonMoves.fromPlanetId, planetId), eq(moonMoves.status, 'PENDING'))).limit(1);
  return {
    rarity: moon.rarity,
    cracks: effectiveCracks({ cracks: moon.cracks, lastHitAtMs: moon.lastHitAt?.getTime() ?? null }, now.getTime()),
    lastHitAt: moon.lastHitAt?.toISOString() ?? null,
    closedUntil: moon.closedUntil?.toISOString() ?? null,
    fleet: band(standing.reduce((sum, row) => sum + row.count, 0)),
    hopping: hop !== undefined,
  };
}

/** The rarity a battle's observer comes home remembering (S53). */
export async function moonRarityOf(tx: Queryable, planetId: string): Promise<MoonRarity | undefined> {
  const [moon] = await tx.select({ rarity: moons.rarity }).from(moons).where(eq(moons.planetId, planetId));
  return moon?.rarity;
}

/** The telescope's second row (S40): ships on the moon, an empty moon, a hop under way, or no moon at all. */
export type MoonWatchStatus = 'HOME' | 'EMPTY' | 'HOP' | 'NONE';

export async function moonWatchStatus(tx: Queryable, planetIds: readonly string[]): Promise<Map<string, MoonWatchStatus>> {
  const out = new Map<string, MoonWatchStatus>(planetIds.map((id) => [id, 'NONE']));
  if (planetIds.length === 0) return out;
  const ids = [...planetIds];
  const [withMoon, manned, hopping] = await Promise.all([
    tx.select({ id: moons.planetId }).from(moons).where(inArray(moons.planetId, ids)),
    tx.selectDistinct({ id: units.planetId }).from(units)
      .where(and(inArray(units.planetId, ids), eq(units.location, MOON_LOCATION), gt(units.count, 0))),
    tx.selectDistinct({ id: moonMoves.fromPlanetId }).from(moonMoves)
      .where(and(inArray(moonMoves.fromPlanetId, ids), eq(moonMoves.status, 'PENDING'))),
  ]);
  for (const { id } of withMoon) out.set(id, 'EMPTY');
  for (const { id } of manned) if (out.get(id) === 'EMPTY') out.set(id, 'HOME');
  // A hop is the freshest fact: the fleet is between the bodies right now.
  for (const { id } of hopping) if (out.get(id) !== 'NONE') out.set(id, 'HOP');
  return out;
}

/**
 * A RAID MAY AIM AT THIS MOON (S2/S6, S13): the galaxy has moons, the world has one, and somebody holds it.
 * A neutral world's seeded moon has nobody on it to fight; the world is taken through its planet (V42).
 * The moon's existence is public (S53), so `NO_MOON` tells the attacker nothing the map does not.
 */
/**
 * S9: a moon is born over a world only for a holder who has researched Lunar Capture. The research arrives with
 * its art in the F9 slice (V34); until then no commander holds it, and no moon is born in battle (V52).
 */
export function holdsLunarCapture(_tx: Queryable, _playerId: string): Promise<boolean> {
  return Promise.resolve(false);
}

export async function assertMoonTarget(
  tx: Queryable, target: { id: string; seasonId: string; kind: string },
  /** A Death Star may strike a neutral world's seeded moon (S54); a fleet may not fight there. */
  neutralAllowed = false,
): Promise<void> {
  if (!await seasonHasMoons(tx, target.seasonId)) throw new GameError('MOONS_DISABLED', 'This galaxy has no moons', 409);
  const [moon] = await tx.select({ id: moons.planetId }).from(moons).where(eq(moons.planetId, target.id));
  if (!moon) throw new GameError('NO_MOON', 'That world has no moon', 409);
  if (target.kind === 'NEUTRAL' && !neutralAllowed) throw new GameError('MOON_UNCLAIMED', 'Nobody holds that moon; take the world first', 409);
}
