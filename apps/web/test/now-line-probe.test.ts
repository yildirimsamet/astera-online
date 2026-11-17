import { beforeEach, describe, expect, it } from 'vitest';
import type { PendingThread } from '../src/api/schemas.js';
import i18n from '../src/i18n/index.js';
import { describeNow } from '../src/lib/nowLine.js';

/**
 * A PROBE CARRIES NO SHIPS (owner 2026-11-17: "Sonda bildiriminde 0 araç yazıyor. Madem hiç
 * yazmasın"). Its thread comes with an empty fleet, so the Now line said "0 craft" under it; a count
 * of nothing is no line at all.
 */
const thread = (over: Partial<PendingThread> = {}): PendingThread => ({
  id: 'mission', kind: 'probe', targetName: 'T2-02', minutesRemaining: 2,
  arriveAt: new Date(Date.now() + 120_000), leg: 'outbound', fleet: {}, recallable: false, ...over,
});

beforeEach(async () => { await i18n.changeLanguage('tr'); });

describe('the Now line under a flight', () => {
  it('says nothing about craft for a probe with an empty fleet', () => {
    expect(describeNow({ tier: 3, kind: 'flight', at: 0, thread: thread() }).detail).toBeNull();
  });

  it('still counts the ships of a fleet', () => {
    expect(describeNow({ tier: 3, kind: 'flight', at: 0, thread: thread({ kind: 'fleet', fleet: { DART: 4 } }) }).detail)
      .toBe('4 araç');
  });
});
