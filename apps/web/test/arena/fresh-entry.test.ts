import { describe, expect, it, vi } from 'vitest';
import { arenaDoor, takeArenaDoor } from '../../src/arena/freshEntry.js';

const memory = (patch: Partial<Pick<Storage, 'getItem' | 'setItem'>> = {}): Storage => {
  const map = new Map<string, string>();
  return { getItem: k => map.get(k) ?? null, setItem: (k, v) => { map.set(k, v); }, removeItem: k => { map.delete(k); }, clear: () => { map.clear(); }, key: () => null, get length() { return map.size; }, ...patch };
};

/**
 * S22, 2026-10-26: a 32-bit Chrome. With the galaxy torn down in the same page the Yarık's load
 * still died (termination status OOM): what the galaxy took is not given back to that renderer
 * in time. A page loaded afresh is. A renderer without room goes in and out of the Yarık through
 * a reload; one with room keeps today's way, in the page.
 */
describe('the way into the Yarık and back', () => {
  it('goes in the page when the renderer has room', () => {
    const reload = vi.fn(); const storage = memory();
    expect(arenaDoor('enter', { roomy: true, storage, reload })).toBe('page');
    expect(reload).not.toHaveBeenCalled();
    expect(takeArenaDoor(storage)).toBeNull();
  });

  it('goes in through a fresh page without room, and the fresh page opens the Yarık once', () => {
    const reload = vi.fn(); const storage = memory();
    expect(arenaDoor('enter', { roomy: false, storage, reload })).toBe('reload');
    expect(reload).toHaveBeenCalledOnce();
    expect(takeArenaDoor(storage)).toBe('enter');
    expect(takeArenaDoor(storage)).toBeNull();
  });

  it('comes back to the hangar through a fresh page too', () => {
    const reload = vi.fn(); const storage = memory();
    expect(arenaDoor('leave', { roomy: false, storage, reload })).toBe('reload');
    expect(takeArenaDoor(storage)).toBe('leave');
  });

  it('keeps the page when the storage cannot hold the note (a private window): a reload would lose the way', () => {
    const reload = vi.fn();
    const broken = memory({ setItem: () => { throw new Error('QuotaExceededError'); } });
    expect(arenaDoor('enter', { roomy: false, storage: broken, reload })).toBe('page');
    expect(reload).not.toHaveBeenCalled();
    expect(takeArenaDoor(memory({ getItem: () => { throw new Error('denied'); } }))).toBeNull();
  });
});
