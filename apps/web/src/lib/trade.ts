import type { Resources, TradeRate } from '@astera/rules';
import type { ActiveGalaxyEvent } from '../api/schemas.js';

/**
 * THE MERCHANT, FOUND IN THE PUBLIC EVENT LIST. D156.
 *
 * `/api/galaxy/events` publishes a discriminated union and the merchant is one
 * variant of it. Two things about that are worth a module of their own rather than
 * three inline expressions:
 *
 *   · `Array.prototype.filter` DOES NOT NARROW a discriminated union — the result
 *     is still the union, so every reader that wanted the orbit reached for a cast.
 *     `flatMap` narrows, which is the lesson `ActiveGalaxyEvent.tsx` had to learn
 *     first, and this is the one place it is written down.
 *   · A PUBLISHED EVENT IS NOT AUTOMATICALLY A LIVE ONE. The payload is fetched on
 *     a one-minute heal and cached, so a window that shut thirty seconds ago is
 *     still in the array. Half-open at the far end, exactly like `tradeShipActive`
 *     in the rules package — `endsAt` is the first instant it is gone.
 *
 * There is no fog question anywhere near this: the merchant is an announced public
 * moment and every commander in the galaxy sees the same one (D156).
 */
export type TradeShipEvent = Extract<ActiveGalaxyEvent, { kind: 'TRADE_SHIP' }>;

/**
 * The merchant currently in the sky, or null.
 *
 * `now` is a SERVER instant — `serverNow()`, never a device clock (D51/D52): the
 * two window edges are server-authored and subtracting a phone's own epoch from
 * them would open or shut the appointment early on a mis-set device.
 */
export function activeTradeShip(
  events: readonly ActiveGalaxyEvent[] | undefined,
  now: number,
): TradeShipEvent | null {
  const open = (events ?? []).flatMap((event) => (
    event.kind === 'TRADE_SHIP'
      && now >= event.startsAt.getTime()
      && now < event.endsAt.getTime()
      ? [event]
      : []
  ));
  return open[0] ?? null;
}

/**
 * Is this merchant still there at this instant?
 *
 * The same half-open test, for a caller that already HAS the event — the sheet,
 * which holds one open while the window can shut underneath it. Kept beside
 * `activeTradeShip` so the two can never disagree about the boundary.
 */
export const tradeWindowOpen = (merchant: TradeShipEvent, now: number): boolean =>
  now >= merchant.startsAt.getTime() && now < merchant.endsAt.getTime();

/* ── the counter's arithmetic ─────────────────────────────────────────────── */

/**
 * A GOOD THE MERCHANT DEALS IN. The rate table's own three keys, and no others.
 */
export type TradeGood = keyof TradeRate;

const GOODS: readonly TradeGood[] = ['alloy', 'crystal', 'deuterium'];

const EMPTY_TRADE: Resources = { alloy: 0, crystal: 0, deuterium: 0 };

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));

const lcm = (a: number, b: number): number => (a / gcd(a, b)) * b;

/**
 * THE SMALLEST PILE OF UNITS THAT IS A WHOLE NUMBER OF ALL THREE GOODS. D183.
 *
 * What the rail draws the rate against. The anchor used to be a single deuterium,
 * which came out whole in every row while the other two prices divided it
 * (1 · 3 · 90 — ninety alloy and thirty crystal). At 1 · 2 · 9 it does not: one
 * deuterium is four and a half crystal, and a resource that only exists in whole
 * units must never be drawn as a fraction.
 *
 * The least common multiple is the smallest anchor with no fractions in it, which
 * keeps the picture as small as the rate allows — on the shipped table it is 18,
 * so the rail reads 18 alloy · 9 crystal · 2 deuterium.
 */
export const rateAnchor = (rate: TradeRate): number =>
  lcm(lcm(rate.alloy, rate.crystal), rate.deuterium);

/**
 * THE TWO GOODS A SWAP MAY ASK FOR, DEARER FIRST — AND THE ORDER IS LOAD-BEARING.
 *
 * The ask is a SPLIT of a fixed number of units, so one good gets the slider and
 * the other absorbs whatever is left. The absorber must be the CHEAPER of the two,
 * and that is arithmetic rather than taste: a remainder can only be spent exactly
 * by a good whose price divides it, and the cheap good is the one with the best
 * chance of dividing anything. Hand the slider to the cheap good instead and the
 * dear one inherits a fraction — three crystal of offer would have to come home as
 * a third of a deuterium.
 *
 * So the dearer good leads, always.
 *
 * THE CHEAP PRICE NO LONGER DIVIDES THE DEAR ONE. D183 moved the rate from
 * 1 · 3 · 90 to 1 · 2 · 9, and this note used to lean on 90 being a multiple of 3
 * — with nine and two it is not, so a remainder of one unit cannot be spent by
 * anything and the counter would keep a scrap. `leadStride` is what replaced that
 * accident with a rule: the split moves in whatever steps actually close the
 * arithmetic, whatever the rate says.
 */
export const dearestFirst = (
  give: TradeGood,
  rate: TradeRate,
): readonly [TradeGood, TradeGood] => {
  const rest = GOODS.filter((good) => good !== give).sort((a, b) => rate[b] - rate[a]);
  return [rest[0]!, rest[1]!];
};

/**
 * THE BIGGEST OFFER THIS CONVOY COULD BRING HOME **WHATEVER THE PLAYER ASKS FOR**.
 *
 * Two walls, and the second is the one nobody guesses:
 *
 *   · The offer has to fit going OUT. That is the obvious one.
 *   · Whatever it buys has to fit coming BACK — and the haul that needs the most
 *     room is all of it in the CHEAPEST good, because cheap means many. Ninety-six
 *     deuterium is 8,640 units; as crystal that is 2,880 of hold, and as alloy it
 *     is 8,640.
 *
 * IT WAS SOLVED AGAINST THE DEAREST GOOD FIRST, WHICH IS THE LIGHTEST HAUL AND
 * THEREFORE THE WRONG WALL. Owner report: *"96 döteryum, kristal hiç istemiyorum
 * yani en sola çektim → gelen alaşım 30 adet. Bu ne saçmalık?"* The ceiling let an
 * offer through that only fitted if the player took it in the dear good, and
 * `balanceTake` then silently pushed the split up off its own floor to make it fit
 * — so the slider sat pinned at its left end reporting a mix nobody had chosen.
 *
 * Against the cheapest good the ceiling is lower and every position of the split
 * is legal by construction: the slider runs its whole length and both ends mean
 * what their labels say. The price is capacity, and the sheet says so — add a ship
 * and it rises.
 *
 * Snapped down to `offerStep` so the ask can always spend the offer to nothing.
 */
export const largestOffer = (
  store: number,
  hold: number,
  give: TradeGood,
  rate: TradeRate,
): number => offerCeiling(store, hold, give, rate).top;

/** Which of the two things stopped the offer where it did. */
export type OfferWall = 'store' | 'hold';

/**
 * THE CEILING AND THE REASON FOR IT, FROM ONE CALCULATION. D166.
 *
 * The sheet has always printed WHY the slider stops — "all this world has", or
 * "grow the convoy to raise it" — and it used to work that out with arithmetic of
 * its own: this function capped the offer with `rate[cheapest]` (the wall the
 * RETURN leg sets), while the caption compared the store against a convoy figure
 * built from `rate[dearest]`. Two formulas for one number, disagreeing in the case
 * that matters most.
 *
 * Giving deuterium with one Atlas (hold 6,000) at a world holding 100 deuterium:
 * the real ceiling is 66, set by what the convoy can carry home. The caption's own
 * sum made the convoy wall 6,000, saw that 100 was smaller, and printed "at most
 * 66 — all this world has" over a world plainly holding a hundred. The player was
 * told to wait for the mine when the fix was to add a ship — the exact Clarity
 * failure (I1) the caption exists to prevent.
 *
 * So the reason is returned WITH the number. `store` wins ties, because a store
 * that exactly equals the convoy's capacity is the thing the player can do least
 * about in the next few minutes.
 */
export const offerCeiling = (
  store: number,
  hold: number,
  give: TradeGood,
  rate: TradeRate,
): { top: number; wall: OfferWall } => {
  if (hold <= 0) return { top: 0, wall: 'hold' };
  const [, cheapest] = dearestFirst(give, rate);
  /** What the convoy can bring HOME, which is the binding leg for a cheap good. */
  const byConvoy = Math.min(Math.floor(hold), Math.floor((hold * rate[cheapest]) / rate[give]));
  const byStore = Math.floor(store);
  const step = offerStep(give, rate);
  const top = Math.max(0, Math.floor(Math.min(byStore, byConvoy) / step) * step);
  return { top, wall: byStore <= byConvoy ? 'store' : 'hold' };
};

/**
 * THE GRID THE OFFER MOVES ON — ONE WHOLE UNIT OF THE DEAREST GOOD IT BUYS.
 *
 * Ninety alloy is exactly one deuterium, so an alloy offer moves in nineties;
 * thirty crystal is one deuterium, so a crystal offer moves in thirties; and a
 * deuterium offer moves one at a time, because a single deuterium already buys
 * thirty whole crystal.
 *
 * IT WAS DERIVED AGAINST THE CHEAPEST GOOD FIRST, AND THAT WAS TWO BUGS AT ONCE.
 * Owner report: *"Sayılar neden 1 2 birim az gösteriliyor? Komisyon falan mı
 * var?"* and *"Hepsini döteryum seçmeme rağmen 6 kristal kalıyor, neden?"* There
 * is no fee — the owner ruled one out before a line was written. Snapping to the
 * cheapest good put an alloy offer on a grid of three, which turned a 2,900 hold
 * into a 2,898 offer for no reason a player could see, and left an offer that
 * could not be spent purely on deuterium: 2,898 buys thirty-two and strands twenty
 * units, which the cheap good then mopped up as six crystal nobody asked for.
 *
 * Against the DEAREST good the arithmetic closes at the TOP: `units` is a multiple
 * of the dear price, so the far end of the split slider is a whole number of the
 * dear good with nothing left over. Every notch below it used to close as well,
 * because the cheap price divided the dear one (1 · 3 · 90) — at D183's 1 · 2 · 9
 * it does not, and `leadStride` is what makes the notches between the ends land on
 * splits that still spend the offer to nothing.
 */
export const offerStep = (give: TradeGood, rate: TradeRate): number => {
  const [dear] = dearestFirst(give, rate);
  return lcm(rate[give], rate[dear]) / rate[give];
};

/**
 * HOW FAR APART THE SPLIT'S NOTCHES ARE. D183.
 *
 * A split spends the offer to nothing when `units − lead·dear` is a whole number
 * of the cheap good. While the cheap price divided the dear one that was true of
 * EVERY lead (1 · 3 · 90 — take one deuterium out of any pile of units and what is
 * left is still a multiple of three). At 1 · 2 · 9 it is not: nine is odd, so
 * taking one deuterium out of an even pile leaves an odd one, and one unit is a
 * scrap no good can spend.
 *
 * The leads that DO close are an arithmetic run, and this is its step. It is one
 * for every rate where the cheap price divides the dear one, so the old table's
 * behaviour is exactly what this returns for it — nothing about the split changed
 * for a rate that never needed it.
 *
 * WHY NOT REFUSE THE SCRAP INSTEAD. Because "the counter never keeps a scrap" is
 * the whole promise of this sheet (the owner's own report: the first version made
 * a balanced swap an achievement). A slider that skips a notch is a slider you can
 * still read; a swap that quietly hands the merchant a unit is not.
 */
export const leadStride = (give: TradeGood, rate: TradeRate): number => {
  const [dear, cheap] = dearestFirst(give, rate);
  return rate[cheap] / gcd(rate[dear], rate[cheap]);
};

/**
 * The smallest lead that spends this many units to nothing.
 *
 * Searched rather than solved: the stride is at most the cheap price — two, on the
 * shipped table — so this is a couple of iterations, and a closed-form modular
 * inverse would be four lines of number theory to save them. `units` is always a
 * multiple of the dear price (`offerStep`), so the top of the range always closes
 * and the search can never come back empty.
 */
const leadFloor = (units: number, give: TradeGood, rate: TradeRate): number => {
  const [dear, cheap] = dearestFirst(give, rate);
  const stride = leadStride(give, rate);
  for (let lead = 0; lead < stride; lead += 1) {
    if ((units - lead * rate[dear]) % rate[cheap] === 0) return lead;
  }
  return 0;
};

/**
 * SPEND EVERY UNIT OF THE OFFER, WITH THE SPLIT THE PLAYER CHOSE.
 *
 * `lead` is how many of the dearer good the player has dragged for — `Infinity`
 * for "as much as possible", which is what the sheet opens on, because there is
 * no reading of this screen where a commander wants FEWER goods for the same
 * payment. The cheaper good takes the remainder exactly.
 *
 * THE HOLD FLOOR BELOW IS A GUARD, NOT A FEATURE, and it must never bind. Dragging
 * toward the cheaper good makes the haul BULKIER — sixty crystal weigh sixty where
 * two deuterium weigh two — so a convoy's room is a floor under the dear good. When
 * that floor actually bit, the slider's left end stopped meaning what it said
 * (`largestOffer` records the report). `largestOffer` now keeps every split inside
 * the hold, so this arithmetic stays only to make the invariant true for any
 * caller rather than by agreement between two functions.
 *
 *   return volume = lead + (units − lead·dear) / cheap ≤ hold
 *   ⇒ lead ≥ (hold·cheap − units) / (cheap − dear)          [cheap < dear, so the
 *                                                            division flips it]
 */
export const balanceTake = (
  units: number,
  give: TradeGood,
  lead: number,
  rate: TradeRate,
  hold: number,
): Resources => {
  const [dear, cheap] = dearestFirst(give, rate);
  const ceiling = Math.floor(Math.max(0, units) / rate[dear]);
  const floorForHold = Math.ceil((hold * rate[cheap] - units) / (rate[cheap] - rate[dear]));
  const low = Math.max(0, Math.min(ceiling, floorForHold));
  const wanted = Math.max(low, Math.min(ceiling, Math.floor(lead)));
  /*
    AND ONTO A NOTCH THAT ACTUALLY CLOSES. D183.

    `leadStride` is one for any rate whose cheap price divides its dear one, so
    this is the identity for the table this sheet shipped with and a real snap for
    D183's. Rounded DOWN toward the base, never up: up can leave the hold floor,
    and the promise here is that the offer is spent to nothing rather than that the
    player gets the exact number they dragged to.
  */
  const base = leadFloor(units, give, rate);
  const stride = leadStride(give, rate);
  const snapped = wanted <= base
    ? base
    : base + Math.floor((wanted - base) / stride) * stride;
  const taken = Math.min(ceiling, snapped);
  const rest = Math.max(0, units - taken * rate[dear]);
  return { ...EMPTY_TRADE, [dear]: taken, [cheap]: Math.floor(rest / rate[cheap]) };
};

/** The narrowest the split slider may sit, given what the convoy can carry home. */
export const leastDearest = (
  units: number,
  give: TradeGood,
  rate: TradeRate,
  hold: number,
): number => balanceTake(units, give, 0, rate, hold)[dearestFirst(give, rate)[0]];
