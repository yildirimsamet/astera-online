import { describe, expect, it } from 'vitest';
import { fuelAlarm } from '../../src/arena/audio.js';

/** CR7: the low-fuel alarm re-armed under 15 fuel, while "low" starts higher, so it restarted every frame. */
describe('the low-fuel alarm', () => {
  it('sounds once on the way down, then every 20 s while the tank stays low', () => {
    let at = fuelAlarm(false, 1_000, Number.NEGATIVE_INFINITY);
    expect(at).toEqual({ play: false, warnAt: Number.NEGATIVE_INFINITY });
    // The first warning does not wait for the page to be 20 s old.
    at = fuelAlarm(true, 1_000, at.warnAt);
    expect(at).toEqual({ play: true, warnAt: 1_000 });
    const plays = [1_016, 1_032, 1_048, 10_000, 20_999].map(now => (at = fuelAlarm(true, now, at.warnAt)).play);
    expect(plays).toEqual([false, false, false, false, false]);
    expect(fuelAlarm(true, 21_001, at.warnAt)).toEqual({ play: true, warnAt: 21_001 });
  });

  it('re-arms only once the tank is out of the low band', () => {
    const warned = fuelAlarm(true, 5_000, Number.NEGATIVE_INFINITY);
    const refuelled = fuelAlarm(false, 6_000, warned.warnAt);
    expect(refuelled.play).toBe(false);
    expect(fuelAlarm(true, 6_100, refuelled.warnAt).play).toBe(true);
  });
});
