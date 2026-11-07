import type { z } from 'zod';
import { vesselAnswerSchema, vesselCancelSchema, vesselCollectSchema, vesselDeckSchema, type VesselView } from '../api/starterSchemas.js';
import { vesselToPlanetView } from './adapter.js';

type Fetch = typeof globalThis.fetch;

/**
 * WHERE THE SESSION IS STANDING: on a ship, or not. Read per request rather than wrapped at build,
 * so one `Api`, one token and one refresh path serve both, and a landing is a value changing.
 */
let onShip = false;
export const setStarterMode = (next: boolean): void => { onShip = next; };
export const isStarterMode = (): boolean => onShip;

/** Belong to the account, not to where it is playing. */
const ACCOUNT_PREFIXES = ['/api/auth/', '/api/starter/', '/api/announcements', '/api/community/'];
const ACCOUNT_PATHS = ['/api/onboarding/claim', '/api/feedback', '/api/maintenance', '/api/push/devices', '/api/stream', '/api/universe'];

const NOTHING_HELD = { alloy: 0, crystal: 0, deuterium: 0 };

/**
 * WHAT THE GALAXY SCREEN READS ON ITS WAY UP, EMPTY UNTIL THAT SYSTEM EXISTS ABOARD. A refusal here
 * would be a failed query on every surface that reads one; none of them has anything to show yet.
 */
const EMPTY_READS: Readonly<Record<string, unknown>> = {
  '/api/galaxy/events': { events: [] },
  '/api/session/unlocks': { unlocked: [] },
  '/api/rewards': { chains: [], claimable: 0 },
  '/api/pirates': { originPlanetId: '', pirates: [] },
  '/api/unknown-signals': { signals: [] },
  '/api/skins': { ownedSkinIds: [], planets: [] },
  '/api/session/brand-recall': { eligible: false, completed: false, reward: NOTHING_HELD },
  '/api/legacy/me/reveals': { awards: [], total: 0 },
  '/api/leaderboard': { ladder: [], you: null },
  '/api/clan/badge': { available: false, membership: null, attention: false, attentionCount: 0, clanChatUnread: 0 },
  '/api/dm/unread': { count: 0 },
};

/** Same question, same answer shape: these only need asking of the galaxy the ship is in. */
const SHIP_READS: Readonly<Record<string, string>> = {
  '/api/intel': '/api/starter/intel',
  '/api/galaxy/traffic': '/api/starter/traffic',
  '/api/session/pending': '/api/starter/pending',
  '/api/session/return': '/api/starter/return',
  '/api/notifications': '/api/starter/notifications',
  '/api/reports': '/api/starter/reports',
  '/api/mining': '/api/starter/mining',
  '/api/mining/field': '/api/starter/mining',
  '/api/mining/status': '/api/starter/mining',
};

/** Their question matters here: which language, and from which line back. */
const CHAT_READS: Readonly<Record<string, string>> = {
  '/api/chat/messages': '/api/starter/chat/messages',
  '/api/chat/unread': '/api/starter/chat/unread',
};

const SHIP_WRITES: Readonly<Record<string, string>> = {
  '/api/intel/probe': '/api/starter/probe',
  '/api/intel/watch': '/api/starter/watch',
  '/api/notifications/seen': '/api/starter/notifications/seen',
  '/api/session/return/seen': '/api/starter/return/seen',
  '/api/chat/messages': '/api/starter/chat/messages',
  '/api/chat/read': '/api/starter/chat/read',
  '/api/community/reports': '/api/starter/chat/report',
  '/api/community/blocks': '/api/starter/chat/block',
};

/** These change the deck, and the screens expect the world back with the answer. */
const SHIP_DECK: Readonly<Record<string, string>> = {
  '/api/planet/build': '/api/starter/build',
  '/api/planet/research': '/api/starter/research',
  '/api/planet/repairs': '/api/starter/dock',
  '/api/fleet/launch': '/api/starter/fleet/launch',
  '/api/mining/launch': '/api/starter/mining/launch',
  '/api/mining/harvest': '/api/starter/mining/harvest',
};

const reply = (body: unknown, status = 200, headers: HeadersInit = { 'content-type': 'application/json' }): Response =>
  new Response(JSON.stringify(body), { status, headers });

const closed = (method: string, path: string): Response => {
  // A surface that reads this fails quietly on a ship, and in development it should not be quiet.
  if (import.meta.env.DEV) console.warn(`[starter] closed: ${method} ${path}`);
  return reply({ error: 'STARTER_CLOSED', message: 'STARTER_CLOSED' }, 404);
};

const worldScope = /^\/api\/planets\/[^/]+/;
const replayPath = /^\/api\/reports\/BATTLE\/[^/]+\/replay$/;
const fleetRecallPath = /^\/api\/fleet\/[^/]+\/recall$/;
const miningRecallPath = /^\/api\/mining\/runs\/[^/]+\/recall$/;
const cancelPath = /^\/api\/planet\/build-orders\/([^/]+)\/cancel$/;

/**
 * THE ONE PLACE THE TWO GALAXIES MEET ON THE CLIENT. Plan §5.7.
 *
 * Off, every request passes untouched, so no main-galaxy player is affected. On, a path goes one of
 * three ways: it belongs to the account and passes, it has a meaning aboard and is answered from the
 * ship, or it never leaves the device. THE DEFAULT IS THE THIRD: a new route added to the client
 * cannot reach a main-galaxy endpoint from a ship by being forgotten here (K1).
 */
export function starterFetch(base: Fetch, isOn: () => boolean = isStarterMode): Fetch {
  return async (input, init) => {
    if (!isOn()) return base(input, init);

    const raw = String(input instanceof Request ? input.url : input);
    const url = new URL(raw, 'https://astera.invalid');
    const path = url.pathname;
    const origin = /^https?:/.test(raw) ? url.origin : '';
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    // The one chat aboard is this galaxy's: a report and a block name its lines, not the main channel's.
    const chatWrite = method === 'POST' && path.startsWith('/api/community/') ? SHIP_WRITES[path] : undefined;
    if (chatWrite) return base(`${origin}${chatWrite}`, init);
    if (ACCOUNT_PATHS.includes(path) || ACCOUNT_PREFIXES.some(prefix => path.startsWith(prefix))) return base(input, init);

    /** Asks the server and, if it says yes, turns the answer into what the caller expects. */
    const through = async <T>(target: string, schema: z.ZodType<T, z.ZodTypeDef, unknown>, shape: (answer: T) => unknown): Promise<Response> => {
      const response = await base(`${origin}${target}`, init);
      if (!response.ok) return response;
      // The clock and the version gate are read off the headers of every answer. The body has a new length.
      const headers = new Headers(response.headers);
      headers.delete('content-length');
      headers.delete('content-encoding');
      return reply(shape(schema.parse(await response.json())), response.status, headers);
    };
    const ship = (shape: (vessel: VesselView) => unknown) =>
      through('/api/starter/vessel', vesselAnswerSchema, answer => shape(answer.vessel));

    if (method === 'GET') {
      if (path === '/api/planet' || /^\/api\/planets\/[^/]+$/.test(path)) return ship(vesselToPlanetView);
      if (path === '/api/planets') {
        return ship(vessel => ({ playerId: vessel.id, seasonId: vessel.galaxy.id, capitalPlanetId: vessel.id, planets: [vesselToPlanetView(vessel)] }));
      }
      if (path === '/api/season') return base(`${origin}/api/starter/season`, init);
      if (path === '/api/galaxy') return base(`${origin}/api/starter/galaxy`, init);
      if (replayPath.test(path)) return base(`${origin}${path.replace('/api/reports', '/api/starter/reports')}`, init);
      const asked = SHIP_READS[path];
      if (asked) return base(`${origin}${asked}`, init);
      const chat = CHAT_READS[path];
      if (chat) return base(`${origin}${chat}${url.search}`, init);
      const empty = EMPTY_READS[path];
      return empty === undefined ? closed(method, path) : reply(empty);
    }

    if (method === 'POST') {
      const told = SHIP_WRITES[path];
      if (told) return base(`${origin}${told}`, init);
      const route = path.replace(worldScope, '/api/planet');
      if (fleetRecallPath.test(path)) return base(`${origin}${path.replace('/api/fleet', '/api/starter/fleet')}`, init);
      const deck = SHIP_DECK[route];
      const deckTarget = deck ?? (miningRecallPath.test(path) ? path.replace('/api/mining', '/api/starter/mining') : undefined);
      if (deckTarget) return through(deckTarget, vesselDeckSchema, ({ vessel, ...rest }) => ({ ...rest, planet: vesselToPlanetView(vessel) }));
      if (route === '/api/planet/collect') {
        return through('/api/starter/collect', vesselCollectSchema, ({ vessel, moved, blocked }) => {
          const planet = vesselToPlanetView(vessel);
          return {
            moved, blocked, planet,
            alloy: planet.planet.alloy, crystal: planet.planet.crystal, deuterium: planet.planet.deuterium,
            bufferAlloy: vessel.bufferAlloy, bufferCrystal: vessel.bufferCrystal, bufferDeuterium: vessel.bufferDeuterium,
          };
        });
      }
      const cancel = cancelPath.exec(route);
      if (cancel) {
        const orderId = cancel[1]!;
        return through(`/api/starter/orders/${orderId}/cancel`, vesselCancelSchema, ({ vessel, refund }) =>
          ({ orderId: decodeURIComponent(orderId), refund, planet: vesselToPlanetView(vessel) }));
      }
    }
    return closed(method, path);
  };
}
