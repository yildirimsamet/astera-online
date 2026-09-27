import { fleetCount } from '@astera/rules';
import type {
  ActiveGalaxyEvent,
  BuildOrderView,
  Contact,
  MiningRun,
  PendingThread,
  ResearchQueueOrderView,
} from '../api/schemas.js';
import i18n from '../i18n/index.js';
import { researchName } from '../i18n/names.js';
import { contactFor, flightFocus, flightTitle, incomingDetail, runArrival, runTitle, type FlightFocus } from './flights.js';
import { buildOrderLabel } from './orders.js';

const MINUTE = 60_000;
/** Your own strike is lifted over every other arrival in its last ten minutes. */
export const STRIKE_WINDOW_MS = 10 * MINUTE;
/** Work is worth the line only in its last five minutes. */
export const BUILD_WINDOW_MS = 5 * MINUTE;
/** A galaxy event only in its last fifteen. */
export const EVENT_WINDOW_MS = 15 * MINUTE;
/** The attack shield only in its last hour. */
export const SHIELD_WINDOW_MS = 60 * MINUTE;

/** Kinds of your own thread that end in a fight at the far end. */
const STRIKES: ReadonlySet<PendingThread['kind']> = new Set(['fleet', 'pirate', 'death_star']);

export type NowEntry =
  | { tier: 1; kind: 'incoming'; at: number; thread: PendingThread; focus?: FlightFocus }
  | { tier: 2; kind: 'strike'; at: number; thread: PendingThread; focus?: FlightFocus }
  | { tier: 3; kind: 'flight'; at: number; thread: PendingThread; focus?: FlightFocus }
  | { tier: 3; kind: 'run'; at: number; run: MiningRun; focus: FlightFocus }
  | { tier: 4; kind: 'build'; at: number; order: BuildOrderView }
  | { tier: 4; kind: 'research'; at: number; order: ResearchQueueOrderView }
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
}

/**
 * EVERY TIMER THE NOW LINE MAY SHOW, MOST URGENT FIRST. Spec B2.
 *
 * Tier decides before time: an enemy ninety minutes out outranks your transfer
 * landing in one, because only one of them is something happening to you. Within
 * a tier the sooner lands first. Threads stay until the server resolves them, so a
 * fight already due still leads; work, events and the shield drop the moment
 * they are over.
 */
export function nowEntries(input: NowInput): NowEntry[] {
  const { now } = input;
  const within = (at: number, window: number): boolean => at > now && at - now <= window;
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
    if (at !== undefined && within(at, BUILD_WINDOW_MS)) entries.push({ tier: 4, kind: 'build', at, order });
  }
  for (const order of input.research) {
    const at = order.finishesAt?.getTime();
    if (at !== undefined && within(at, BUILD_WINDOW_MS)) entries.push({ tier: 4, kind: 'research', at, order });
  }
  for (const event of input.events) {
    const at = event.endsAt.getTime();
    if (event.startsAt.getTime() <= now && within(at, EVENT_WINDOW_MS)) {
      entries.push({ tier: 5, kind: 'event', at, event });
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
      return { title: buildOrderLabel(entry.order), detail: i18n.t('now.work') };
    case 'research':
      return {
        title: `${researchName(entry.order.projectId)} ${i18n.t('itemSheet.rungLevel', { level: entry.order.level })}`,
        detail: i18n.t('now.research'),
      };
    case 'event':
      return { title: i18n.t(EVENT_NAME[entry.event.kind]), detail: i18n.t('now.event') };
    case 'shield':
      return { title: i18n.t('now.shield'), detail: i18n.t('now.shieldDetail') };
  }
}
