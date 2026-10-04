import { describe, expect, it } from 'vitest';
import { transferEventDisposition } from '../src/services/transferReferences.js';

describe('monument events during commander transfer', () => {
  it('keeps a public target’s HOLD loss timer with its monument regardless of the account handover', () => {
    expect(transferEventDisposition('monument_loss', 'pending', 200, 100)).toBe('KEEP');
    expect(transferEventDisposition('monument_loss', 'processing', 90, 100)).toBe('KEEP');
  });
  it('keeps the neutral respawn clock with its target', () => {
    expect(transferEventDisposition('monument_respawn', 'pending', 200, 100)).toBe('KEEP');
    expect(transferEventDisposition('monument_respawn', 'failed', 90, 100)).toBe('KEEP');
  });
  it('requires a physical wave’s arrival to finish before a handover proceeds', () => {
    expect(transferEventDisposition('monument_arrival', 'pending', 200, 100)).toBe('DEFER');
    expect(transferEventDisposition('monument_arrival', 'processing', 90, 100)).toBe('DEFER');
    expect(transferEventDisposition('monument_arrival', 'done', 90, 100)).toBe('KEEP');
  });
});
