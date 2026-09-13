import { describe, expect, it } from 'vitest';
import { researchNeedWorld } from '../src/lib/researchNeed.js';

/**
 * D209 — OWNER INSTRUCTION: research is gated by the CAPITAL's Command Core, so the
 * fix a research card offers for a Core shortfall opens the capital's planet sheet,
 * whichever world the research menu was opened from.
 */
describe('researchNeedWorld', () => {
  it('sends a Core shortfall to the capital', () => {
    expect(researchNeedWorld('CORE', 'capital-1')).toBe('capital-1');
  });

  it('asks for no world change for anything that is not the Core', () => {
    expect(researchNeedWorld('SHIPYARD', 'capital-1')).toBeNull();
  });

  it('asks for no world change when the capital is not known', () => {
    expect(researchNeedWorld('CORE', null)).toBeNull();
  });
});
