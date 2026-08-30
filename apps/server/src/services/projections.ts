import type { Db, Queryable } from '../db/client.js';
import type { EventBus, StreamEvent } from '../stream/bus.js';
import { AsyncCache, type AsyncCacheStats } from './asyncCache.js';
import { publicWorlds, type PublicWorld } from './publicGalaxy.js';
import { loadTrafficSnapshot, sensorPosts, type SensorPost, type TrafficSnapshot } from './traffic.js';
import { rememberedWorlds, type RememberedWorlds } from './intel.js';
import { loadMiningSnapshot, type MiningSnapshot } from './mining.js';
import {
  commanderTopology,
  type CommanderTopology,
} from './ownership.js';

export interface ProjectionConfig {
  enabled: boolean;
  maxSeasons: number;
  maxAccounts: number;
  commanderTtlMs: number;
  publicTtlMs: number;
  trafficTtlMs: number;
  miningTtlMs: number;
}

export interface ProjectionStatus {
  enabled: boolean;
  commander: AsyncCacheStats;
  sensors: AsyncCacheStats;
  remembered: AsyncCacheStats;
  publicGalaxy: AsyncCacheStats;
  traffic: AsyncCacheStats;
  mining: AsyncCacheStats;
}

/**
 * Replica-local shared projections. D99.
 *
 * The bus is the correctness boundary: when LISTEN is down, reads bypass every
 * cache. A committed shard event invalidates before the same process writes the
 * SSE line, and single-flight turns the resulting fan-out into one rebuild on
 * each API replica. Shared world/traffic/mining entries contain no caller field;
 * separate account/player-keyed entries hold only that caller's private topology.
 */
export class Projections {
  private readonly publicGalaxy: AsyncCache<PublicWorld[]>;
  private readonly traffic: AsyncCache<TrafficSnapshot>;
  private readonly mining: AsyncCache<MiningSnapshot>;
  private readonly commanders: AsyncCache<CommanderTopology>;
  /**
   * WHAT EACH COMMANDER CAN SEE MOVING. D123.
   *
   * Player-keyed and cleared in exactly the branches that clear `commanders`,
   * because the two have to agree: a captured colony brings both a world id and
   * that world's eyes, and a horizon computed from a fresher world list than the
   * one the caller is filtering with would publish contacts around a planet the
   * same request says they do not hold.
   *
   * A completed build invalidates its owner's exact entry before the waking client
   * can reuse it. An impact has no player id by design, so the rare destructive
   * event clears the bounded set: a lowered Core may shrink a Telescope or Radar,
   * and serving the old wider horizon even briefly would reveal unearned data.
   * TTL remains only a repair net; it is never the correctness mechanism.
   */
  private readonly sensors: AsyncCache<SensorPost[]>;
  /**
   * WHAT EACH COMMANDER REMEMBERS ABOUT WORLDS THEY CANNOT SEE. D127.
   *
   * Player-keyed and cleared with `commanders`, for the same reason: a captured
   * colony changes both what a caller controls and what they can resolve without
   * a probe, and the two may never be read from different generations.
   *
   * A new probe report invalidates its player's entry on the private event. TTL is
   * only the fallback if caching is disabled or a listener reconnect forces all
   * reads to bypass; the waking client must see the committed report immediately.
   */
  private readonly remembered: AsyncCache<RememberedWorlds>;
  private readonly stopObserving: () => void;
  private readonly stopObservingResets: () => void;

  constructor(
    private readonly db: Db,
    private readonly bus: EventBus,
    private readonly config: ProjectionConfig,
  ) {
    const usable = (): boolean => this.config.enabled && this.bus.status().listening;
    this.commanders = new AsyncCache<CommanderTopology>(
      config.maxAccounts,
      config.commanderTtlMs,
      usable,
    );
    this.sensors = new AsyncCache<SensorPost[]>(
      config.maxAccounts,
      config.commanderTtlMs,
      usable,
    );
    this.remembered = new AsyncCache<RememberedWorlds>(
      config.maxAccounts,
      config.commanderTtlMs,
      usable,
    );
    this.publicGalaxy = new AsyncCache<PublicWorld[]>(
      config.maxSeasons,
      config.publicTtlMs,
      usable,
    );
    this.traffic = new AsyncCache<TrafficSnapshot>(
      config.maxSeasons,
      config.trafficTtlMs,
      usable,
    );
    this.mining = new AsyncCache<MiningSnapshot>(
      config.maxSeasons,
      config.miningTtlMs,
      usable,
    );
    this.stopObserving = bus.observe((event) => {
      this.onEvent(event);
    });
    this.stopObservingResets = bus.observeReset(() => {
      this.clear();
    });
  }

  worlds(seasonId: string, now: Date): Promise<PublicWorld[]> {
    return this.publicGalaxy.get(seasonId, () => publicWorlds(this.db, seasonId, now));
  }

  commander(accountId: string): Promise<CommanderTopology> {
    return this.commanders.get(accountId, () => commanderTopology(this.db, accountId));
  }

  /** The caller's own sensor posts, for the traffic horizon. D123. */
  sensorsFor(playerId: string, planetIds: readonly string[]): Promise<SensorPost[]> {
    return this.sensors.get(playerId, () => sensorPosts(this.db, planetIds));
  }

  /** The caller's own probe memory, for the three galaxy intel states. D127. */
  rememberedFor(playerId: string): Promise<RememberedWorlds> {
    return this.remembered.get(playerId, () => rememberedWorlds(this.db, playerId));
  }

  trafficSnapshot(seasonId: string, now: Date = new Date()): Promise<TrafficSnapshot> {
    return this.traffic.get(seasonId, () => loadTrafficSnapshot(this.db, seasonId, now));
  }

  miningSnapshot(
    seasonId: string,
    now: Date,
    source: Queryable = this.db,
  ): Promise<MiningSnapshot> {
    // A transactional caller may supply its already-acquired connection. This is
    // important for mutations that assemble a view before commit: a cold fan-out
    // must not hold every pool slot while its shared fill waits for another one.
    return this.mining.get(seasonId, () => loadMiningSnapshot(source, seasonId, now));
  }

  invalidate(seasonId: string): void {
    this.publicGalaxy.invalidate(seasonId);
    this.traffic.invalidate(seasonId);
    this.mining.invalidate(seasonId);
  }

  status(): ProjectionStatus {
    return {
      enabled: this.config.enabled && this.bus.status().listening,
      commander: this.commanders.status(),
      sensors: this.sensors.status(),
      remembered: this.remembered.status(),
      publicGalaxy: this.publicGalaxy.status(),
      traffic: this.traffic.status(),
      mining: this.mining.status(),
    };
  }

  close(): void {
    this.stopObserving();
    this.stopObservingResets();
    this.clear();
  }

  /**
   * EVERY CACHE, AND THE LIST HAS TO STAY COMPLETE.
   *
   * Called when the bus resets, which means this process may have MISSED events.
   * `remembered` was left out of it and that broke the contract its own docblock
   * states — it is cleared with `commanders`, always, because the two are read in
   * the same request and may never come from different generations. A reset that
   * refreshed every projection but one would go on serving pre-reset probe memory
   * against a freshly-read world list.
   */
  private clear(): void {
    this.commanders.clear();
    this.sensors.clear();
    this.remembered.clear();
    this.publicGalaxy.clear();
    this.traffic.clear();
    this.mining.clear();
  }

  private onEvent(event: StreamEvent): void {
    // Global operator content has no bearing on game projections.
    if ('global' in event) return;
    if ('playerId' in event) {
      /**
       * A PROBE CAME HOME, SO ONE COMMANDER'S MAP JUST CHANGED. D127.
       *
       * One of the private events a caller projection depends on, and it had to be
       * handled or the feature contradicted itself for half a minute: the report
       * lands, `probe_report` wakes the client, the client refetches — and
       * `/api/galaxy` answers out of a cache that still says UNKNOWN, so the Intel
       * centre holds a report about a world the disc is still drawing as an
       * unmarked point.
       *
       * It is on the same channel every replica already listens to, and it carries
       * a player id and a kind and nothing else, so acting on it discloses nothing
       * that was not already addressed to that one commander.
       */
      if (event.kind === 'probe_report') this.remembered.invalidate(event.playerId);
      // Ground instruments are private hardware, so their completion deliberately
      // has no shard event. The addressed event is enough to refresh this owner's
      // reach without advertising to the rest of the galaxy what they just built.
      if (event.kind === 'build_complete') this.sensors.invalidate(event.playerId);
      // The row is shared by season but the launch instant is private to the two
      // participants and commanders whose effective Telescope covers it. The
      // event therefore cannot carry a shard id; clearing this bounded cache is
      // the safe price of keeping hidden launch timing off the shard channel.
      if (event.kind === 'private:strategic-sight') this.traffic.clear();
      return;
    }

    // Invalidate only the shared payload the event can actually move. Chat and
    // chat traffic is deliberately absent. Score is present because the public
    // galaxy now carries the three podium badges; a rank-changing battle moves
    // that projection even though it moves no planet hardware.
    const kind = event.kind;
    if (
      kind === 'shard:world'
      || kind === 'shard:control'
      || kind === 'shard:season'
      || kind === 'shard:rollover'
    ) {
      // Keyed by account/player rather than shard, so an ownership mutation clears
      // the small bounded sets. These events are rare; stale ownership is not allowed.
      // The sensor posts go with them: they are derived from the same world list
      // and the two may never be read from different generations.
      this.commanders.clear();
      this.sensors.clear();
      this.remembered.clear();
    }
    if (kind === 'shard:impact') {
      // The event intentionally names no target. An impact can lower Core and
      // therefore clamp either sensor, so clearing the small player-keyed cache is
      // the only safe invalidation that does not add information to the event.
      this.sensors.clear();
    }
    if (
      kind === 'shard:world'
      || kind === 'shard:impact'
      || kind === 'shard:control'
      || kind === 'shard:recovery'
      || kind === 'shard:protection'
      || kind === 'shard:clan'
      || kind === 'shard:score'
      || kind === 'shard:season'
      || kind === 'shard:rollover'
    ) {
      this.publicGalaxy.invalidate(event.shard);
    }
    if (
      kind === 'shard:launch'
      || kind === 'shard:arrival'
      || kind === 'shard:mining'
      || kind === 'shard:impact'
      || kind === 'shard:control'
      || kind === 'shard:transfer'
      || kind === 'shard:season'
      || kind === 'shard:rollover'
    ) {
      this.traffic.invalidate(event.shard);
    }
    if (
      kind === 'shard:mining'
      || kind === 'shard:arrival'
      || kind === 'shard:impact'
      || kind === 'shard:control'
      || kind === 'shard:season'
      || kind === 'shard:rollover'
    ) {
      this.mining.invalidate(event.shard);
    }
  }
}
