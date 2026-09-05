import { TRADE } from './constants.js';
import { orbitPosition, orbitRadius } from './galaxy.js';
import type { OrbitElements } from './galaxy.js';
import type { TradeShipEffect } from './galaxyEvents.js';
import { resourcesTotal } from './strategic.js';
import type { Resources, Rng, Vec3 } from './types.js';

/**
 * TİCARET GEMİSİ — A SHOP THAT COMES TO THE GALAXY. D156.
 *
 * The disc has known three targets — a commander, a neutral world, a pirate — and
 * every one of them is something you take from. This is the first one you deal
 * with. It converts a surplus you cannot spend into the resource that is holding
 * your queue up, and it does so at one published rate with no haggling, no order
 * book and no price discovery: a rate a player can hold in their head is a rate
 * they can plan a convoy against a day in advance.
 *
 * IT IS A PURE FUNCTION OF ITS OCCURRENCE, exactly like a pirate is a pure
 * function of the season key. The calendar row says when it is there and what it
 * pays; everything else — where on the disc, on which plane, at what phase — is
 * derived from one stream. Nothing about the ship is stored.
 *
 * AND UNLIKE A PIRATE, IT IS PUBLIC. A pirate's orbital elements are the route
 * and D150 forbids publishing a route, because a pirate is a private opportunity
 * that sight is sold for. A trade ship is an ANNOUNCED moment: everybody knows it
 * is there, so its elements may leave the server and the disc may draw the whole
 * circle. Fog hides pre-decision knowledge, never a public live event. What stays
 * server-side is the same thing D149 has always kept back — the FUTURE calendar.
 *
 * WHAT THE PLAYER ACTUALLY DECIDES IS CARGO, which is why `quoteTrade` states the
 * return leg's volume rather than only the offer's. There is no quota, no fee and
 * no one-convoy-per-world rule: hold size, a flight bay and prepaid fuel (D136)
 * are the brakes, and they are the brakes the rest of the game already runs on.
 */

export interface TradeRate {
  /** Units one Alloy is worth. */
  readonly alloy: number;
  /** Units one Crystal is worth. */
  readonly crystal: number;
  /** Units one Deuterium is worth. */
  readonly deuterium: number;
}

export interface TradeShipSpec extends OrbitElements {
  /** Which TRADE_SHIP occurrence in the season's calendar. */
  sequence: number;
  /** Minutes since season start. */
  appearsAt: number;
  /** Minutes since season start. It is gone after this. */
  expiresAt: number;
  /**
   * Frozen at the occurrence, so a later constant change never moves a live
   * season. The same rule the whole event calendar runs on: what is dealt is
   * dealt, and editing the table is a next-season change.
   */
  rate: TradeRate;
}

/**
 * WHAT ONE MERCHANT IS, AND WHERE IT RUNS.
 *
 * THE ROLL ORDER IS THE CONTRACT — radius, phase, inclination, ascendingNode.
 * Every draw is taken in a fixed sequence from one generator, so inserting a new
 * property in the middle re-rolls every trade ship after it. APPEND, never insert.
 * `pirates.ts` carries the same warning for the same reason.
 *
 * SPEED IS FIXED AND THE PERIOD IS DERIVED. A pirate and a rock both roll a speed
 * because how fast one moves is part of what you are judging before you commit.
 * A merchant is not a fight and not a race against another commander — it is an
 * appointment — so the only thing worth varying is where it keeps it. One speed
 * also means one honest sentence on the launch screen about whether your convoy
 * leads it, which at half an Atlas is always yes.
 */
export function tradeShipSpec(
  occurrence: {
    sequence: number;
    startsAtMinute: number;
    endsAtMinute: number;
    effect: TradeShipEffect;
  },
  rng: Rng,
): TradeShipSpec {
  // The shared draw, handed this lane's own band — never a second distribution.
  const radius = orbitRadius(rng(), TRADE.orbitMin, TRADE.orbitMax);
  return {
    sequence: occurrence.sequence,
    radius,
    // Period follows from the two, exactly as it does for a rock and a pirate.
    period: (2 * Math.PI * radius) / TRADE.speed,
    phase: rng() * Math.PI * 2,
    // Uniform cos(inclination) makes the orbit normals isotropic. Choosing the
    // angle itself uniformly would crowd orbital planes around the poles.
    inclination: Math.acos(rng() * 2 - 1),
    ascendingNode: rng() * Math.PI * 2,
    speed: TRADE.speed,
    appearsAt: occurrence.startsAtMinute,
    expiresAt: occurrence.endsAtMinute,
    rate: { ...occurrence.effect.rate },
  };
}

/** Where this merchant is at this instant. The shared orbit trig, nothing added. */
export const tradeShipPosition = (spec: TradeShipSpec, minutes: number): Vec3 =>
  orbitPosition(spec, minutes);

/** Is this merchant in the disc at this instant? Half-open, like a rock. */
export const tradeShipActive = (spec: TradeShipSpec, minutes: number): boolean =>
  minutes >= spec.appearsAt && minutes < spec.expiresAt;

/**
 * What a pile of resources is worth in the merchant's own currency.
 *
 * ONE SCALE FOR BOTH SIDES OF THE COUNTER, which is what makes the swap a single
 * comparison rather than three exchange rates that have to agree.
 */
export const tradeUnits = (resources: Resources, rate: TradeRate): number =>
  resources.alloy * rate.alloy
  + resources.crystal * rate.crystal
  + resources.deuterium * rate.deuterium;

export type TradeRefusal =
  | 'EMPTY_GIVE'
  | 'EMPTY_WANT'
  | 'OVERLAPPING_RESOURCE'
  /** Non-integer, negative, or not a number at all. */
  | 'BAD_AMOUNT'
  /** `askUnits > offerUnits`. */
  | 'INSUFFICIENT_OFFER';

export interface TradeQuote {
  offerUnits: number;
  askUnits: number;
  /** `offerUnits − askUnits`. Lost to the merchant; every surface must SHOW it (D124). */
  leftoverUnits: number;
  /** `resourcesTotal(give)` — what the convoy carries out. */
  outboundVolume: number;
  /** `resourcesTotal(want)` — what the convoy brings home. */
  returnVolume: number;
  /** max(outbound, return) — the leg that decides how big the convoy must be. */
  requiredHold: number;
  /** Null means the swap is legal. */
  refusal: TradeRefusal | null;
}

const AMOUNTS = ['alloy', 'crystal', 'deuterium'] as const;

const isCountable = (amount: number): boolean =>
  Number.isInteger(amount) && amount >= 0;

const NO_QUOTE = {
  offerUnits: 0,
  askUnits: 0,
  leftoverUnits: 0,
  outboundVolume: 0,
  returnVolume: 0,
  requiredHold: 0,
} as const;

/**
 * PRICE A SWAP, AND NEVER THROW WHILE DOING IT.
 *
 * This runs on every keystroke of a composer and once more inside the launch
 * transaction, so it reports a refusal instead of raising: the screen needs to say
 * WHY the button is dark, and an exception cannot be rendered.
 *
 * THE RETURN LEG IS THE ANSWER PLAYERS ACTUALLY NEED. A thousand Deuterium is
 * ninety thousand units and buys seventy thousand units of ore — the convoy that
 * carries the offer out needs room for a thousand, and the one that brings the
 * goods home needs room for seventy thousand. Sizing a wing against the outbound
 * leg is the mistake this quote exists to prevent, so `requiredHold` is the larger
 * of the two and is stated rather than left to be inferred (D124/D142).
 *
 * REFUSAL ORDER IS DELIBERATE. `BAD_AMOUNT` comes first because nothing else can
 * be computed honestly from a number that is not one — the figures come back as
 * zeroes rather than as `NaN`, since there is genuinely no quote to state. Then
 * the two empties, then the self-swap, and `INSUFFICIENT_OFFER` last, because it
 * is the only refusal a player fixes by typing a different NUMBER rather than by
 * choosing a different resource.
 */
export function quoteTrade(give: Resources, want: Resources, rate: TradeRate): TradeQuote {
  for (const resource of AMOUNTS) {
    if (!isCountable(give[resource]) || !isCountable(want[resource])) {
      return { ...NO_QUOTE, refusal: 'BAD_AMOUNT' };
    }
  }

  const offerUnits = tradeUnits(give, rate);
  const askUnits = tradeUnits(want, rate);
  const outboundVolume = resourcesTotal(give);
  const returnVolume = resourcesTotal(want);
  const quote = {
    offerUnits,
    askUnits,
    leftoverUnits: offerUnits - askUnits,
    outboundVolume,
    returnVolume,
    requiredHold: Math.max(outboundVolume, returnVolume),
  };

  if (offerUnits <= 0) return { ...quote, refusal: 'EMPTY_GIVE' };
  if (askUnits <= 0) return { ...quote, refusal: 'EMPTY_WANT' };
  /*
    A SELF-SWAP IS A ROUND TRIP THAT ENDS WHERE IT BEGAN, minus whatever the
    merchant keeps. It burns two legs of fuel and a flight bay for nothing, and it
    makes "what did I gain from this" unreadable on every surface downstream —
    the report, the record, the hold. Refused here so no screen has to explain it.
  */
  if (AMOUNTS.some((resource) => give[resource] > 0 && want[resource] > 0)) {
    return { ...quote, refusal: 'OVERLAPPING_RESOURCE' };
  }
  if (askUnits > offerUnits) return { ...quote, refusal: 'INSUFFICIENT_OFFER' };
  return { ...quote, refusal: null };
}
