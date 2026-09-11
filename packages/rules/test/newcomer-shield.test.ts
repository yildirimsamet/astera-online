import { describe, expect, it } from 'vitest';
import { ABUSE, newcomerShieldUntil, newcomerShielded } from '../src/index.js';

/**
 * THE FIRST DAY IN A GALAXY IS SAFE. D183, owner instruction:
 * *"Server'a da gezegenini yeni oluşturan herkes: ilk 1 gün saldırılamaz kalkanı
 * olmalı. Kişi kendisi saldırı yapmak isterse uyarı verilir ve kabul ederse kalkanı
 * kalkar. Bu ilk kez gelen kullanıcılar için değil, herkes için, her sezon."*
 *
 * THIS REVERSES D14, DELIBERATELY AND ON THE OWNER'S WORD. That decision removed a
 * four-hour shield with a clear argument — "a world where a new arrival is
 * untouchable is a world where the first hours are safe, and this game's first
 * hours are supposed to teach you that they are not" — and the argument is still a
 * real cost. What answers it is the SECOND half of this rule: the shield is not a
 * gift, it is a POSITION. Taking a shot drops it, so the commander who wants the
 * first hours to be dangerous makes them dangerous, and the one who wants to build
 * gets a day to build. D14's fear was a beginner who cannot be reached; this is a
 * beginner who has chosen not to reach out yet.
 *
 * IT IS THE COMMANDER'S, NOT THE WORLD'S. A shield per world would be bought with
 * a colony — settle a fresh one and hide a fleet behind its untouchable sky — and
 * D168 moved the attack band onto the commander for exactly that reason.
 *
 * AND IT IS EVERY SEASON, FOR EVERYBODY. Not a first-account courtesy: a veteran
 * joining a new galaxy is as new to it as anyone, and a rule that reads a player's
 * history rather than their situation is the kind D14 rightly refused.
 */
describe('the newcomer shield', () => {
  const joined = Date.UTC(2026, 0, 1, 12, 0, 0);

  it('runs for one day from the moment a commander joins', () => {
    expect(newcomerShieldUntil(joined))
      .toBe(joined + ABUSE.newcomerShieldHours * 3_600_000);
    expect(ABUSE.newcomerShieldHours).toBe(24);
  });

  it('is up for the whole window and down the instant it ends', () => {
    const until = newcomerShieldUntil(joined);
    expect(newcomerShielded(until, joined)).toBe(true);
    expect(newcomerShielded(until, until - 1)).toBe(true);
    // The boundary belongs to the galaxy: at the instant it expires it is gone.
    expect(newcomerShielded(until, until)).toBe(false);
    expect(newcomerShielded(until, until + 1)).toBe(false);
  });

  /**
   * NULL IS THE ORDINARY STATE, and it is what the column holds for every
   * commander who has ever taken a shot. Dropping the shield writes null rather
   * than a past instant, so "has this commander committed to the war" is one
   * question with one answer rather than a date comparison nobody remembers to make.
   */
  it('reads a commander with no shield as unshielded', () => {
    expect(newcomerShielded(null, joined)).toBe(false);
    expect(newcomerShielded(undefined, joined)).toBe(false);
  });

  /** Never a NaN window: a shield that cannot be reasoned about is not one. */
  it('refuses to invent a window out of numbers that are not ones', () => {
    expect(newcomerShielded(Number.NaN, joined)).toBe(false);
    expect(newcomerShielded(joined, Number.NaN)).toBe(false);
    expect(Number.isFinite(newcomerShieldUntil(joined))).toBe(true);
  });
});
