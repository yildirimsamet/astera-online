import { describe, expect, it } from 'vitest';
import { DECISION_MINUTES, nextDecision, playerWindows } from '../src/player-calendar.js';
import { advanceStrategicLayer, buildWorld, runSeason, runStrategicSession } from '../src/season.js';
import { fleetTravelExact, missionFuel, MULTI_WORLD } from '@astera/rules';

function settlementFixture() {
  const world = buildWorld({ players: 5, days: 1, seed: 2, activityProfiles: ['low'], neutralRaidChance: 0 });
  const p = world.players[0]!, target = world.neutrals.find(n => n.tier === 1)!;
  p.x = 0; p.y = 0; p.z = 0; target.x = 1250; target.y = 0; target.z = 0;
  p.buildings.CORE = 3; p.fleet = { COURIER: 2 }; p.alloy = 10000; p.crystal = 10000; p.deuterium = 1000;
  target.claimUntil = 100;
  world.strategicRng = () => 0;
  return { world, p, target };
}

describe('working adult calendar', () => {
  it('prepays both neutral raid legs and includes the engagement before the claim opens', () => {
    const { world, p, target } = settlementFixture();
    target.claimUntil = null;
    world.neutrals = [target]; world.neutralRaidChance = 1;
    p.fleet = { DART: 2, COURIER: 1 }; p.deuterium = 0;
    runStrategicSession(p, 0, world);
    expect(world.strategicMissions).toHaveLength(0);
    p.deuterium = 1000;
    runStrategicSession(p, 0, world);
    expect(p.deuterium).toBe(1000 - missionFuel({ DART: 2, COURIER: 1 }, 1250, 2));
    expect(world.strategicMissions[0]!.arriveAt).toBeCloseTo(fleetTravelExact(1250, { DART: 2, COURIER: 1 }, { boost: 1, tech: p.tech }) + 10 / 60);
  });
  it('prepays settlement fuel and refuses unfunded dispatch', () => {
    const { world, p } = settlementFixture();
    p.deuterium = 0;
    runStrategicSession(p, 0, world);
    expect(world.strategicMissions).toHaveLength(0);
    p.deuterium = 1000;
    runStrategicSession(p, 0, world);
    expect(world.strategicMissions.filter(m => m.kind === 'settlement')).toHaveLength(1);
    expect(p.deuterium).toBe(1000 - MULTI_WORLD.settlement.charge.deuterium - missionFuel({ COURIER: 2 }, 1250, 1));
  });
  it('rejects settlement arriving exactly at claim expiry', () => {
    const { world, p, target } = settlementFixture();
    target.claimUntil = fleetTravelExact(1250, { COURIER: 2 }, { boost: 1, tech: p.tech });
    runStrategicSession(p, 0, world);
    expect(world.strategicMissions).toHaveLength(0);
    expect(p.alloy).toBe(10000);
  });
  it('returns a lost settlement only after its return flight without refunding fuel', () => {
    const { world, p, target } = settlementFixture();
    runStrategicSession(p, 0, world);
    const mission = world.strategicMissions.find(m => m.kind === 'settlement')!;
    const fuel = p.deuterium;
    target.controllerId = 1;
    advanceStrategicLayer(world, mission.arriveAt);
    expect(p.fleet.COURIER).toBe(0);
    expect(p.alloy).toBe(10000 - MULTI_WORLD.settlement.charge.alloy);
    advanceStrategicLayer(world, mission.arriveAt * 2);
    expect(p.fleet.COURIER).toBe(2);
    // Server resolveTransfer adds the rerouted cargo even above storage capacity.
    expect(p.alloy).toBe(10000);
    expect(p.deuterium).toBe(fuel + MULTI_WORLD.settlement.charge.deuterium);
  });
  it('refuses an arrival at the expired boundary even when already in flight', () => {
    const { world, p, target } = settlementFixture();
    runStrategicSession(p, 0, world);
    const mission = world.strategicMissions.find(m => m.kind === 'settlement')!;
    target.claimUntil = mission.arriveAt;
    advanceStrategicLayer(world, mission.arriveAt);
    expect(target.controllerId).toBeNull();
  });
  it('does not create overnight decisions and keeps the weekday/weekend budget', () => {
    expect(nextDecision('low', 8, 7)).toBe(720);
    expect(nextDecision('average', 808, 7)).toBe(1440);
    expect(nextDecision('average', 7 * 1440 - 1, 7)).toBe(Infinity);
    expect(playerWindows('average', 7).reduce((n, w) => n + w.end - w.start, 0)).toBe(950);
  });
  it('separates spending policy from login frequency', () => {
    const w = buildWorld({ players: 5, days: 1, seed: 1, activityProfiles: ['average', 'low-once'], spendingArchetype: 'CASUAL' });
    expect(w.players.every(p => p.type === 'CASUAL')).toBe(true);
    expect(w.players[0]!.nextLogin).toBe(0);
    expect(w.players[1]!.nextLogin).toBe(720);
  });
  it('runs only the scheduled decisions even though production and queues continue offline', () => {
    const { world } = runSeason({ players: 5, days: 1, seed: 2, strategicLayer: false,
      activityProfiles: ['low'], spendingArchetype: 'CASUAL' });
    // Derived, not typed: `low` wakes for two ten-minute windows a day, so the
    // count is players x windows x (window / cadence). A hard-coded 50 was the
    // two-minute cadence D189 replaced, and it would drift silently again.
    const windows = playerWindows('low', 1);
    const perPlayer = windows.reduce((n, w) => n + Math.ceil((w.end - w.start) / DECISION_MINUTES), 0);
    expect(world.activityDecisions).toBe(5 * perPlayer);
    expect(world.players.every(p => p.nextLogin === Infinity)).toBe(true);
  });
  it('cannot dispatch settlers automatically from an offline battle outcome', () => {
    const world = buildWorld({ players: 5, days: 1, seed: 2, activityProfiles: ['low'], spendingArchetype: 'CASUAL' });
    const p = world.players[0]!, target = world.neutrals.find(n => n.tier === 1)!;
    p.buildings.CORE = 3; p.fleet = { COURIER: 2 }; p.alloy = 10000; p.crystal = 10000; p.deuterium = 1000;
    world.strategicRng = () => 0;
    world.strategicMissions.push({ id: 999, kind: 'neutral_attack', ownerId: p.id, targetId: target.id,
      arriveAt: 100, fleet: { DART: 1 }, returning: false });
    advanceStrategicLayer(world, 100);
    expect(target.claimUntil).toBeGreaterThan(100);
    expect(world.strategicMissions.some(m => m.kind === 'settlement')).toBe(false);
    expect(p.fleet.COURIER).toBe(2);
  });
});
it('splits the same weekend time budget into short checks and an evening session', () => {
  const weekend = playerWindows('average', 7).filter(w => w.start >= 5 * 1440);
  expect(weekend).toHaveLength(6);
  expect(weekend.reduce((sum, w) => sum + w.end - w.start, 0)).toBe(300);
  expect(weekend.slice(0, 3).map(w => w.start - 5 * 1440)).toEqual([0, 330, 720]);
});

/**
 * THE POPULATION THE GAME IS ACTUALLY FOR. Owner brief, 2026-09-10.
 *
 * *"30-40 yaş civarı, hepsi gerçek hayatta çalışan insanlar. Sabah 8'de işe
 * gidiyorlar akşam 7'de boşa çıkıyorlar... Sabah 10dk, Öğle 15dk, İkindi 15dk,
 * Akşam 90dk, Haftasonu 130dk. Bu değerlerin 2 katına çıkanlar da olacaktır,
 * yarısı kadar oynayanlar da."*
 *
 * `average` was already that brief exactly. What was missing is the spread around
 * it — nobody above the baseline, and the only profiles below it were a flat twenty
 * minutes, which models a lapsed player rather than a lighter one. `heavy` and
 * `half` are the brief's own two multipliers, so the population is the sentence
 * rather than an interpretation of it.
 */
describe('the audience, as a population', () => {
  const dayMinutes = (profile: Parameters<typeof playerWindows>[0], day: number): number =>
    playerWindows(profile, 7)
      .filter((w) => Math.floor(w.start / 1440) === day)
      .reduce((sum, w) => sum + (w.end - w.start), 0);

  /** Monday. The brief's own figures: 10 + 15 + 15 + 90. */
  it('holds the briefed baseline on a working day', () => {
    expect(dayMinutes('average', 0)).toBe(130);
  });

  it('holds the briefed baseline at the weekend', () => {
    expect(dayMinutes('average', 5)).toBe(150);
  });

  it('puts one profile at twice the baseline and one at half', () => {
    expect(dayMinutes('heavy', 0)).toBe(2 * dayMinutes('average', 0));
    expect(dayMinutes('half', 0) * 2).toBe(dayMinutes('average', 0));
  });

  /** The evening is the session that matters; it must scale with the rest. */
  it('scales the evening with the profile, not just the check-ins', () => {
    const evening = (p: Parameters<typeof playerWindows>[0]) =>
      playerWindows(p, 1).reduce((longest, w) => Math.max(longest, w.end - w.start), 0);
    expect(evening('heavy')).toBe(2 * evening('average'));
    expect(evening('half') * 2).toBe(evening('average'));
  });

  /** Every profile still sleeps: nothing may schedule a decision in the small hours. */
  it('never wakes anybody between 01:00 and 07:00 Türkiye time', () => {
    for (const p of ['heavy', 'average', 'half', 'low', 'low-once'] as const) {
      for (const w of playerWindows(p, 7)) {
        // Season origin is Monday 07:30, so minute-of-day 0 is 07:30 = clock 450.
        const startClock = w.start % 1440 + 450;
        const endClock = startClock + (w.end - w.start);
        // Nobody is woken before 07:30, and nothing runs past 01:00 (1440 + 60).
        expect(startClock, `${p} starts at ${String(startClock)}`).toBeGreaterThanOrEqual(450);
        expect(endClock, `${p} runs to ${String(endClock)}`).toBeLessThanOrEqual(1500);
      }
    }
  });
});
