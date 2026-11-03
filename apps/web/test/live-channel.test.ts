import { afterEach, describe, expect, it } from 'vitest';
import { CALM_NET_MS, NET_MS, safetyNetMs, setChannelLive } from '../src/api/liveChannel.js';

/**
 * THE SAFETY NET IS FOR A DEAD CHANNEL. Query plan, 2026-11-03.
 *
 * About one production request in eight was a read repeating itself a minute later,
 * though the stream it guards was up and had already told the client everything. A
 * live channel keeps a slower net for a missed edge; a dead one keeps the old minute.
 */
afterEach(() => { setChannelLive(false); });

describe('safetyNetMs', () => {
  it('reads every minute while nothing says the channel is up', () => {
    expect(safetyNetMs()).toBe(NET_MS);
    expect(NET_MS).toBe(60_000);
  });

  it('reads far less often on a live channel', () => {
    setChannelLive(true);
    expect(safetyNetMs()).toBe(CALM_NET_MS);
    expect(CALM_NET_MS).toBeGreaterThanOrEqual(150_000);
    expect(CALM_NET_MS).toBeLessThanOrEqual(210_000);
  });

  it('goes back to the minute when the channel drops', () => {
    setChannelLive(true);
    setChannelLive(false);
    expect(safetyNetMs()).toBe(NET_MS);
  });

  it('gives one answer per state, because a changing interval would restart the timer on every render', () => {
    setChannelLive(true);
    expect(new Set(Array.from({ length: 50 }, () => safetyNetMs())).size).toBe(1);
  });
});
