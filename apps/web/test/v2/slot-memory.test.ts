import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readDismissed, rememberDismissed, SLOT_MEMORY_KEY } from '../../src/lib/slotMemory.js';

/**
 * A CLOSED EVENT CARD STAYS CLOSED. Owner, 2026-09-24: "bir kez girdim gördüm ve kapattım,
 * sonra oyunu kapattım ve hemen tekrar girdim — bir daha çıkıyor, bir daha çıkıyor."
 *
 * The context slot kept what the player closed in memory only, so every reload showed
 * the same running event again. An event has its own id, so closing it is "I have seen
 * this one"; a new event is a new card. An attack card is not kept: an attack is still
 * coming after a reload, and the next one is a new card.
 *
 * A CLOSED SUGGESTION STAYS CLOSED FOR GOOD. Owner, 2026-09-25: "küçültmek yerine kapatırsam
 * kapattığım modal bir daha çıkmasın" — folding is "not now", closing is "never again".
 */

const NOW = Date.parse('2026-09-24T12:00:00Z');
const DAY = 24 * 60 * 60_000;

beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('the slot’s memory', () => {
  it('keeps a closed event across a reload', () => {
    rememberDismissed(['event:e-1'], NOW);
    expect(readDismissed(NOW + 60_000)).toEqual(new Set(['event:e-1']));
  });

  it('adds to what it already holds', () => {
    rememberDismissed(['event:e-1'], NOW);
    rememberDismissed(['event:e-2', 'event:e-3'], NOW + 1000);
    expect(readDismissed(NOW + 2000)).toEqual(new Set(['event:e-1', 'event:e-2', 'event:e-3']));
  });

  it('never keeps an attack', () => {
    rememberDismissed(['threat:m-1', 'event:e-1'], NOW);
    expect(readDismissed(NOW)).toEqual(new Set(['event:e-1']));
  });

  it('keeps a closed suggestion for good, long after an event would be forgotten', () => {
    rememberDismissed(['suggestion:undefended'], NOW);
    rememberDismissed(['event:e-1'], NOW + 400 * DAY);
    expect(readDismissed(NOW + 400 * DAY)).toEqual(new Set(['suggestion:undefended', 'event:e-1']));
  });

  it('forgets after three days — no event runs that long, and the list never grows', () => {
    rememberDismissed(['event:old'], NOW);
    rememberDismissed(['event:new'], NOW + 3 * DAY);
    expect(readDismissed(NOW + 3 * DAY + 1)).toEqual(new Set(['event:new']));
  });

  it('reads nothing from a broken or foreign value', () => {
    localStorage.setItem(SLOT_MEMORY_KEY, '{not json');
    expect(readDismissed(NOW)).toEqual(new Set());
    localStorage.setItem(SLOT_MEMORY_KEY, JSON.stringify({ 'event:e-1': 'yesterday', 'event:e-2': NOW }));
    expect(readDismissed(NOW)).toEqual(new Set(['event:e-2']));
  });

  it('works without storage at all: a private window forgets, it never throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(() => { rememberDismissed(['event:e-1'], NOW); }).not.toThrow();
    expect(readDismissed(NOW)).toEqual(new Set());
  });
});
