import { describe, expect, it } from 'vitest';
import { BOTS } from '../src/services/bots/personas.js';
import { openLanes } from '../src/services/bots/brain.js';
import type { PlanetView } from '../src/services/planetView.js';

/**
 * THE SERVER'S COMMANDERS DO NOT OPEN A SEASON BY ATTACKING. D170, owner request:
 * *"Botlar server yeni başladığında en az 4 saat savaşmasın."*
 *
 * A galaxy's first hours are when every commander is at their weakest and least
 * defended, and twelve of them are the server's — so a bot that raids at minute
 * thirty is not competition, it is the world arriving already hostile. Four hours
 * is long enough for a person to stand a Vault, a gun and a fleet before anything
 * is at stake.
 *
 * IT IS THE PvP LANE ONLY. A pirate is not a player: raiding one costs a bot a
 * bay and a fuel bill and takes nothing from anybody, so the lane that makes bots
 * look alive stays open from the first minute. So do probe, mine and harvest —
 * the point is that nobody is ATTACKED, not that the galaxy sits still.
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
  it('opens no attack lane inside the first four hours', () => {
    for (const age of [0, 30, 2 * HOUR, BOTS.ceasefireMinutes - 1]) {
      expect(openLanes(armed, age), `minute ${String(age)}`).not.toContain('attack');
    }
  });

  it('opens the attack lane once the window has passed', () => {
    expect(openLanes(armed, BOTS.ceasefireMinutes)).toContain('attack');
    expect(openLanes(armed, 10 * HOUR)).toContain('attack');
  });

  it('is four hours', () => {
    expect(BOTS.ceasefireMinutes).toBe(4 * 60);
  });

  /** Everything that takes nothing from a person stays open from minute one. */
  it('leaves the pirate, probe and mining lanes alone', () => {
    const lanes = openLanes(armed, 0);
    expect(lanes).toContain('probe');
    expect(lanes).toContain('pirate');
    expect(lanes).toContain('mine');
    expect(lanes).toContain('harvest');
  });

  /** A world with no warship still opens no combat lane, ceasefire or not. */
  it('does not hand an unarmed world a lane it never had', () => {
    const unarmed = { fleet: {}, flight: { used: 0, total: 3 } } as unknown as PlanetView;
    expect(openLanes(unarmed, 10 * HOUR)).toEqual(['probe']);
  });
});
