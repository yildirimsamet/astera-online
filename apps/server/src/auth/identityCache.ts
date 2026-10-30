import { AsyncCache, type AsyncCacheStats } from '../services/asyncCache.js';
import type { EventBus } from '../stream/bus.js';

/** A token found current; a native device's only until its session's own expiry. */
export interface IdentityGrant { until: Date | null }

/**
 * WHO IS ASKING, READ ONCE PER PROCESS. Scaling plan F1.8 (C1 + Q7).
 *
 * Every authenticated request proved its token current with a read of the account
 * (or the native session). Those reads now remember a YES until the database says
 * otherwise. What ends a token — `auth_version` moving (password reset, ban,
 * deletion approval), a native session revoked, the account row erased — is said by
 * a trigger in the transaction that did it (`account:auth`, migrations 0210/0214),
 * so no writer can forget to. A native session also ends at its own expiry, which
 * no event announces, so its grant carries that instant.
 *
 * Only reads ask it: a command is checked against the database, as before. A NO is
 * never kept, a process whose bus is down asks the database every time, and a bus
 * reset (events may have been missed) forgets everything.
 */
export class IdentityCache {
  private readonly grants: AsyncCache<IdentityGrant | null>;
  private readonly stopObserving: () => void;
  private readonly stopObservingResets: () => void;

  constructor(bus: EventBus, config: { enabled: boolean; maxAccounts: number; ttlMs: number }) {
    this.grants = new AsyncCache(config.maxAccounts, config.ttlMs, () => config.enabled && bus.status().listening);
    this.stopObserving = bus.observe((event) => {
      if ('account' in event) this.grants.invalidatePrefix(`${event.account}|`);
    });
    this.stopObservingResets = bus.observeReset(() => { this.grants.clear(); });
  }

  async current(accountId: string, version: number, nativeSessionId: string | undefined, now: Date,
    load: () => Promise<IdentityGrant | null>): Promise<boolean> {
    const key = `${accountId}|${String(version)}|${nativeSessionId ?? ''}`;
    let grant = await this.grants.get(key, load);
    // A refreshed native session keeps its id and version and moves its expiry on.
    if (grant?.until && grant.until <= now) {
      this.grants.invalidate(key);
      grant = await this.grants.get(key, load);
    }
    if (grant && (!grant.until || grant.until > now)) return true;
    this.grants.invalidate(key);
    return false;
  }

  status(): AsyncCacheStats { return this.grants.status(); }

  close(): void {
    this.stopObserving();
    this.stopObservingResets();
  }
}
