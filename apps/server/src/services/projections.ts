import type { Db, Queryable } from '../db/client.js';
import type { EventBus, StreamEvent } from '../stream/bus.js';
import { AsyncCache, type AsyncCacheStats } from './asyncCache.js';
import { publicWorlds, type PublicWorld } from './publicGalaxy.js';
import { loadTrafficSnapshot, type TrafficSnapshot } from './traffic.js';
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
 * the separate account-keyed entry holds only that caller's own world ids.
 */
export class Projections {
  private readonly publicGalaxy: AsyncCache<PublicWorld[]>;
  private readonly traffic: AsyncCache<TrafficSnapshot>;
  private readonly mining: AsyncCache<MiningSnapshot>;
  private readonly commanders: AsyncCache<CommanderTopology>;
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

  private clear(): void {
    this.commanders.clear();
    this.publicGalaxy.clear();
    this.traffic.clear();
    this.mining.clear();
  }

  private onEvent(event: StreamEvent): void {
    if (!('shard' in event)) return;

    // Invalidate only the shared payload the event can actually move. Chat and
    // score traffic are deliberately absent: turning every public event into a
    // full-galaxy rebuild would recreate the fan-out problem this cache removes.
    const kind = event.kind;
    if (
      kind === 'shard:world'
      || kind === 'shard:control'
      || kind === 'shard:season'
      || kind === 'shard:rollover'
    ) {
      // Keyed by account rather than shard, so an ownership mutation clears the
      // small bounded set. These events are rare; stale ownership is not allowed.
      this.commanders.clear();
    }
    if (
      kind === 'shard:world'
      || kind === 'shard:impact'
      || kind === 'shard:control'
      || kind === 'shard:recovery'
      || kind === 'shard:protection'
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
