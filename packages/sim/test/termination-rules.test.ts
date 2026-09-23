import { describe, expect, it } from 'vitest';
import {
  HULLS, buildingCost, hangarCapacity, hullBulk, resourceValue, worthInvesting,
} from '@astera/rules';
import type { BuildingId } from '@astera/rules';
import { stillWorthBuilding, type TerminationInput } from '../src/season.js';

/**
 * WHAT A BOT SHOULD STILL BUY WITH THE SEASON RUNNING OUT. Plan §15.3, item 0.4.
 *
 * `worthInvesting` prices a rung against the income it returns, and a Vault, a Shipyard and a
 * Hangar have no income at all — so applying it to them asked a question they cannot answer, and
 * the first fix (one flat "six hours of use left" window) answered a DIFFERENT question badly: it
 * let a bot buy a Vault it would never be raided behind and refuse a Core whose hull it could
 * still have flown.
 *
 * Each of these buildings buys something specific, so each gets the test that measures it.
 */

const LEVELS: Record<BuildingId, number> = {
  CORE: 10, REFINERY: 10, EXTRACTOR: 10, DEUTERIUM_PLANT: 6,
  SHIPYARD: 4, HANGAR: 4, VAULT: 6,
};

const base = (over: Partial<TerminationInput> = {}): TerminationInput => ({
  kind: 'SHIPYARD',
  level: 4,
  productiveHours: 100,
  buildings: LEVELS,
  tech: {},
  homeFleet: {},
  raidsTaken: [],
  elapsedHours: 100,
  ...over,
});

describe('a Shipyard rung is worth its price only if the hull it opens can be flown', () => {
  /** The rung that opens a hull is worth paying for exactly while that hull can still be built. */
  const openingRung = (() => {
    const gates = Object.values(HULLS)
      .filter((h) => !h.ground && h.minShipyard > 0)
      .map((h) => h.minShipyard);
    return Math.min(...gates);
  })();

  it('buys the rung when there is time to build what it opens', () => {
    expect(stillWorthBuilding(base({
      kind: 'SHIPYARD', level: openingRung - 1, productiveHours: 10_000,
    }))).toBe(true);
  });

  it('refuses it when the hull it opens could never be finished', () => {
    expect(stillWorthBuilding(base({
      kind: 'SHIPYARD', level: openingRung - 1, productiveHours: 0.01,
    }))).toBe(false);
  });

  /**
   * A rung that opens NO new hull still buys build SPEED, so it falls back to the general use
   * window rather than being refused outright.
   */
  it('falls back to the use window on a rung that opens nothing', () => {
    const noGate = 40;
    expect(stillWorthBuilding(base({ kind: 'SHIPYARD', level: noGate, productiveHours: 100 })))
      .toBe(true);
    expect(stillWorthBuilding(base({ kind: 'SHIPYARD', level: noGate, productiveHours: 0.5 })))
      .toBe(false);
  });
});

describe('a Hangar rung is worth its price only if the ceiling is actually binding', () => {
  it('refuses room on a world flying almost nothing', () => {
    expect(stillWorthBuilding(base({ kind: 'HANGAR', level: 4, homeFleet: { DART: 1 } })))
      .toBe(false);
  });

  /**
   * EVERY HULL THIS COMMANDER OWNS, NOT JUST THE ONES STANDING AT HOME. Owner review, 2026-09-22.
   *
   * The server counts home AND away against the Hangar (`totalUnitsOf`) — a squadron in the air
   * still occupies its berth, which is the whole reason a recall always fits. The rule read only
   * the home fleet, so a world with one Dart at home and twenty-five out was 78/80 full by the
   * product's own arithmetic and read as empty here.
   *
   * It was latent while no archetype built a Hangar. It stops being latent the moment one does.
   */
  it('counts the fleet that is in the air, exactly as the game does', () => {
    const berths = hangarCapacity(4);
    const perDart = Math.floor(berths / hullBulk('DART'));
    const home = { DART: 1 };
    const away = { DART: perDart - 1 };
    expect(stillWorthBuilding(base({ kind: 'HANGAR', level: 4, homeFleet: home })))
      .toBe(false);
    expect(stillWorthBuilding(base({ kind: 'HANGAR', level: 4, homeFleet: home, awayFleet: away })))
      .toBe(true);
  });

  /**
   * AND WHAT THE YARD HAS ALREADY BEEN TOLD TO BUILD. Review 2026-09-22, #7: the server counts a
   * queued hull against its room, so once the simulator enforced the Hangar a world could be full
   * of orders while its ships alone read as half empty — and never buy the rung it was waiting on.
   */
  it('counts the hulls already ordered in the yard', () => {
    const berths = hangarCapacity(4);
    const home = { DART: 1 };
    expect(stillWorthBuilding(base({ kind: 'HANGAR', level: 4, homeFleet: home }))).toBe(false);
    expect(stillWorthBuilding(base({
      kind: 'HANGAR', level: 4, homeFleet: home, queuedBulk: berths - hullBulk('DART'),
    }))).toBe(true);
  });

  it('buys room on a world pressed against its ceiling', () => {
    // Enough Darts to fill the current rung: the next one is the only way to keep building.
    const perDart = hangarCapacity(4) / 40;
    expect(stillWorthBuilding(base({
      kind: 'HANGAR', level: 4, homeFleet: { DART: Math.ceil(perDart * 40) },
    }))).toBe(true);
  });

  /** Room that arrives after the wipe is room nobody ever fills. */
  it('refuses room there is no time left to fill', () => {
    const perDart = hangarCapacity(4) / 40;
    expect(stillWorthBuilding(base({
      kind: 'HANGAR', level: 4, productiveHours: 0.1,
      homeFleet: { DART: Math.ceil(perDart * 40) },
    }))).toBe(false);
  });
});

describe('a Vault rung is worth buying only while a raid is still expected behind it', () => {
  /**
   * NO HISTORY IS NOT EVIDENCE OF SAFETY. This is a TERMINATION rule — its job is to stop a Vault
   * bought in the last hours of a season — so a commander nobody has raided yet still buys one on
   * the ordinary use window. Reading an empty history as "nobody will ever come" would be a
   * season-long gate rather than a terminal one.
   */
  it('still buys the rung early, with no raid history either way', () => {
    expect(stillWorthBuilding(base({ kind: 'VAULT', level: 6, raidsTaken: [] }))).toBe(true);
  });

  it('refuses the rung that lands too late to be used at all', () => {
    expect(stillWorthBuilding(base({ kind: 'VAULT', level: 6, raidsTaken: [], productiveHours: 1 })))
      .toBe(false);
  });

  /** Raided steadily, with most of the season ahead: the lock has work to do. */
  it('buys the rung while raids are still expected behind it', () => {
    const raids = Array.from({ length: 20 }, (_, i) => i * 300);
    expect(stillWorthBuilding(base({
      kind: 'VAULT', level: 6, raidsTaken: raids, elapsedHours: 100, productiveHours: 400,
    }))).toBe(true);
  });

  /**
   * ONE RAID IN A HUNDRED HOURS, AND EIGHT HOURS OF SEASON LEFT. The rung clears the use window
   * and still buys nothing: it will not be standing behind a raid before the wipe.
   */
  it('refuses the rung once no further raid is expected before the season ends', () => {
    expect(stillWorthBuilding(base({
      kind: 'VAULT', level: 6, raidsTaken: [10], elapsedHours: 100, productiveHours: 8,
    }))).toBe(false);
  });

  /**
   * IT DOES NOT SECOND-GUESS WHETHER A TURTLE SHOULD WANT VAULTS. The stricter "must pay for
   * itself" form refuses every rung past about the fourth — the protection a rung adds is flat
   * while its price is not — and measured over the fixture seeds it turned the turtle into an
   * optimiser that out-earned the informed player. What a bot WANTS is its build order's business;
   * this rule only asks whether there is still season enough for that want to make sense.
   */
  it('keeps buying a deep rung whose price it could never repay, while raids are still coming', () => {
    const raids = Array.from({ length: 20 }, (_, i) => i * 300);
    const deep = stillWorthBuilding(base({
      kind: 'VAULT', level: 12, raidsTaken: raids, elapsedHours: 100, productiveHours: 400,
    }));
    expect(resourceValue(buildingCost('VAULT', 12)))
      .toBeGreaterThan(resourceValue(buildingCost('VAULT', 6)));
    expect(deep).toBe(true);
  });
});

describe('the rules that were already right stay right', () => {
  it('still judges a producer by its own payback', () => {
    expect(stillWorthBuilding(base({ kind: 'REFINERY', level: 10, productiveHours: 0.1 })))
      .toBe(false);
    expect(stillWorthBuilding(base({ kind: 'REFINERY', level: 10, productiveHours: 100_000 })))
      .toBe(true);
  });

  it('still judges a Core by the producer rung it unlocks', () => {
    expect(stillWorthBuilding(base({ kind: 'CORE', level: 10, productiveHours: 0.1 })))
      .toBe(false);
  });

  /**
   * BY THE PRODUCER THAT IS ACTUALLY AT THE CEILING — not always the Refinery. Owner review,
   * 2026-09-22.
   *
   * The branch's own comment says "judge it by the rung it unlocks" and then asked
   * `worthInvesting('REFINERY', ...)` whatever was standing there. When the Extractor is the one
   * at the Core cap and the Refinery is a rung behind, the Core's next level unlocks an EXTRACTOR
   * rung, and the two curves disagree: at Core 8 / Refinery 7 / Extractor 8 with sixty hours left,
   * the Extractor's next rung repays in 39 hours and the Refinery's in 57, so the Core was refused
   * on the payback of a rung it was not buying.
   *
   * A Core unlocks every producer sitting at its ceiling, so it is worth buying if ANY of them
   * would repay — one profitable rung is a reason, and the others do not have to agree.
   */
  /**
   * THE PREMISE MOVED WITH FAZ 4.2. The Refinery and the Extractor used to disagree at rung 8 (the
   * dead zone made the Refinery's payback run away); priced on what each really adds, they now
   * repay on the same curve and no longer tell the two rules apart. The Plant still repays about
   * twice as slowly, so it is the producer that can: a Core 8 standing over a Plant 8 buys a Plant
   * rung, and must be judged by the Plant even while the Refinery's curve would say yes.
   */
  it('judges a Core by whichever producer is standing at its ceiling', () => {
    const buildings: Record<BuildingId, number> = {
      ...LEVELS, CORE: 8, REFINERY: 7, EXTRACTOR: 7, DEUTERIUM_PLANT: 8,
    };
    // The premise: the two curves genuinely disagree in this window.
    expect(worthInvesting('REFINERY', 8, 40)).toBe(true);
    expect(worthInvesting('DEUTERIUM_PLANT', 8, 40)).toBe(false);
    expect(stillWorthBuilding(base({ kind: 'CORE', level: 8, productiveHours: 40, buildings })))
      .toBe(false);
  });

  it('refuses the Core when no producer at the ceiling would repay', () => {
    const buildings: Record<BuildingId, number> = {
      ...LEVELS, CORE: 8, REFINERY: 8, EXTRACTOR: 8, DEUTERIUM_PLANT: 0,
    };
    expect(worthInvesting('EXTRACTOR', 8, 1)).toBe(false);
    expect(worthInvesting('REFINERY', 8, 1)).toBe(false);
    expect(stillWorthBuilding(base({ kind: 'CORE', level: 8, productiveHours: 1, buildings })))
      .toBe(false);
  });

  /** A producer below the ceiling is not unlocked by this Core, so its curve is not consulted. */
  it('ignores a producer that has room under the Core already', () => {
    const buildings: Record<BuildingId, number> = {
      ...LEVELS, CORE: 8, REFINERY: 3, EXTRACTOR: 8, DEUTERIUM_PLANT: 0,
    };
    expect(worthInvesting('REFINERY', 3, 60)).toBe(true);
    expect(worthInvesting('EXTRACTOR', 8, 0.2)).toBe(false);
    expect(stillWorthBuilding(base({ kind: 'CORE', level: 8, productiveHours: 0.2, buildings })))
      .toBe(false);
  });
});
