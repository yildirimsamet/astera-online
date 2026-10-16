import { expect, it } from 'vitest';
import { transferEventDisposition } from '../src/services/transferReferences.js';

it('requires a physical bomb and its interception to finish before a commander transfer', () => {
  for (const kind of ['radiation_bomb_arrival', 'radiation_bomb_intercept', 'radiation_bomb_intercept_impact']) {
    expect(transferEventDisposition(kind, 'pending', 200, 100)).toBe('DEFER');
    expect(transferEventDisposition(kind, 'processing', 90, 100)).toBe('DEFER');
    expect(transferEventDisposition(kind, 'done', 90, 100)).toBe('KEEP');
  }
});

it('keeps the planet radiation clock with its physical world', () => {
  expect(transferEventDisposition('planet_radiation_boundary', 'pending', 200, 100)).toBe('KEEP');
  expect(transferEventDisposition('planet_radiation_boundary', 'processing', 90, 100)).toBe('KEEP');
});
