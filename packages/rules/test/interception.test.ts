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
   * ONE SHOT IN THE TUBE, AND THAT NUMBER IS THE WHOLE INTERLOCK.
   *
   * At two charges a fully-loaded defender is immune to a commander who may only
   * stockpile two weapons, and the Death Star stops existing. At one, the answer
   * is on the board: send the first as bait, land the second. Each feature is the
   * other's cost.
   */
  it('holds exactly one charge, which is what the stockpile is the answer to', () => {
    expect(ANTI_STRATEGIC.maxCharges).toBe(1);
    expect(strategicStockpile(1)).toBeGreaterThan(ANTI_STRATEGIC.maxCharges);
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

  it('is earned through the same war chain the weapon is', () => {
    const grid = RESEARCH_PROJECTS[ANTI_STRATEGIC.requiredResearch];
    expect(grid.maxLevel).toBe(1);
    expect(grid.prerequisite).toBe('GRAVITIC_CHARGES');
    expect(grid.availableAtMinutes)
      .toBe(RESEARCH_PROJECTS.DEATH_STAR_PROTOCOL.availableAtMinutes);
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
  it('allows one weapon without the research and two with it', () => {
    expect(strategicStockpile(0)).toBe(1);
    expect(strategicStockpile(1)).toBe(2);
  });

  it('never allows a third, however much is researched', () => {
    expect(strategicStockpile(99)).toBe(2);
  });

  it('is gated behind the weapon it stockpiles', () => {
    const project = RESEARCH_PROJECTS.STRATEGIC_STOCKPILE;
    expect(project.maxLevel).toBe(1);
    expect(project.prerequisite).toBe('DEATH_STAR_PROTOCOL');
  });
});
