import { describe, expect, it } from 'vitest';
import { LAB_MOMENTS, labVariant, type LabMoment } from '../../src/dev/lab/moments.js';

const moments = Object.keys(LAB_MOMENTS) as LabMoment[];

describe('vfx lab moments', () => {
  it('every moment opens on a prototype, never on today\'s look', () => {
    for (const moment of moments) {
      const variant = labVariant(moment, null);
      expect(Object.keys(LAB_MOMENTS[moment].variants)).toContain(variant);
      expect(variant).not.toBe('now');
    }
  });

  it('a variant carried over from another moment never sticks', () => {
    // The bug: Death Star on "nuke", switch to the damaged ship, and nothing burns.
    for (const from of moments) {
      for (const variant of Object.keys(LAB_MOMENTS[from].variants)) {
        for (const to of moments) {
          expect(Object.keys(LAB_MOMENTS[to].variants)).toContain(labVariant(to, variant === 'now' ? 'unknown' : variant));
        }
      }
    }
    expect(labVariant('damage', 'nuke')).toBe('repair');
  });

  it('a link that names a variant of that moment keeps it', () => {
    expect(labVariant('damage', 'now')).toBe('now');
    expect(labVariant('warp', 'arrive')).toBe('arrive');
  });
});

describe('vfx lab clock', () => {
  it('continuous effects never restart; one-shot moments replay', async () => {
    const { LAB_MOMENTS: moments } = await import('../../src/dev/lab/moments.js');
    expect(moments.damage.continuous).toBe(true);
    expect(moments.emp.continuous).toBe(true);
    expect(moments.aegis.continuous).toBe(true);
    expect(moments.engines.continuous).toBe(true);
    expect(moments.deathstar.continuous).toBe(false);
    expect(moments.warp.continuous).toBe(false);
    expect(moments.mining.continuous).toBe(false);
    expect(moments.scan.continuous).toBe(false);
    expect(moments.levelup.continuous).toBe(false);
  });
});
