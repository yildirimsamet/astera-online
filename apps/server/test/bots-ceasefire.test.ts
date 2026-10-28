import { describe, expect, it } from 'vitest';
import { BOTS } from '../src/services/bots/personas.js';
import { openLanes } from '../src/services/bots/brain.js';
import type { PlanetView } from '../src/services/planetView.js';

/**
 * THE SERVER'S COMMANDERS DO NOT OPEN A SEASON BY ATTACKING. D170, owner request:
 * *"Botlar server yeni başladığında en az 4 saat savaşmasın."* Raised to twelve
 * hours on 2026-09-13, owner instruction: *"Bu 4 saat'i 12 saat yap."* Raised to a
 * full day and widened to pirates on 2026-10-28, owner instruction: *"Sezon
 * başlarında 1 gün hiç bir saldırı yapmasınlar: ne korsanlara ne başka oyunculara."*
 *
 * A galaxy's first day is when every commander is at their weakest and least
 * defended, and a bot raid report in hour one reads as the world arriving already
 * hostile. Probe, mine and harvest stay open from the first minute — the point is
 * that nobody is ATTACKED, not that the galaxy sits still.
 *
 * The bot's own manners, never a rule: `withinTierBand`, the bash limit and the
 * fog all still apply to them exactly as they do to a person. Nothing here
 * changes what a player may do.
 */

const armed = {
  fleet: { DART: 6, PROSPECTOR: 1 },
  flight: { used: 0, total: 3 },
} as unknown as PlanetView;

const HOUR = 60;

describe('the opening ceasefire', () => {
  it('opens neither a player nor a pirate attack inside the first day', () => {
    for (const age of [0, 30, 4 * HOUR, 12 * HOUR, 20 * HOUR, BOTS.ceasefireMinutes - 1]) {
      expect(openLanes(armed, age), `minute ${String(age)}`).not.toContain('attack');
      expect(openLanes(armed, age), `minute ${String(age)}`).not.toContain('pirate');
    }
  });

  it('opens both attack lanes once the day has passed', () => {
    expect(openLanes(armed, BOTS.ceasefireMinutes)).toEqual(expect.arrayContaining(['attack', 'pirate']));
    expect(openLanes(armed, 25 * HOUR)).toEqual(expect.arrayContaining(['attack', 'pirate']));
  });

  it('is one day', () => {
    expect(BOTS.ceasefireMinutes).toBe(24 * 60);
  });

  /** Everything that takes nothing from anyone stays open from minute one. */
  it('leaves the probe and mining lanes alone', () => {
    expect(openLanes(armed, 0)).toEqual(['probe', 'mine', 'harvest']);
  });

  /** A world with no warship still opens no combat lane, ceasefire or not. */
  it('does not hand an unarmed world a lane it never had', () => {
    const unarmed = { fleet: {}, flight: { used: 0, total: 3 } } as unknown as PlanetView;
    expect(openLanes(unarmed, 10 * HOUR)).toEqual(['probe']);
  });
});
