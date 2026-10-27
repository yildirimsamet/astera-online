import { afterEach, describe, expect, it } from 'vitest';
import i18n from '../../src/i18n/index.js';
import { railLevel } from '../../src/arena/input.js';
import { arenaCopy } from '../../src/arena/copy.js';

/**
 * F12 (S22 2026-10-26): the throttle read the whole column, label and figure included, so the
 * rail's visible foot was about 5 % and a full stop took a tap on the figure or a hidden double tap.
 */
describe('the throttle rail', () => {
  const rail = { top: 300, height: 140 };

  it('reads its own length: the foot is a full stop, the head full throttle', () => {
    expect(railLevel(440, rail)).toBe(0);
    expect(railLevel(436, rail)).toBe(0);
    expect(railLevel(300, rail)).toBe(1);
    expect(railLevel(370, rail)).toBeCloseTo(0.5, 2);
  });

  it('stops on a touch below the rail and goes full above it', () => {
    expect(railLevel(470, rail)).toBe(0);
    expect(railLevel(250, rail)).toBe(1);
  });

  afterEach(async () => { await i18n.changeLanguage('en'); });
  it('tells the pilot in the exit zone how to stop', async () => {
    await i18n.changeLanguage('tr'); expect(arenaCopy().exitStop).toMatch(/gaz/i);
    await i18n.changeLanguage('en'); expect(arenaCopy().exitStop).toMatch(/throttle/i);
  });
});
