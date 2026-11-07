import { describe, expect, it } from 'vitest';
import { STARTER, STARTER_CRATES, crateStates, openingProgress, readyCrates, type VesselProgress } from '../src/index.js';

/**
 * KURTARMA KASALARI (retention plan §6.2). A sealed crate in a system's bay opens when that system's
 * repair is done, and pays the shortfall of the guided road. It pays for an act, never for waiting.
 */
describe('the salvage crates', () => {
  const at = (modules: Record<string, number>): VesselProgress => ({ ...openingProgress(), modules: { ...openingProgress().modules, ...modules } });

  it('are ready once their repair is done, and never twice', () => {
    const first = STARTER_CRATES[0]!;
    expect(readyCrates(openingProgress(), [])).toEqual([]);
    const done = at({ [first.module]: first.stage });
    expect(readyCrates(done, []).map(crate => crate.id)).toContain(first.id);
    expect(readyCrates(done, [first.id]).map(crate => crate.id)).not.toContain(first.id);
  });

  it('have unique ids and pay only alloy and crystal', () => {
    expect(new Set(STARTER_CRATES.map(crate => crate.id)).size).toBe(STARTER_CRATES.length);
    for (const crate of STARTER_CRATES) {
      expect(crate.reward.alloy + crate.reward.crystal).toBeGreaterThan(0);
      expect(Object.keys(crate.reward).sort()).toEqual(['alloy', 'crystal']);
    }
  });

  it('pay the first day mostly in crystal, the resource that runs out first', () => {
    const late = STARTER_CRATES.filter(crate => (crate.module === 'EXTRACTOR' && crate.stage === 3) || (crate.module === 'SURVEY' && crate.stage === 2));
    expect(late.length).toBe(2);
    for (const crate of late) expect(crate.reward.crystal).toBeGreaterThan(crate.reward.alloy);
  });

  it('stay a shortfall, not a fortune: less than what the ship may carry across', () => {
    const alloy = STARTER_CRATES.reduce((sum, crate) => sum + crate.reward.alloy, 0);
    const crystal = STARTER_CRATES.reduce((sum, crate) => sum + crate.reward.crystal, 0);
    expect(alloy).toBeLessThanOrEqual(STARTER.carry.alloy);
    expect(crystal).toBeLessThanOrEqual(1200);
  });

  it('reads as sealed, ready or opened, in bay order', () => {
    const first = STARTER_CRATES[0]!;
    const done = at({ [first.module]: first.stage });
    expect(crateStates(openingProgress(), []).every(crate => crate.state === 'sealed')).toBe(true);
    expect(crateStates(done, [])[0]).toMatchObject({ id: first.id, state: 'ready', alloy: first.reward.alloy });
    expect(crateStates(done, [first.id])[0]?.state).toBe('opened');
  });
});
