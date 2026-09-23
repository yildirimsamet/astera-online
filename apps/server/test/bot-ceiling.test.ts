import { describe, expect, it } from 'vitest';
import { coreTier, withinTierBand } from '@astera/rules';
import { BOTS } from '../src/services/bots/personas.js';

/**
 * THE BOTS STAND IN THE MIDDLE OF THE CORE RANGE THE COMMANDERS NOW REACH. Owner decision,
 * 2026-09-23 (self-review R5).
 *
 * Half of the live galaxy's PvP raids land on the eight server bots, and a raid is only legal
 * inside ±1 development tier (`coreTier`, a tier per three Core levels). The bots stopped at Core 9
 * — tier 3 — while Faz 4.1's curve lifts the commanders: the sim's median Core on days 6–30 now runs
 * 13 · 15 · 16 · 16 · 17 · 17 · 17 (about 16 on average), its top tenth 19 by day 30. A tier-3 bot
 * would have fallen out of reach of nearly everybody, and every raid it used to absorb would have
 * landed on a person instead — whose losses to raids are already 28% of production live.
 *
 * The owner's rule: set the ceiling to the AVERAGE of that new distribution. It stays a middle
 * ceiling — below the top of the ladder, off the podium — but inside the band of the commanders
 * who actually play.
 */
describe('where the server bots stop', () => {
  it('stops at the average of the new Core distribution', () => {
    expect(BOTS.coreCeiling).toBe(16);
  });

  it('stays within raiding reach of the live median and of the top tenth', () => {
    // Live day-9 median on the old curve, and the sim's day-30 top tenth on the new one.
    expect(withinTierBand(BOTS.coreCeiling, 13)).toBe(true);
    expect(withinTierBand(BOTS.coreCeiling, 19)).toBe(true);
  });

  it('never climbs to the top of the ladder it exists to leave to people', () => {
    expect(BOTS.coreCeiling).toBeLessThan(19);
    expect(coreTier(BOTS.coreCeiling)).toBeLessThan(coreTier(19));
  });
});
