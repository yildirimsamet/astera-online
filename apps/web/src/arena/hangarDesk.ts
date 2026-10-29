import { z } from 'zod';
import { repairQuote, type Ability, type ArenaResources, type LoadoutPlan, type ShipClass } from '@astera/rules/arena';
import { arenaUrl } from './origin.js';
import { hangarSchema, resources } from './deskSchemas.js';

export { hangarSchema };

/**
 * The hangar desk (Y6a, plan 14 §7): the commander's ship, its timers, what filling it costs the
 * capital, and what the capital can still take from the Yarık today. The arena process answers it;
 * the launch itself goes through the room's hello, which checks all of this again.
 */
export type Hangar = z.infer<typeof hangarSchema>;
export type HangarAnswer = { ok: true; hangar: Hangar } | { ok: false; error: string; params: Record<string, string | number> };

/** The end of a flight as the room reports it (`kind: 'sortie'`). */
export const sortieSchema = z.object({ kind: z.literal('sortie'), outcome: z.enum(['extracted', 'dead', 'towed', 'recalled', 'test']),
  teamId: z.string().uuid().optional(),
  deposit: resources, overflow: resources, readyAt: z.string().nullable(), readyReason: z.enum(['repair', 'service']).nullable(),
  /** Y6b: what the flight made, what the ship kept of it, and what its bar took. */
  xp: z.object({ earned: z.number().int().nonnegative(), kept: z.number().int().nonnegative(), banked: z.number().int().nonnegative() }) });
export type SortieReport = Omit<z.infer<typeof sortieSchema>, 'kind'>;

const refusal = z.object({ error: z.string(), params: z.record(z.union([z.string(), z.number()])).optional() });
async function ask(token: string | null, url: string, body: unknown, fetcher: typeof fetch): Promise<HangarAnswer> {
  if (!token) return { ok: false, error: 'auth', params: {} };
  const authorization = `Bearer ${token}`;
  try {
    const response = await fetcher(arenaUrl(url), body === undefined ? { headers: { authorization } }
      : { method: 'POST', headers: { authorization, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const answer: unknown = await response.json();
    if (!response.ok) {
      const parsed = refusal.safeParse(answer);
      return { ok: false, error: parsed.success ? parsed.data.error : 'hangar', params: parsed.success ? parsed.data.params ?? {} : {} };
    }
    const parsed = hangarSchema.safeParse(answer);
    return parsed.success ? { ok: true, hangar: parsed.data } : { ok: false, error: 'hangar', params: {} };
  } catch { return { ok: false, error: 'hangar', params: {} }; }
}
export const fetchHangar = (token: string | null, fetcher: typeof fetch = fetch): Promise<HangarAnswer> => ask(token, '/arena/hangar', undefined, fetcher);
export const pickShip = (token: string | null, ship: ShipClass, fetcher: typeof fetch = fetch): Promise<HangarAnswer> => ask(token, '/arena/ship', { ship }, fetcher);
/** Buys the ship's next level (Y6b). */
export const upgradeShip = (token: string | null, fetcher: typeof fetch = fetch): Promise<HangarAnswer> => ask(token, '/arena/upgrade', {}, fetcher);
export const repairShip = (token: string | null, fetcher: typeof fetch = fetch): Promise<HangarAnswer> => ask(token, '/arena/repair', {}, fetcher);
export const spendAbility = (token: string | null, ability: Ability, fetcher: typeof fetch = fetch): Promise<HangarAnswer> => ask(token, '/arena/ability', { ability }, fetcher);
/** What the next launch tops the tank and the magazine up to; the launch charges for it. */
export const setLoadout = (token: string | null, plan: LoadoutPlan, fetcher: typeof fetch = fetch): Promise<HangarAnswer> => ask(token, '/arena/loadout', plan, fetcher);

/** Only offer payment when its wait is shorter than the existing repair. The server checks again under lock. */
export function repairOffer(h: Hangar, now: number): ReturnType<typeof repairQuote> | null {
  const ship = h.ship;
  if (!ship || ship.flying || ship.away === 'escort' || ship.readyReason !== 'repair' || ship.readyAt === null) return null;
  const quote = repairQuote(ship.level);
  // A ship on its way home is repaired from the moment it lands.
  const from = Math.max(now, ship.homeAt === null ? 0 : Date.parse(ship.homeAt));
  return Date.parse(ship.readyAt) - from > quote.minutes * 60_000 ? quote : null;
}

/** A ship the room still holds in the air: the way in is the way back to it. */
export const stillFlying = (h: Hangar | null): boolean => h?.ship?.flying === true && h.live?.yours === true;

export type LaunchBlock = { kind: 'core'; core: number; need: number } | { kind: 'ship' } | { kind: 'flying' } | { kind: 'escort' } | { kind: 'homeward'; until: number }
  | { kind: 'ready'; until: number; reason: 'repair' | 'service' } | { kind: 'season' } | { kind: 'deuterium'; need: number; have: number };

/** The first thing that keeps the ship on the ground at `now`, in the order the player can act on it; null when it may fly. */
export function launchBlock(h: Hangar, now: number): LaunchBlock | null {
  if (h.core < h.minCore) return { kind: 'core', core: h.core, need: h.minCore };
  if (!h.ship) return { kind: 'ship' };
  if (h.ship.flying) return { kind: 'flying' };
  if (h.ship.away === 'escort') return { kind: 'escort' };
  if (h.ship.away === 'homeward' && h.ship.homeAt !== null && Date.parse(h.ship.homeAt) > now) return { kind: 'homeward', until: Date.parse(h.ship.homeAt) };
  const until = h.ship.readyAt === null ? 0 : Date.parse(h.ship.readyAt);
  if (until > now) return { kind: 'ready', until, reason: h.ship.readyReason ?? 'service' };
  if (now >= Date.parse(h.entryClosesAt)) return { kind: 'season' };
  if (h.deuterium < h.refill.total) return { kind: 'deuterium', need: h.refill.total, have: h.deuterium };
  return null;
}

/**
 * The room's refusals of a launch that the hangar explains: a commander who meets one goes back
 * to it. A dropped link is not among them; reconnecting puts that right.
 */
const HANGAR_REFUSALS: readonly string[] = ['NO_SHIP', 'SHIP_NOT_READY', 'SHIP_FLYING', 'ADMIRAL_AWAY', 'NOT_ENOUGH_DEUTERIUM', 'SEASON_CLOSING', 'SEASON_FROZEN',
  'VACATION_ACTIVE', 'WORLD_RECOVERING', 'NO_PLANET', 'TEAM_LOBBY', 'TEAM_IN_FLIGHT', 'TEAM_NOT_SPECTATING', 'TEAM_CONNECT_EXPIRED', 'full', 'hangar'];
export const refusedAtHangar = (reason: string): boolean => HANGAR_REFUSALS.includes(reason);

/** What the capital can still take from the Yarık today, per resource. */
export function capLeft(h: Hangar): ArenaResources {
  return { alloy: Math.max(0, h.cap.alloy - h.sent.alloy), crystal: Math.max(0, h.cap.crystal - h.sent.crystal),
    deuterium: Math.max(0, h.cap.deuterium - h.sent.deuterium) };
}

/** A countdown as minutes and seconds: 9:58. Repair is an hour at most, so minutes never run past 60. */
export function clockText(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(seconds / 60))}:${String(seconds % 60).padStart(2, '0')}`;
}

/** Whole resources with narrow no-break thousands, so a figure never wraps: 5 664. */
export function amount(n: number): string {
  return String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
