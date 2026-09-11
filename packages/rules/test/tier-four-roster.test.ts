import { describe, expect, it } from 'vitest';
import {
  COMBAT_HULLS, HULLS, MOBILE_HULLS, SUPPORT_HULLS, TRANSFER_CARGO_HULLS,
  fleetValue, mulberry32, resolveCombat, type Fleet, type HullId,
} from '../src/index.js';

const val = (id: HullId): number => HULLS[id].alloy + HULLS[id].crystal + HULLS[id].deuterium;
const atTier = (t: number): HullId[] => MOBILE_HULLS.filter((id) => HULLS[id].tier === t);
const find = (t: number, profile: string): HullId | undefined =>
  atTier(t).find((id) => HULLS[id].profile === profile);

/**
 * THE TOP TIER IS A COMPLETE TIER. D196, owner instruction.
 *
 * D195b measured the hole and could not close it: tier 4 held a Lance and a
 * Fortress and nothing else, so the counter cycle — Skirmisher beats Bulwark,
 * Bulwark beats Lance, Lance beats Skirmisher — had NO top-tier answer to a
 * Bulwark. Measured at equal budget over 40 seeds against a Citadel wall, the
 * share of attacker value surviving was: Cataclysm 1%, Nullifier 0%, Praetorian
 * 46%, and a tier-THREE Tempest 88%.
 *
 * So a commander who reached the top tier answered the commonest late-game
 * defence by building a hull they had unlocked two tiers earlier. The cycle was
 * never broken — it survives across tiers — but reaching tier 4 made the
 * catalogue SMALLER, which is the same defect shape D195 removed from fuel.
 *
 * It was blocked on art rather than on rules, and the art arrived.
 */
describe('the tier-4 roster', () => {
  it('fields all five shapes, like every tier below it', () => {
    for (const profile of ['RAIDER', 'STRIKER', 'FORTRESS', 'ESCORT', 'TRANSPORT'] as const) {
      for (let tier = 1; tier <= 4; tier += 1) {
        expect(find(tier, profile), `tier ${String(tier)} ${profile}`).toBeDefined();
      }
    }
  });

  it('gives the counter cycle a top-tier answer to a Bulwark', () => {
    const skirmisher = atTier(4).find((id) => HULLS[id].cls === 'SKIRMISHER');
    expect(skirmisher).toBeDefined();
    expect(HULLS[skirmisher!].atk).toBeGreaterThan(0);

    const side = { tech: {} } as never;
    const budget = 200_000;
    const wing = (id: HullId): Fleet => ({ [id]: Math.max(1, Math.round(budget / val(id))) });
    let kept = 0;
    for (let seed = 1; seed <= 40; seed += 1) {
      const r = resolveCombat(wing(skirmisher!), wing('CITADEL'), 0, mulberry32(seed),
        { attacker: side, defender: side });
      const mine = fleetValue(r.attackerSurvivors), theirs = fleetValue(r.defenderSurvivors);
      kept += mine / (mine + theirs || 1);
    }
    // A Skirmisher should BEAT a Bulwark at equal budget, decisively.
    expect(kept / 40).toBeGreaterThan(0.75);
  });

  /** The middle of the spread exists, so the sharpest tier is not the barest one. */
  it('offers something between maximum attack and maximum armour', () => {
    const ratios = atTier(4).filter((id) => HULLS[id].atk > 0)
      .map((id) => HULLS[id].atk / HULLS[id].hp).sort((a, b) => a - b);
    expect(ratios.length).toBeGreaterThanOrEqual(4);
    const [lowest] = ratios, highest = ratios.at(-1)!;
    const middle = ratios.slice(1, -1);
    expect(middle.length).toBeGreaterThan(0);
    for (const r of middle) {
      expect(r).toBeGreaterThan(lowest!);
      expect(r).toBeLessThan(highest);
    }
  });

  it('carries logistics as far as it carries guns', () => {
    const transports = SUPPORT_HULLS.filter((id) => HULLS[id].profile === 'TRANSPORT');
    expect(Math.max(...transports.map((id) => HULLS[id].tier ?? 0))).toBe(4);
    expect(TRANSFER_CARGO_HULLS).toHaveLength(transports.length);
    for (const id of transports) expect(TRANSFER_CARGO_HULLS).toContain(id);
  });

  /** The three new hulls obey every ladder the existing ones do. */
  it('keeps the tier-4 additions on the catalogue rules', () => {
    const t4 = atTier(4);
    const eff = t4.filter((id) => HULLS[id].atk > 0)
      .map((id) => (HULLS[id].atk * HULLS[id].hp) / val(id) ** 2);
    expect(Math.max(...eff) / Math.min(...eff)).toBeLessThan(1.06);
    for (const id of COMBAT_HULLS.filter((h) => HULLS[h].tier === 4)) {
      expect(HULLS[id].cargo, id).toBeGreaterThan(0);
    }
  });
});
