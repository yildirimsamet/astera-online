import { describe, expect, it } from 'vitest';
import {
  STARTER,
  canAttackVessel,
  openingProgress,
  recoveryUntilAfter,
  vesselPvpOpenAt,
  type VesselStanding,
} from '../src/index.js';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const NOW = 100 * DAY;

const standing = (id: string, over: Partial<VesselStanding> = {}): VesselStanding => ({
  id,
  status: 'ACTIVE',
  progress: { ...openingProgress(), modules: { REFINERY: 1, AEGIS: 1 }, facts: ['FIRST_BATTLE_REPORT'] },
  enlistedAtMs: NOW - DAY,
  pvpOpenAtMs: NOW - HOUR,
  recoveryUntilMs: null,
  ...over,
});

const ask = (over: { attacker?: Partial<VesselStanding>; target?: Partial<VesselStanding>; own?: number[]; raids?: number[]; now?: number } = {}) =>
  canAttackVessel({
    attacker: standing('a', over.attacker),
    target: standing('t', over.target),
    nowMs: over.now ?? NOW,
    attacksByAttackerOnTargetMs: over.own ?? [],
    successfulRaidsOnTargetMs: over.raids ?? [],
  });

describe('who may attack whom', () => {
  it('allows two open ships', () => {
    expect(ask()).toEqual({ ok: true, dropsOwnShield: false });
  });

  it('refuses before the first battle report', () => {
    expect(ask({ attacker: { progress: { ...openingProgress(), modules: { AEGIS: 1 } } } })).toEqual({ ok: false, code: 'FEATURE_LOCKED' });
  });

  it('refuses a ship with no Aegis', () => {
    expect(ask({ target: { progress: openingProgress(), pvpOpenAtMs: null } })).toEqual({ ok: false, code: 'PVP_PROTECTED' });
  });

  it('refuses a ship inside its shield, and allows it the moment the shield ends', () => {
    expect(ask({ target: { pvpOpenAtMs: NOW + 1 } })).toEqual({ ok: false, code: 'PVP_PROTECTED' });
    expect(ask({ target: { pvpOpenAtMs: NOW } }).ok).toBe(true);
  });

  it('refuses a ship inside its recovery shield', () => {
    expect(ask({ target: { recoveryUntilMs: NOW + HOUR } })).toEqual({ ok: false, code: 'PVP_PROTECTED' });
    expect(ask({ target: { recoveryUntilMs: NOW } }).ok).toBe(true);
  });

  it('refuses a ship that is gone', () => {
    for (const status of ['DORMANT', 'DEPARTING', 'DEPARTED'] as const) {
      expect(ask({ target: { status } })).toEqual({ ok: false, code: 'TARGET_GONE' });
    }
  });

  it('refuses a ship attacking itself', () => {
    expect(canAttackVessel({
      attacker: standing('a'), target: standing('a'), nowMs: NOW, attacksByAttackerOnTargetMs: [], successfulRaidsOnTargetMs: [],
    })).toEqual({ ok: false, code: 'TARGET_GONE' });
  });
});

describe('the attacker\'s own shield', () => {
  it('asks for confirmation when attacking would drop it', () => {
    expect(ask({ attacker: { pvpOpenAtMs: NOW + HOUR } })).toEqual({ ok: true, dropsOwnShield: true });
  });

  it('counts a recovery shield too', () => {
    expect(ask({ attacker: { recoveryUntilMs: NOW + HOUR } })).toEqual({ ok: true, dropsOwnShield: true });
  });
});

describe('the limit on staying aboard', () => {
  it('stops a ship ready to jump from attacking players', () => {
    expect(ask({ attacker: { progress: { ...openingProgress(), modules: { AEGIS: 1 }, facts: ['FIRST_BATTLE_REPORT'], fuel: STARTER.fuelForJump } } }))
      .toEqual({ ok: false, code: 'PVP_LOCKED' });
  });

  it('stops a ship past its fourteenth day, not before', () => {
    const days = STARTER.pvp.lockAfterDays;
    expect(ask({ attacker: { enlistedAtMs: NOW - days * DAY } })).toEqual({ ok: false, code: 'PVP_LOCKED' });
    expect(ask({ attacker: { enlistedAtMs: NOW - days * DAY + 1 } }).ok).toBe(true);
  });

  it('leaves a locked ship a valid target', () => {
    expect(ask({ target: { enlistedAtMs: NOW - 30 * DAY } }).ok).toBe(true);
  });
});

describe('the limits on repeat attacks', () => {
  const window = STARTER.pvp.bashWindowMinutes * 60_000;

  it('allows the same attacker two attacks inside the window', () => {
    expect(ask({ own: [NOW - HOUR] }).ok).toBe(true);
    expect(ask({ own: [NOW - HOUR, NOW - 2 * HOUR] })).toEqual({ ok: false, code: 'BASH_LIMIT' });
  });

  it('forgets an attack once it leaves the window', () => {
    expect(ask({ own: [NOW - HOUR, NOW - window] }).ok).toBe(true);
    expect(ask({ own: [NOW - HOUR, NOW - window + 1] })).toEqual({ ok: false, code: 'BASH_LIMIT' });
  });

  it('stops all attackers after three successful raids in a day', () => {
    expect(ask({ raids: [NOW - HOUR, NOW - 2 * HOUR] }).ok).toBe(true);
    expect(ask({ raids: [NOW - HOUR, NOW - 2 * HOUR, NOW - 3 * HOUR] })).toEqual({ ok: false, code: 'RAID_CAP' });
  });

  it('forgets a raid after a day', () => {
    expect(ask({ raids: [NOW - HOUR, NOW - 2 * HOUR, NOW - DAY] }).ok).toBe(true);
  });
});

describe('shields handed out', () => {
  it('gives twelve hours after the Aegis is repaired', () => {
    expect(vesselPvpOpenAt(NOW)).toBe(NOW + 12 * HOUR);
  });

  it('gives three hours after a decisive defeat, and nothing otherwise', () => {
    expect(recoveryUntilAfter('DECISIVE', NOW)).toBe(NOW + 3 * HOUR);
    expect(recoveryUntilAfter('PARTIAL', NOW)).toBeNull();
    expect(recoveryUntilAfter('REPELLED', NOW)).toBeNull();
  });
});
