export interface AsyncCacheStats {
  entries: number;
  hits: number;
  misses: number;
  bypasses: number;
  invalidations: number;
  evictions: number;
  singleFlightWaits: number;
}

interface Entry<T> {
  token: symbol;
  pending: boolean;
  expiresAt: number;
  promise: Promise<T>;
}

/**
 * A bounded, disposable LRU with one Promise per key.
 *
 * Invalidation may race a cache fill. A pending fill's token is marked so a
 * loader that began before a committed shard event cannot install or return its
 * old snapshot after that event; it joins the post-invalidation fill instead.
 * Only in-flight tokens are retained, so the correctness bookkeeping is bounded
 * too. Eviction and TTL never affect correctness; they only cause more work.
 */
export class AsyncCache<T> {
  private readonly entries = new Map<string, Entry<T>>();
  /** Only fills invalidated while pending; bounded by the entry ceiling. */
  private readonly invalidatedFills = new Set<symbol>();
  private hits = 0;
  private misses = 0;
  private bypasses = 0;
  private invalidations = 0;
  private evictions = 0;
  private singleFlightWaits = 0;

  constructor(
    private readonly maxEntries: number,
    private readonly ttlMs: number,
    private readonly enabled: () => boolean = () => true,
    private readonly now: () => number = Date.now,
  ) {}

  async get(key: string, load: () => Promise<T>): Promise<T> {
    if (!this.enabled()) {
      this.bypasses += 1;
      return load();
    }

    const instant = this.now();
    const existing = this.entries.get(key);
    // A pending fill never expires. Starting a second database projection because
    // the first one has taken longer than the value TTL recreates the exact cache
    // stampede single-flight exists to prevent.
    if (existing && (existing.pending || existing.expiresAt > instant)) {
      this.hits += 1;
      if (existing.pending) this.singleFlightWaits += 1;
      this.touch(key, existing);
      return existing.promise;
    }
    if (existing) this.entries.delete(key);

    this.misses += 1;
    const token = Symbol(key);
    const promise = load()
      .then((value): T | Promise<T> => {
        if (this.invalidatedFills.delete(token)) {
          return this.get(key, load);
        }
        const current = this.entries.get(key);
        if (current?.token === token) {
          current.pending = false;
          current.expiresAt = this.now() + this.ttlMs;
          this.touch(key, current);
        }
        return value;
      })
      .catch((error: unknown) => {
        this.invalidatedFills.delete(token);
        if (this.entries.get(key)?.token === token) this.entries.delete(key);
        throw error;
      });
    const entry: Entry<T> = {
      token,
      pending: true,
      expiresAt: instant + this.ttlMs,
      promise,
    };

    this.entries.set(key, entry);
    this.evictOverflow();
    return entry.promise;
  }

  invalidate(key: string): void {
    const entry = this.entries.get(key);
    if (entry?.pending) this.invalidatedFills.add(entry.token);
    if (this.entries.delete(key)) this.invalidations += 1;
  }

  clear(): void {
    for (const entry of this.entries.values()) {
      if (entry.pending) this.invalidatedFills.add(entry.token);
    }
    this.invalidations += this.entries.size;
    this.entries.clear();
  }

  status(): AsyncCacheStats {
    return {
      entries: this.entries.size,
      hits: this.hits,
      misses: this.misses,
      bypasses: this.bypasses,
      invalidations: this.invalidations,
      evictions: this.evictions,
      singleFlightWaits: this.singleFlightWaits,
    };
  }

  private touch(key: string, entry: Entry<T>): void {
    this.entries.delete(key);
    this.entries.set(key, entry);
  }

  private evictOverflow(): void {
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) return;
      this.entries.delete(oldest);
      this.evictions += 1;
    }
  }
}
