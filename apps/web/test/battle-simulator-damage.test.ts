import { describe, expect, it } from 'vitest';
import { damageLabel } from '../src/battle-simulator/presentation.js';

describe('damage badges', () => {
  it('never rounds positive damage into a zero badge', () => {
    expect(damageLabel(.0247672724, 'en')).toBe('−<0.1');
    expect(damageLabel(.0000001, 'tr')).toBe('−<0,1');
    expect(damageLabel(50.24, 'en')).toBe('−50.2');
    expect(damageLabel(0, 'en')).toBe('');
  });
});
