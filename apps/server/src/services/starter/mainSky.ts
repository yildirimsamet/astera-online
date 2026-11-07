import { createHash } from 'node:crypto';
import { motionPositionAt, type MonumentMotion } from '@astera/rules';
import { and, eq } from 'drizzle-orm';
import type { Clock } from '../../clock.js';
import type { Db } from '../../db/client.js';
import { planets, seasons, shards, starterGalaxies, vessels } from '../../db/schema.js';
import { galaxyFactsAt, loadGalaxyFacts } from '../galaxyFacts.js';
import { GameError } from '../planet.js';

interface Whole { x: number; y: number; z: number }

export interface MainSky {
  points: number[];
  worlds: number;
  server: string;
  seasonEndsAt: string | null;
  monuments: { position: Whole; difficulty: 'LEGACY' | 'EASY' | 'HARD'; ordinal: number; motion?: MonumentMotion }[];
  clouds: { mode: 'EMIT' | 'SHELTER'; center: Whole; radius: number; intensityHpPerMinute: number; level?: 1 | 2 | 3; motion?: MonumentMotion }[];
}

const whole = ({ x, y, z }: Whole): Whole => ({ x: Math.round(x), y: Math.round(y), z: Math.round(z) });

interface Held { at: number; body: MainSky; etag: string }

const HOLD_MS = 10 * 60_000;
/** Only the podiums read this, and the sky draws no podium. */
const NO_ADMINS: ReadonlySet<string> = new Set();

/**
 * THE MAIN GALAXY AS A PICTURE. Positions and a count, flat and rounded, and no id, name or owner,
 * so a client here has nothing to aim at (K1). One read per shard every ten minutes, whoever asks,
 * and no event wakes it: a thousand people on ships add nothing to the main galaxy's load.
 */
export class MainSkyReader {
  private readonly held = new Map<string, Held>();

  constructor(private readonly db: Db, private readonly clock: Clock) {}

  async read(accountId: string): Promise<Held> {
    const [ship] = await this.db.select({ shardId: starterGalaxies.shardId, server: shards.name }).from(vessels)
      .innerJoin(starterGalaxies, eq(starterGalaxies.id, vessels.starterGalaxyId))
      .innerJoin(shards, eq(shards.id, starterGalaxies.shardId))
      .where(eq(vessels.accountId, accountId));
    if (!ship) throw new GameError('VESSEL_NOT_FOUND', 'This account has no colony ship', 404);

    const now = this.clock.now().getTime();
    const held = this.held.get(ship.shardId);
    if (held && now - held.at < HOLD_MS) return held;

    const [season] = await this.db.select({ id: seasons.id, endsAt: seasons.endsAt }).from(seasons)
      .where(and(eq(seasons.shardId, ship.shardId), eq(seasons.status, 'live')));
    const worlds = season
      ? await this.db.select({ x: planets.x, y: planets.y, z: planets.z }).from(planets).where(eq(planets.seasonId, season.id))
      : [];
    const facts = season ? await loadGalaxyFacts(this.db, season.id, NO_ADMINS, this.clock.now()) : null;
    const landmarks = facts ? galaxyFactsAt(facts, this.clock.now()) : null;
    const body: MainSky = {
      points: worlds.flatMap(world => [Math.round(world.x), Math.round(world.y), Math.round(world.z)]),
      worlds: worlds.length,
      server: ship.server,
      seasonEndsAt: season?.endsAt.toISOString() ?? null,
      // Picked field by field: the views hold ids, holders and targets that must not reach a ship.
      monuments: (landmarks?.monuments ?? []).map(({ position, difficulty, ordinal, motion }) => ({
        position: whole(position), difficulty, ordinal, ...(motion ? { motion } : {}),
      })),
      clouds: (landmarks?.hpRadiation ?? []).filter(cloud => cloud.origin !== 'BOMB').map(cloud => ({
        mode: cloud.mode, center: whole(cloud.motion ? motionPositionAt(cloud.motion, now) : cloud.center), radius: Math.round(cloud.radius), intensityHpPerMinute: cloud.intensityHpPerMinute,
        ...(cloud.level === undefined ? {} : { level: cloud.level }),
        ...(cloud.motion ? { motion: cloud.motion } : {}),
      })),
    };
    const fresh: Held = { at: now, body, etag: `"${createHash('sha1').update(JSON.stringify(body)).digest('base64url')}"` };
    this.held.set(ship.shardId, fresh);
    return fresh;
  }
}
