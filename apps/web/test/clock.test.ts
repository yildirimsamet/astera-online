import { afterEach, describe, expect, it } from 'vitest';
import { clockOffset, noteServerTime, resetClock, serverNow, toServerTime } from '../src/lib/clock.js';

/**
 * THE GALAXY RUNS ON THE SERVER'S CLOCK, NOT THE PHONE'S.
 *
 * Every craft, every rock and every countdown on the disc is drawn by comparing a
 * server timestamp against "now". When "now" was `Date.now()`, a device whose clock
 * had drifted drew every fleet at the wrong point of its leg, every asteroid at the
 * wrong point of its orbit and every countdown at the wrong number — silently, with
 * nothing to error on, and differently for every player in the same galaxy.
 */
describe('the server clock', () => {
  afterEach(() => {
    resetClock();
  });

  const iso = (ms: number) => new Date(ms).toUTCString();
  /** The millisecond stamp the server sends on every answer. */
  const stamp = (ms: number) => String(ms);

  it('is the device clock until anything has been measured', () => {
    expect(clockOffset()).toBe(0);
    expect(Math.abs(serverNow() - Date.now())).toBeLessThan(50);
  });

  /** A device running two minutes slow must not draw a galaxy two minutes behind. */
  it('takes the first sample whole, so a drifted phone is right immediately', () => {
    const sent = Date.now();
    noteServerTime(stamp(sent + 120_000), null, sent, sent + 40);
    // 120s ahead, less the half round trip that biased the sample.
    expect(clockOffset()).toBeGreaterThan(119_000);
    expect(serverNow() - Date.now()).toBeGreaterThan(119_000);
  });

  /**
   * The offset is a property of two clocks, which drift by milliseconds an hour.
   * Snapping to every sample would step every craft in the galaxy sideways mid-frame
   * whenever one response happened to be measured badly.
   */
  it('smooths later samples rather than snapping to them', () => {
    const sent = Date.now();
    noteServerTime(stamp(sent + 10_000), null, sent, sent + 20);
    const first = clockOffset();
    noteServerTime(stamp(sent + 20_000), null, sent, sent + 20);
    const second = clockOffset();
    expect(second).toBeGreaterThan(first);
    expect(second).toBeLessThan(20_000);
  });

  /** A slow response says more about the network than about the clock. */
  it('discards a sample from a slow round trip', () => {
    const sent = Date.now();
    noteServerTime(stamp(sent + 5_000), null, sent, sent + 20);
    const good = clockOffset();
    noteServerTime(stamp(sent + 90_000), null, sent, sent + 9_000);
    expect(clockOffset()).toBe(good);
  });

  it('takes half the round trip back off the sample', () => {
    const sent = Date.now();
    // Stamped exactly when the request left, and the answer took a second: the
    // server is half a round trip behind the midpoint, so −500ms, not −1000.
    noteServerTime(stamp(sent), null, sent, sent + 1_000);
    expect(clockOffset()).toBeCloseTo(-500, 0);
  });

  /**
   * `Date` is the fallback, and it truncates to the second — up to a second EARLY
   * and never late, which is a bias no amount of smoothing removes. Half a second
   * back is the mean of that truncation, and it is why the server also sends
   * `x-server-time`: a second is a tenth of the engagement window.
   */
  it('corrects the second-resolution bias of the Date fallback', () => {
    const onTheSecond = Math.ceil(Date.now() / 1000) * 1000;
    // Worst case: the stamp is written 999ms after the second it reports.
    const sent = onTheSecond + 999;
    noteServerTime(null, iso(sent), sent, sent + 20);
    // Read literally this would be −999ms out. Corrected, under half a second.
    expect(Math.abs(clockOffset())).toBeLessThan(510);
  });

  it('prefers the millisecond stamp over the Date header', () => {
    const sent = Date.now();
    noteServerTime(stamp(sent + 30_000), iso(sent), sent, sent + 20);
    expect(clockOffset()).toBeGreaterThan(29_000);
  });

  it('ignores a missing or unparseable header rather than poisoning the estimate', () => {
    const sent = Date.now();
    noteServerTime(stamp(sent + 7_000), null, sent, sent + 20);
    const good = clockOffset();
    noteServerTime(null, null, sent, sent + 20);
    noteServerTime('not a number', 'not a date', sent, sent + 20);
    expect(clockOffset()).toBe(good);
  });

  /** A clock that went backwards between the two reads is not a measurement. */
  it('ignores a negative round trip', () => {
    const sent = Date.now();
    noteServerTime(stamp(sent), null, sent, sent - 5_000);
    expect(clockOffset()).toBe(0);
  });
});

/**
 * THE ONE TIMESTAMP THAT IS BORN ON THE DEVICE.
 *
 * React Query's `dataUpdatedAt` records when a fetch landed and can only be
 * measured locally. Comparing it against `serverNow()` subtracts two epochs, and
 * the difference carries the whole offset — `useProjected` did exactly that and
 * jumped the works forward by the offset the instant every fetch landed.
 */
describe('moving a device instant onto the server epoch', () => {
  afterEach(() => {
    resetClock();
  });

  it('leaves it alone while the two clocks agree', () => {
    const at = Date.now();
    expect(toServerTime(at)).toBe(at);
  });

  it('carries the offset, so a span measured against serverNow is real elapsed time', () => {
    resetClock(120_000);
    const fetchedAt = Date.now() - 60_000;
    const elapsed = serverNow() - toServerTime(fetchedAt);
    // A minute really passed. Without the conversion this reads three.
    expect(elapsed).toBeGreaterThan(59_000);
    expect(elapsed).toBeLessThan(61_000);
  });

  it('never lets a fetch that just landed read as time already spent', () => {
    resetClock(-90_000);
    const elapsed = serverNow() - toServerTime(Date.now());
    expect(Math.abs(elapsed)).toBeLessThan(50);
  });
});
