import type { QueryClient } from '@tanstack/react-query';
import { keys } from './keys.js';
import type { PlanetView, PlanetsView } from './schemas.js';

const predictions = new WeakSet<PlanetView>();
const deferredReads = new WeakSet<PlanetView>();

export function markPlanetPrediction(view: PlanetView): void {
  predictions.add(view);
}

export function settlePlanetPrediction(view: PlanetView | undefined): void {
  if (view) predictions.delete(view);
}

/** A read suppressed during a purchase must be retried once it settles. */
export function takeDeferredPlanetRead(view: PlanetView | undefined): boolean {
  return view ? deferredReads.delete(view) : false;
}

/** Arrival order is not commit order, especially across a list and a single-world read. */
export function latestPlanetSnapshot(current: PlanetView | undefined, incoming: PlanetView): PlanetView {
  if (current?.planet.id !== incoming.planet.id || predictions.has(current)) return incoming;
  const heldAt = current.planet.snapshotAt;
  const incomingAt = incoming.planet.snapshotAt;
  return heldAt && incomingAt && heldAt > incomingAt ? current : incoming;
}

export async function readPlanetSnapshot(
  client: QueryClient,
  key: readonly string[],
  read: () => Promise<PlanetView>,
): Promise<PlanetView> {
  const before = client.getQueryData<PlanetView>(key);
  const incoming = await read();
  const current = client.getQueryData<PlanetView>(key);
  // A read cannot undo a pending purchase. Its POST or rollback will reconcile it.
  if (current && predictions.has(current)) {
    deferredReads.add(current);
    return current;
  }
  if (current && !incoming.planet.snapshotAt && current !== before) return current;
  return latestPlanetSnapshot(current, incoming);
}

/** The list supplies ownership; all resource readers subscribe to ['planet', id]. */
export async function readWorldSnapshots(
  client: QueryClient,
  read: () => Promise<PlanetsView>,
  signal: AbortSignal,
): Promise<PlanetsView> {
  const before = new Map(client.getQueriesData<PlanetView>({ queryKey: keys.planet })
    .flatMap(([key, view]) => key.length === 2 && view ? [[view.planet.id, view] as const] : []));
  const incoming = await read();
  // Query cancellation alone cannot undo side effects inside a query function.
  if (signal.aborted) return incoming;
  for (const view of incoming.planets) {
    const key = keys.planetById(view.planet.id);
    const current = client.getQueryData<PlanetView>(key);
    if (current && predictions.has(current)) {
      deferredReads.add(current);
      continue;
    }
    if (current && current !== before.get(view.planet.id) && (!current.planet.snapshotAt || !view.planet.snapshotAt)) continue;
    if (latestPlanetSnapshot(current, view) !== current) client.setQueryData(key, view);
  }
  // Keep the compatibility list consistent too; ownership comes from this read,
  // but an older response must carry the held balances rather than replace them.
  return { ...incoming, planets: incoming.planets.map((view) =>
    client.getQueryData<PlanetView>(keys.planetById(view.planet.id)) ?? view) };
}
