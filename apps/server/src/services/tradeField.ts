import { createHmac } from 'node:crypto';
import {
  tradeShipActive,
  tradeShipSpec,
  type PlannedGalaxyEvent,
  type TradeShipSpec,
} from '@astera/rules';

/**
 * THE SEASON'S TRADE SHIPS, DERIVED AND NEVER STORED. D156.
 *
 * The mirror of `pirateField.ts`, and much smaller, because there is nothing to
 * persist: a pirate has a crew that gets shot off and a hoard that gets taken
 * once, and the merchant has neither. Its stock is unlimited and its rate is
 * frozen on the calendar row, so every fact about it is a pure function of the
 * season key and the occurrence. That is also why this lane has no `trade_state`
 * table and therefore cannot reach D150's "seed the row before `FOR UPDATE`"
 * race — there is no row to seed.
 *
 * `packages/rules` may not import `crypto` (A1), so the keyed determinism is
 * injected from this side and the pure generator is handed an ordinary function —
 * exactly as `asteroidField.ts` and `pirateField.ts` do it.
 *
 * ITS OWN HMAC LABEL NAMESPACE, AND THAT IS LOAD-BEARING. Three lanes now hang off
 * one season secret. `trade:draw:*` cannot collide with `asteroid:draw:*`,
 * `asteroid:shower:v1:*` or `pirate:draw:*`, so adding merchants to a calendar
 * moves neither a rock nor a pirate. A copied label would not fail anywhere: the
 * field would still generate and every season would just quietly be a different
 * season from the one the balance was measured on. `trade-field.test.ts` asserts
 * the independence rather than trusting it.
 *
 * ONE THING THIS FILE DOES DIFFERENTLY FROM ITS TWO NEIGHBOURS: the spec it
 * returns is PUBLIC. A pirate's orbital elements are its route, and D150 forbids
 * publishing a route because a pirate is a private opportunity that sight is sold
 * for. A trade ship is an announced moment — fog hides pre-decision knowledge, not
 * a public live event — so `activeGalaxyEvents` may hand the client the whole
 * circle. What stays back is what D149 has always kept back: an occurrence that
 * has not started yet.
 */

type PlannedTradeShip = Extract<PlannedGalaxyEvent, { kind: 'TRADE_SHIP' }>;

/** One independent stream per occurrence, so a later merchant cannot move an earlier one. */
function tradeRng(key: string, sequence: number): () => number {
  let counter = 0;
  return () => {
    const value = createHmac('sha256', key)
      .update(`trade:draw:${String(sequence)}:${String(counter)}`)
      .digest()
      .readUInt32BE(0);
    counter += 1;
    return value / 0x1_0000_0000;
  };
}

const specCache = new Map<string, TradeShipSpec>();
const CACHE_MAX = 64;

function trim(cache: Map<string, TradeShipSpec>): void {
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) return;
    cache.delete(oldest);
  }
}

/*
  THE CACHE KEY IS THE WHOLE OCCURRENCE, NOT JUST ITS SEQUENCE.

  A calendar row is immutable once dealt, so in production the sequence alone
  would do. It is not what the key is defending against: the same season key with
  a hand-built occurrence turns up in tests and in the simulator, and a key that
  ignored the window would serve the first caller's ship to the second and hide
  the difference. Cheap to include, and it makes the memo a memo rather than a
  second source of truth.
*/
const cacheKeyOf = (key: string, occurrence: PlannedTradeShip): string => [
  key,
  occurrence.sequence,
  occurrence.startsAtMinute,
  occurrence.endsAtMinute,
  occurrence.effect.rate.alloy,
  occurrence.effect.rate.crystal,
  occurrence.effect.rate.deuterium,
].join(':');

/** The merchant one calendar row describes. Memoised, LRU-64. */
export function tradeShipOf(key: string, occurrence: PlannedTradeShip): TradeShipSpec {
  const cacheKey = cacheKeyOf(key, occurrence);
  const cached = specCache.get(cacheKey);
  if (cached) {
    specCache.delete(cacheKey);
    specCache.set(cacheKey, cached);
    return cached;
  }
  const spec = tradeShipSpec(occurrence, tradeRng(key, occurrence.sequence));
  specCache.set(cacheKey, spec);
  trim(specCache);
  return spec;
}

/**
 * The merchant standing in the disc at this instant, or null.
 *
 * Half-open on `[appearsAt, expiresAt)`, like a rock and like the occurrence
 * clock the calendar row is read with — one definition of "active", not two.
 */
export function activeTradeShip(
  key: string,
  occurrences: readonly PlannedGalaxyEvent[],
  minutes: number,
): TradeShipSpec | null {
  for (const occurrence of occurrences) {
    if (occurrence.kind !== 'TRADE_SHIP') continue;
    const spec = tradeShipOf(key, occurrence);
    if (tradeShipActive(spec, minutes)) return spec;
  }
  return null;
}
