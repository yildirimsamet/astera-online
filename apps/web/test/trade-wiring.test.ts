import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { chroniclePageSchema, type ActiveGalaxyEvent } from '../src/api/schemas.js';
import { describeNotification } from '../src/lib/notifications.js';
import { activeTradeShip, type TradeShipEvent } from '../src/lib/trade.js';

/**
 * THE MERCHANT HAS TO REACH THE SURFACES BEFORE ANY OF THEM CAN BE JUDGED. D156.
 *
 * Three separate places dropped it on the floor, and every one of them failed
 * SAFELY — nothing threw, nothing logged, and the feature simply was not there:
 *
 *   · `GalaxyView` mounted `GalaxyCanvas` without a `tradeShip` prop, whose
 *     default is `null`, so the ship was never drawn at all.
 *   · `galaxyLifecycle` in `notifications.ts` pinned `eventKind` to the shower, so
 *     a merchant's start and end parsed as failures and Signals printed nothing.
 *   · `chroniclePageSchema` dropped every lifecycle row that was not a shower.
 *
 * A silent drop is the most expensive bug shape this project has, so each is
 * pinned here rather than left to be noticed by looking at the disc.
 */

const OPEN = new Date('2026-01-01T09:00:00.000Z');
const SHUT = new Date('2026-01-01T12:00:00.000Z');

const merchant = (over: Partial<TradeShipEvent> = {}): TradeShipEvent => ({
  id: '2f0a2e0e-6e64-4b1e-9c0e-3b3a5f6f4d11',
  kind: 'TRADE_SHIP',
  startsAt: OPEN,
  endsAt: SHUT,
  rate: { alloy: 1, crystal: 3, deuterium: 90 },
  appearsAtMinute: 540,
  expiresAtMinute: 720,
  orbit: {
    radius: 1_100,
    period: 148,
    phase: 0.7,
    inclination: 0.5,
    ascendingNode: 1.9,
    speed: 47,
  },
  ...over,
});

const shower = (): ActiveGalaxyEvent => ({
  id: '87fd333f-4270-4ada-a809-2f34ea37aca6',
  kind: 'ASTEROID_SHOWER',
  startsAt: OPEN,
  endsAt: SHUT,
  asteroidSpawnMultiplier: 5,
});

describe('finding the merchant in the active-event list', () => {
  it('narrows the union to the merchant and hands back its orbit', () => {
    const found = activeTradeShip([shower(), merchant()], OPEN.getTime() + 60_000);
    expect(found).not.toBeNull();
    // The narrowing is the point: `filter` would leave this a union and the orbit
    // unreadable without a cast. `ActiveGalaxyEvent.tsx` learned that already.
    expect(found?.orbit.radius).toBe(1_100);
    expect(found?.rate.deuterium).toBe(90);
  });

  it('finds nothing when only a shower is up', () => {
    expect(activeTradeShip([shower()], OPEN.getTime() + 60_000)).toBeNull();
  });

  it('finds nothing before the window opens or once it has shut', () => {
    const events = [merchant()];
    expect(activeTradeShip(events, OPEN.getTime() - 1)).toBeNull();
    // Half-open at the far end, exactly like `tradeShipActive` in the rules.
    expect(activeTradeShip(events, SHUT.getTime())).toBeNull();
    expect(activeTradeShip(events, SHUT.getTime() - 1)).not.toBeNull();
  });

  it('survives an absent payload', () => {
    expect(activeTradeShip(undefined, OPEN.getTime())).toBeNull();
  });
});

/**
 * THE PROP THAT WAS NEVER PASSED.
 *
 * Asserted against the source because the failure is an ABSENCE at one call site
 * — `GalaxyCanvas`'s default is `null`, so a component test of the canvas would
 * render exactly as happily without it. What has to be true is that this screen
 * hands the merchant over, and the file is where that is either written or not.
 */
describe('GalaxyView mounts the merchant', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/screens/GalaxyView.tsx'), 'utf8');

  it('passes a tradeShip to the canvas', () => {
    const tag = /<GalaxyCanvas\b[\s\S]*?\/>/.exec(source)?.[0] ?? '';
    expect(tag).not.toBe('');
    expect(tag).toMatch(/tradeShip=\{/);
  });

  /**
   * AND THE SHOWER'S SKY IS STILL THE SHOWER'S. D154.
   *
   * `meteorShower` asked only whether ANY active event was still running, which was
   * true while `/api/galaxy/events` had one kind on it. Since D156 it has two, so a
   * trade window was tripling the shooting-star pool — a sky saying rocks were
   * arriving when nothing of the sort was happening. Asserted against the source
   * for the same reason the prop above is: the failure is a missing clause at one
   * call site inside a screen with no seam to render it through.
   */
  it('gives the extra meteors to a shower and not to a merchant', () => {
    const line = /const meteorShower = [\s\S]*?;\n/.exec(source)?.[0] ?? '';
    expect(line).not.toBe('');
    expect(line).toMatch(/ASTEROID_SHOWER/);
  });
});

/* ── the two gaps slice 2a left open ─────────────────────────── */

const lifecycle = (kind: string) => ({
  id: 'n1',
  kind,
  payload: {
    eventKind: 'TRADE_SHIP',
    startsAt: OPEN.toISOString(),
    endsAt: SHUT.toISOString(),
    rate: { alloy: 1, crystal: 3, deuterium: 90 },
  },
  seen: false,
  at: OPEN,
});

describe('the merchant reaches Signals', () => {
  it('describes its arrival', () => {
    const line = describeNotification(lifecycle('galaxy_event_started'), OPEN.getTime());
    expect(line).toBeTruthy();
    expect(line).not.toMatch(/asteroid/i);
  });

  it('describes its departure', () => {
    const line = describeNotification(lifecycle('galaxy_event_ended'), SHUT.getTime());
    expect(line).toBeTruthy();
    expect(line).not.toMatch(/asteroid/i);
  });

  /** The shower still reads as the shower — teaching one kind may not cost the other. */
  it('still describes a shower', () => {
    const line = describeNotification({
      id: 'n2',
      kind: 'galaxy_event_started',
      payload: {
        eventKind: 'ASTEROID_SHOWER',
        startsAt: OPEN.toISOString(),
        endsAt: SHUT.toISOString(),
        asteroidSpawnMultiplier: 5,
      },
      seen: false,
      at: OPEN,
    }, OPEN.getTime());
    expect(line).toMatch(/asteroid/i);
  });
});

describe('the merchant reaches the Chronicle', () => {
  const row = (kind: string) => ({
    id: 'c1',
    kind,
    subjectPlanetId: null,
    payload: {
      eventKind: 'TRADE_SHIP',
      startsAt: OPEN.toISOString(),
      endsAt: SHUT.toISOString(),
      rate: { alloy: 1, crystal: 3, deuterium: 90 },
    },
    occurredAt: OPEN.toISOString(),
  });

  it('keeps a merchant lifecycle row instead of dropping it', () => {
    const page = chroniclePageSchema.parse({
      events: [row('galaxy_event_started'), row('galaxy_event_ended')],
      nextBefore: null,
    });
    expect(page.events).toHaveLength(2);
    const first = page.events[0];
    expect(first?.kind).toBe('galaxy_event_started');
    if (first?.kind === 'galaxy_event_started') {
      expect(first.payload.eventKind).toBe('TRADE_SHIP');
    }
  });

  it('still keeps a shower row', () => {
    const page = chroniclePageSchema.parse({
      events: [{
        id: 'c2',
        kind: 'galaxy_event_started',
        subjectPlanetId: null,
        payload: {
          eventKind: 'ASTEROID_SHOWER',
          startsAt: OPEN.toISOString(),
          endsAt: SHUT.toISOString(),
          asteroidSpawnMultiplier: 5,
        },
        occurredAt: OPEN.toISOString(),
      }],
      nextBefore: null,
    });
    expect(page.events).toHaveLength(1);
  });

  /** An unknown kind is still dropped, quietly, for the reason the schema says. */
  it('still drops a lifecycle kind it has never been taught', () => {
    const page = chroniclePageSchema.parse({
      events: [{
        id: 'c3',
        kind: 'galaxy_event_started',
        subjectPlanetId: null,
        payload: { eventKind: 'SOLAR_FLARE', startsAt: OPEN.toISOString(), endsAt: SHUT.toISOString() },
        occurredAt: OPEN.toISOString(),
      }],
      nextBefore: null,
    });
    expect(page.events).toHaveLength(0);
  });
});

/**
 * THE CONVOY'S OWN HOMECOMING SENTENCE. D166.
 *
 * `resolveTradeReturn` writes `trip: 'trade'`, and the client's `returned` union
 * had no such branch — so `safeParse` failed and the code fell through to the
 * LEGACY raid shape kept for old payloads. That shape asks for `ships`,
 * `lootAlloy`, `lootCrystal` and `lootDeuterium`, which a trade payload happens to
 * carry exactly, so it parsed and printed a PLUNDER sentence over a transaction
 * that took nothing from anybody. Nothing threw; the wrong words simply appeared.
 *
 * The lesson generalises: a new `trip` value must grow the union in the same
 * change, or the legacy branch quietly swallows it.
 */
const convoyHome = (over: Record<string, unknown> = {}) => ({
  id: 'n9',
  kind: 'fleet_returned',
  payload: {
    trip: 'trade',
    ships: 3,
    lootAlloy: 0,
    lootCrystal: 300,
    lootDeuterium: 0,
    ...over,
  },
  seen: false,
  at: OPEN,
});

describe('a convoy coming home', () => {
  it('is never described as plunder', () => {
    const line = describeNotification(convoyHome(), OPEN.getTime());
    expect(line).toBeTruthy();
    expect(line).not.toMatch(/loot|plunder|ganimet/i);
  });

  it('names the merchant and states what was bought', () => {
    const line = describeNotification(convoyHome(), OPEN.getTime());
    expect(line).toMatch(/trade|convoy|merchant/i);
    expect(line).toMatch(/300/);
  });

  /** A swap that bought nothing is still a swap, and still not a raid. */
  it('has a sentence for an empty haul too', () => {
    const line = describeNotification(
      convoyHome({ lootCrystal: 0 }),
      OPEN.getTime(),
    );
    expect(line).toBeTruthy();
    expect(line).not.toMatch(/loot|plunder/i);
  });
});
