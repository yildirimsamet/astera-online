import { describe, expect, it } from 'vitest';
import { COMBAT, resolveCombat } from '../src/index.js';

const flat = () => () => 0.5;
const NO_TECH = { attacker: { tech: {} }, defender: { tech: {} } };

/**
 * THE AEGIS IS A DEFENCE UNIT. Owner ruling.
 *
 * *"aegis'te bir savunma birimi sonucta. tabya gibi kirpi gibi gemi gibi bir
 * savunma birimi."*
 *
 * THE DEFECT THIS FIXES. A fleet with no Nullifier flying at a world that holds
 * ONLY an Aegis achieved literally nothing — no damage landed, no shield was
 * spent, no unit died on either side — and came home graded **PARTIAL**, which
 * pays a partial haul.
 *
 * The cause was one branch. `lossRatio` is the share of the defender's unit VALUE
 * destroyed, and it read `defValueBefore > 0 ? … : 1`. That `: 1` is correct for a
 * WALKOVER — destroying all of nothing is total — but it was also being taken by a
 * world whose defence was entirely its shield, and there the DECISIVE branch is
 * blocked by `shieldLeft > 0`, so a ratio of 1 fell through to PARTIAL.
 *
 * The fix follows the owner's sentence exactly: where a world's defence IS the
 * shield, the shield is what the loss ratio measures. Nothing changes for a battle
 * that had units in it, so no grading anywhere else moves.
 */
describe('a world whose whole defence is its Aegis', () => {
  const bareShield = (attacker: Record<string, number>, shield: number) =>
    resolveCombat(attacker, {}, shield, flat(), NO_TECH);

  it('repels a fleet that cannot touch the shield', () => {
    const r = bareShield({ DART: 5 }, 4_000);
    // Nothing happened, and the grade now says so.
    expect(r.shieldLeft).toBe(4_000);
    expect(r.defenderLosses).toEqual({});
    expect(r.grade).toBe('REPELLED');
  });

  /** A REPELLED pays nothing — which is the whole point of the correction. */
  it('is a grade that earns no haul', () => {
    expect(bareShield({ DART: 5 }, 4_000).grade).toBe('REPELLED');
    expect(bareShield({ DART: 400 }, 900_000).grade).toBe('REPELLED');
  });

  it('still falls DECISIVE once the shield is actually broken', () => {
    const r = bareShield({ NULLIFIER: 4 }, 4_000);
    expect(r.shieldLeft).toBe(0);
    expect(r.grade).toBe('DECISIVE');
  });

  /**
   * KNOCKING A WALL HALF DOWN IS A PARTIAL SUCCESS, and stays one. The Aegis being
   * a defence unit cuts both ways: damaging it IS damaging defence, so the ratio is
   * measured against the shield rather than being pinned at nothing.
   */
  it('grades a serious dent as PARTIAL, on the shield it was measured against', () => {
    let found = false;
    for (const shield of [2_000, 4_000, 8_000, 16_000, 32_000]) {
      const r = bareShield({ NULLIFIER: 4 }, shield);
      const spent = 1 - r.shieldLeft / shield;
      if (r.grade === 'PARTIAL') {
        found = true;
        expect(spent).toBeGreaterThanOrEqual(COMBAT.partialThreshold);
        expect(spent).toBeLessThan(1);
      }
    }
    expect(found, 'no shield size produced a partial knock-down').toBe(true);
  });

  /**
   * THE WALKOVER IS UNTOUCHED. A world with no units AND no shield has no defence
   * at all, and taking all of nothing is still total — this is the branch the
   * `: 1` was written for and it keeps it.
   */
  it('leaves an undefended world DECISIVE', () => {
    const r = bareShield({ DART: 5 }, 0);
    expect(r.grade).toBe('DECISIVE');
    expect(r.rounds).toHaveLength(0);
  });

  /** And a battle with units in it grades exactly as it always did. */
  it('changes nothing about a fight that had units', () => {
    const withUnits = resolveCombat({ DART: 30 }, { THORN: 6 }, 0, flat(), NO_TECH);
    expect(withUnits.grade).toBe('PARTIAL');
    const repel = resolveCombat({ DART: 2 }, { CITADEL: 4 }, 0, flat(), NO_TECH);
    expect(repel.grade).toBe('REPELLED');
  });
});
