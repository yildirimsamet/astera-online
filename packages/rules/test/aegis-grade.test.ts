import { describe, expect, it } from 'vitest';
import { resolveCombat } from '../src/index.js';

const flat = () => () => 0.5;
const NO_TECH = { attacker: { tech: {} }, defender: { tech: {} } };

/**
 * AN UNGUARDED WORLD IS A WALKOVER. D173.
 *
 * Owner instruction: *"Sıfır kişi varsa bu WIN sayılır ve yağmalanabilir
 * kaynakları almaları lazım."* An Aegis absorbs fire aimed at a defending line;
 * it does not become that line when no combat unit or ground gun stands there.
 * The raid therefore wins without firing, leaves the idle shield untouched and
 * proceeds through the ordinary DECISIVE loot path.
 */
describe('an Aegis without a defending line', () => {
  const bareShield = (attacker: Record<string, number>, shield: number) =>
    resolveCombat(attacker, {}, shield, flat(), NO_TECH);

  it('is a decisive walkover regardless of shield charge', () => {
    const r = bareShield({ DART: 5 }, 4_000);

    expect(r.shieldLeft).toBe(4_000);
    expect(r.rounds).toHaveLength(0);
    expect(r.defenderLosses).toEqual({});
    expect(r.grade).toBe('DECISIVE');
    expect(r.lossRatio).toBe(1);
  });

  it('does not spend a Nullifier shot on an unguarded shield', () => {
    const r = bareShield({ NULLIFIER: 4 }, 4_000);

    expect(r.grade).toBe('DECISIVE');
    expect(r.rounds).toHaveLength(0);
    expect(r.shieldLeft).toBe(4_000);
  });

  /**
   * The zero-shield shape remains the same walkover; Aegis presence must not
   * create a second outcome for the same empty defending line.
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
