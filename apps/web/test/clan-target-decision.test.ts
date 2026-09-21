import { describe, expect, it } from 'vitest';
import { clanTargetDecision } from '../src/lib/clanTarget.js';

describe('Galaxy Focus joint target action', () => {
  const base = { leader: true, available: true, realForeignPlayer: true,
    sameClan: false, operationOpen: false,
    seasonEndsAt: new Date('2026-09-22T12:00:00Z'),
    now: new Date('2026-09-20T12:00:00Z').getTime() };

  it('shows the action for a discovered foreign player world and blocks an open operation', () => {
    expect(clanTargetDecision(base)).toEqual({ visible: true, reason: null });
    expect(clanTargetDecision({ ...base, operationOpen: true }))
      .toEqual({ visible: true, reason: 'targetOpen' });
  });

  it('refuses the final 24 hours and hides the action on neutral, allied or old ruleset worlds', () => {
    expect(clanTargetDecision({ ...base, seasonEndsAt: new Date('2026-09-21T11:00:00Z') }))
      .toEqual({ visible: true, reason: 'seasonTooShort' });
    expect(clanTargetDecision({ ...base, realForeignPlayer: false }).visible).toBe(false);
    expect(clanTargetDecision({ ...base, sameClan: true }).visible).toBe(false);
    expect(clanTargetDecision({ ...base, available: false }).visible).toBe(false);
    expect(clanTargetDecision({ ...base, leader: false }).visible).toBe(false);
  });
});
