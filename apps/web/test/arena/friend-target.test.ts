import { describe, expect, it } from 'vitest';
import { createPilot } from '@astera/rules/arena';
import { friendTarget } from '../../src/arena/marks.js';

describe('tap a friend after arming support', () => {
  it('picks the closest living real clanmate and ignores a nearer rival or illusion', () => {
    const self = createPilot(1); self.clanId = 'a';
    const ally = createPilot(2); ally.clanId = 'a';
    const rival = createPilot(3); const copy = createPilot(4); copy.clanId = 'a'; copy.decoyOf = 2;
    expect(friendTarget(self, [{ pilot: rival, x: 100, y: 100, behind: false }, { pilot: copy, x: 100, y: 100, behind: false },
      { pilot: ally, x: 120, y: 100, behind: false }], 100, 100)).toBe(2);
    ally.phase = 'dead';
    expect(friendTarget(self, [{ pilot: ally, x: 100, y: 100, behind: false }], 100, 100)).toBeNull();
  });
  it('never selects a ship behind the camera or beyond the touch area', () => {
    const self = createPilot(1); self.clanId = 'a'; const ally = createPilot(2); ally.clanId = 'a';
    expect(friendTarget(self, [{ pilot: ally, x: 100, y: 100, behind: true }], 100, 100)).toBeNull();
    expect(friendTarget(self, [{ pilot: ally, x: 160, y: 100, behind: false }], 100, 100)).toBeNull();
  });
});
