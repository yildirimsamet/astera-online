import { expect, it } from 'vitest';
import { reciprocalEconomy, reciprocalScenario, scaleContract } from './reciprocal-economy-study.js';
import { prototypeRoster } from './fleet-economy-next-study.js';
import { fleetSession } from './fleet-session-study.js';
import { HULLS, hullBulk } from '../packages/rules/src/index.js';
import { worldStats } from './costed-world.js';
import { designScenario } from './economy-design-study.js';

it('uses the same new-design hull recipes and production work in isolated and shared clocks', () => {
  const s = reciprocalScenario(14, 3, 42); s.contactCount = 0;
  s.players = s.players.map(p => ({ ...p, ...designScenario('average', 14), fleetBudgetHours: 24 }));
  const shared = reciprocalEconomy(s);
  const single = fleetSession({ ...designScenario('average', 14), fleetBudgetHours: 24 });
  for (const p of shared.players) {
    expect(p.firstBuilt).toEqual(single.firstBuilt);
    expect(p.world).toEqual(single.world); expect(p.built).toEqual(single.built);
    for (const k of ['alloy', 'crystal', 'deuterium'] as const) {
      expect(p.spent[k]).toBeCloseTo(single.spent[k], 7);
      expect(p.stock[k]).toBeCloseTo(single.stock[k], 7);
    }
  }
});

it('does not refresh exact enemy fleet intelligence for free after a battle', () => {
  const s = reciprocalScenario(14, 3, 42); s.end = 90; s.distance = 5000; s.contactCount = 1;
  for (const p of s.players) {
    p.development = []; p.world!.orders = {};
    p.world!.initial.buildings.CORE = 1; p.world!.initial.buildings.SHIPYARD = 1;
    p.world!.initial.buildings.REFINERY = 1; p.world!.initial.buildings.EXTRACTOR = 1;
    p.stock = { alloy: 100000, crystal: 100000, deuterium: 10000 };
    p.desiredFleet = {}; p.windows = [];
  }
  const attacker = s.players[0]!;
  attacker.desiredFleet = { DART: 2, COURIER: 1 }; attacker.packetChoices = [{ DART: 2 }];
  attacker.windows = [{ start: 0, end: 90 }];
  const r = reciprocalEconomy(s);
  expect(r.missions.length).toBeGreaterThanOrEqual(2);
  // The first report is older than this policy's 60-minute limit on return.
  // Battle reports disclose losses, not a new exact surviving enemy roster.
  expect(r.players[0]!.probes).toBeGreaterThanOrEqual(2);
});

it('delivers raid cargo above storage capacity instead of silently destroying the haul', () => {
  const s = reciprocalScenario(14, 3, 42); s.end = 90;
  for (const p of s.players) {
    p.development = []; p.world!.orders = {};
    p.world!.initial.buildings.CORE = 1; p.world!.initial.buildings.SHIPYARD = 1;
    p.world!.initial.buildings.REFINERY = 1; p.world!.initial.buildings.EXTRACTOR = 1;
    p.stock = { alloy: 100000, crystal: 100000, deuterium: 10000 };
    p.desiredFleet = {}; p.windows = [];
  }
  const attacker = s.players[0]!;
  attacker.desiredFleet = { DART: 2, COURIER: 1 }; attacker.packetChoices = [{ DART: 2 }];
  attacker.windows = [{ start: 0, end: 20 }];
  const r = reciprocalEconomy(s), p = r.players[0]!;
  expect(r.missions.length).toBeGreaterThan(0);
  expect(r.missions.every(m => m.returned)).toBe(true);
  expect(p.received.alloy + p.received.crystal).toBeGreaterThan(0);
  expect(p.stock.alloy).toBeGreaterThan(worldStats(p.world).storage.alloy);
  expect(p.discarded).toEqual({ alloy: 0, crystal: 0, deuterium: 0 });
  for (const k of ['alloy', 'crystal', 'deuterium'] as const) {
    // The initial store is already full: passive production stays in Works.
    expect(p.stock[k]).toBeCloseTo(attacker.stock[k] - p.spent[k] + p.received[k], 8);
    expect(r.transferred[k]).toBeCloseTo(r.players.reduce((sum, x) => sum + x.stolen[k], 0), 8);
  }
  expect(r.maxResourceError).toBeLessThan(1e-7);
});

it('does not buy late probes or launch raids beyond the real season in the shared ledger', () => {
  const s = reciprocalScenario(14, 3, 42); s.end = 30;
  for (const p of s.players) { p.seasonEnd = 6.25; p.windows = [{ start: 0, end: 30 }]; }
  const short = reciprocalEconomy(s);
  expect(short.players[0]!.built.DART).toBe(2);
  expect(short.players.reduce((n, p) => n + p.probes, 0)).toBe(0);
  for (const p of s.players) p.seasonEnd = 8;
  const r = reciprocalEconomy(s);
  expect(r.players.some(p => p.probes > 0)).toBe(true);
  expect(r.missions).toHaveLength(0);
  expect(r.players.every(p => p.fuel === 0)).toBe(true);
});

it('does not fund unfinished investments in the last minute of a season', () => {
  const s = reciprocalScenario(14, 3, 42); s.contactCount = 0;
  for (const p of s.players) p.windows = [{ start: s.end - 1, end: s.end }];
  expect(reciprocalEconomy(s).orders).toHaveLength(0);
});

it('reproduces isolated economics for every player when interaction is disabled', () => {
  const s = reciprocalScenario(14, 6, 42); s.contactCount = 0;
  s.players[0]!.developmentReserveHours = 3;
  const r = reciprocalEconomy(s);
  for (const [i, config] of s.players.entries()) {
    const isolated = fleetSession({ ...config, targets: [], hullRequires: {},
      roster: { ...config.roster, COURIER: { ...HULLS.COURIER } },
      bulk: { ...config.bulk, PIKE: 3, WARDEN: 3, TALON: 5, SENTINEL: 5, COURIER: hullBulk('COURIER') } });
    expect(r.players[i]!.world).toEqual(isolated.world);
    expect(r.players[i]!.built).toEqual(isolated.built);
    for (const k of ['alloy', 'crystal', 'deuterium'] as const) {
      expect(r.players[i]!.spent[k]).toBeCloseTo(isolated.spent[k], 6);
      expect(r.players[i]!.stock[k]).toBeCloseTo(isolated.stock[k], 6);
    }
  }
});

it('reports ordinary combat-line losses without diluting them with cargo value', () => {
  const r = reciprocalEconomy(reciprocalScenario(14, 12, 42)), roster = prototypeRoster(1.1, 0.52, 0);
  const value = (f: Record<string, number>) => Object.entries(f).filter(([h]) => h !== 'COURIER')
    .reduce((sum, [h, n]) => { const p = roster[h as keyof typeof roster]!; return sum + n * (p.alloy + 3 * p.crystal + 90 * p.deuterium); }, 0);
  const b = r.battles.find(b => b.sent.COURIER && b.lossFraction !== null && value(b.lost) > 0)!;
  expect(b).toBeDefined();
  expect(b.lossFraction).toBeCloseTo(value(b.lost) / value(b.sent), 10);
});

it('can reserve half the owned combat value for defence after the opening', () => {
  const s = reciprocalScenario(14, 12, 42); s.dispatchShare = 0.5;
  const r = reciprocalEconomy(s);
  expect(r.missions.length).toBeGreaterThan(0);
  expect(r.missions.filter(m => m.at >= 1440).every(m => m.sentCombatValue <= m.ownedCombatValue * 0.5 + 1e-6)).toBe(true);
});

it('starts every commander with the declared wallet and pays actual progression without offline orders', () => {
  const s = reciprocalScenario(14, 12, 42); s.end = 1440;
  const r = reciprocalEconomy(s);
  expect(r.players).toHaveLength(12);
  expect(r.players.every(p => p.spent.alloy > 0 && p.world.buildings.CORE > 0)).toBe(true);
  expect(r.orders.every(o => s.players[o.player]!.windows.some(w => o.at >= w.start && o.at < w.end))).toBe(true);
  expect(r.maxResourceError).toBeLessThan(1e-6);
  expect(r.maxHullError).toBe(0);
});

it('uses one finite stock for growth, mutual combat, cargo transfer and paid replacement', () => {
  const s = reciprocalScenario(14, 12, 42), r = reciprocalEconomy(s);
  expect(r.battles.length).toBeGreaterThan(0);
  expect(new Set(r.battles.map(b => b.attacker)).size).toBeGreaterThan(1);
  expect(r.transferred.alloy + r.transferred.crystal).toBeGreaterThan(0);
  expect(r.players.some(p => Object.values(p.losses).some(n => n > 0))).toBe(true);
  expect(r.players.every(p => Object.values(p.stock).every(n => n >= -1e-8))).toBe(true);
  expect(r.maxResourceError).toBeLessThan(1e-6);
  expect(r.maxHullError).toBe(0);
});

it('keeps human windows and local flight time fixed while scaling volume and progression dates', () => {
  const a = scaleContract(14, 300), b = scaleContract(30, 1000);
  expect(b.radius / a.radius).toBeCloseTo(Math.cbrt(1000 / 300));
  expect(b.referenceRoundTrip).toEqual(a.referenceRoundTrip);
  expect(b.t3Window).toEqual([3 / 14 * 30, 4 / 14 * 30]);
  expect(b.t4Window).toEqual([7 / 14 * 30, 8 / 14 * 30]);
  expect(() => scaleContract(0, 300)).toThrow();
});
