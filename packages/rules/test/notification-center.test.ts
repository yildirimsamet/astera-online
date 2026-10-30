import { describe, expect, it } from 'vitest';
import {
  ALERT_TIMINGS, NOTIFICATION_CENTER, alertPrice, alertSendAt, centerReading, centerStatus,
} from '../src/notificationCenter.js';

/** Owner 2026-10-30: docs/bildirim-merkezi-plani-2026-10-30.md, decision 2. */
describe('Bildirim Merkezi prices', () => {
  it('charges the floor while the commander makes little or no deuterium', () => {
    expect(ALERT_TIMINGS.map(t => alertPrice('incoming_attack', t, 0))).toEqual([20, 30, 60, 100]);
    expect(ALERT_TIMINGS.map(t => alertPrice('incoming_attack', t, 5))).toEqual([20, 30, 60, 100]);
    expect(alertPrice('probe_detected', 'NOW', 0)).toBe(20);
  });

  it('scales with hours of the commander\'s whole deuterium output, rounded up', () => {
    // 30.2/h ≈ Deuterium Plant 10.
    expect(ALERT_TIMINGS.map(t => alertPrice('incoming_attack', t, 30.2))).toEqual([31, 46, 91, 151]);
    expect(alertPrice('probe_detected', 'NOW', 30.2)).toBe(31);
  });

  it('prices a strategic weapon at half again an attack, floor included', () => {
    expect(ALERT_TIMINGS.map(t => alertPrice('incoming_strategic', t, 0))).toEqual([30, 45, 90, 150]);
    expect(alertPrice('incoming_strategic', 'T5', 30.2)).toBe(68);
  });

  it('earlier warning always costs more', () => {
    for (const rate of [0, 7.1, 13.1, 30.2, 500]) {
      const prices = ALERT_TIMINGS.map(t => alertPrice('incoming_attack', t, rate));
      expect([...prices].sort((a, b) => a - b)).toEqual(prices);
    }
  });

  it('refuses a timing the kind does not have and a nonsense rate', () => {
    expect(() => alertPrice('probe_detected', 'T5', 10)).toThrow();
    expect(() => alertPrice('incoming_attack', 'NOW', 10)).toThrow();
    expect(() => alertPrice('incoming_attack', 'T5', -1)).toThrow();
    expect(() => alertPrice('incoming_attack', 'T5', Number.NaN)).toThrow();
  });

  it('is built once for the price of a Radar 2', () => {
    expect(NOTIFICATION_CENTER.buildCost).toEqual({ alloy: 1510, crystal: 1133, deuterium: 0 });
  });
});

describe('Bildirim Merkezi send moment', () => {
  const arrive = Date.parse('2026-11-01T12:00:00Z');
  const at = (minutesBefore: number) => arrive - minutesBefore * 60_000;

  it('sends the chosen minutes before landing once the radar has the fleet', () => {
    const seen = at(40);
    expect(alertSendAt('T3', arrive, seen)).toBe(at(3));
    expect(alertSendAt('T5', arrive, seen)).toBe(at(5));
    expect(alertSendAt('T15', arrive, seen)).toBe(at(15));
    expect(alertSendAt('RADAR', arrive, seen)).toBe(seen);
  });

  it('waits for the radar when it sees the fleet later than the chosen moment', () => {
    expect(alertSendAt('T15', arrive, at(9))).toBe(at(9));
  });

  it('sends nothing the radar never sees, or sees only on landing', () => {
    for (const timing of ALERT_TIMINGS) {
      expect(alertSendAt(timing, arrive, null)).toBeNull();
      expect(alertSendAt(timing, arrive, arrive)).toBeNull();
    }
  });
});

describe('Bildirim Merkezi under a probe (decision 8)', () => {
  it('ladders the wallet by how many of the cheapest alert it buys', () => {
    expect(centerStatus(false, 9999, 20)).toBe('NONE');
    expect(centerStatus(true, 19, 20)).toBe('EMPTY');
    expect(centerStatus(true, 20, 20)).toBe('FEW');
    expect(centerStatus(true, 79, 20)).toBe('FEW');
    expect(centerStatus(true, 80, 20)).toBe('PLENTY');
  });

  const seq = (...values: number[]) => { let i = 0; return () => values[i++] ?? 0; };

  it('reads the truth when the misread roll passes', () => {
    // Accuracy 0.55 misreads below (1 - 0.55) / 2 = 0.225.
    expect(centerReading('FEW', 0.55, seq(0.3))).toBe('FEW');
  });

  it('a misread is either unknown or one rung off, never out of the ladder', () => {
    expect(centerReading('FEW', 0.55, seq(0.1, 0.2))).toBe('UNKNOWN');
    expect(centerReading('FEW', 0.55, seq(0.1, 0.8, 0.2))).toBe('EMPTY');
    expect(centerReading('FEW', 0.55, seq(0.1, 0.8, 0.8))).toBe('PLENTY');
    expect(centerReading('NONE', 0.55, seq(0.1, 0.8, 0.2))).toBe('EMPTY');
    expect(centerReading('PLENTY', 0.55, seq(0.1, 0.8, 0.8))).toBe('FEW');
  });

  it('a better probe misreads less often', () => {
    const rate = (accuracy: number) => {
      let wrong = 0; let s = 1;
      const rng = () => { s = (s * 48271) % 2147483647; return s / 2147483647; };
      for (let i = 0; i < 4000; i++) if (centerReading('FEW', accuracy, rng) !== 'FEW') wrong++;
      return wrong / 4000;
    };
    expect(rate(0.9)).toBeLessThan(rate(0.55));
    expect(rate(0.55)).toBeGreaterThan(0.18);
    expect(rate(0.55)).toBeLessThan(0.27);
  });
});
