import { describe, expect, it } from 'vitest';
import { buildShare } from '../src/lib/strategic.js';

/**
 * HOW FAR A STRATEGIC BUILD HAS COME. `readyAt` is the live clock; `remainingSeconds`
 * is frozen at the full duration by the server, so halfway through a build must read
 * halfway rather than two percent.
 */
describe('the share of a strategic build done', () => {
  const now = Date.parse('2026-09-24T12:00:00Z');

  it('reads the live clock when there is one', () => {
    const asset = { status: 'BUILDING' as const, readyAt: new Date(now + 30 * 60_000), remainingSeconds: 60 * 60 };
    expect(buildShare(asset, 60, now)).toBe(50);
  });

  it('falls back to the stored remainder without a clock', () => {
    const asset = { status: 'PAUSED' as const, readyAt: null, remainingSeconds: 15 * 60 };
    expect(buildShare(asset, 60, now)).toBe(75);
  });

  it('stays between empty and full', () => {
    expect(buildShare({ status: 'BUILDING' as const, readyAt: new Date(now - 60_000), remainingSeconds: 0 }, 60, now)).toBe(100);
    expect(buildShare({ status: 'BUILDING' as const, readyAt: new Date(now + 120 * 60_000), remainingSeconds: 0 }, 60, now)).toBe(0);
  });

  it('is full for a ready charge', () => {
    expect(buildShare({ status: 'READY' as const, readyAt: null, remainingSeconds: 0 }, 60, now)).toBe(100);
  });
});
