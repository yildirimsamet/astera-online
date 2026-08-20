import {
  COMBAT,
  HULLS,
  PROSPECTOR,
  activeAsteroids,
  coreTier,
  distance,
  drillHoldMult,
  drillSpeedMult,
  fleetSpeed,
  generateGalaxy,
  travelMinutes,
  type Fleet,
  type BuildingId,
  type HullId,
} from '@astera/rules';
import type { Preview } from '../api/schemas.js';
import { serverNow } from '../lib/clock.js';
import {
  build,
  launch,
  planetOf,
  refusesBuild,
  refusesUpgrade,
  upgrade,
  type RehearsalWorld,
} from './world.js';

/**
 * THE REHEARSAL'S SEAM: A `fetch` THAT NEVER LEAVES THE DEVICE. D56.
 *
 * The rehearsal has to render the real game — the real disc, the real planet
 * screen, the real focus panels — or it teaches an interface that does not exist.
 * The cheapest way to get that is not to fake the screens; it is to fake the ONE
 * function underneath all of them.
 *
 * `Api` already takes its `fetch` as a dependency, so a rehearsal is
 * `new Api({ fetch: rehearsalFetch(...) })` and every component above it is
 * untouched — same hooks, same query keys, same Zod parsing. THE PAYLOADS ARE
 * PARSED BY THE PRODUCTION SCHEMAS, which means a rehearsal that drifts from the
 * contract fails exactly where a real payload would.
 *
 * AND NOTHING CAN ESCAPE. The real `fetch` is never called, so there is no path
 * from here to the network at all — a route nobody remembered to answer is a
 * refusal in this file, not a silent unauthenticated request to a live server.
 *
 * WHAT IT REFUSES IS PART OF THE DESIGN. A visitor cannot probe, watch, mine,
 * harvest, install or collect during the rehearsal: none of it is affordable out
 * of the opening grant (a probe alone needs crystal the mandatory upgrades have
 * already spent), and offering a control that the claim would then refuse is the
 * one thing an optimistic surface must never do (D53).
 */

export interface RehearsalState {
  preview: Preview;
  world: RehearsalWorld;
}

type Reader = () => RehearsalState;
type Writer = (next: RehearsalWorld) => void;

export function rehearsalFetch(read: Reader, write: Writer): typeof globalThis.fetch {
  return (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const path = url.replace(/^https?:\/\/[^/]+/, '').split('?')[0] ?? url;
    const method = (init?.method ?? 'GET').toUpperCase();
    /**
     * Only a JSON string is ever read back.
     *
     * `Api.send` serialises every body itself and a second `JSON.stringify` is a
     * compile error there, so a body that is not a string cannot come from this
     * client — and stringifying a `Blob` or a `FormData` to `[object Object]` and
     * then parsing it would fail somewhere far less obvious than here.
     */
    const raw = init?.body;
    const body: unknown = typeof raw === 'string' ? JSON.parse(raw) : undefined;

    try {
      return Promise.resolve(ok(answer(path, method, body, read, write)));
    } catch (err) {
      if (err instanceof Refused) return Promise.resolve(refusal(err));
      throw err;
    }
  };
}

/** A refusal in the server's own vocabulary, so `ApiError` carries a usable code. */
class Refused extends Error {
  constructor(
    readonly code: string,
    readonly status = 400,
  ) {
    super(code);
  }
}

/**
 * Every answer carries the clock header the real one does.
 *
 * `noteServerTime` reads it on every response, and everything that moves on the
 * disc is drawn against `serverNow()` (D52). A rehearsal that answered without it
 * would leave the offset at whatever the last real request set — which is right,
 * because the preview call was real — but a header that is present and honest is
 * cheaper than a comment explaining why its absence happens to be safe.
 */
const ok = (payload: unknown): Response =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json', 'x-server-time': new Date(serverNow()).toISOString() },
  });

const refusal = (err: Refused): Response =>
  new Response(JSON.stringify({ error: err.code, message: err.code }), {
    status: err.status,
    headers: { 'content-type': 'application/json' },
  });

function answer(
  path: string,
  method: string,
  body: unknown,
  read: Reader,
  write: Writer,
): unknown {
  const { preview, world } = read();

  if (method === 'GET') {
    switch (path) {
      case '/api/season':
        return preview.season;

      /**
       * The disc, with the visitor's own world kept current.
       *
       * `coreTier` is the one public fact about a planet that the rehearsal can
       * actually move — raising the Core past 3 changes the silhouette the disc
       * draws for everybody — so it is recomputed rather than frozen at 1.
       */
      case '/api/galaxy':
        return {
          you: preview.galaxy.you,
          planets: preview.galaxy.planets.map((p) =>
            p.isSelf ? { ...p, coreTier: coreTier(world.buildings.CORE) } : p,
          ),
        };

      /**
       * Everybody else's craft. The visitor's own launch is deliberately absent:
       * `/api/galaxy/traffic` excludes what you own, because your own legs are
       * drawn from `pending` at full fidelity and a second anonymous copy beside
       * the real one is both confusing and a free calibration sample.
       */
      case '/api/galaxy/traffic':
        return preview.traffic;

      case '/api/planet':
        return planetOf(world);

      case '/api/session/pending':
        return { pending: pendingOf(preview, world) };

      /**
       * ROCKS FROM THE SEED, WHICH IS WHERE THE REAL ONES COME FROM TOO.
       *
       * `generateGalaxy` is deterministic and takes no clock, so these are the
       * actual asteroids of the actual galaxy rather than decoration.
       *
       * FILTERED TO THE ONES THAT EXIST RIGHT NOW, which the first draft was not —
       * a rock has an `appearsAt` and an `expiresAt` and the generated field spans
       * the WHOLE season, so handing the disc all of them drew nine hundred rocks
       * over a galaxy that has a few dozen. It buried the worlds the beats were
       * asking the player to find. `activeAsteroids` is the same filter
       * `visibleAsteroids` runs on the server.
       *
       * `oreRemaining` is the untouched figure. How much a stranger has already
       * taken out of a rock is not on any public payload, and inventing a smaller
       * number would be a lie where a slightly generous truth will do — nothing in
       * a rehearsal can mine anyway, since a Prospector costs more than the entire
       * opening grant.
       */
      case '/api/mining': {
        const field = generateGalaxy(preview.season.seed, preview.season.playerCap).asteroids;
        const minutes = (serverNow() - preview.season.startsAt.getTime()) / 60_000;
        return {
          derrick: false,
          craftSpeed: PROSPECTOR.speed * drillSpeedMult([]),
          craftHold: PROSPECTOR.hold * drillHoldMult([]),
          derrickHold: PROSPECTOR.hold * drillHoldMult(['DERRICK']),
          asteroids: activeAsteroids(field, minutes).map((a) => ({ ...a, oreRemaining: a.ore })),
          debris: [],
          runs: [],
        };
      }

      /** A two-minute-old planet has no history, and saying so is not a stub. */
      case '/api/intel':
        return {
          watching: [],
          radarLog: [],
          probeReports: [],
          probeCost: { alloy: 50, crystal: 50 },
        };
      case '/api/reports':
        return { reports: [] };
      case '/api/notifications':
        return { notifications: [], unseen: 0 };
      case '/api/session/unlocks':
        return { unlocked: [] };
      case '/api/leaderboard':
        return { ladder: [], you: null };
      default:
        throw new Refused('REHEARSAL_ONLY', 404);
    }
  }

  if (method === 'POST') {
    switch (path) {
      case '/api/planet/upgrade': {
        const type = (body as { type: BuildingId }).type;
        const bad = refusesUpgrade(world, type);
        if (bad) throw new Refused(bad);
        const next = upgrade(world, type);
        write(next);
        return {
          type,
          level: next.buildings[type],
          alloy: next.alloy,
          crystal: next.crystal,
          planet: planetOf(next),
        };
      }

      case '/api/planet/build': {
        const { hull, count } = body as { hull: HullId; count: number };
        const bad = refusesBuild(world, hull, count);
        if (bad) throw new Refused(bad);
        const next = build(world, hull, count);
        write(next);
        return {
          hull,
          built: count,
          alloy: next.alloy,
          crystal: next.crystal,
          planet: planetOf(next),
        };
      }

      case '/api/fleet/launch': {
        const { targetPlanetId, fleet } = body as { targetPlanetId: string; fleet: Fleet };
        if (world.launch) throw new Refused('NO_FREE_BAY');
        const next = launch(world, targetPlanetId, fleet);
        if (next === world) throw new Refused('NOT_ENOUGH_SHIPS');
        write(next);
        const thread = pendingOf(preview, next)[0];
        return {
          missionId: REHEARSAL_MISSION,
          arriveAt: thread?.arriveAt ?? new Date(serverNow()).toISOString(),
          exposureMinutes: 2 * (thread?.minutesRemaining ?? 0),
          homeDefenceAfter: 0,
          pending: pendingOf(preview, next),
          planet: planetOf(next),
        };
      }

      /**
       * Marking news as seen is the one write that is harmless to accept and
       * pointless to model: there is no news in a rehearsal.
       */
      case '/api/notifications/seen':
        return { marked: 0 };

      default:
        throw new Refused('REHEARSAL_ONLY', 404);
    }
  }

  throw new Refused('REHEARSAL_ONLY', 404);
}

/**
 * The mission id the rehearsal's own launch flies under.
 *
 * It is the seed the bombardment volley is generated from (D52), so it has to be
 * stable for the life of the flight — a new id every render would re-roll the
 * volley on every frame.
 */
const REHEARSAL_MISSION = 'rehearsal-launch';

/**
 * What is in the air, as `/api/session/pending` would put it.
 *
 * The path is carried in full because this is the visitor's OWN craft: a thread
 * you own is the attributed one, and the disc draws it from these four fields
 * rather than from a contact. Both ends come out of the public positions the
 * preview already carried.
 */
function pendingOf(preview: Preview, world: RehearsalWorld) {
  if (!world.launch) return [];
  const target = preview.galaxy.planets.find((p) => p.id === world.launch?.targetPlanetId);
  if (!target) return [];

  const minutes = travelMinutes(
    distance(preview.reserved.position, target.position),
    fleetSpeed(world.launch.fleet),
  );
  const departAt = launchedAt(world);
  const arriveAt = new Date(departAt.getTime() + minutes * 60_000);

  return [
    {
      id: REHEARSAL_MISSION,
      kind: 'fleet' as const,
      targetName: target.name,
      minutesRemaining: Math.max(0, (arriveAt.getTime() - serverNow()) / 60_000),
      arriveAt: arriveAt.toISOString(),
      leg: 'outbound' as const,
      fleet: world.launch.fleet,
      path: {
        from: preview.reserved.position,
        to: target.position,
        departAt: departAt.toISOString(),
        arriveAt: arriveAt.toISOString(),
      },
    },
  ];
}

/**
 * When the rehearsal's fleet left, frozen at the moment of the press.
 *
 * RECOMPUTING IT WOULD PARK THE CRAFT ON THE PAD. Every leg on the disc is drawn
 * by interpolating between `departAt` and `arriveAt` against `serverNow()`; if
 * `departAt` were "now" on every read, the fraction would stay at zero and the
 * squadron would sit on its own world for the whole flight.
 */
const departures = new WeakMap<RehearsalWorld['launch'] & object, Date>();
function launchedAt(world: RehearsalWorld): Date {
  const key = world.launch;
  if (!key) return new Date(serverNow());
  const known = departures.get(key);
  if (known) return known;
  const now = new Date(serverNow());
  departures.set(key, now);
  return now;
}

/** Unused today, kept honest: the engagement window is the server's, not a length. */
export const ENGAGEMENT_SECONDS = COMBAT.engagementSeconds;

/** Re-exported so the beats can price the opening without importing the hull table. */
export const WASP_COST = HULLS.WASP.alloy;
