import { describe, expect, it } from 'vitest';
import {
  PROSPECTOR,
  prospectorReadyAt,
  shortProspectorTrip,
} from '../src/index.js';

/**
 * THE TRIP THAT COSTS NOTHING TO MAKE. D183, owner report:
 * *"Kendi gezegenimde oluşan debris'i kazıcılarımla tak tak tak sürek beklemeden
 * toplayabiliyorum."*
 *
 * A battle over your own world leaves its wreckage AT your own world, so the
 * salvage run's leg is zero units long. Every brake mining has is a function of
 * that leg — `returnSpeedFactor` scales a distance, the flight bay is held for the
 * duration of a trip, and `PROSPECTOR.max` rations craft that are AWAY. At zero
 * distance all three evaluate to nothing, and the field can be emptied by tapping.
 *
 * WHY A COOLDOWN, WHEN `returnSpeedFactor` EXPLICITLY REFUSED TO BE ONE. That note
 * argued a lockout would ration the same thing twice and would do it as a timer
 * with nothing on screen. Both halves still hold for an ordinary run and neither
 * holds here: at zero distance the ratio rations NOTHING, so this is the first
 * brake rather than a second one, and it is drawn — the rail and the launch
 * control both state the instant (D124).
 *
 * IT IS THE OUTBOUND LEG THAT IS MEASURED, because that is the trip the player
 * chose. The way home is derived from it, so testing the pair would be testing the
 * same fact twice with a factor in front of it.
 */
describe('a Prospector trip too short to cost anything', () => {
  it('is one measured against the outbound leg alone', () => {
    expect(shortProspectorTrip(0)).toBe(true);
    expect(shortProspectorTrip(PROSPECTOR.shortTripMinutes / 2)).toBe(true);
    // The boundary belongs to the ordinary trip: exactly a minute is not short.
    expect(shortProspectorTrip(PROSPECTOR.shortTripMinutes)).toBe(false);
    expect(shortProspectorTrip(PROSPECTOR.shortTripMinutes * 10)).toBe(false);
  });

  /**
   * A COOLDOWN IS AN INSTANT, NOT A DURATION, for the same reason every other
   * clock in this game is: the client renders a countdown against `serverNow()`
   * and a duration would have to be re-based by whoever received it.
   */
  it('lands its craft with an instant they are free again', () => {
    const home = Date.UTC(2026, 0, 1, 12, 0, 0);
    expect(prospectorReadyAt(0, home))
      .toBe(home + PROSPECTOR.shortTripCooldownMinutes * 60_000);
  });

  it('leaves an ordinary trip with no cooldown at all', () => {
    const home = Date.UTC(2026, 0, 1, 12, 0, 0);
    expect(prospectorReadyAt(PROSPECTOR.shortTripMinutes, home)).toBeNull();
    expect(prospectorReadyAt(45, home)).toBeNull();
  });

  /**
   * NEVER A NaN IN A TIMESTAMP. A run row is server-authored, but this function is
   * also the one the client reads a payload through, and a NaN instant renders as
   * a countdown that never ends.
   */
  it('refuses to invent an instant out of numbers that are not ones', () => {
    expect(prospectorReadyAt(Number.NaN, Date.now())).toBeNull();
    expect(prospectorReadyAt(0, Number.NaN)).toBeNull();
    expect(shortProspectorTrip(Number.NaN)).toBe(false);
    expect(shortProspectorTrip(-1)).toBe(true);
  });

  /**
   * THE TWO CONSTANTS ARE INDEPENDENT, and this is the only place that is said.
   *
   * What counts as "too short to have cost anything" and how long the answer to it
   * lasts are different questions, and tying them together is how a later tuning
   * pass silently changes the rule while appearing to change a number.
   */
  it('states both figures as minutes, and both above zero', () => {
    expect(PROSPECTOR.shortTripMinutes).toBeGreaterThan(0);
    expect(PROSPECTOR.shortTripCooldownMinutes).toBeGreaterThan(0);
  });
});
