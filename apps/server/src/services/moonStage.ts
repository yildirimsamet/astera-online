import { eq } from 'drizzle-orm';
import { hashSeed, type MoonRarity } from '@astera/rules';
import type { Clock } from '../clock.js';
import type { Db } from '../db/client.js';
import { moons, planets } from '../db/schema.js';
import { publishShard } from '../stream/bus.js';
import { GameError } from './planet.js';

/**
 * THE PLAYTEST'S MOON (Ay plan §6.23, review B4). A stage or local galaxy can be handed a moon of a chosen
 * rarity, so F10 tries a Legendary gate without waiting for a battle to bear one. Production refuses: a
 * moon there is earned, built or conquered.
 */
export const stageMoonToolAllowed = (env: { NODE_ENV: string; SENTRY_ENVIRONMENT: string }): boolean =>
  env.NODE_ENV !== 'production' || env.SENTRY_ENVIRONMENT === 'stage';

export async function placeStageMoon(db: Db, planetId: string, rarity: MoonRarity, clock: Clock): Promise<void> {
  await db.transaction(async (tx) => {
    const [world] = await tx.select({ seasonId: planets.seasonId }).from(planets).where(eq(planets.id, planetId));
    if (!world) throw new GameError('PLANET_NOT_FOUND', 'No such world', 404);
    const written = await tx.insert(moons).values({
      planetId, rarity, origin: 'BATTLE', visualSeed: hashSeed('moon-visual', planetId) % 2_147_483_647, bornAt: clock.now(), asteriumSyncedAt: clock.now(),
    }).onConflictDoNothing({ target: moons.planetId }).returning({ planetId: moons.planetId });
    if (written.length === 0) throw new GameError('MOON_EXISTS', 'This world already has a moon', 409);
    await publishShard(tx, world.seasonId, 'moons');
  });
}
