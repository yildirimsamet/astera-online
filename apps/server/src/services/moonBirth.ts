import { eq } from 'drizzle-orm';
import { hashSeed, replaces, rollMoonBirth, type MoonRarity } from '@astera/rules';
import type { Tx } from '../db/client.js';
import { moons, planets } from '../db/schema.js';
import { publishShard } from '../stream/bus.js';
import { abandonMoonOrders } from './buildQueue.js';
import { recordGalaxyEvent } from './chronicle.js';
import { holdsLunarCapture, seasonHasMoons } from './moon.js';
import { settleWorldMoonAsterium } from './synthesis.js';

/**
 * A MOON BORN IN BATTLE (S9, S11, S44, V16; plan §6.13). Rolled once per PvP battle over a held world, from
 * the wreck BEFORE any collector or clan purse took its share, and seeded by the battle so a replay rolls the
 * same moon. A rarer moon takes the old one's place — healed, charged, its ships still standing on it; a
 * commoner one changes nothing. The galaxy hears that a moon was born, never its rarity (S53, V18).
 */
export async function settleMoonBirth(tx: Tx, input: {
  planetId: string; missionId: string; wreck: number; now: Date;
}): Promise<MoonRarity | null> {
  const [world] = await tx.select({ id: planets.id, seasonId: planets.seasonId, kind: planets.kind,
    controllerPlayerId: planets.controllerPlayerId, name: planets.name }).from(planets).where(eq(planets.id, input.planetId));
  if (!world?.controllerPlayerId || world.kind === 'NEUTRAL') return null;
  if (!await seasonHasMoons(tx, world.seasonId)) return null;
  if (!await holdsLunarCapture(tx, world.controllerPlayerId)) return null;
  const born = rollMoonBirth(hashSeed('moon-birth', input.missionId), input.wreck);
  if (!born) return null;
  const [current] = await tx.select({ rarity: moons.rarity }).from(moons).where(eq(moons.planetId, world.id)).for('update');
  if (!replaces(current?.rarity ?? null, born)) return null;
  const moon = {
    rarity: born, origin: 'BATTLE' as const, cracks: 0, lastHitAt: null, closedUntil: null, gateReadyAt: null,
    visualSeed: hashSeed('moon-visual', input.missionId) % 2_147_483_647, bornAt: input.now, bornMissionId: input.missionId,
  };
  // A rarer moon makes Asteryum faster: the old one is paid up to its last instant first (plan §3.3).
  if (current) {
    await settleWorldMoonAsterium(tx, world.id, input.now);
    await tx.update(moons).set(moon).where(eq(moons.planetId, world.id));
  } else await tx.insert(moons).values({ planetId: world.id, ...moon, asteriumSyncedAt: input.now });
  // V1: the world has its moon now; a Common one still being built is dropped and paid back in full.
  await abandonMoonOrders(tx, world.id, input.now);
  await recordGalaxyEvent(tx, { seasonId: world.seasonId, kind: 'moon_born', refId: input.missionId,
    subjectPlanetId: world.id, payload: { planetName: world.name }, occurredAt: input.now });
  await publishShard(tx, world.seasonId, 'moons');
  return born;
}
