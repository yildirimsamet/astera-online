import type { InvalidateQueryFilters, Query, QueryClient } from '@tanstack/react-query';

interface Refresh {
  version: number;
  waiters: { version: number; resolve: () => void; reject: (error: unknown) => void }[];
}

const queued = new WeakMap<QueryClient, Map<Query, Refresh>>();

function settle(refresh: Refresh, through: number): void {
  const ready = refresh.waiters.filter(waiter => waiter.version <= through);
  refresh.waiters = refresh.waiters.filter(waiter => waiter.version > through);
  for (const waiter of ready) waiter.resolve();
}

/**
 * Join an in-flight read instead of canceling and restarting its HTTP request.
 * An event can postdate that read's snapshot, so retain one pending fresh pass
 * per query. Further events during that pass can queue the next one, never an
 * overlapping request. Polls and focus already join through TanStack Query.
 */
export function refreshQueries(client: QueryClient, filters: InvalidateQueryFilters = {}): Promise<void> {
  const cache = client.getQueryCache();
  const fetching = cache.findAll({ ...filters, type: 'active' })
    .filter(query => query.state.fetchStatus === 'fetching');
  const pass = client.invalidateQueries(filters, { cancelRefetch: false });
  let pending = queued.get(client);
  if (!pending) {
    pending = new Map();
    queued.set(client, pending);
  }
  const waits = [pass];
  for (const query of fetching) {
    const existing = pending.get(query);
    const refresh: Refresh = existing ?? { version: 0, waiters: [] };
    refresh.version++;
    waits.push(new Promise<void>((resolve, reject) => {
      refresh.waiters.push({ version: refresh.version, resolve, reject });
    }));
    if (existing) continue;
    const entries = pending;
    entries.set(query, refresh);
    void (async () => {
      await pass;
      while (refresh.waiters.length > 0 && query.isActive()
        && cache.get(query.queryHash) === query && query.state.fetchStatus !== 'paused') {
        const through = refresh.version;
        await client.refetchQueries({ queryKey: query.queryKey, exact: true }, { cancelRefetch: false });
        // An awaited mutation needs its own fresh pass, not every later event's
        // pass too. Continuous SSE traffic must not hold its action lane forever.
        settle(refresh, through);
      }
      if (refresh.waiters.length > 0 && cache.get(query.queryHash) === query) {
        // An older read resets isInvalidated on success. Keep the unserved event
        // stale for the next mount without starting work for an inactive screen.
        await client.invalidateQueries({ queryKey: query.queryKey, exact: true, refetchType: 'none' });
      }
      settle(refresh, Infinity);
    })().catch((error: unknown) => {
      for (const waiter of refresh.waiters) waiter.reject(error);
      refresh.waiters = [];
    }).finally(() => { entries.delete(query); });
  }
  return Promise.all(waits).then(() => undefined);
}
