import type { QueryClient } from '@tanstack/react-query';
import { refreshQueries } from './refreshQueries.js';

export const EVENT_REFRESH_GAP_MS = 1_500;

interface Gate { openAt: number; timer: ReturnType<typeof setTimeout> | null }
const gates = new WeakMap<QueryClient, Map<string, Gate>>();

/**
 * ONE READ FOR A BURST OF EVENTS. Query plan, 2026-11-03.
 *
 * One production request in five repeated the same read within three seconds: a battle
 * sends several events, and each asked for everything again. An event's first refresh
 * still leaves at once. The rest of a burst share one read after the gap, which starts
 * after the last of them, so none is lost. Only events come through here: a command's own
 * refresh must see its write, and `refreshQueries` keeps that promise.
 */
export function refreshForEvent(client: QueryClient, queryKey: readonly string[]): void {
  let perKey = gates.get(client);
  if (!perKey) {
    perKey = new Map();
    gates.set(client, perKey);
  }
  const id = queryKey.join('\u0000');
  const now = Date.now();
  const gate = perKey.get(id);
  if (!gate || now >= gate.openAt) {
    perKey.set(id, { openAt: now + EVENT_REFRESH_GAP_MS, timer: null });
    void refreshQueries(client, { queryKey });
    return;
  }
  if (gate.timer !== null) return;
  gate.timer = setTimeout(() => {
    gate.timer = null;
    gate.openAt = Date.now() + EVENT_REFRESH_GAP_MS;
    void refreshQueries(client, { queryKey });
  }, gate.openAt - now);
}

/** For a stream being taken down: nothing it heard may read after it has gone. */
export function cancelEventRefreshes(client: QueryClient): void {
  for (const gate of gates.get(client)?.values() ?? []) {
    if (gate.timer !== null) clearTimeout(gate.timer);
  }
  gates.delete(client);
}
