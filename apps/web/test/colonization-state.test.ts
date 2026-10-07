import { describe, expect, it } from 'vitest';
import { colonizationPhase, priorityWaitMinutes } from '../src/lib/colonization.js';
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

/**
 * THE RAIDER'S FIRST HOUR. Owner decision, 2026-10-07: only the commander whose raid opened
 * a claim may land in its first sixty minutes. Everyone else may LEAVE early — what they
 * need is the number: how long until a launch would land as the hour ends.
 */
describe('how long the raider\'s hour keeps a commander waiting', () => {
  const race = (over: Partial<GalaxyPlanet> = {}) => world({
    neutral: {
      claimUntil: new Date(NOW + 80 * 60_000),
      claimPriorityUntil: new Date(NOW + 40 * 60_000),
    },
    ...over,
  });

  it('is the time until a launch would land as the hour ends', () => {
    expect(priorityWaitMinutes(race(), NOW, 10)).toBe(30);
    expect(priorityWaitMinutes(race(), NOW, 39.5)).toBe(0.5);
  });

  it('keeps nobody waiting whose flight outlasts the hour', () => {
    expect(priorityWaitMinutes(race(), NOW, 40)).toBe(0);
    expect(priorityWaitMinutes(race(), NOW, 55)).toBe(0);
  });

  it('never holds back the raider, and nobody once the hour is over or when there is none', () => {
    expect(priorityWaitMinutes(race({ claimPriorityMine: true }), NOW, 10)).toBe(0);
    expect(priorityWaitMinutes(race(), NOW + 40 * 60_000, 10)).toBe(0);
    expect(priorityWaitMinutes(world({ neutral: { claimUntil: new Date(NOW + 80 * 60_000) } }), NOW, 10)).toBe(0);
    expect(priorityWaitMinutes(world({
      neutral: { claimUntil: new Date(NOW + 80 * 60_000), claimPriorityUntil: null },
    }), NOW, 10)).toBe(0);
  });
});
