import { describe, expect, it } from 'vitest';
import {
  CAPSULE_CATALOG,
  CAPSULE_IDS,
  SYNTHESIS,
  accrueMoonAsterium,
  capsulesForLaunch,
  missionHidesFromGalaxy,
  missionSuppressesRadarWarning,
  moonAsteriumPerDay,
  requiredCapsules,
  synthesisCancelRefund,
  synthesisCost,
  synthesisDelivered,
  synthesisDurationMs,
  validateMissionCapsules,
} from '../src/index.js';

const HOUR = 3_600_000;
const MIN = 60_000;

describe('capsule catalog (plan §3.5, K13)', () => {
  it('holds the two first capsules with their owner prices and per-capsule minutes', () => {
    expect(CAPSULE_IDS).toEqual(['OPTIC_VEIL', 'SILENT_THRUST']);
    expect(CAPSULE_CATALOG.OPTIC_VEIL.cost).toEqual({ alloy: 2_000, crystal: 3_000, deuterium: 250, asterium: 4 });
    expect(CAPSULE_CATALOG.SILENT_THRUST.cost).toEqual({ alloy: 4_000, crystal: 2_000, deuterium: 350, asterium: 6 });
    expect(CAPSULE_CATALOG.OPTIC_VEIL.craftMinutes).toBe(30);
    expect(CAPSULE_CATALOG.SILENT_THRUST.craftMinutes).toBe(60);
    expect(SYNTHESIS.requiredCore).toBe(10);
    expect(SYNTHESIS.bulkPerCapsule).toBe(500);
  });
});

describe('R1 requiredCapsules: one capsule per 500 bulk of flying ships', () => {
  it('rounds up and counts nothing for an empty fleet', () => {
    expect(requiredCapsules('OPTIC_VEIL', {})).toBe(0);
    // DART bulk 3, PIKE bulk 3, ATLAS bulk 14
    expect(requiredCapsules('OPTIC_VEIL', { DART: 1 })).toBe(1); // 3
    expect(requiredCapsules('OPTIC_VEIL', { ATLAS: 35, DART: 3, PIKE: 3 })).toBe(2); // 490 + 18 = 508
    expect(requiredCapsules('SILENT_THRUST', { ATLAS: 35, DART: 2 })).toBe(1); // 490 + 6 = 496
    expect(requiredCapsules('SILENT_THRUST', { GARBAGE_COLLECTOR: 25 })).toBe(2); // 1000
    expect(requiredCapsules('SILENT_THRUST', { GARBAGE_COLLECTOR: 25, DART: 1 })).toBe(3); // 1003
  });

  it('leaves ground defences out, as the hangar does', () => {
    expect(requiredCapsules('OPTIC_VEIL', { HARPOON: 100 })).toBe(0);
  });
});

describe('R2 validateMissionCapsules', () => {
  it('accepts none, one, or both on a raid and a clan war', () => {
    expect(validateMissionCapsules('attack', [])).toEqual({ ok: true, ids: [] });
    expect(validateMissionCapsules('attack', ['OPTIC_VEIL'])).toEqual({ ok: true, ids: ['OPTIC_VEIL'] });
    expect(validateMissionCapsules('attack', ['SILENT_THRUST', 'OPTIC_VEIL'])).toEqual({ ok: true, ids: ['OPTIC_VEIL', 'SILENT_THRUST'] });
    expect(validateMissionCapsules('clan_war', ['OPTIC_VEIL', 'SILENT_THRUST']).ok).toBe(true);
  });

  it('refuses the same capsule twice', () => {
    expect(validateMissionCapsules('attack', ['OPTIC_VEIL', 'OPTIC_VEIL'])).toEqual({ ok: false, code: 'CAPSULE_DUPLICATE' });
  });

  it('keeps Sessiz İtki off flights that raise no warning anyway', () => {
    expect(validateMissionCapsules('transfer', ['OPTIC_VEIL']).ok).toBe(true);
    expect(validateMissionCapsules('settlement', ['OPTIC_VEIL']).ok).toBe(true);
    expect(validateMissionCapsules('transfer', ['SILENT_THRUST'])).toEqual({ ok: false, code: 'CAPSULE_MISSION_FORBIDDEN' });
    expect(validateMissionCapsules('settlement', ['SILENT_THRUST'])).toEqual({ ok: false, code: 'CAPSULE_MISSION_FORBIDDEN' });
  });

  it('refuses every capsule on probes, Death Stars, returns and clan transfers', () => {
    for (const kind of ['probe', 'death_star', 'return', 'clan_transfer'] as const) {
      for (const id of CAPSULE_IDS) {
        expect(validateMissionCapsules(kind, [id])).toEqual({ ok: false, code: 'CAPSULE_MISSION_FORBIDDEN' });
      }
      expect(validateMissionCapsules(kind, [])).toEqual({ ok: true, ids: [] });
    }
  });
});

describe('capsulesForLaunch', () => {
  it('prices each chosen capsule on the same bulk', () => {
    const fleet = { GARBAGE_COLLECTOR: 25, DART: 1 }; // 1003 bulk
    expect(capsulesForLaunch(['OPTIC_VEIL', 'SILENT_THRUST'], fleet)).toEqual([
      { id: 'OPTIC_VEIL', count: 3 },
      { id: 'SILENT_THRUST', count: 3 },
    ]);
    expect(capsulesForLaunch([], fleet)).toEqual([]);
  });
});

describe('batch synthesis (K6, K13)', () => {
  it('multiplies cost and time by the quantity', () => {
    expect(synthesisCost('OPTIC_VEIL', 3)).toEqual({ alloy: 6_000, crystal: 9_000, deuterium: 750, asterium: 12 });
    expect(synthesisDurationMs('OPTIC_VEIL', 3)).toBe(90 * MIN);
    expect(synthesisDurationMs('SILENT_THRUST', 2)).toBe(2 * HOUR);
  });

  it('refuses a quantity outside 1..maxBatch', () => {
    expect(() => synthesisCost('OPTIC_VEIL', 0)).toThrow();
    expect(() => synthesisCost('OPTIC_VEIL', 1.5)).toThrow();
    expect(() => synthesisCost('OPTIC_VEIL', SYNTHESIS.maxBatch + 1)).toThrow();
    expect(synthesisCost('OPTIC_VEIL', SYNTHESIS.maxBatch).asterium).toBe(4 * SYNTHESIS.maxBatch);
  });

  it('R3b delivers capsules one by one as each finishes, never past the quantity', () => {
    const job = { capsuleId: 'OPTIC_VEIL' as const, quantity: 3, startedAtMs: 0 };
    expect(synthesisDelivered(job, 0)).toBe(0);
    expect(synthesisDelivered(job, 30 * MIN - 1)).toBe(0);
    expect(synthesisDelivered(job, 30 * MIN)).toBe(1);
    expect(synthesisDelivered(job, 89 * MIN)).toBe(2);
    expect(synthesisDelivered(job, 90 * MIN)).toBe(3);
    expect(synthesisDelivered(job, 10 * HOUR)).toBe(3);
    expect(synthesisDelivered(job, -5)).toBe(0);
  });
});

describe('R3 synthesisCancelRefund: half of what the unmade capsules cost', () => {
  it('halves the whole payment when nothing was made, flooring odd amounts', () => {
    expect(synthesisCancelRefund({ alloy: 5, crystal: 4, deuterium: 0, asterium: 7 }, 1, 0))
      .toEqual({ alloy: 2, crystal: 2, deuterium: 0, asterium: 3 });
  });

  it('refunds only the unmade share of a batch', () => {
    // 4 Optik Örtü: 8000 A, 12000 C, 1000 D, 16 Ast; one made → 3/4 unmade → half of that
    expect(synthesisCancelRefund({ alloy: 8_000, crystal: 12_000, deuterium: 1_000, asterium: 16 }, 4, 1))
      .toEqual({ alloy: 3_000, crystal: 4_500, deuterium: 375, asterium: 6 });
  });

  it('refunds nothing once every capsule is made', () => {
    expect(synthesisCancelRefund({ alloy: 8_000, crystal: 12_000, deuterium: 1_000, asterium: 16 }, 4, 4))
      .toEqual({ alloy: 0, crystal: 0, deuterium: 0, asterium: 0 });
  });
});

describe('R4 accrueMoonAsterium: lazy production by rarity', () => {
  // Owner 2026-11-25: halved ("2-3 kolonisi olanlar çok fazla üretebilir"); a commander's four moons make about 7 a day.
  it('rates rise with rarity, at half the first rates', () => {
    expect(moonAsteriumPerDay('COMMON')).toBe(1);
    expect(moonAsteriumPerDay('RARE')).toBe(1.5);
    expect(moonAsteriumPerDay('EPIC')).toBe(2);
    expect(moonAsteriumPerDay('LEGENDARY')).toBe(3);
  });

  it('pays whole units and carries the fraction', () => {
    // COMMON: one per 24 h
    const a = accrueMoonAsterium({ rarity: 'COMMON', syncedAtMs: 0, closedUntilMs: null, fraction: 0, nowMs: 36 * HOUR });
    expect(a.gained).toBe(1);
    expect(a.fraction).toBeCloseTo(0.5, 9);
    expect(a.syncedAtMs).toBe(36 * HOUR);
    const b = accrueMoonAsterium({ rarity: 'COMMON', syncedAtMs: a.syncedAtMs, closedUntilMs: null, fraction: a.fraction, nowMs: 48 * HOUR });
    expect(b.gained).toBe(1);
    expect(b.fraction).toBeCloseTo(0, 9);
  });

  it('is the same whether read once or many times', () => {
    let state = { syncedAtMs: 0, fraction: 0 };
    let total = 0;
    for (let t = 1; t <= 48; t++) {
      const r = accrueMoonAsterium({ rarity: 'LEGENDARY', ...state, closedUntilMs: null, nowMs: t * HOUR });
      total += r.gained; state = { syncedAtMs: r.syncedAtMs, fraction: r.fraction };
    }
    expect(total).toBe(6);
    expect(accrueMoonAsterium({ rarity: 'LEGENDARY', syncedAtMs: 0, closedUntilMs: null, fraction: 0, nowMs: 48 * HOUR }).gained).toBe(6);
  });

  it('makes nothing while a Death Star keeps the moon shut, and resumes after', () => {
    const shut = accrueMoonAsterium({ rarity: 'EPIC', syncedAtMs: 0, closedUntilMs: 3 * HOUR, fraction: 0, nowMs: 2 * HOUR });
    expect(shut.gained).toBe(0);
    expect(shut.fraction).toBe(0);
    expect(shut.syncedAtMs).toBe(2 * HOUR);
    // EPIC: one per 12 h; open from 3 h, read at 15 h → 12 h open → 1
    const open = accrueMoonAsterium({ rarity: 'EPIC', syncedAtMs: shut.syncedAtMs, closedUntilMs: 3 * HOUR, fraction: 0, nowMs: 15 * HOUR });
    expect(open.gained).toBe(1);
    expect(open.fraction).toBeCloseTo(0, 9);
  });

  it('never runs backwards on a clock that steps back', () => {
    const r = accrueMoonAsterium({ rarity: 'RARE', syncedAtMs: 10 * HOUR, closedUntilMs: null, fraction: 0.25, nowMs: 9 * HOUR });
    expect(r).toEqual({ gained: 0, fraction: 0.25, syncedAtMs: 10 * HOUR });
  });
});

describe('R6 what an applied capsule list means', () => {
  it('Optik Örtü hides, Sessiz İtki silences, each alone', () => {
    expect(missionHidesFromGalaxy([])).toBe(false);
    expect(missionHidesFromGalaxy([{ id: 'OPTIC_VEIL', count: 1 }])).toBe(true);
    expect(missionHidesFromGalaxy([{ id: 'SILENT_THRUST', count: 2 }])).toBe(false);
    expect(missionSuppressesRadarWarning([{ id: 'SILENT_THRUST', count: 2 }])).toBe(true);
    expect(missionSuppressesRadarWarning([{ id: 'OPTIC_VEIL', count: 1 }])).toBe(false);
    const both = [{ id: 'OPTIC_VEIL' as const, count: 1 }, { id: 'SILENT_THRUST' as const, count: 1 }];
    expect(missionHidesFromGalaxy(both) && missionSuppressesRadarWarning(both)).toBe(true);
  });
});
