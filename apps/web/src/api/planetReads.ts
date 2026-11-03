import type { Api } from './client.js';
import type { PlanetView, PlanetsView } from './schemas.js';

/** One request runs at a time, so a stuck one must not hold every world read of the session. */
export const WORLD_READ_DEADLINE_MS = 20_000;

type Answer = { list: PlanetsView } | { view: PlanetView };

interface Batch {
  wantsList: boolean;
  /** The worlds asked for; `undefined` is the capital alias. */
  worlds: Set<string | undefined>;
  readers: number;
  controller: AbortController;
  answer: Promise<Answer>;
  send: () => void;
}

export interface PlanetReads {
  list: (signal?: AbortSignal) => Promise<PlanetsView>;
  /** Without an id, the commander's capital. */
  world: (planetId: string | undefined, signal?: AbortSignal) => Promise<PlanetView>;
}

/**
 * ONE HTTP READ FOR A SCREEN'S WORTH OF WORLD READS. Query plan, 2026-11-03.
 *
 * Half of production's world reads repeated one from the last two seconds: an event
 * refreshes the list and the open world side by side, though the list carries that
 * world and costs the server the same statements. Reads asked for together share one
 * request, and a lone world keeps its own smaller route. At most one request runs: a
 * read asked for during it waits for the next, never taking the running answer, which
 * may predate the write this read follows.
 *
 * Nothing here touches the query cache: every reader applies its own answer after
 * checking it was not cancelled (`planetCache.ts`).
 */
function createPlanetReads(api: Api): PlanetReads {
  let waiting: Batch | null = null;
  let running = false;

  const request = async (batch: Batch): Promise<Answer> => {
    const { signal } = batch.controller;
    if (!batch.wantsList && batch.worlds.size === 1) {
      const [only] = batch.worlds;
      return { view: await api.planet(only, { signal }) };
    }
    return { list: await api.planets({ signal }) };
  };

  const launch = (batch: Batch): void => {
    waiting = null;
    running = true;
    const deadline = setTimeout(() => { batch.controller.abort(); }, WORLD_READ_DEADLINE_MS);
    batch.send();
    void batch.answer.catch(() => undefined).finally(() => {
      clearTimeout(deadline);
      running = false;
      if (waiting) launch(waiting);
    });
  };

  const join = (): Batch => {
    if (waiting) return waiting;
    let send!: () => void;
    const answer = new Promise<Answer>((resolve, reject) => {
      send = () => { request(batch).then(resolve, reject); };
    });
    const batch: Batch = { wantsList: false, worlds: new Set(), readers: 0, controller: new AbortController(), answer, send };
    waiting = batch;
    // Reads asked for in one tick go together; the refreshes of one event all are.
    if (!running) queueMicrotask(() => { if (waiting === batch) launch(batch); });
    return batch;
  };

  /** The batch's answer for this reader, or an abort the moment this reader leaves. */
  const answerFor = (batch: Batch, signal: AbortSignal | undefined): Promise<Answer> => {
    batch.readers += 1;
    if (!signal) return batch.answer;
    return new Promise<Answer>((resolve, reject) => {
      const leave = (): void => {
        batch.readers -= 1;
        if (batch.readers === 0) {
          batch.controller.abort();
          // Unsent and unwanted: the next reader starts its own.
          if (waiting === batch) waiting = null;
        }
        reject(new DOMException('Read cancelled', 'AbortError'));
      };
      signal.addEventListener('abort', leave, { once: true });
      batch.answer.then(resolve, reject).finally(() => { signal.removeEventListener('abort', leave); });
    });
  };

  return {
    list: async (signal) => {
      signal?.throwIfAborted();
      const batch = join();
      batch.wantsList = true;
      const answer = await answerFor(batch, signal);
      return 'list' in answer ? answer.list : api.planets(signal ? { signal } : undefined);
    },
    world: async (planetId, signal) => {
      signal?.throwIfAborted();
      const batch = join();
      batch.worlds.add(planetId);
      const answer = await answerFor(batch, signal);
      if ('view' in answer) return answer.view;
      const wanted = planetId ?? answer.list.capitalPlanetId;
      // A world the list does not hold: its own route says why.
      return answer.list.planets.find(view => view.planet.id === wanted)
        ?? api.planet(planetId, signal ? { signal } : undefined);
    },
  };
}

const perClient = new WeakMap<Api, PlanetReads>();

/** The reads every screen of one session shares. */
export function planetReads(api: Api): PlanetReads {
  let reads = perClient.get(api);
  if (!reads) {
    reads = createPlanetReads(api);
    perClient.set(api, reads);
  }
  return reads;
}
