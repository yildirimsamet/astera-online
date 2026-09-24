import { describe, expect, it } from 'vitest';
import { COUNTERS, counteredBy } from '@astera/rules';
import { lossReason, sentAndLeft } from '../src/lib/reportScene.js';

/**
 * THE REPORT SCENE'S TWO READINGS. Spec B15 (docs/ui-v2/gozlemevi.md).
 *
 * "Tek cümle 'neden' (sınıf verisinden)": the one-line why comes off the class data —
 * which class the reader lost most of, what is strong against it, and what is strong
 * against THAT. It states the counter cycle, never a claim about the other side's
 * fleet, which the report does not have (rule 15).
 */
describe('why the reader lost what they lost', () => {
  it('names the class lost most, what beats it, and what beats that', () => {
    // Darts are Skirmishers; lose more of them than of anything else.
    const reason = lossReason({ DART: 9, TALON: 1 });
    expect(reason).not.toBeNull();
    expect(reason!.lost).toBe('SKIRMISHER');
    expect(reason!.by).toBe(counteredBy('SKIRMISHER'));
    expect(reason!.bring).toBe(counteredBy(reason!.by));
    // The cycle closes: what to bring counters what beat you.
    expect(COUNTERS[reason!.bring]).toBe(reason!.by);
  });

  it('has nothing to say when nothing that fights was lost', () => {
    expect(lossReason({})).toBeNull();
    expect(lossReason({ COURIER: 3 })).toBeNull();
  });
});

describe('a side, sent and left', () => {
  it('pairs every hull sent with what came back, in the roster order', () => {
    expect(sentAndLeft({ DART: 23, COURIER: 3 }, { DART: 9 })).toEqual([
      { hull: 'DART', sent: 23, lost: 9, left: 14 },
      { hull: 'COURIER', sent: 3, lost: 0, left: 3 },
    ]);
  });

  it('never counts a loss beyond what was sent', () => {
    expect(sentAndLeft({ DART: 2 }, { DART: 5 })).toEqual([{ hull: 'DART', sent: 2, lost: 2, left: 0 }]);
  });
});
