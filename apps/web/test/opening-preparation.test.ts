import { describe, expect, it } from 'vitest';
import { createOpeningPreparation } from '../src/galaxy/openingPreparation.js';

describe('per-canvas opening preparation', () => {
  it('counts jobs and treats release as idempotent', () => {
    const work = createOpeningPreparation(true);
    const a = work.begin(); const b = work.begin();
    expect(work.size).toBe(2);
    expect(work.revision).toBe(2);
    a('ready'); a('ready');
    expect(work.size).toBe(1);
    b('ready'); expect(work.size).toBe(0);
    work.finish('ready'); expect(work.result).toBe('ready');
  });
  it('distinguishes a failed preparation from a successful one', () => {
    const work = createOpeningPreparation(true);
    work.begin()('failed');
    expect(work.size).toBe(0);
    work.finish('ready'); expect(work.result).toBe('failed');
  });
  it('ignores late completions after timeout without stopping background callers', () => {
    const work = createOpeningPreparation(true);
    const late = work.begin();
    work.finish('timeout'); late('ready');
    expect(work.result).toBe('timeout');
    expect(work.covered).toBe(false);
    expect(work.size).toBe(0);
    work.begin()('ready'); expect(work.result).toBe('timeout');
  });
  it('does not track ordinary preview work or mix canvases', () => {
    const normal = createOpeningPreparation(false);
    const a = createOpeningPreparation(true); const b = createOpeningPreparation(true);
    normal.begin()('ready'); expect(normal.size).toBe(0);
    const done = a.begin(); expect(b.size).toBe(0);
    done('cancelled'); a.finish('ready'); expect(a.result).toBe('ready');
  });
});
