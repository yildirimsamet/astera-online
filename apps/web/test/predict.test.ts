import { describe, expect, it } from 'vitest';
import { HULLS, PROSPECTOR, instrumentCost, satelliteCost, upgradeCost } from '@astera/rules';
import {
  predictBuild,
  predictCollect,
  predictInstrument,
  predictSatellite,
  predictUpgrade,
} from '../src/lib/predict.js';
import { planetView } from './fixtures.js';

/**
 * WHAT A TAP SHOWS BEFORE THE SERVER ANSWERS. D53.
 *
 * Construction is instant on payment — no build timers, by design — and the
 * interface now keeps that promise on the frame of the tap rather than a round
 * trip later. What makes that safe rather than dishonest is entirely in this file:
 * a predictor must be right, or it must DECLINE.
 *
 * So the tests that matter most here are the negative ones. A prediction that is
 * usually right is worse than no prediction at all, because the flicker of a
 * purchase un-happening lands on the one screen the whole game is played on.
 */
describe('predicting an upgrade', () => {
  const rich = planetView(
    {
      buildings: { CORE: 5, REFINERY: 2, EXTRACTOR: 2, VAULT: 1, SHIPYARD: 1 },
      nextCosts: { REFINERY: upgradeCost(2), CORE: upgradeCost(5) },
    },
    { alloy: 500_000, crystal: 500_000 },
  );

  it('raises the level and pays for it', () => {
    const after = predictUpgrade(rich, 'REFINERY');
    expect(after?.buildings.REFINERY).toBe(3);
    expect(after?.planet.alloy).toBe(500_000 - upgradeCost(2).alloy);
    expect(after?.planet.crystal).toBe(500_000 - upgradeCost(2).crystal);
  });

  /** The figure directly under the button that was just pressed. */
  it('re-prices the next one', () => {
    expect(predictUpgrade(rich, 'REFINERY')?.nextCosts.REFINERY).toEqual(upgradeCost(3));
  });

  it('leaves every derived figure to the server', () => {
    const after = predictUpgrade(rich, 'REFINERY');
    // A Refinery level moves the storage cap and the per-hour rate, and neither is
    // predicted: re-deriving them here would be `planetView` written twice.
    expect(after?.planet.alloyCap).toBe(rich.planet.alloyCap);
    expect(after?.planet.alloyPerHour).toBe(rich.planet.alloyPerHour);
    expect(after?.orbitSlots).toBe(rich.orbitSlots);
  });

  it('declines when the player cannot afford it', () => {
    const poor = planetView(
      { buildings: rich.buildings, nextCosts: rich.nextCosts },
      { alloy: 1, crystal: 1 },
    );
    expect(predictUpgrade(poor, 'REFINERY')).toBeNull();
  });

  /**
   * THE REFUSAL A PLAYER MEETS MOST OFTEN.
   *
   * Everything on a planet is capped by its Command Core, so a structure sitting
   * at the ceiling is the commonest thing a tap can be refused for. Predicting it
   * as a success would show a level that un-happens a moment later.
   */
  it('declines at the Command Core ceiling', () => {
    const capped = planetView(
      {
        buildings: { CORE: 3, REFINERY: 3, EXTRACTOR: 1, VAULT: 0, SHIPYARD: 0 },
        nextCosts: { REFINERY: upgradeCost(3) },
      },
      { alloy: 500_000, crystal: 500_000 },
    );
    expect(predictUpgrade(capped, 'REFINERY')).toBeNull();
    // The Core itself is never capped by the Core.
    expect(
      predictUpgrade(
        planetView(
          { buildings: capped.buildings, nextCosts: { CORE: upgradeCost(3) } },
          { alloy: 500_000, crystal: 500_000 },
        ),
        'CORE',
      )?.buildings.CORE,
    ).toBe(4);
  });

  /** A payload with no price for this building is a stale screen, not a purchase. */
  it('declines when it has no price to charge', () => {
    expect(predictUpgrade(planetView({ nextCosts: {} }), 'VAULT')).toBeNull();
  });
});

describe('predicting a build', () => {
  const yard = planetView(
    { buildings: { CORE: 6, REFINERY: 2, EXTRACTOR: 2, VAULT: 0, SHIPYARD: 4 }, fleet: { WASP: 2 } },
    { alloy: 500_000, crystal: 500_000 },
  );

  it('adds the hulls and charges for all of them', () => {
    const after = predictBuild(yard, 'WASP', 3);
    expect(after?.fleet.WASP).toBe(5);
    expect(after?.planet.alloy).toBe(500_000 - HULLS.WASP.alloy * 3);
  });

  /** A ground gun lands on the ground stack, never on the fleet. */
  it('puts a ground hull where a ground hull lives', () => {
    const after = predictBuild(yard, 'THORN', 2);
    expect(after?.ground.THORN).toBe(2);
    expect(after?.fleet.THORN).toBeUndefined();
  });

  it('declines below the hull\'s Shipyard level', () => {
    const shed = planetView(
      { buildings: { CORE: 6, REFINERY: 2, EXTRACTOR: 2, VAULT: 0, SHIPYARD: 1 } },
      { alloy: 500_000, crystal: 500_000 },
    );
    expect(predictBuild(shed, 'BULWARK', 1)).toBeNull();
  });

  /**
   * A PROSPECTOR IS CAPPED BY WHAT YOU OWN, NOT BY WHAT IS AT HOME.
   *
   * The cap counts craft wherever they are — which is the whole reason the payload
   * carries `fleetAway`. A predictor reading only the home stack would offer a
   * third drill to somebody whose two were out mining.
   */
  it('counts drills that are away against the cap', () => {
    const mining = planetView(
      {
        buildings: { CORE: 6, REFINERY: 2, EXTRACTOR: 2, VAULT: 0, SHIPYARD: 4 },
        fleet: {},
        fleetAway: { PROSPECTOR: PROSPECTOR.max },
      },
      { alloy: 500_000, crystal: 500_000 },
    );
    expect(predictBuild(mining, 'PROSPECTOR', 1)).toBeNull();
  });

  it('declines a count that is not a positive whole number', () => {
    expect(predictBuild(yard, 'WASP', 0)).toBeNull();
    expect(predictBuild(yard, 'WASP', -2)).toBeNull();
    expect(predictBuild(yard, 'WASP', 1.5)).toBeNull();
  });

  it('declines when the total price is out of reach, not just the unit price', () => {
    const thin = planetView(
      { buildings: yard.buildings },
      { alloy: HULLS.WASP.alloy * 2, crystal: 0 },
    );
    expect(predictBuild(thin, 'WASP', 2)).not.toBeNull();
    expect(predictBuild(thin, 'WASP', 3)).toBeNull();
  });
});

describe('predicting an instrument', () => {
  const seeing = planetView(
    {
      buildings: { CORE: 6, REFINERY: 2, EXTRACTOR: 2, VAULT: 0, SHIPYARD: 0 },
      orbit: ['UPLINK'],
      instruments: { TELESCOPE: 1 },
      instrumentCosts: { TELESCOPE: instrumentCost('TELESCOPE', 1), AEGIS: instrumentCost('AEGIS', 0) },
    },
    { alloy: 500_000, crystal: 500_000 },
  );

  it('raises the level and re-prices the next one', () => {
    const after = predictInstrument(seeing, 'TELESCOPE');
    expect(after?.instruments.TELESCOPE).toBe(2);
    expect(after?.instrumentCosts.TELESCOPE).toEqual(instrumentCost('TELESCOPE', 2));
  });

  /**
   * THE ONE PREREQUISITE IN THE SYSTEM. D25.
   *
   * The Uplink gates the Telescope and the Radar and nothing else gates anything.
   * A prediction that ignored it would show a Telescope going up on a world that
   * cannot have one.
   */
  it('declines a seeing instrument with no Uplink in orbit', () => {
    const blind = planetView(
      { buildings: seeing.buildings, orbit: [], instrumentCosts: seeing.instrumentCosts },
      { alloy: 500_000, crystal: 500_000 },
    );
    expect(predictInstrument(blind, 'TELESCOPE')).toBeNull();
    // The Aegis stands on its own and is unaffected.
    expect(predictInstrument(blind, 'AEGIS')).not.toBeNull();
  });

  it('declines at the Command Core ceiling', () => {
    const capped = planetView(
      {
        buildings: { CORE: 1, REFINERY: 1, EXTRACTOR: 1, VAULT: 0, SHIPYARD: 0 },
        orbit: ['UPLINK'],
        instruments: { TELESCOPE: 1 },
        instrumentCosts: seeing.instrumentCosts,
      },
      { alloy: 500_000, crystal: 500_000 },
    );
    expect(predictInstrument(capped, 'TELESCOPE')).toBeNull();
  });

  /**
   * An instrument stops where its own effect table stops (D36). Past that the
   * purchase is refused, and predicting it would show a level that buys nothing
   * and then vanishes.
   */
  it('declines an instrument that has nothing left to sell', () => {
    const maxed = planetView(
      {
        buildings: { CORE: 12, REFINERY: 2, EXTRACTOR: 2, VAULT: 0, SHIPYARD: 0 },
        orbit: ['UPLINK'],
        instruments: { TELESCOPE: 5 },
        instrumentCosts: { TELESCOPE: instrumentCost('TELESCOPE', 5) },
      },
      { alloy: 5_000_000, crystal: 5_000_000 },
    );
    expect(predictInstrument(maxed, 'TELESCOPE')).toBeNull();
  });
});

describe('predicting a satellite', () => {
  const room = planetView(
    { buildings: { CORE: 5, REFINERY: 2, EXTRACTOR: 2, VAULT: 0, SHIPYARD: 0 }, orbit: [], orbitSlots: 2 },
    { alloy: 500_000, crystal: 500_000 },
  );

  it('puts it in orbit and pays for it', () => {
    const after = predictSatellite(room, 'FOUNDRY');
    expect(after?.orbit).toEqual(['FOUNDRY']);
    expect(after?.planet.alloy).toBe(500_000 - satelliteCost('FOUNDRY').alloy);
  });

  it('declines when it is already up there', () => {
    expect(predictSatellite({ ...room, orbit: ['FOUNDRY'] }, 'FOUNDRY')).toBeNull();
  });

  /** Orbit is rationed by the Command Core: 1, 3, 5 and 9. D25. */
  it('declines with no free slot', () => {
    expect(
      predictSatellite({ ...room, orbit: ['FOUNDRY', 'UPLINK'], orbitSlots: 2 }, 'DERRICK'),
    ).toBeNull();
  });
});

describe('predicting a collect', () => {
  it('moves the works into storage', () => {
    const full = planetView({}, {
      alloy: 100,
      crystal: 50,
      alloyCap: 5000,
      crystalCap: 5000,
      bufferAlloy: 800,
      bufferCrystal: 400,
    });
    const after = predictCollect(full);
    expect(after?.planet.alloy).toBe(900);
    expect(after?.planet.crystal).toBe(450);
    expect(after?.planet.bufferAlloy).toBe(0);
    expect(after?.planet.bufferCrystal).toBe(0);
  });

  /**
   * WHAT WILL NOT FIT STAYS IN THE WORKS. D16.
   *
   * It is not destroyed, and the interface says so. A predictor that emptied the
   * works regardless would teach the opposite of the lesson the whole two-pile
   * economy exists to teach.
   */
  it('stops at the storage ceiling and leaves the rest behind', () => {
    const brimming = planetView({}, {
      alloy: 900,
      crystal: 0,
      alloyCap: 1000,
      crystalCap: 1000,
      bufferAlloy: 500,
      bufferCrystal: 0,
    });
    const after = predictCollect(brimming);
    expect(after?.planet.alloy).toBe(1000);
    expect(after?.planet.bufferAlloy).toBe(400);
  });

  /** Nothing to move is not a prediction; it is a tap that changes nothing. */
  it('declines when the works are empty', () => {
    expect(predictCollect(planetView({}, { bufferAlloy: 0, bufferCrystal: 0 }))).toBeNull();
  });

  it('declines when storage is already full', () => {
    expect(
      predictCollect(
        planetView({}, {
          alloy: 1000,
          crystal: 1000,
          alloyCap: 1000,
          crystalCap: 1000,
          bufferAlloy: 500,
          bufferCrystal: 500,
        }),
      ),
    ).toBeNull();
  });
});

/**
 * A PREDICTION MUST NEVER MUTATE WHAT IT WAS GIVEN.
 *
 * The view it reads is the object React Query is holding, and every subscriber on
 * screen is rendering from it. Mutating in place would change what is drawn
 * without telling React, and — worse — would destroy the snapshot the rollback
 * puts back when the server refuses.
 */
describe('every predictor', () => {
  it('leaves the view it was given untouched', () => {
    const view = planetView(
      {
        buildings: { CORE: 6, REFINERY: 2, EXTRACTOR: 2, VAULT: 0, SHIPYARD: 4 },
        nextCosts: { REFINERY: upgradeCost(2) },
        orbit: ['UPLINK'],
        orbitSlots: 3,
        instruments: { TELESCOPE: 1 },
        instrumentCosts: { TELESCOPE: instrumentCost('TELESCOPE', 1) },
        fleet: { WASP: 2 },
      },
      { alloy: 500_000, crystal: 500_000, bufferAlloy: 100, bufferCrystal: 100, alloyCap: 999_999, crystalCap: 999_999 },
    );
    const before = structuredClone(view);

    predictUpgrade(view, 'REFINERY');
    predictBuild(view, 'WASP', 2);
    predictInstrument(view, 'TELESCOPE');
    predictSatellite(view, 'FOUNDRY');
    predictCollect(view);

    expect(view).toEqual(before);
  });
});
