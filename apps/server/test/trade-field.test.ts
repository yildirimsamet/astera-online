import { describe, expect, it } from 'vitest';
import { GALAXY_EVENTS, TRADE, type PlannedGalaxyEvent } from '@astera/rules';
import { activeTradeShip, tradeShipOf } from '../src/services/tradeField.js';
import { privateAsteroidField, privateAsteroidFieldWithEvents } from '../src/services/asteroidField.js';
import { privatePirateField } from '../src/services/pirateField.js';

/**
 * THE MERCHANT'S LANE IS ITS OWN DRAW, AND THAT IS THE WHOLE POINT OF THIS FILE.
 *
 * Three server-side lanes now hang off one season secret — rocks, pirates and the
 * trade ship — and each of them is only independent because its HMAC label says
 * so. A copied label would not fail anywhere: the field would still generate, the
 * pirates would still fly, and every season would silently be a different season
 * from the one the balance was measured on. So the independence is asserted, not
 * assumed.
 */

const RATE = GALAXY_EVENTS.definitions.TRADE_SHIP.effect.rate;
const KEY = 'trade-field-test-key';

const tradeOccurrence = (
  sequence: number,
  startsAtMinute: number,
): Extract<PlannedGalaxyEvent, { kind: 'TRADE_SHIP' }> => ({
  sequence,
  kind: 'TRADE_SHIP',
  startsAtMinute,
  endsAtMinute: startsAtMinute + GALAXY_EVENTS.definitions.TRADE_SHIP.durationMinutes,
  definitionVersion: GALAXY_EVENTS.definitions.TRADE_SHIP.version,
  effect: { rate: RATE },
});

const showerOccurrence = (
  sequence: number,
  startsAtMinute: number,
): Extract<PlannedGalaxyEvent, { kind: 'ASTEROID_SHOWER' }> => ({
  sequence,
  kind: 'ASTEROID_SHOWER',
  startsAtMinute,
  endsAtMinute: startsAtMinute + GALAXY_EVENTS.definitions.ASTEROID_SHOWER.durationMinutes,
  definitionVersion: GALAXY_EVENTS.definitions.ASTEROID_SHOWER.version,
  effect: { asteroidSpawnMultiplier: 5 },
});

describe('the season trade lane', () => {
  it('derives one stable ship per occurrence from the season key', () => {
    const occurrence = tradeOccurrence(0, 600);
    const first = tradeShipOf(KEY, occurrence);
    const again = tradeShipOf(KEY, { ...occurrence });

    expect(again).toEqual(first);
    expect(first.sequence).toBe(0);
    expect(first.appearsAt).toBe(600);
    expect(first.expiresAt).toBe(600 + GALAXY_EVENTS.definitions.TRADE_SHIP.durationMinutes);
    expect(first.rate).toEqual(RATE);
    expect(first.speed).toBe(TRADE.speed);
    expect(first.radius).toBeGreaterThanOrEqual(TRADE.orbitMin);
    expect(first.radius).toBeLessThanOrEqual(TRADE.orbitMax);
  });

  it('gives two occurrences in one season two different orbits', () => {
    const first = tradeShipOf(KEY, tradeOccurrence(0, 600));
    const second = tradeShipOf(KEY, tradeOccurrence(1, 1_200));

    expect(second.radius).not.toBe(first.radius);
    expect(second.phase).not.toBe(first.phase);
    expect(second.ascendingNode).not.toBe(first.ascendingNode);
  });

  it('gives two seasons two different ships for the same occurrence', () => {
    const occurrence = tradeOccurrence(0, 600);
    expect(tradeShipOf('another-season-key', occurrence).radius)
      .not.toBe(tradeShipOf(KEY, occurrence).radius);
  });

  it('is half-open around its window, exactly like a rock', () => {
    const occurrences = [tradeOccurrence(0, 600), tradeOccurrence(1, 1_200)];
    expect(activeTradeShip(KEY, occurrences, 599)).toBeNull();
    expect(activeTradeShip(KEY, occurrences, 600)?.sequence).toBe(0);
    expect(activeTradeShip(KEY, occurrences, 779)?.sequence).toBe(0);
    // 600 + 180 is the first minute it is gone.
    expect(activeTradeShip(KEY, occurrences, 780)).toBeNull();
    expect(activeTradeShip(KEY, occurrences, 1_200)?.sequence).toBe(1);
    expect(activeTradeShip(KEY, occurrences, 99_999)).toBeNull();
  });

  it('ignores every non-trade row on the calendar', () => {
    expect(activeTradeShip(KEY, [showerOccurrence(0, 600)], 620)).toBeNull();
  });

  /**
   * THE INDEPENDENCE PROOF. A trade ship draws from `trade:draw:*`, a rock from
   * `asteroid:draw:*` / `asteroid:shower:v1:*` and a pirate from `pirate:draw:*`.
   * Nothing shares a stream, so adding merchants to a calendar cannot move a
   * single rock or a single pirate.
   */
  it('moves neither a rock nor a pirate', () => {
    const key = 'independence-key';
    const showers = [showerOccurrence(0, 600), showerOccurrence(1, 1_500)];
    const mixed: PlannedGalaxyEvent[] = [
      ...showers,
      tradeOccurrence(0, 300),
      tradeOccurrence(1, 900),
      tradeOccurrence(2, 1_800),
    ];

    const rocksWithout = privateAsteroidFieldWithEvents(key, showers);
    const piratesBefore = privatePirateField(key);
    for (const occurrence of mixed) {
      if (occurrence.kind === 'TRADE_SHIP') tradeShipOf(key, occurrence);
    }
    const rocksWith = privateAsteroidFieldWithEvents(key, mixed);

    expect(rocksWith).toEqual(rocksWithout);
    expect(privatePirateField(key)).toEqual(piratesBefore);
  });

  /** A calendar of merchants alone composes to the untouched baseline field. */
  it('leaves the baseline field alone when the calendar is merchants only', () => {
    const key = 'merchants-only-key';
    expect(privateAsteroidFieldWithEvents(key, [tradeOccurrence(0, 300)]))
      .toEqual(privateAsteroidField(key));
  });
});
