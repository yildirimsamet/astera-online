import { describe, expect, it } from 'vitest';
import { beforeEach } from 'vitest';
import { RESEARCH_MAX_LEVEL, hullTech } from '@astera/rules';
import { researchGain } from '../src/lib/gains.js';
import { percent } from '../src/lib/format.js';
import i18n from '../src/i18n/index.js';

/**
 * WHAT A RUNG IS WORTH, AND WHERE THE LADDER ENDS. Owner report:
 *
 *   *"Bazı araştırmaların ne katkı sağladığı anlaşılmıyor. Zırh mı arttırıyor atak
 *   mı arttırıyor, ne kadar arttırıyor anlaşılamıyor."*
 *
 * Two separate failures behind one sentence, and the numbers were on screen for
 * both of them:
 *
 *   · THE FIGURE WAS ROUNDED INTO NOISE. A rung of Ship Power is 2.26% and the row
 *     printed "%2"; the next is 4.56% and printed "%5". Three rungs of a five-rung
 *     ladder rendered as 2, 5, 7 — numbers that look like rounding rather than a
 *     design, and small enough that a commander reads them as "nothing".
 *   · THE CEILING WAS NOWHERE. A rung is only worth judging against what the whole
 *     ladder comes to. +2.3% is meaningless; +2.3% of an eventual +11.8%, bought
 *     five times, is a decision.
 */
beforeEach(async () => {
  await i18n.changeLanguage('en');
});

describe('a percentage small enough to matter', () => {
  it('keeps a decimal where whole numbers would collapse the ladder', () => {
    // The five rungs of Ship Power, which rounded to 2, 5, 7, 9, 12.
    expect(percent(0.0226)).toBe('2.3%');
    expect(percent(0.0456)).toBe('4.6%');
    expect(percent(0.0112)).toBe('1.1%');
  });

  it('keeps the top of a small ladder at its tenth too', () => {
    // The ceiling of Ship Power. Rounded to 12% it would break the very ladder
    // the decimals were added to make even: 2.3, 4.6, 6.9, 9.3, then 12.
    expect(percent(0.118)).toBe('11.8%');
  });

  it('still writes the big ones whole, where a decimal is only noise', () => {
    // Propulsion's own ladder, which must never grow a `.0`.
    expect(percent(0.25)).toBe('25%');
    expect(percent(0.5)).toBe('50%');
    expect(percent(1)).toBe('100%');
  });

  it('puts the sign where the language puts it', async () => {
    await i18n.changeLanguage('tr');
    expect(percent(0.0226)).toBe('%2,3');
    expect(percent(0.25)).toBe('%25');
  });
});

describe('every ladder says where it ends', () => {
  const LADDERS = [
    'SHIP_POWER', 'SHIP_ARMOR', 'SHIP_PROPULSION', 'EMPLACEMENT_DOCTRINE',
    'YARD_AUTOMATION', 'PROSPECTOR_HOLDS', 'CARGO_HOLDS',
  ] as const;

  it('states the top of the ladder on every rung that has one', () => {
    for (const id of LADDERS) {
      const gain = researchGain(id, 0);
      expect(gain.ceiling, id).toBeDefined();
    }
  });

  it('names the real ceiling, read off the same tables combat reads', () => {
    const top = RESEARCH_MAX_LEVEL.SHIP_POWER;
    const full = hullTech({ SHIP_POWER: top }, 'DART').atk - 1;
    expect(researchGain('SHIP_POWER', 0).ceiling).toBe(percent(full));
    expect(researchGain('SHIP_POWER', 0).ceiling).toBe('11.8%');
  });

  it('says nothing about a ceiling on a door, which has no ladder', () => {
    for (const id of ['ISOTOPE_SPECTROMETRY', 'DENSE_FUEL_CELLS', 'GRAVITIC_CHARGES'] as const) {
      expect(researchGain(id, 0).ceiling, id).toBeUndefined();
    }
  });

  /** A ladder already at its top has arrived at its ceiling, not below it. */
  it('shows a finished ladder standing on its own ceiling', () => {
    const top = RESEARCH_MAX_LEVEL.SHIP_ARMOR;
    const gain = researchGain('SHIP_ARMOR', top);
    expect(gain.maxed).toBe(true);
    expect(gain.now).toBe(gain.ceiling);
  });
});
