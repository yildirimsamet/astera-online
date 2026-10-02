import { describe, expect, it } from 'vitest';
import {
  ANTI_STRATEGIC,
  DEATH_STAR,
  RESEARCH_PROJECTS,
  interceptionRange,
  radarContactRange,
  radarRange,
  resourcesTotal,
  pointAlong,
  sphereEntryFraction,
  interceptorCapacity,
  strategicStockpile,
} from '../src/index.js';

/**
 * THE WEAPON THAT ANSWERS THE WEAPON. T10 · T11.
 *
 * A Death Star is 33,000 resources, an hour of build, a Command Core of twelve, a
 * Shipyard of five and the whole Frontier research chain. An interceptor that
 * stopped it cheaply would throw all of D113's work away — so the two are priced
 * against each other deliberately, and they ship together because each is the
 * other's answer: the stockpile is what beats a charged defence, and the defence
 * is what makes the stockpile worth its second hour.
 */
describe('the interception grid', () => {
  it('fires along the RADAR circle that carries a clock', () => {
    /*
      D124: a rule the player cannot SEE is not a rule. An arrival-time check would
      be invisible — you would only ever meet its result. The timed radar circle is
      drawn on the disc, so a weapon dying on it is a rule with a picture, and an
      attacker can read the target's reach and price the risk.

      IT IS `radarRange` AND NOT `radarContactRange`, and while the two tables are
      merged that distinction is invisible in the numbers — which is exactly why it
      is asserted against the timed one by NAME. Split the tables again and this
      test keeps holding the weapon on the correct circle without being touched.
    */
    for (const level of [3, 4, 5]) {
      expect(level).toBeGreaterThanOrEqual(ANTI_STRATEGIC.requiredRadar);
      expect(interceptionRange(level)).toBe(radarRange(level));
    }
    expect(radarContactRange(5)).toBeGreaterThanOrEqual(radarRange(5));
  });

  /**
   * THE "I BUILT THE EXPENSIVE THING AND IT NEVER FIRED" TRAP.
   *
   * The requirement used to be justified by the table: below L3 `radarRange` was
   * literally zero, so a grid installed there could never fire. The radar ladder
   * now reaches from L1, so the rung is a DELIBERATE PRICE rather than a
   * consequence of a zero — and the trap it guards against is unchanged, so the
   * gate is asserted here instead of being read off the table.
   */
  it('is shut below its required rung and open at it', () => {
    expect(ANTI_STRATEGIC.requiredRadar).toBeGreaterThan(0);
    for (let level = 0; level < ANTI_STRATEGIC.requiredRadar; level += 1) {
      expect(interceptionRange(level), `radar ${String(level)}`).toBe(0);
    }
    expect(interceptionRange(ANTI_STRATEGIC.requiredRadar)).toBeGreaterThan(0);
  });

  /**
   * MORE CHARGES THAN WEAPONS AT EVERY RUNG, AND THE VOLUME IS THE ANSWER. Owner, 2026-10-01.
   *
   * The pad limit is per WORLD and a charge only fires from the target's pad, so the
   * attacker's reply to a loaded world is several worlds striking at once.
   */
  it('holds two charges by default and four with the Grid', () => {
    expect(ANTI_STRATEGIC.charges).toEqual({ base: 2, researched: 4 });
    expect(DEATH_STAR.perWorld).toEqual({ base: 1, researched: 2 });
  });

  it('costs a real share of what it destroys, and never more', () => {
    const shot = resourcesTotal(ANTI_STRATEGIC.cost);
    const weapon = resourcesTotal(DEATH_STAR.cost);
    // Dear enough that a defence is a decision, cheap enough to be worth making.
    expect(shot).toBeGreaterThan(weapon / 8);
    expect(shot).toBeLessThan(weapon);
    // And it reloads faster than the thing it shoots down is built.
    expect(ANTI_STRATEGIC.buildMinutes).toBeLessThan(DEATH_STAR.buildMinutes);
  });

  it('doubles its capacity through the war chain, one rung deep', () => {
    const grid = RESEARCH_PROJECTS.INTERCEPTION_GRID;
    expect(grid.maxLevel).toBe(1);
    expect(grid.prerequisite).toBe('GRAVITIC_CHARGES');
    expect(grid.availableAtMinutes)
      .toBe(RESEARCH_PROJECTS.STRATEGIC_STOCKPILE.availableAtMinutes);
    expect(interceptorCapacity(0)).toBe(2);
    expect(interceptorCapacity(1)).toBe(4);
  });

  it('solves the exact Telescope entry point on a moving leg', () => {
    const from = { x: -10, y: 0, z: 0 };
    const to = { x: 10, y: 0, z: 0 };
    const entry = sphereEntryFraction(from, to, { x: 0, y: 0, z: 0 }, 4);
    expect(entry).toBeCloseTo(0.3);
    expect(pointAlong(from, to, entry!)).toEqual({ x: -4, y: 0, z: 0 });
  });

  it('does not schedule a Telescope crossing for a leg that misses the sphere', () => {
    expect(sphereEntryFraction(
      { x: -10, y: 8, z: 0 },
      { x: 10, y: 8, z: 0 },
      { x: 0, y: 0, z: 0 },
      4,
    )).toBeNull();
  });
});

/**
 * TWO WEAPONS ON THE PAD, BUILT ONE AFTER THE OTHER. T11.
 *
 * The stockpile removes the CHORE — being at the keyboard when the first finishes
 * — and keeps the COST: the second still takes its own hour. Anything else would
 * hand one commander a same-hour double strike, and D113's capture route already
 * turns two hits inside a recovery window into a colony changing hands.
 */
describe('the strategic stockpile', () => {
  it('allows one weapon without research and two with it', () => {
    expect(strategicStockpile(0)).toBe(1);
    expect(strategicStockpile(1)).toBe(2);
  });

  it('never allows a third, however much is researched', () => {
    expect(strategicStockpile(99)).toBe(2);
  });

  /**
   * The protocol it used to stand behind is gone (owner, 2026-10-01), so it stands
   * behind the protocol's own prerequisite, at the Core the weapon itself asks for.
   */
  it('stands behind Gravitic Charges at the weapon’s own Core', () => {
    const project = RESEARCH_PROJECTS.STRATEGIC_STOCKPILE;
    expect(project.maxLevel).toBe(1);
    expect(project.prerequisite).toBe('GRAVITIC_CHARGES');
    expect(project.requiredCore).toBe(DEATH_STAR.requiredCore);
  });
});
