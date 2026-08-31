import { describe, expect, it } from 'vitest';
import { colonizationPhase } from '../src/lib/colonization.js';
import type { GalaxyPlanet } from '../src/api/schemas.js';

const NOW = new Date('2026-08-31T12:00:00.000Z').getTime();

const world = (over: Partial<GalaxyPlanet> = {}): GalaxyPlanet => ({
  id: 'target-1',
  name: 'Haven',
  owner: 'Neutral T1',
  position: { x: 200, y: 0, z: 0 },
  coreTier: 1,
  coreLevel: 2,
  intel: 'RESOLVED',
  kind: 'NEUTRAL',
  controller: { kind: 'NEUTRAL', tier: 1 },
  state: { kind: 'NORMAL' },
  satellites: [],
  shielded: false,
  isSelf: false,
  neutral: {
    tier: 1,
    threat: 'UNGUARDED',
    reserve: 'LOW',
    claimUntil: null,
    nextReinforcementAt: null,
  },
  ...over,
});

describe('colonization phase', () => {
  it('treats a public colony race as actionable even when the world is unsurveyed', () => {
    expect(colonizationPhase(world({
      intel: 'UNKNOWN',
      name: '',
      owner: '',
      kind: undefined,
      controller: undefined,
      neutral: { claimUntil: new Date(NOW + 20 * 60_000) },
    }), NOW)).toBe('NEUTRAL_RACE');
  });

  it('distinguishes an unclaimed neutral from somebody else’s colony and capital', () => {
    expect(colonizationPhase(world(), NOW)).toBe('NEUTRAL_PREP');
    expect(colonizationPhase(world({
      kind: 'COLONY',
      controller: { kind: 'PLAYER', playerId: 'other', displayName: 'Other' },
      neutral: undefined,
    }), NOW)).toBe('FOREIGN_COLONY');
    expect(colonizationPhase(world({
      kind: 'CAPITAL',
      controller: { kind: 'PLAYER', playerId: 'other', displayName: 'Other' },
      neutral: undefined,
    }), NOW)).toBe('FOREIGN_CAPITAL');
  });

  it('moves a foreign colony to the second-impact phase only during recovery', () => {
    expect(colonizationPhase(world({
      kind: 'COLONY',
      controller: { kind: 'PLAYER', playerId: 'other', displayName: 'Other' },
      neutral: undefined,
      state: { kind: 'RECOVERY', until: new Date(NOW + 30 * 60_000) },
    }), NOW)).toBe('FOREIGN_COLONY_RECOVERY');
  });

  it('shows an outbound settlement as its own phase instead of offering a duplicate launch', () => {
    expect(colonizationPhase(world({
      neutral: {
        tier: 1,
        threat: 'UNGUARDED',
        reserve: 'LOW',
        claimUntil: new Date(NOW + 20 * 60_000),
        nextReinforcementAt: null,
      },
    }), NOW, true)).toBe('SETTLEMENT_IN_FLIGHT');
  });

  it('never presents an unknown, owned or clan world as available to colonize', () => {
    expect(colonizationPhase(world({
      intel: 'UNKNOWN', name: '', owner: '', kind: undefined, controller: undefined,
      neutral: undefined,
    }), NOW)).toBe('UNKNOWN');
    expect(colonizationPhase(world({ isOwned: true, kind: 'COLONY', neutral: undefined }), NOW))
      .toBe('OWNED');
    expect(colonizationPhase(world({ clanmate: true, kind: 'COLONY', neutral: undefined }), NOW))
      .toBe('CLANMATE');
  });
});
