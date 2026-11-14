import { fleetCount } from '@astera/rules';
import type {
  ActiveGalaxyEvent,
  BuildOrderView,
  Contact,
  MiningRun,
  PendingThread,
  ResearchQueueOrderView,
} from '../api/schemas.js';
import type { GlyphId } from '../game-ui/icons.js';
import i18n from '../i18n/index.js';
import { researchName } from '../i18n/names.js';
import { contactFor, flightFocus, flightTitle, incomingDetail, runArrival, runTitle, type FlightFocus } from './flights.js';
import { buildOrderLabel } from './orders.js';
import { clockTime } from './time.js';

const MINUTE = 60_000;
/** Your own strike is lifted over every other arrival in its last ten minutes. */
export const STRIKE_WINDOW_MS = 10 * MINUTE;
/** Work is worth the line only in its last five minutes. */
export const BUILD_WINDOW_MS = 5 * MINUTE;
/** A galaxy event only in its last fifteen. */
export const EVENT_WINDOW_MS = 15 * MINUTE;
/** The attack shield only in its last hour. */
export const SHIELD_WINDOW_MS = 60 * MINUTE;
/** The move to Silent Space in its last twelve hours: one evening is enough to answer it. D212. */
export const SILENT_SPACE_WINDOW_MS = 12 * 60 * MINUTE;
/** A planned maintenance window is announced a day ahead (F0.9, K7). */
export const MAINTENANCE_NOTICE_MS = 24 * 60 * MINUTE;
/** In its last three hours a raid sent now could land inside it: then it outranks own timers. */
export const MAINTENANCE_NEAR_MS = 3 * 60 * MINUTE;

/** Kinds of your own thread that end in a fight at the far end. */
const STRIKES: ReadonlySet<PendingThread['kind']> = new Set(['fleet', 'pirate', 'death_star']);

export type NowEntry =
  | { tier: 1; kind: 'incoming'; at: number; thread: PendingThread; focus?: FlightFocus }
  | { tier: 2; kind: 'strike'; at: number; thread: PendingThread; focus?: FlightFocus }
  /** Losing the galaxy outranks every own timer; only an enemy landing comes first. D212. */
  | { tier: 2; kind: 'silentSpace'; at: number }
  /** `at` is the start while ahead, the reopening once under way; `until` is always the reopening. */
  | { tier: 2 | 5; kind: 'maintenance'; at: number; started: boolean; startsAt: number; until: number }
  | { tier: 3; kind: 'flight'; at: number; thread: PendingThread; focus?: FlightFocus }
  | { tier: 3; kind: 'run'; at: number; run: MiningRun; focus: FlightFocus }
  /** `waiting`: behind the head of its lane, so its clock is not running yet (D4). */
  | { tier: 4; kind: 'build'; at: number; order: BuildOrderView; waiting: boolean }
  | { tier: 4; kind: 'research'; at: number; order: ResearchQueueOrderView; waiting: boolean }
  | { tier: 5; kind: 'event'; at: number; event: ActiveGalaxyEvent }
  | { tier: 6; kind: 'shield'; at: number };

export interface NowInput {
  /** Server time. */
  now: number;
  threads: readonly PendingThread[];
  contacts?: readonly Contact[];
  runs: readonly MiningRun[];
  /** Every build order on the active world, both lanes. */
  builds: readonly BuildOrderView[];
  research: readonly ResearchQueueOrderView[];
  events: readonly ActiveGalaxyEvent[];
  shieldUntil: Date | null;
  /** When this commander leaves for Silent Space unless they order something first. D212. */
  silentSpaceAt?: Date | null;
  /** The next planned maintenance window, from the public notice. F0.9. */
  maintenance?: { startsAt: Date; endsAt: Date } | null;
}

/**
 * EVERY TIMER THE NOW LINE MAY SHOW, MOST URGENT FIRST. Spec B2.
 *
 * Tier decides before time: an enemy ninety minutes out outranks your transfer
 * landing in one, because only one of them is something happening to you. Within
 * a tier the sooner lands first. Threads stay until the server resolves them, so a
 * fight already due still leads; work, events and the shield drop the moment
 * they are over.
 *
 * `scope: 'sheet'` is the timers sheet one tap under the line, and it holds the WHOLE
 * work queue (owner report, 2026-10-06: three orders queued, two shown). The line keeps
 * its five-minute window for work; the sheet lists every order still to finish, each
 * marked `waiting` while it stands behind the head of its lane.
 */
export function nowEntries(input: NowInput, scope: 'line' | 'sheet' = 'line'): NowEntry[] {
  const { now } = input;
  const within = (at: number, window: number): boolean => at > now && at - now <= window;
  const workShown = (at: number): boolean => (scope === 'sheet' ? at > now : within(at, BUILD_WINDOW_MS));
  const waiting = (order: { startedAt?: Date | undefined }): boolean =>
    order.startedAt !== undefined && order.startedAt.getTime() > now;
  const entries: NowEntry[] = [];

  for (const [index, thread] of input.threads.entries()) {
    const at = thread.arriveAt.getTime();
    const focus = flightFocus(thread, index, input.contacts ?? []);
    const target = focus ? { focus } : {};
    if (thread.kind === 'incoming') {
      entries.push({ tier: 1, kind: 'incoming', at, thread, ...target });
    } else if (STRIKES.has(thread.kind) && thread.leg !== 'return' && at - now <= STRIKE_WINDOW_MS) {
      entries.push({ tier: 2, kind: 'strike', at, thread, ...target });
    } else {
      entries.push({ tier: 3, kind: 'flight', at, thread, ...target });
    }
  }
  for (const run of input.runs) {
    if (run.status !== 'done') entries.push({ tier: 3, kind: 'run', at: runArrival(run), run, focus: { kind: 'run', id: run.id } });
  }
  for (const order of input.builds) {
    const at = order.finishesAt?.getTime();
    if (at !== undefined && workShown(at)) entries.push({ tier: 4, kind: 'build', at, order, waiting: waiting(order) });
  }
  for (const order of input.research) {
    const at = order.finishesAt?.getTime();
    if (at !== undefined && workShown(at)) entries.push({ tier: 4, kind: 'research', at, order, waiting: waiting(order) });
  }
  for (const event of input.events) {
    const at = event.endsAt.getTime();
    if (event.startsAt.getTime() <= now && within(at, EVENT_WINDOW_MS)) {
      entries.push({ tier: 5, kind: 'event', at, event });
    }
  }
  if (input.silentSpaceAt && within(input.silentSpaceAt.getTime(), SILENT_SPACE_WINDOW_MS)) {
    entries.push({ tier: 2, kind: 'silentSpace', at: input.silentSpaceAt.getTime() });
  }
  if (input.maintenance) {
    const startsAt = input.maintenance.startsAt.getTime();
    const until = input.maintenance.endsAt.getTime();
    const started = startsAt <= now;
    if (started ? until > now : within(startsAt, MAINTENANCE_NOTICE_MS)) {
      entries.push({ tier: started || startsAt - now <= MAINTENANCE_NEAR_MS ? 2 : 5, kind: 'maintenance',
        at: started ? until : startsAt, started, startsAt, until });
    }
  }
  if (input.shieldUntil && within(input.shieldUntil.getTime(), SHIELD_WINDOW_MS)) {
    entries.push({ tier: 6, kind: 'shield', at: input.shieldUntil.getTime() });
  }

  return entries.sort((a, b) => a.tier - b.tier || a.at - b.at);
}

/** Each galaxy event by its own name, for every surface that names one. */
export const EVENT_NAME = {
  TRADE_SHIP: 'trade.chip',
  INTERGALACTIC_CONVOY: 'galaxy.intergalacticConvoy',
  ASTEROID_SHOWER: 'galaxy.asteroidShower',
} as const satisfies Record<ActiveGalaxyEvent['kind'], string>;

/**
 * WHAT A NOW-LINE TIMER IS CALLED, AND ONE CLAUSE ABOUT IT.
 *
 * Flights read exactly as the flight board reads them (`lib/flights.ts`); work is
 * named by what is being built; events by their own name.
 */
export function describeNow(
  entry: NowEntry,
  contacts: readonly Contact[] = [],
): { title: string; detail: string | null } {
  switch (entry.kind) {
    case 'incoming':
      return { title: flightTitle(entry.thread), detail: incomingDetail(entry.thread, contactFor(entry.thread, contacts)) };
    case 'strike':
    case 'flight':
      return {
        title: flightTitle(entry.thread),
        detail: entry.thread.fleet ? i18n.t('pendingStrip.craftCount', { count: fleetCount(entry.thread.fleet) }) : null,
      };
    case 'run':
      return { title: runTitle(entry.run), detail: i18n.t('pendingStrip.craftCount', { count: entry.run.craft }) };
    case 'build':
      return { title: buildOrderLabel(entry.order), detail: i18n.t(entry.waiting ? 'now.queued' : 'now.work') };
    case 'research':
      return {
        title: `${researchName(entry.order.projectId)} ${i18n.t('itemSheet.rungLevel', { level: entry.order.level })}`,
        detail: i18n.t(entry.waiting ? 'now.queued' : 'now.research'),
      };
    case 'event':
      return { title: i18n.t(EVENT_NAME[entry.event.kind]), detail: i18n.t('now.event') };
    case 'shield':
      return { title: i18n.t('now.shield'), detail: i18n.t('now.shieldDetail') };
    case 'silentSpace':
      return { title: i18n.t('now.silentSpace'), detail: i18n.t('now.silentSpaceDetail') };
    case 'maintenance':
      return entry.started
        ? { title: i18n.t('now.maintenanceOn'), detail: i18n.t('now.maintenanceOnDetail') }
        : { title: i18n.t('now.maintenance', { from: clockTime(new Date(entry.startsAt)), to: clockTime(new Date(entry.until)) }),
          detail: i18n.t('now.maintenanceDetail') };
  }
}

/** Whose a timer is, by its colour: red only for an enemy, amber for a warning, yours otherwise. */
export type NowTone = 'self' | 'hostile' | 'warn';

export function nowTone(entry: NowEntry): NowTone {
  if (entry.kind === 'incoming') return 'hostile';
  // D212: leaving the galaxy is a warning, never an enemy. F0.9: so is a maintenance window.
  if (entry.kind === 'silentSpace' || entry.kind === 'maintenance') return 'warn';
  return 'self';
}

/**
 * THE WHOLE A TIMER RUNS OVER (G1-c, 2026-11-14): its ring drains across it. Only a whole
 * the game was told — a flight's departure, work's start, an event's window, a maintenance
 * under way. The shield, the move to Silent Space and a maintenance still ahead have none,
 * and an order behind the head of its lane has no running clock: their rings stay empty
 * rather than drain over a made-up whole.
 */
export function nowSpan(entry: NowEntry, contacts: readonly Contact[] = []): { from: number; to: number } | null {
  switch (entry.kind) {
    case 'incoming': {
      // Seen leaving by the galaxy, or not at all: an enemy's departure is not ours to know.
      const seen = contactFor(entry.thread, contacts);
      return seen ? { from: seen.startAt.getTime(), to: seen.endAt.getTime() } : null;
    }
    case 'strike':
    case 'flight':
      return entry.thread.path ? { from: entry.thread.path.departAt.getTime(), to: entry.at } : null;
    case 'run':
      // Home from where it turned: its recall, or the rock it reached.
      return entry.run.status === 'returning'
        ? { from: (entry.run.recalledAt ?? entry.run.arriveAt).getTime(), to: entry.at }
        : { from: entry.run.departAt.getTime(), to: entry.at };
    case 'build':
    case 'research':
      return entry.waiting || entry.order.startedAt === undefined ? null : { from: entry.order.startedAt.getTime(), to: entry.at };
    case 'event':
      return { from: entry.event.startsAt.getTime(), to: entry.at };
    case 'maintenance':
      return entry.started ? { from: entry.startsAt, to: entry.until } : null;
    case 'shield':
    case 'silentSpace':
      return null;
  }
}

/** A flight's mark by what it carries; anything else in the air is a rocket. */
const FLIGHT_GLYPH: Partial<Record<PendingThread['kind'], GlyphId>> = {
  probe: 'eye',
  transfer: 'crate',
  trade: 'crate',
  intergalactic_convoy: 'crate',
  settlement: 'colony',
  radiation_bomb: 'radiation',
  monument: 'star',
  unknown_signal: 'target',
};

/** An event's mark: the shower its rock, the merchant its goods, the convoy a fleet passing (G1-d2). */
export const EVENT_GLYPH = {
  ASTEROID_SHOWER: 'asteroid',
  TRADE_SHIP: 'crate',
  INTERGALACTIC_CONVOY: 'rocket',
} as const satisfies Record<ActiveGalaxyEvent['kind'], GlyphId>;

/** THE MARK EACH TIMER WEARS (G1-c): a list of timers reads before a word of it does. */
export function nowGlyph(entry: NowEntry): GlyphId {
  switch (entry.kind) {
    case 'incoming':
      return 'siren';
    case 'strike':
      return 'attack';
    case 'flight': {
      const { thread } = entry;
      if (thread.leg === 'return') return 'recall';
      if (thread.clanSupport === true) return 'support';
      return FLIGHT_GLYPH[thread.kind] ?? 'rocket';
    }
    case 'run':
      return 'mine';
    case 'build':
      return 'up';
    case 'research':
      return 'zoom';
    case 'event':
      return EVENT_GLYPH[entry.event.kind];
    case 'shield':
      return 'shield';
    case 'silentSpace':
      return 'warn';
    case 'maintenance':
      return 'settings';
  }
}
