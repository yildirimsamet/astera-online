import {
  buildMinutes,
  defenceMinutes,
  researchMinutes,
  shipMinutes,
  type BuildingId,
  type Resources,
} from '@astera/rules';
import { techOf } from './navigation.js';

/**
 * HOW LONG AN ORDER WILL TAKE, QUOTED BEFORE IT IS PLACED.
 *
 * The four functions this wraps have been pure, exported and correct in
 * `@astera/rules` since the economy was written, and `apps/web` called none of
 * them. So the game asked a commander to commit resources to a Citadel, a Dyson
 * shell or a research rung without ever saying whether the thing lands in four
 * minutes or nine hours — while `UpgradeRow` printed `affordableIn`, which answers
 * WHEN THE PRICE IS MET and is a different question from the one being asked.
 *
 * THE ONLY THING THIS MODULE HAS TO GET RIGHT IS AGREEING WITH THE SERVER. A time
 * the server then contradicts is worse than no time at all: the first contradiction
 * teaches the player that every figure on the screen is a guess, and this game is
 * built on the opposite claim. So each branch below mirrors one call site in
 * `apps/server/src/services/build.ts` or `research.ts`, including the parts that
 * look like inconsistencies and are not:
 *
 *   · CONSTRUCTION prices against the PROJECTED Core — the level the order will
 *     inherit once everything ahead of it in its own queue has finished
 *     (`buildQueueContext`). Quoting today's Core understates every row on a screen
 *     with a Core upgrade already queued.
 *   · A YARD order prices against the CURRENT Shipyard, and that is not an
 *     oversight to be tidied up. The two queues run in parallel, so the projection
 *     a hull inherits contains only other hulls; a Shipyard rising in CONSTRUCTION
 *     may well finish after the ship does, and the server refuses to assume it
 *     won't.
 *   · RESEARCH prices against the CURRENT Core, because `research.ts` reads
 *     `planet.buildings.CORE` directly rather than going through a build queue at
 *     all. D134 made research commander-wide with its own lane; it never acquired
 *     the projection the other two have.
 *
 * Pure, and takes only what it reads. No clock: this is a DURATION, not a moment.
 */

/** Which lane an order goes down, which is what decides its arithmetic. */
export type OrderKind = 'BUILDING' | 'INSTRUMENT' | 'SATELLITE' | 'HULL' | 'DEFENCE' | 'RESEARCH';

/** One order already in a queue, as much of it as the timing needs. */
interface QueuedOrder {
  kind: string;
  subject: string;
  count: number;
}

/**
 * The parts of a planet view this reads.
 *
 * Structural rather than the full `PlanetView`, so the helper stays testable
 * without standing up a whole payload — and so a caller holding an optimistic or
 * partial view can still ask.
 */
export interface OrderTimingSource {
  buildings: Partial<Record<BuildingId, number>>;
  research: readonly { id: string; level?: number; completed?: boolean }[];
  queues?: {
    CONSTRUCTION: readonly QueuedOrder[];
    YARD: readonly QueuedOrder[];
  } | undefined;
}

const levelOf = (view: OrderTimingSource, building: BuildingId): number =>
  view.buildings[building] ?? 0;

/**
 * How many levels of one building are already waiting in the CONSTRUCTION queue.
 *
 * `projectOrder` on the server adds one level per BUILDING order regardless of its
 * `count`, because a building order is always a single level — the field exists for
 * hull batches. Counting `count` here would inflate the projection the first time
 * anything else in the schema used it.
 */
const queuedLevels = (view: OrderTimingSource, building: BuildingId): number =>
  (view.queues?.CONSTRUCTION ?? []).filter(
    (order) => order.kind === 'BUILDING' && order.subject === building,
  ).length;

/** Core as a CONSTRUCTION order will find it: what stands, plus what is queued ahead. */
export const projectedCore = (view: OrderTimingSource): number =>
  levelOf(view, 'CORE') + queuedLevels(view, 'CORE');

/**
 * Shipyard as a YARD order will find it — which is simply what stands today.
 *
 * The YARD queue holds only hulls, so there is nothing in a ship's own lane that
 * could raise the Shipyard before it starts. Written as its own function rather
 * than inlined so the asymmetry with `projectedCore` is visible and tested rather
 * than looking like a forgotten `+`.
 */
export const projectedShipyard = (view: OrderTimingSource): number =>
  levelOf(view, 'SHIPYARD');

/**
 * Minutes this order will take once it starts.
 *
 * NOT "minutes until it is done" — anything ahead of it in its queue has to finish
 * first, and that wait belongs to the queue rather than to the thing being bought.
 * A caller with a queue on screen can add the two; a row in a catalogue is quoting
 * a property of the item.
 *
 * `count` scales the COST and then prices it, exactly as `build.ts` does, so a
 * batch of ten hulls quotes ten hulls of yard time and hits the same cap.
 */
export function orderMinutes(
  kind: OrderKind,
  cost: Resources,
  view: OrderTimingSource,
  count = 1,
): number {
  const priced: Resources = count === 1
    ? cost
    : { alloy: cost.alloy * count, crystal: cost.crystal * count, deuterium: cost.deuterium * count };

  switch (kind) {
    case 'BUILDING':
    case 'INSTRUMENT':
    case 'SATELLITE':
      return buildMinutes(priced, projectedCore(view));
    case 'HULL':
      return shipMinutes(priced, projectedShipyard(view), techOf({ research: research(view) }));
    case 'DEFENCE':
      return defenceMinutes(priced, projectedShipyard(view));
    case 'RESEARCH':
      // The CURRENT Core, deliberately. See the docblock: `research.ts` reads the
      // planet's own level and never consults a build queue.
      return researchMinutes(priced, levelOf(view, 'CORE'));
  }
}

/** `techOf` wants the payload's own research shape; this narrows to it. */
const research = (view: OrderTimingSource) =>
  view.research as Parameters<typeof techOf>[0]['research'];
