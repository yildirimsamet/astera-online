import { describe, expect, it } from 'vitest';
import {
  describeNotification,
  signalFamily,
  signalGlyph,
  signalOutcome,
} from '../src/lib/notifications.js';
import type { NotificationView } from '../src/api/schemas.js';

const AT = new Date('2026-09-08T12:00:00.000Z');

const news = (payload: Record<string, unknown>, kind = 'target_gone'): NotificationView => ({
  id: 'n1',
  kind,
  refId: 'r1',
  payload,
  seen: false,
  at: AT,
});

const pirateGone = (over: Record<string, unknown> = {}) =>
  news({ targetKind: 'PIRATE', callsign: 'BLACKJAW', level: 3, ships: 40, ...over });
const rockGone = (over: Record<string, unknown> = {}) =>
  news({ targetKind: 'ASTEROID', craft: 2, ...over });

/**
 * ARRIVING AT NOTHING. D177.
 *
 * A launched flight is committed, so a target that dies mid-flight cannot recall
 * anybody: the craft fly the whole outbound leg, find an empty sky and fly home.
 * That was already true and is not what these pin. What they pin is that the
 * commander is TOLD, at the moment it becomes true, instead of finding out a
 * return leg later from a haul row that says "empty-handed" without saying why.
 */
describe('a flight that arrived at nothing', () => {
  it('says the pirate was already gone, and names it', () => {
    const line = describeNotification(pirateGone(), AT.getTime());
    expect(line).toBeTruthy();
    expect(line).toMatch(/BLACKJAW/);
    expect(line).toMatch(/40/);
  });

  /**
   * AND IT NEVER NAMES WHO GOT THERE FIRST. That is somebody else's raid, and
   * D127 does not hand it over because this commander aimed at the same target.
   */
  it('never names the commander who won the race', () => {
    const line = describeNotification(
      pirateGone({ destroyedByName: 'Yasin', destroyedByPlanet: 'Kestrel-12' }),
      AT.getTime(),
    );
    expect(line).not.toMatch(/Yasin|Kestrel/);
  });

  it('says the rock was already stripped, and how many drills are turning back', () => {
    const line = describeNotification(rockGone(), AT.getTime());
    expect(line).toBeTruthy();
    expect(line).toMatch(/2/);
    expect(line?.toLowerCase()).not.toMatch(/pirate/);
  });

  it('has its own sentence for a wreck field that was picked clean', () => {
    const line = describeNotification(rockGone({ targetKind: 'DEBRIS' }), AT.getTime());
    expect(line).toBeTruthy();
    expect(line).not.toBe(describeNotification(rockGone(), AT.getTime()));
  });

  /**
   * THE ROW IS FURNITURE IN NEITHER DIRECTION.
   *
   * Nothing was won and nothing was lost — the fuel was spent at launch and the
   * ships are all coming back — so the wash is neutral. A `pirate`-family row
   * would otherwise fall through `signalOutcome` to `win`, congratulating a
   * commander on a trip that paid nothing.
   */
  it('is neither a win nor a loss, on either lane', () => {
    expect(signalOutcome(pirateGone())).toBe('neutral');
    expect(signalOutcome(rockGone())).toBe('neutral');
  });

  it('wears its own lane, and never the fallback bell', () => {
    expect(signalFamily(pirateGone())).toBe('pirate');
    expect(signalGlyph(pirateGone())).toBe('skull');
    expect(signalFamily(rockGone())).not.toBe('note');
    expect(signalGlyph(rockGone())).not.toBe('bell');
  });
});

/**
 * A RAID ON A PIRATE COMING HOME. D177.
 *
 * The server has always written `trip: 'pirate'` and the client's union has never
 * had a branch for it, so every pirate homecoming was parsed by `legacyRaidReturn`
 * — which asks for exactly the four fields a pirate payload happens to carry. It
 * PARSED, and printed the PvP fleet's wording over a lane that has no commander in
 * it. That is the identical failure the `trade` branch above it was written to
 * document: a new `trip` has to grow the union in the same change.
 */
describe('a raid on a pirate coming home', () => {
  const raidersHome = (over: Record<string, unknown> = {}) =>
    news({ trip: 'pirate', ships: 38, lootAlloy: 900, lootCrystal: 0, lootDeuterium: 240, ...over },
      'fleet_returned');

  it('is worded as the pirate lane, not as a raid on a commander', () => {
    const line = describeNotification(raidersHome(), AT.getTime());
    expect(line).toBeTruthy();
    expect(line).toMatch(/raider/i);
  });

  /**
   * THE TOWED HULL SURVIVES THE HOMECOMING SENTENCE.
   *
   * `raid_result` calls a capture "the single most memorable outcome this feature
   * can produce" and puts it first. The landing row is the other place a commander
   * meets it, and a raid whose cargo hulls all died comes home with loot 0 and a
   * captured ship in the hangar — reporting that as "empty-handed" is the one
   * wording that is flatly untrue.
   */
  it('names a hull it towed home even when the hold is empty', () => {
    const line = describeNotification(
      raidersHome({ lootAlloy: 0, lootCrystal: 0, lootDeuterium: 0, capturedHull: 'DART' }),
      AT.getTime(),
    );
    expect(line).toBeTruthy();
    expect(line).not.toMatch(/empty/i);
    expect(line).toMatch(/captured/i);
  });

  /** A hull this build has never heard of is dropped, never printed as an id. */
  it('drops an unknown towed hull rather than printing its id', () => {
    const line = describeNotification(
      raidersHome({ lootAlloy: 0, lootCrystal: 0, lootDeuterium: 0, capturedHull: 'WARP_SLED' }),
      AT.getTime(),
    );
    expect(line).toMatch(/empty/i);
    expect(line).not.toMatch(/WARP_SLED/);
  });

  it('still has a sentence when it comes home empty', () => {
    const line = describeNotification(
      raidersHome({ lootAlloy: 0, lootCrystal: 0, lootDeuterium: 0 }),
      AT.getTime(),
    );
    expect(line).toMatch(/raider/i);
    expect(line).toMatch(/empty/i);
  });
});
