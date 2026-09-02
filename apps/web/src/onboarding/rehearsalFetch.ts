import {
  PROSPECTOR,
  activeAsteroids,
  asteroidDiscoveredAt,
  coreTier,
  drillHoldMult,
  drillSpeedMult,
  generateGalaxy,
  nextAsteroidDiscoveryAt,
  sensorSphere,
  type BuildingId,
  type HullId,
} from '@astera/rules';
import type { Preview } from '../api/schemas.js';
import { serverNow } from '../lib/clock.js';
import {
  build,
  planetOf,
  projectedBuildings,
  refusesBuild,
  refusesUpgrade,
  upgrade,
  type RehearsalWorld,
} from './world.js';

const OPAQUE_ID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** Preview-only stable handle with the same public shape as a server asteroid id. */
function rehearsalAsteroidId(seed: number, index: number): string {
  let state = (seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0;
  let id = '';
  for (let i = 0; i < 22; i += 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    /*
      The alphabet is 64 characters and `>>> 26` is 0–63, so this never misses —
      but `noUncheckedIndexedAccess` cannot know that, and concatenating a
      possibly-undefined string is the one thing it is there to stop.
    */
    id += OPAQUE_ID_ALPHABET[state >>> 26] ?? '';
  }
  return id;
}

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
       * The Core is the one public fact about a planet that the rehearsal can
       * actually move — raising it changes the silhouette the disc draws for
       * everybody — so both readings of it are recomputed rather than frozen at
       * the opening.
       *
       * The LEVEL is what the visitor actually sees change, and since D153 it is the
       * one that decides the drawn size: a world grows a little at every Core level,
       * and Core 4 is reachable inside the ninety seconds. The TIER still carries the
       * three `worldWeight` words and D49's ±2 band, and is recomputed here because
       * the two must not disagree — `coreTier` is `ceil(level / 3)`, and a payload
       * where the pair contradicts itself is a projection the client is entitled to
       * trust and cannot. Neither earns a dyson ring: those start at Core 12 and no
       * rehearsal comes close.
       */
      case '/api/galaxy':
        return {
          you: preview.galaxy.you,
          planets: preview.galaxy.planets.map((p) =>
            p.isSelf
              ? { ...p, coreTier: coreTier(world.buildings.CORE), coreLevel: world.buildings.CORE }
              : p,
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
        return { pending: [] };

      /**
       * DECORATIVE ROCKS FROM THE PUBLIC PREVIEW SEED.
       *
       * Production uses a private season key, so these cannot be real targets and
       * must never pretend to reveal that schedule. They do obey the real sight
       * contract: the offered world's naked-eye post starts when the preview does,
       * and only a rock physically inside it is shown. Claiming therefore narrows
       * neither the player's eyes nor the rule the rehearsal taught.
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
        const active = activeAsteroids(field, minutes);
        const eye = {
          at: preview.reserved.position,
          reach: sensorSphere(preview.reserved.position, 0, 0).identify,
          startsAt: minutes,
          endsAt: null,
        };
        const visible = active.filter(
          (rock) => asteroidDiscoveredAt(rock, [eye], minutes) !== null,
        );
        const nextDiscovery = nextAsteroidDiscoveryAt(field, [eye], minutes);
        const nextMinute = [
          ...visible.map((rock) => rock.expiresAt),
          ...(nextDiscovery === null ? [] : [nextDiscovery]),
        ].reduce<number | null>(
          (earliest, candidate) => earliest === null || candidate < earliest ? candidate : earliest,
          null,
        );
        return {
          derrick: false,
          craftSpeed: PROSPECTOR.speed * drillSpeedMult([]),
          craftHold: PROSPECTOR.hold * drillHoldMult([]),
          derrickHold: PROSPECTOR.hold * drillHoldMult(['DERRICK']),
          asteroids: visible.map((asteroid) => {
            const { index, ...visible } = asteroid;
            return {
              ...visible,
              id: rehearsalAsteroidId(preview.season.seed, index),
              oreRemaining: asteroid.ore,
              active: true,
              isotopeRich: false,
              deuteriumShare: null,
            };
          }),
          nextFieldChangeAt: nextMinute === null
            ? null
            : new Date(preview.season.startsAt.getTime() + nextMinute * 60_000),
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
          probeCost: { alloy: 50, crystal: 50, deuterium: 0 },
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
          // The mutation fragment names the level this order will produce; the
          // whole planet beside it remains durable until completion, like server.
          level: projectedBuildings(next)[type],
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
