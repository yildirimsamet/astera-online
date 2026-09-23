import { describe, expect, it } from 'vitest';
import type { NotificationView } from '../../src/api/schemas.js';
import { bellState } from '../../src/lib/bell.js';

/**
 * THE BELL'S NUMBER. Spec B1 (docs/ui-v2/gozlemevi.md).
 *
 * It counts news you have not seen — never a standing state such as a full store,
 * which has its own mark on the meter — and only news the sheet can actually say.
 * It pulses only for something urgent.
 */

const NOW = Date.parse('2026-09-23T12:00:00Z');
let serial = 0;
const note = (kind: string, seen = false): NotificationView => {
  serial += 1;
  return { id: `n-${String(serial)}`, kind, payload: {}, seen, at: new Date(NOW - 60_000) };
};

describe('the bell', () => {
  it('counts unseen news only', () => {
    expect(bellState([note('fleet_returned'), note('fleet_returned', true)], NOW)).toEqual({ unseen: 1, urgent: false });
  });

  it('does not count what the sheet cannot say', () => {
    expect(bellState([note('a_kind_from_a_newer_server')], NOW).unseen).toBe(0);
  });

  it('pulses for an unseen attack, and not for one already read', () => {
    expect(bellState([note('incoming_fleet')], NOW).urgent).toBe(true);
    expect(bellState([note('incoming_fleet', true)], NOW).urgent).toBe(false);
  });

  it('is quiet with nothing', () => {
    expect(bellState([], NOW)).toEqual({ unseen: 0, urgent: false });
  });
});
