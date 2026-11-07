import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import type { Clock } from '../clock.js';
import type { Db } from '../db/client.js';
import { players, seasons, starterGalaxies, vessels } from '../db/schema.js';

export interface UniverseView {
  galaxies: { ordinal: number; ships: number }[];
  /** The caller's own starter galaxy. Null for a commander in the main galaxy. */
  mine: number | null;
}

const HOLD_MS = 60_000;

interface Held { at: number; galaxies: UniverseView['galaxies'] }

/**
 * THE WHOLE SERVER AT A GLANCE, for the view past the zoom limit. A galaxy's number gives its place in
 * every client (`starterGalaxyCentre`), so all this adds is how many ships hold a place in each. No
 * id, name or position leaves here. One count per shard a minute, whoever asks.
 */
export class UniverseReader {
  private readonly held = new Map<string, Held>();

  constructor(private readonly db: Db, private readonly clock: Clock) {}

  async read(accountId: string): Promise<UniverseView> {
    const [ship] = await this.db.select({ shardId: starterGalaxies.shardId, ordinal: starterGalaxies.ordinal }).from(vessels)
      .innerJoin(starterGalaxies, eq(starterGalaxies.id, vessels.starterGalaxyId))
      .where(and(eq(vessels.accountId, accountId), inArray(vessels.status, ['ACTIVE', 'DORMANT', 'DEPARTING'])));
    const shardId = ship?.shardId ?? await this.commanderShard(accountId);
    return { galaxies: shardId ? await this.count(shardId) : [], mine: ship?.ordinal ?? null };
  }

  private async commanderShard(accountId: string): Promise<string | null> {
    const [seat] = await this.db.select({ shardId: seasons.shardId }).from(players)
      .innerJoin(seasons, eq(seasons.id, players.seasonId))
      .where(and(eq(players.accountId, accountId), eq(seasons.status, 'live')));
    return seat?.shardId ?? null;
  }

  private async count(shardId: string): Promise<UniverseView['galaxies']> {
    const now = this.clock.now().getTime();
    const held = this.held.get(shardId);
    if (held && now - held.at < HOLD_MS) return held.galaxies;
    const galaxies = await this.db.select({ ordinal: starterGalaxies.ordinal, ships: sql<number>`count(*)::int` }).from(vessels)
      .innerJoin(starterGalaxies, eq(starterGalaxies.id, vessels.starterGalaxyId))
      .where(and(eq(starterGalaxies.shardId, shardId), inArray(vessels.status, ['ACTIVE', 'DEPARTING'])))
      .groupBy(starterGalaxies.ordinal)
      .orderBy(asc(starterGalaxies.ordinal));
    this.held.set(shardId, { at: now, galaxies });
    return galaxies;
  }
}
