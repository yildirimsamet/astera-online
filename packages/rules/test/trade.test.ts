import { describe, expect, it } from 'vitest';
import {
  GALAXY,
  GALAXY_EVENTS,
  HULLS,
  TRADE,
  TRAVEL,
  distance,
  generateGalaxyEventSchedule,
  interceptOrbit,
  mulberry32,
  orbitPosition,
  orbitRadius,
  quoteTrade,
  resourcesTotal,
  tradeShipActive,
  tradeShipPosition,
  tradeShipSpec,
  tradeUnits,
  travelExact,
  type GalaxyEventKind,
  type Resources,
  type Rng,
  type TradeShipSpec,
} from '../src/index.js';

const DAY_MINUTES = 24 * 60;
const MINUTE = 60_000;
// 2026-09-02 00:00 in Türkiye (UTC+03:00).
const TURKEY_MIDNIGHT_UNIX_MINUTE = Date.parse('2026-09-01T21:00:00.000Z') / MINUTE;

const res = (alloy: number, crystal: number, deuterium: number): Resources =>
  ({ alloy, crystal, deuterium });

const NOTHING = res(0, 0, 0);

/** Middle of a sorted sample. The lead measurements below are medians, not means. */
const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
};

/** One independent stream per kind, memoised — `rngFor` is asked once per kind. */
const streamsFrom = (seed: number): ((kind: GalaxyEventKind) => Rng) => {
  const made = new Map<GalaxyEventKind, Rng>();
  return (kind) => {
    const existing = made.get(kind);
    if (existing) return existing;
    const stream = mulberry32(kind === 'ASTEROID_SHOWER' ? seed : (seed ^ 0x7ade5) >>> 0);
    made.set(kind, stream);
    return stream;
  };
};

/** Every trade ship a season's calendar puts in the sky, in occurrence order. */
const laneFor = (seed: number, days = 3): TradeShipSpec[] => {
  const calendar = generateGalaxyEventSchedule({
    seasonStartsAtUnixMinute: TURKEY_MIDNIGHT_UNIX_MINUTE,
    seasonDurationMinutes: days * DAY_MINUTES,
    rngFor: streamsFrom(seed),
  });
  const rng = mulberry32((seed ^ 0x7c0de) >>> 0);
  return calendar
    .filter((event) => event.kind === 'TRADE_SHIP')
    .map((event) => tradeShipSpec(event, rng));
};

/**
 * TİCARET GEMİSİ — the second public galaxy moment. D156.
 *
 * A trade ship is an announced event, not a secret: unlike a pirate its position
 * is public, so its orbital elements may be published. What it sells is one fixed
 * exchange rate, and the whole decision a player makes is a CARGO decision —
 * which is why the return leg, not the outbound one, is what these tests hold.
 */
describe('the trade rate', () => {
  it('prices ninety alloy, thirty crystal and one deuterium the same', () => {
    // The owner's rate, stated in the only place it can be read wrong: units.
    expect(tradeUnits(res(90, 0, 0), TRADE.rate)).toBe(90);
    expect(tradeUnits(res(0, 30, 0), TRADE.rate)).toBe(90);
    expect(tradeUnits(res(0, 0, 1), TRADE.rate)).toBe(90);
    expect(tradeUnits(NOTHING, TRADE.rate)).toBe(0);
    expect(tradeUnits(res(1, 1, 1), TRADE.rate)).toBe(1 + 3 + 90);
  });

  it('is the rate the galaxy-event calendar hands to a live occurrence', () => {
    expect(GALAXY_EVENTS.definitions.TRADE_SHIP.effect.rate).toEqual(TRADE.rate);
  });
});

describe('quoting a swap', () => {
  it("settles the owner's worked example with nothing left on the counter", () => {
    /*
      THE RETURN LEG IS THE DECISION, and this example is why the feature exists.

      One thousand Deuterium is ninety thousand units, and ninety thousand units
      buys sixty thousand Alloy plus ten thousand Crystal. The convoy that carries
      the offer out needs room for 1,000; the convoy that brings the goods home
      needs room for 70,000. Sizing a wing against the OUTBOUND leg is the mistake
      the quote exists to prevent, so `requiredHold` states the larger of the two.
    */
    const quote = quoteTrade(res(0, 0, 1000), res(60_000, 10_000, 0), TRADE.rate);

    expect(quote.refusal).toBeNull();
    expect(quote.offerUnits).toBe(90_000);
    expect(quote.askUnits).toBe(90_000);
    expect(quote.leftoverUnits).toBe(0);
    expect(quote.outboundVolume).toBe(1_000);
    expect(quote.returnVolume).toBe(70_000);
    expect(quote.requiredHold).toBe(70_000);
    expect(quote.requiredHold).toBe(quote.returnVolume);
  });

  it('works the rate in the other direction too', () => {
    const quote = quoteTrade(res(9_000, 0, 0), res(0, 0, 100), TRADE.rate);
    expect(quote.refusal).toBeNull();
    expect(quote.offerUnits).toBe(9_000);
    expect(quote.askUnits).toBe(9_000);
    expect(quote.requiredHold).toBe(9_000);
    expect(quote.outboundVolume).toBe(9_000);
    expect(quote.returnVolume).toBe(100);
  });

  it('shows what the merchant keeps rather than rounding it away', () => {
    // D124: a rule the player cannot see is not a usable rule. An offer worth
    // more than the ask is legal, and the difference is stated, never silent.
    const quote = quoteTrade(res(0, 0, 10), res(450, 0, 0), TRADE.rate);
    expect(quote.refusal).toBeNull();
    expect(quote.offerUnits).toBe(900);
    expect(quote.askUnits).toBe(450);
    expect(quote.leftoverUnits).toBe(450);
  });

  it('refuses an empty offer, an empty ask and an offer that cannot pay', () => {
    expect(quoteTrade(NOTHING, res(90, 0, 0), TRADE.rate).refusal).toBe('EMPTY_GIVE');
    expect(quoteTrade(res(90, 0, 0), NOTHING, TRADE.rate).refusal).toBe('EMPTY_WANT');
    // 89 Alloy is 89 units and 30 Crystal costs 90 — one unit short.
    expect(quoteTrade(res(89, 0, 0), res(0, 30, 0), TRADE.rate).refusal)
      .toBe('INSUFFICIENT_OFFER');
    // Exactly enough is not insufficient.
    expect(quoteTrade(res(90, 0, 0), res(0, 30, 0), TRADE.rate).refusal).toBeNull();
  });

  it('refuses a self-swap, which only burns cargo', () => {
    /*
      Giving Alloy and asking for Alloy is a round trip that ends where it began
      minus the merchant's cut, and it makes "what did I gain" unreadable on every
      surface downstream. Refused at the quote so no screen has to explain it.
    */
    expect(quoteTrade(res(1_000, 0, 0), res(900, 0, 0), TRADE.rate).refusal)
      .toBe('OVERLAPPING_RESOURCE');
    expect(quoteTrade(res(0, 0, 10), res(60, 30, 0), TRADE.rate).refusal).toBeNull();
    // A zero on one side is not an overlap: asking for none of what you gave is fine.
    expect(quoteTrade(res(1_000, 0, 0), res(0, 300, 0), TRADE.rate).refusal).toBeNull();
  });

  it('refuses an amount that is not a whole non-negative number', () => {
    expect(quoteTrade(res(0, 0, 1.5), res(90, 0, 0), TRADE.rate).refusal).toBe('BAD_AMOUNT');
    expect(quoteTrade(res(90, 0, 0), res(0, 0.5, 0), TRADE.rate).refusal).toBe('BAD_AMOUNT');
    expect(quoteTrade(res(-90, 0, 0), res(0, 30, 0), TRADE.rate).refusal).toBe('BAD_AMOUNT');
    expect(quoteTrade(res(90, 0, 0), res(0, -30, 0), TRADE.rate).refusal).toBe('BAD_AMOUNT');
    expect(quoteTrade(res(Number.NaN, 0, 0), res(0, 30, 0), TRADE.rate).refusal)
      .toBe('BAD_AMOUNT');
    // There is no quote to state when the numbers are not numbers.
    const bad = quoteTrade(res(0, 0, 1.5), res(90, 0, 0), TRADE.rate);
    expect(bad.offerUnits).toBe(0);
    expect(bad.requiredHold).toBe(0);
  });

  it('never throws, whatever it is handed', () => {
    expect(() => quoteTrade(res(Infinity, 0, 0), res(0, 0, -1), TRADE.rate)).not.toThrow();
  });

  it('measures both legs with the same arithmetic every cargo hold uses', () => {
    const give = res(120, 40, 3);
    const want = res(0, 30, 1);
    const quote = quoteTrade(give, want, TRADE.rate);
    expect(quote.outboundVolume).toBe(resourcesTotal(give));
    expect(quote.returnVolume).toBe(resourcesTotal(want));
    expect(quote.requiredHold).toBe(Math.max(resourcesTotal(give), resourcesTotal(want)));
  });
});

describe('the merchant on its orbit', () => {
  it('flies at half an Atlas, on the Atlas\'s own scale', () => {
    /*
      D155'S LESSON, APPLIED BEFORE IT COULD BE REPEATED.

      A hull's catalogue figure is divided by `TRAVEL.distanceFactor` to reach
      units per minute, and an orbiting NPC's `speed` already IS units per minute.
      A pirate's band was once written on the wrong scale and every warship in the
      game turned out to be slower than the thing it was chasing. The anchor is
      asserted against `HULLS` so the constant cannot drift off the catalogue.
    */
    expect(TRADE.speed * 2 * TRAVEL.distanceFactor).toBeCloseTo(HULLS.ATLAS.speed, 9);

    // Every cargo hull LEADS the merchant, so the convoy is a choice of hold size
    // rather than a question of whether you can catch it at all.
    for (const id of ['COURIER', 'WAYFARER', 'ATLAS'] as const) {
      expect(HULLS[id].speed / TRAVEL.distanceFactor).toBeGreaterThan(TRADE.speed);
    }
  });

  it('runs inside a band narrower than the rocks, and inside the disc', () => {
    // The position is public, so the fourth-power draw's sensor-fairness purpose
    // does not apply — but a merchant glued to the centre or hugging the rim
    // makes distance unfair, so both ends are pulled in.
    expect(TRADE.orbitMin).toBeGreaterThan(GALAXY.asteroidOrbitMin);
    expect(TRADE.orbitMax).toBeLessThan(GALAXY.asteroidOrbitMax);
    expect(TRADE.orbitMax).toBeLessThan(GALAXY.radius);
  });

  it('leaves a rim world a round trip inside the window', () => {
    /*
      THE WORST GEOMETRY THE BAND ALLOWS: a world on the rim at 2,000 and a ship
      at the far side of its widest orbit, 1,600 out. An Atlas is the slowest
      cargo hull in the catalogue, so if it fits, the whole class fits.
    */
    const worst = GALAXY.radius + TRADE.orbitMax;
    const oneWay = travelExact(worst, HULLS.ATLAS.speed);
    expect(worst).toBe(3_600);
    expect(oneWay).toBeLessThan(50);
    expect(oneWay * 2).toBeLessThan(GALAXY_EVENTS.definitions.TRADE_SHIP.durationMinutes);
  });

  it('is a pure function of its occurrence and its stream', () => {
    const occurrence = {
      sequence: 2,
      startsAtMinute: 640,
      endsAtMinute: 820,
      effect: { rate: TRADE.rate },
    } as const;
    const first = tradeShipSpec(occurrence, mulberry32(77));
    const second = tradeShipSpec(occurrence, mulberry32(77));

    expect(second).toEqual(first);
    expect(first.sequence).toBe(2);
    expect(first.appearsAt).toBe(640);
    expect(first.expiresAt).toBe(820);
    expect(first.rate).toEqual(TRADE.rate);
    expect(first.speed).toBe(TRADE.speed);
    expect(first.radius).toBeGreaterThanOrEqual(TRADE.orbitMin);
    expect(first.radius).toBeLessThanOrEqual(TRADE.orbitMax);
    expect(first.period).toBeCloseTo((2 * Math.PI * first.radius) / TRADE.speed, 9);
  });

  it('draws its radius through the one shared distribution', () => {
    // Not a second distribution: the same `orbitRadius` the rocks and the pirates
    // use, handed this lane's own band.
    const rolls = mulberry32(31);
    const firstRoll = mulberry32(31)();
    const spec = tradeShipSpec(
      { sequence: 0, startsAtMinute: 0, endsAtMinute: 180, effect: { rate: TRADE.rate } },
      rolls,
    );
    expect(spec.radius).toBeCloseTo(orbitRadius(firstRoll, TRADE.orbitMin, TRADE.orbitMax), 9);
  });

  it('is in the sky for a half-open window', () => {
    const spec = tradeShipSpec(
      { sequence: 0, startsAtMinute: 100, endsAtMinute: 280, effect: { rate: TRADE.rate } },
      mulberry32(5),
    );
    expect(tradeShipActive(spec, 99.9)).toBe(false);
    expect(tradeShipActive(spec, 100)).toBe(true);
    expect(tradeShipActive(spec, 279.9)).toBe(true);
    // Gone at the instant it ends, exactly like a rock and a pirate.
    expect(tradeShipActive(spec, 280)).toBe(false);
  });

  it('rides the shared orbit trig and adds nothing to it', () => {
    const spec = tradeShipSpec(
      { sequence: 0, startsAtMinute: 0, endsAtMinute: 180, effect: { rate: TRADE.rate } },
      mulberry32(19),
    );
    for (const minutes of [0, 17.5, 91, 179.9]) {
      expect(tradeShipPosition(spec, minutes)).toEqual(orbitPosition(spec, minutes));
    }
  });
});

describe('reaching the merchant', () => {
  it('is reachable from everywhere, at 100%, inside its own window', () => {
    /*
      A VISIBLE TARGET YOU CANNOT REACH IS A REFUSAL AT THE LAUNCH SCREEN for
      something the disc is actively showing. The trade ship's position is PUBLIC,
      so every commander in the galaxy can see it — which makes an unreachable one
      worse here than on the pirate lane, where the fog gate at least means only
      the commanders who paid for sight are looking at it.

      The rim is the case that matters: the galactic centre is the friendliest
      origin on the map and a sweep launched only from there would prove nothing
      about the commanders seeded on the edge.
    */
    const origins = [
      { x: 0, y: 0, z: 0 },
      { x: 1_950, y: 0, z: 0 },
      { x: -1_950, y: 0, z: 0 },
      { x: 0, y: 120, z: 1_900 },
      { x: 1_300, y: -400, z: -1_400 },
    ];
    const window = GALAXY_EVENTS.definitions.TRADE_SHIP.durationMinutes;
    let checked = 0;
    for (const seed of [3, 19, 404, 7_777]) {
      for (const spec of laneFor(seed)) {
        for (const from of origins) {
          const now = spec.appearsAt + 0.25;
          const hit = interceptOrbit(
            from, HULLS.ATLAS.speed, (m) => tradeShipPosition(spec, m), spec.expiresAt, now,
          );
          expect(hit, `seed ${String(seed)} from ${JSON.stringify(from)}`).not.toBeNull();
          expect(hit!.flightMinutes).toBeLessThan(window);
          expect(hit!.meetsAtMinutes).toBeLessThan(spec.expiresAt);
          // The meeting is exact: the convoy and the merchant are in one place.
          expect(distance(hit!.at, tradeShipPosition(spec, hit!.meetsAtMinutes)))
            .toBeLessThan(1e-6);
          expect(travelExact(distance(from, hit!.at), HULLS.ATLAS.speed))
            .toBeCloseTo(hit!.flightMinutes, 6);
          checked += 1;
        }
      }
    }
    expect(checked).toBeGreaterThan(150);
  });

  it('is met with a lead, never after a lap of waiting', () => {
    /*
      THE ROCK LANE'S CEILING SINCE D40/D121, AND THE PIRATE LANE'S SINCE D155: a
      craft that has to wait for another revolution reads as a craft flying
      somewhere unrelated. An Atlas is exactly twice the merchant's pace, so
      `interceptOrbit`'s f is strictly decreasing and the earliest meeting is the
      only one — a lead shot by construction. Measured rather than argued.
    */
    const origins = [
      { x: 0, y: 0, z: 0 },
      { x: 1_950, y: 0, z: 0 },
      { x: 0, y: 120, z: 1_900 },
      { x: -1_300, y: -400, z: 1_400 },
    ];
    const laps: number[] = [];
    for (const seed of [3, 19, 404, 7_777]) {
      for (const spec of laneFor(seed)) {
        for (const from of origins) {
          const now = spec.appearsAt + 0.25;
          const hit = interceptOrbit(
            from, HULLS.ATLAS.speed, (m) => tradeShipPosition(spec, m), spec.expiresAt, now,
          );
          if (!hit) continue;
          laps.push(hit.flightMinutes / spec.period);
        }
      }
    }
    expect(laps.length).toBeGreaterThan(140);
    expect(median(laps)).toBeGreaterThan(0);
    expect(median(laps)).toBeLessThan(0.25);
    // A median hides a tail, and one baffling launch is the memory that sticks.
    expect(Math.max(...laps)).toBeLessThan(0.5);
  });
});
