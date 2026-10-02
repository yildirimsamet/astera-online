import { describe, expect, it } from 'vitest';
import { flightTitle } from '../src/lib/flights.js';
import type { PendingThread } from '../src/api/schemas.js';

/** KLAN SAVUNMA DESTEĞİ: a support flight is named for what it is on the strip (P12). */
describe('a clan support flight on the pending strip', () => {
  const thread = (leg: 'outbound' | 'return'): PendingThread => ({
    id: 'm1', kind: 'transfer', clanSupport: true, targetName: 'Vega', minutesRemaining: 9,
    arriveAt: new Date(), leg,
  });

  it('reads as support flying to the clanmate, and as support coming home', () => {
    expect(flightTitle(thread('outbound'))).toMatch(/clan support → Vega/i);
    expect(flightTitle(thread('return'))).toMatch(/support home from Vega/i);
  });
});
