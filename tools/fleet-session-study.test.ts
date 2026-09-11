import { expect, it } from 'vitest';
import { fleetSession, sessionScenario } from './fleet-session-study.js';
import { fleetCount, fleetTravelExact, missionFuel, resolveCombat, mulberry32 , hullBulk } from '../packages/rules/src/index.js';
import { prototypeRoster } from './fleet-economy-next-study.js';
import { HULLS } from '../packages/rules/src/hulls.js';
import { emptyWorld, worldStats } from './costed-world.js';
import { buildingCost } from '../packages/rules/src/index.js';
import { designHull } from './economy-design-model.js';

/** Ground-excluded bulk of a wing. The Hangar that metered it is gone (D184); the studies still size fleets by it. */
const fleetBulk = (fleet: Record<string, number | undefined>): number =>
  Object.entries(fleet).reduce(
    (sum, [id, n]) => sum + (HULLS[id as keyof typeof HULLS].ground ? 0 : hullBulk(id as never) * (n ?? 0)),
    0,
  );

it('applies the new design propulsion ceiling to both actual mission legs', () => {
  const s = sessionScenario(); s.development = []; s.targets = [{ id: 'empty', distance: 1250, fleet: {} }];
  s.initialFleet = { DART: 2 }; s.desiredFleet = {}; s.packet = { DART: 2 };
  s.windows = [{ start: 0, end: 1 }]; s.end = 30;
  s.world = { initial: { ...emptyWorld(), design: { seasonDays: 14 }, tech: { SHIP_PROPULSION: 4 } }, orders: {} };
  s.roster = { DART: designHull('DART') }; s.bulk = { DART: designHull('DART').bulk };
  const r = fleetSession(s), l = r.launches[0]!;
  expect(l).toBeDefined();
  expect(l.battleAt - l.at).toBeCloseTo((15 - 1 / 6) / 3 + 1 / 6);
  expect(l.returnAt! - l.at).toBeCloseTo((15 - 1 / 6) / 1.5 + 1 / 6);
});

it('uses separately priced ship work for the new design instead of deriving time from resource sums', () => {
  const s = sessionScenario(); s.initialFleet = {}; s.desiredFleet = { DART: 2 }; s.packet = { DART: 2 };
  s.targets = []; s.windows = [{ start: 0, end: 1 }]; s.end = 10;
  s.world = { initial: { ...emptyWorld(), design: { seasonDays: 14 } }, orders: {} };
  s.development = []; s.roster = { DART: designHull('DART') }; s.bulk = { DART: designHull('DART').bulk };
  const r = fleetSession(s);
  expect(r.firstBuilt.DART).toBe(4); expect(r.spent.alloy).toBe(600); expect(r.spent.crystal).toBe(120);
  expect(r.home.DART).toBe(2);
});

it('integrates offline production by completion time in a hand-calculated one-hour example', () => {
  const s = sessionScenario(); s.initialFleet = {}; s.desiredFleet = {}; s.targets = [];
  s.stock = { alloy: 100, crystal: 0, deuterium: 0 }; s.rate = { alloy: 60, crystal: 0, deuterium: 0 };
  s.end = 60; s.windows = [{ start: 0, end: 1 }];
  s.development = [{ id: 'producer', queue: 'construction', minutes: 10, requires: [],
    cost: { alloy: 40, crystal: 0, deuterium: 0 }, rateGain: { alloy: 60, crystal: 0, deuterium: 0 } }];
  const r = fleetSession(s);
  expect(r.stock.alloy).toBe(60);
  // 10 minutes at 1/minute, then 50 at 2/minute. Nothing is collected offline.
  expect(r.works.alloy).toBe(110); expect(r.produced.alloy).toBe(110);
  expect(r.developmentCompleted.producer).toBe(10);
});

it('refuses a raid returning after season end, but permits the server-legal exact boundary', () => {
  const s = sessionScenario(); s.targets = [s.targets[0]!]; s.windows = [{ start: 0, end: 1 }];
  s.seasonEnd = 2 * fleetTravelExact(1250, s.packet, { boost: 1, tech: {} }) + 10 / 60 - 0.001;
  const r = fleetSession(s);
  expect(r.launches).toHaveLength(0); expect(r.fuelSpent).toBe(0); expect(r.away).toEqual({});
  // Observation can end before return, provided the real season does not.
  s.seasonEnd += 0.001; s.end = 1;
  expect(fleetSession(s).launches).toHaveLength(1);
});

it('refuses a probe that cannot return before the season ends without charging its invoice', () => {
  const s = sessionScenario(); s.intel = { maxAgeMinutes: 60 }; s.seasonEnd = 0.1;
  const r = fleetSession(s);
  expect(r.probes).toHaveLength(0); expect(r.intelSpent).toEqual({ alloy: 0, crystal: 0, deuterium: 0 });
});

it('does not charge for jobs that cannot finish strictly before the actual season boundary', () => {
  const s = sessionScenario(); s.initialFleet = {}; s.desiredFleet = { DART: 2 }; s.packet = { DART: 2 };
  s.targets = []; s.end = 10; s.seasonEnd = 1; s.yard = 0;
  s.world = { initial: emptyWorld(), orders: { core: { building: 'CORE', level: 1 } } };
  s.development = [{ id: 'core', queue: 'construction', cost: { alloy: 0, crystal: 0, deuterium: 0 }, minutes: 1, requires: [] }];
  const r = fleetSession(s);
  expect(r.orders).toHaveLength(0); expect(r.jobs).toHaveLength(0);
  expect(r.spent).toEqual({ alloy: 0, crystal: 0, deuterium: 0 });
});

it('keeps a declared development reserve in the actual wallet instead of recording fictitious spending', () => {
  const s = sessionScenario(); s.initialFleet = {}; s.desiredFleet = {}; s.targets = [];
  s.stock = { alloy: 100, crystal: 100, deuterium: 0 }; s.rate = { alloy: 100, crystal: 100, deuterium: 0 };
  s.end = 1; s.developmentReserveHours = 1;
  s.development = [{ id: 'investment', queue: 'construction', minutes: 1, requires: [], cost: { alloy: 20, crystal: 20, deuterium: 0 } }];
  const r = fleetSession(s);
  expect(r.jobs).toHaveLength(0);
  expect(r.stock).toEqual(s.stock);
  expect(r.spent).toEqual({ alloy: 0, crystal: 0, deuterium: 0 });
});

it('does not repeatedly buy expired reports for a known opponent its current fleet still cannot fight', () => {
  const s = sessionScenario(); s.targets = [{ ...s.targets[0]!, fleet: { SENTINEL: 120 } }];
  s.intel = { maxAgeMinutes: 60 }; s.maxExpectedLossFraction = 0.3;
  s.windows = [{ start: 0, end: 180 }];
  const r = fleetSession(s);
  expect(r.probes).toHaveLength(1);
  expect(r.launches).toHaveLength(0);
});

it('pays a probe, occupies the common bay and waits for its returned report before raiding', () => {
  const s = sessionScenario(); s.targets = [s.targets[0]!];
  s.intel = { maxAgeMinutes: 60 }; s.end = 2;
  const pending = fleetSession(s);
  expect(pending.probes).toHaveLength(1);
  expect(pending.launches).toHaveLength(0);
  expect(pending.intelSpent).toEqual({ alloy: 50, crystal: 30, deuterium: 0 });
  s.end = 30;
  const r = fleetSession(s);
  expect(r.launches[0]!.at).toBeGreaterThanOrEqual(r.probes[0]!.returnAt);
  expect(Math.abs(r.resourceConservationError.crystal!)).toBeLessThan(1e-6);
  s.stock.alloy = 0; s.stock.crystal = 0; s.rate = { alloy: 0, crystal: 0, deuterium: 0 };
  expect(fleetSession(s).launches).toHaveLength(0);
});

it('freezes attacker research at dispatch and uses defender research in the actual battle', () => {
  const s = sessionScenario(); const w = emptyWorld();
  w.buildings.CORE = 12; w.buildings.HANGAR = 12; w.buildings.SHIPYARD = 6;
  w.tech = { SHIP_POWER: 1, STARSHIP_ENGINEERING: 1 };
  s.stock.crystal = 10000; s.baseRoundTripAt1250 = 150;
  s.world = { initial: w, orders: { power: { research: 'SHIP_POWER', level: 2 } } };
  s.development = [{ id: 'power', queue: 'research', cost: { alloy: 0, crystal: 0, deuterium: 0 }, minutes: 1, requires: [] }];
  s.desiredFleet = {}; s.targets = [{ ...s.targets[0]!, tech: { SHIP_ARMOR: 4 } }];
  const r = fleetSession(s), first = r.launches[0]!;
  expect(r.developmentCompleted.power).toBeGreaterThan(first.at);
  expect(r.developmentCompleted.power).toBeLessThan(first.battleAt);
  expect(r.world!.tech.SHIP_POWER).toBe(2);
  expect(first.attackerTech).toEqual({ SHIP_POWER: 1, STARSHIP_ENGINEERING: 1 });
  expect(first.defenderTech).toEqual({ SHIP_ARMOR: 4 });
  const expected = resolveCombat(first.sent, s.targets[0]!.fleet, 0, mulberry32(s.seed),
    { attacker: { tech: { SHIP_POWER: 1 } }, defender: { tech: { SHIP_ARMOR: 4 } } });
  expect(first.lost).toEqual(expected.attackerLosses);
  expect(w.tech).toEqual({ SHIP_POWER: 1, STARSHIP_ENGINEERING: 1 });
});

it('pays and projects Uplink then Telescope without mutating the initial world', () => {
  const s = sessionScenario();
  const initial = emptyWorld(); initial.buildings.CORE = 2; initial.orbit = []; initial.instruments = {};
  s.world = { initial, orders: { uplink: { satellite: 'UPLINK' }, telescope: { instrument: 'TELESCOPE', level: 1 } } };
  s.initialFleet = {}; s.desiredFleet = {}; s.targets = [];
  s.development = ['uplink', 'telescope'].map(id => ({ id, queue: 'construction', cost: { alloy: 0, crystal: 0, deuterium: 0 }, minutes: 1, requires: [] }));
  const r = fleetSession(s);
  expect(r.world!.orbit).toEqual(['UPLINK']);
  expect(r.world!.instruments!.TELESCOPE).toBe(1);
  expect(initial.orbit).toEqual([]); expect(initial.instruments).toEqual({});
  expect(r.spent.alloy).toBeGreaterThan(0);
  expect(r.developmentStarted.telescope).toBeLessThan(r.developmentCompleted.uplink!);
});

it('funds real construction in the fleet wallet and derives income only from completed buildings', () => {
  const s = sessionScenario(); s.initialFleet = {}; s.desiredFleet = {}; s.targets = [];
  s.world = { initial: emptyWorld(), orders: { core: { building: 'CORE', level: 1 }, refinery: { building: 'REFINERY', level: 1 } } };
  s.development = ['core', 'refinery'].map(id => ({ id, queue: 'construction', requires: [],
    cost: { alloy: 1, crystal: 0, deuterium: 0 }, minutes: 1 }));
  s.end = 1;
  const pending = fleetSession(s);
  expect(pending.rate.alloy).toBe(0);
  expect(pending.world!.buildings.REFINERY).toBe(0);
  expect(pending.spent.alloy).toBe(buildingCost('CORE', 0).alloy);
  s.end = 60;
  s.windows.push({ start: 1, end: 1.5 });
  const r = fleetSession(s);
  expect(r.world!.buildings.REFINERY).toBe(1);
  expect(r.spent.alloy).toBe(buildingCost('CORE', 0).alloy + buildingCost('REFINERY', 0).alloy);
  expect(r.rate).toEqual(worldStats(r.world!).rate);
  expect(r.developmentStarted.refinery).toBeLessThan(r.developmentCompleted.core!);
  expect(r.developmentCompleted.refinery).toBeGreaterThan(r.developmentCompleted.core!);
  expect(Math.abs(r.resourceConservationError.alloy!)).toBeLessThan(1e-6);
});

it('does not mix paid world orders with unpriced industry gains', () => {
  const s = sessionScenario(); s.world = { initial: emptyWorld(), orders: {} };
  s.development = [{ id: 'gift', queue: 'construction', requires: [], cost: { alloy: 0, crystal: 0, deuterium: 0 },
    minutes: 1, rateGain: { alloy: 1000, crystal: 1000, deuterium: 1000 } }];
  expect(() => fleetSession(s)).toThrow();
});

it('does not let an impossible research invoice block affordable capacity investments', () => {
  const s = sessionScenario(); const initial = emptyWorld();
  initial.buildings.CORE = 1; initial.buildings.REFINERY = 1; initial.buildings.EXTRACTOR = 1;
  s.initialFleet = {}; s.desiredFleet = {}; s.targets = []; s.stock = { alloy: 1000, crystal: 400, deuterium: 0 };
  s.world = { initial, orders: { synthesis: { research: 'DEUTERIUM_SYNTHESIS', level: 1 }, core: { building: 'CORE', level: 2 } } };
  s.development = [
    { id: 'synthesis', queue: 'research', requires: [], cost: { alloy: 1, crystal: 1, deuterium: 0 }, minutes: 1 },
    { id: 'core', queue: 'construction', requires: [], cost: { alloy: 1, crystal: 1, deuterium: 0 }, minutes: 1 },
  ];
  const r = fleetSession(s);
  expect(r.developmentStarted.core).toBe(0);
  expect(r.developmentStarted.synthesis).toBeUndefined();
});

it('requires real catalog research in costed mode even when a prototype roster clears its research list', () => {
  const s = sessionScenario(); const initial = emptyWorld(); initial.buildings.CORE = 6; initial.buildings.SHIPYARD = 6;
  s.world = { initial, orders: {} }; s.initialFleet = {}; s.desiredFleet = { TEMPEST: 1 }; s.targets = [];
  s.roster = prototypeRoster(1.1, 0.52, 0); s.bulk = { VIPER: 5, TEMPEST: 8 };
  s.stock = { alloy: 100000, crystal: 100000, deuterium: 100000 };
  expect(fleetSession(s).orders).toHaveLength(0);
});

it('rejects invalid starting facilities and a mismatched invoice queue', () => {
  const s = sessionScenario(); const initial = emptyWorld(); initial.buildings.CORE = -1;
  s.world = { initial, orders: {} }; s.initialFleet = {};
  expect(() => fleetSession(s)).toThrow();
  initial.buildings.CORE = 0;
  s.world.orders = { core: { building: 'CORE', level: 1 } };
  s.development = [{ id: 'core', queue: 'research', requires: [], cost: { alloy: 1, crystal: 0, deuterium: 0 }, minutes: 1 }];
  expect(() => fleetSession(s)).toThrow();
});

it('waits for a half-roster batch and can fund it even when full-roster storage is impossible', () => {
  const s = sessionScenario(); s.roster = prototypeRoster(1.1, 0.52, 0);
  s.bulk = { VIPER: 5, SENTINEL: 5 }; s.hangar = 120;
  s.targets = [{ id: 'rival', distance: 1250, fleet: { SENTINEL: 24 }, economy: {
    stock: { alloy: 17000, crystal: 4500, deuterium: 700 }, rate: { alloy: 0, crystal: 0, deuterium: 0 },
    windows: [{ start: 0, end: 180 }], yard: 4, hangar: 120, minimumRebuildFraction: 0.5,
  } }];
  const r = fleetSession(s);
  expect(r.defenders[0]!.orders[0]!.count).toBe(12);
  expect(r.defenders[0]!.orders).toHaveLength(1);
  s.targets[0]!.economy!.stock.alloy = 15000;
  expect(fleetSession(s).defenders[0]!.orders).toHaveLength(0);
});

it('rejects a defender batch fraction outside the physical interval', () => {
  const s = sessionScenario(); s.targets[0]!.economy = {
    stock: { alloy: 0, crystal: 0, deuterium: 0 }, rate: { alloy: 0, crystal: 0, deuterium: 0 },
    windows: [], yard: 4, hangar: 120, minimumRebuildFraction: 2,
  };
  expect(() => fleetSession(s)).toThrow();
});

it('lets a defeated target rebuild with its own paid queue and become a target again', () => {
  const s = sessionScenario(); s.roster = prototypeRoster(1.1, 0.52, 0);
  s.bulk = { VIPER: 5, SENTINEL: 5 }; s.hangar = 240;
  s.initialFleet = { VIPER: 48 }; s.desiredFleet = { VIPER: 48 };
  s.stock = { alloy: 100000, crystal: 40000, deuterium: 5000 };
  s.windows = [{ start: 0, end: 180 }]; s.end = 240;
  s.targets = [{ id: 'rival', distance: 1250, fleet: { SENTINEL: 24 }, economy: {
    stock: { alloy: 100000, crystal: 40000, deuterium: 5000 }, rate: { alloy: 300, crystal: 120, deuterium: 20 },
    windows: [{ start: 0, end: 180 }], yard: 4, hangar: 120,
  } }];
  const r = fleetSession(s);
  expect(r.launches.length).toBeGreaterThan(1);
  expect(r.launches.length).toBeLessThanOrEqual(3);
  const defender = r.defenders[0]!;
  expect(defender.spent.alloy).toBeGreaterThan(0);
  expect(defender.built.SENTINEL).toBeGreaterThan(0);
  expect(defender.recovery.collapsedAt).toBeGreaterThan(0);
  expect(defender.recovery.halfAt).toBeGreaterThan(defender.recovery.collapsedAt!);
  expect(r.launches[0]!.defenderAtBattle).toEqual({ SENTINEL: 24 });
  expect(defender.hullConservationError.SENTINEL).toBe(0);
  expect(Math.abs(defender.resourceConservationError.alloy!)).toBeLessThan(1e-6);
});

it('does not respawn an offline unfunded defender or raid its empty remains repeatedly', () => {
  const s = sessionScenario();
  s.targets = [{ id: 'rival', distance: 1250, fleet: { SENTINEL: 1 }, economy: {
    stock: { alloy: 0, crystal: 0, deuterium: 0 }, rate: { alloy: 0, crystal: 0, deuterium: 0 },
    windows: [], yard: 4, hangar: 120,
  } }];
  const r = fleetSession(s);
  expect(r.launches).toHaveLength(1);
  expect(r.defenders[0]!.built).toEqual({});
  expect(fleetCount(r.targets[0]!.fleet)).toBe(0);
});

it('can wait for a fully funded replacement order without granting a fleet while saving', () => {
  const s = sessionScenario(); s.roster = prototypeRoster(1.1, 0.52, 0);
  s.bulk = { VIPER: 5, SENTINEL: 5 }; s.hangar = 120;
  s.targets = [{ id: 'rival', distance: 1250, fleet: { SENTINEL: 24 }, economy: {
    stock: { alloy: 12000, crystal: 4500, deuterium: 700 }, rate: { alloy: 0, crystal: 0, deuterium: 0 },
    windows: [{ start: 0, end: 180 }], yard: 4, hangar: 120, batchRebuild: true,
  } }];
  const r = fleetSession(s);
  expect(r.defenders[0]!.orders).toHaveLength(0);
  expect(r.defenders[0]!.stock.alloy).toBe(12000);
  expect(r.defenders[0]!.recovery.collapsedAt).not.toBeNull();
  expect(r.defenders[0]!.recovery.halfAt).toBeNull();
});

it('books a forced docked-fleet loss once and replaces it with paid orders in the same wallet', () => {
  const s = sessionScenario(); s.targets = []; s.shocks = [{ at: 30, homeLossFraction: 0.5 }];
  const r = fleetSession(s);
  expect(r.shocks[0]!.lost).toEqual({ VIPER: 12 });
  expect(r.shocks[0]!.before).toEqual({ VIPER: 24 });
  expect(r.shocks[0]!.recoveredAt).toBeGreaterThan(30);
  expect(r.orders[0]!.at).toBe(30);
  expect(r.built).toEqual({ VIPER: 12 });
  expect(r.losses).toEqual({ VIPER: 12 });
  expect(r.hullConservationError.VIPER).toBe(0);
});

it('does not heal a fleet loss for free when both money and income are absent', () => {
  const s = sessionScenario(); s.targets = []; s.stock = { alloy: 0, crystal: 0, deuterium: 0 }; s.rate = { ...s.stock };
  s.shocks = [{ at: 30, homeLossFraction: 0.5 }];
  const r = fleetSession(s);
  expect(r.home).toEqual({ VIPER: 12 });
  expect(r.shocks[0]!.recoveredAt).toBeNull();
  expect(r.orders).toHaveLength(0);
});

it('rejects impossible loss fractions instead of creating negative or extra ships', () => {
  const s = sessionScenario(); s.shocks = [{ at: 30, homeLossFraction: 1.01 }];
  expect(() => fleetSession(s)).toThrow();
});

it('does not build a hull below its catalog shipyard requirement even with ample money', () => {
  const s = sessionScenario(); s.initialFleet = {}; s.yard = 0; s.targets = [];
  const r = fleetSession(s);
  expect(r.orders).toHaveLength(0);
  expect(r.built).toEqual({});
});

it('activates purchased infrastructure only at completion before permitting new ship orders', () => {
  const s = sessionScenario(); s.initialFleet = {}; s.yard = 0; s.hangar = 0; s.targets = [];
  s.development = [{ id: 'dock', queue: 'construction', cost: { alloy: 1000, crystal: 200, deuterium: 0 },
    minutes: 30, requires: [] }];
  s.infrastructure = { dock: { yardLevel: 2, hangarGain: fleetBulk(s.packet) } };
  s.end = 29;
  const pending = fleetSession(s);
  expect(pending.orders).toHaveLength(0);
  expect(pending.infrastructure).toEqual({ yard: 0, hangar: 0 });
  s.end = 60;
  const done = fleetSession(s);
  expect(done.orders[0]!.at).toBe(30);
  expect(done.infrastructure).toEqual({ yard: 2, hangar: fleetBulk(s.packet) });
  expect(done.developmentCompleted.dock).toBe(30);
  expect(Math.abs(done.resourceConservationError.alloy!)).toBeLessThan(1e-6);
});

it('rejects infrastructure effects attached to a nonexistent purchase or invalid capacity', () => {
  const s = sessionScenario(); s.infrastructure = { missing: { hangarGain: 10 } };
  expect(() => fleetSession(s)).toThrow();
});

it('keeps a launched fleet unavailable until its offline return and pays fuel only once', () => {
  const s = sessionScenario();
  s.windows = [{ start: 0, end: 1 }]; s.end = 60;
  s.targets = [{ id: 'empty', distance: 1250, fleet: {} }];
  const r = fleetSession(s);
  expect(r.launches).toHaveLength(1);
  expect(r.launches[0]!.returnAt).toBeCloseTo(2 * fleetTravelExact(1250, s.packet, { boost: 1, tech: {} }) + 1 / 6);
  expect(r.fuelSpent).toBe(missionFuel(s.packet, 1250, 2));
  expect(r.home).toEqual(s.initialFleet);
  expect(r.away).toEqual({});
});

it('cannot finance a launch with future production', () => {
  const s = sessionScenario(); s.stock.deuterium = 0; s.rate.deuterium = 0;
  const r = fleetSession(s);
  expect(r.launches).toHaveLength(0);
  expect(r.fuelSpent).toBe(0);
});

it('counts away and queued ships against the same hangar', () => {
  const s = sessionScenario();
  s.desiredFleet = { ...s.packet, COURIER: 2 };
  s.hangar = fleetBulk(s.initialFleet);
  s.targets = [{ id: 'empty', distance: 1250, fleet: {} }];
  const r = fleetSession(s);
  expect(r.orders).toHaveLength(0);
  expect(r.maxCommittedBulk).toBeLessThanOrEqual(s.hangar);
});

it('accounts for actual battle losses and prepaid replacement orders without creating hulls', () => {
  const r = fleetSession(sessionScenario());
  expect(r.launches.length).toBeGreaterThan(0);
  expect(Object.values(r.losses).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
  for (const n of Object.values(r.hullConservationError)) expect(n).toBe(0);
  for (const n of Object.values(r.resourceConservationError)) expect(Math.abs(n)).toBeLessThan(1e-7);
});

it('preserves a target after combat and never invents a fresh defender for a repeat raid', () => {
  const s = sessionScenario(); s.targets = [{ id: 'empty', distance: 1250, fleet: {} }];
  const r = fleetSession(s);
  expect(r.launches).toHaveLength(1);
});

it('shares the resource wallet with development and applies its output only after completion', () => {
  const s = sessionScenario(); s.targets = []; s.windows = [{ start: 0, end: 1 }]; s.end = 120;
  s.development = [{ id: 'industry', queue: 'construction', minutes: 60, requires: [],
    cost: { alloy: 1000, crystal: 100, deuterium: 10 }, rateGain: { alloy: 300, crystal: 0, deuterium: 0 } }];
  const r = fleetSession(s);
  expect(r.developmentCompleted.industry).toBe(60);
  expect(r.produced.alloy).toBe(900);
  expect(r.spent.alloy).toBe(1000);
  expect(r.stock.alloy).toBe(s.stock.alloy - 1000);
  expect(r.resourceConservationError.alloy).toBeCloseTo(0);
});

it('does not launch a dependent development order from an offline completion', () => {
  const s = sessionScenario(); s.targets = []; s.windows = [{ start: 0, end: 1 }];
  s.development = [
    { id: 'a', queue: 'research', minutes: 10, requires: [], cost: { alloy: 1, crystal: 0, deuterium: 0 } },
    { id: 'b', queue: 'research', minutes: 10, requires: ['a'], cost: { alloy: 1, crystal: 0, deuterium: 0 } },
  ];
  const r = fleetSession(s);
  expect(r.developmentCompleted.a).toBe(10);
  expect(r.developmentStarted.b).toBeUndefined();
});

it('rejects ground hulls in a mobile attack packet', () => {
  const s = sessionScenario(); s.packet = { THORN: 1 };
  expect(() => fleetSession(s)).toThrow();
});

it('keeps the candidate unresearched roundtrip separate from the capped speed upgrade', () => {
  const s = sessionScenario(); s.targets = [{ id: 'empty', distance: 1250, fleet: {} }];
  s.windows = [{ start: 0, end: 1 }]; s.baseRoundTripAt1250 = 25; s.speedMultiplier = 1;
  expect(fleetSession(s).launches[0]!.returnAt).toBeCloseTo(25);
  s.speedMultiplier = 1.5;
  expect(fleetSession(s).launches[0]!.returnAt).toBeCloseTo((25 - 1 / 6) / 1.5 + 1 / 6);
  s.speedMultiplier = 2;
  expect(() => fleetSession(s)).toThrow();
});

it('uses candidate physical bulk for both hangar and fuel and restores the live catalog', () => {
  const original = HULLS.VIPER;
  const s = sessionScenario(); s.roster = prototypeRoster(1.1, 0.52, 0);
  s.bulk = { VIPER: 5, SENTINEL: 5 }; s.hangar = 24 * 5;
  s.targets = [{ id: 'empty', distance: 1250, fleet: {} }]; s.windows = [{ start: 0, end: 1 }];
  const r = fleetSession(s);
  expect(r.maxCommittedBulk).toBe(120);
  expect(r.fuelSpent).toBe(60);
  expect(HULLS.VIPER).toBe(original);
});

it('rejects a partial physical catalog rather than falling back to cached live bulk', () => {
  const s = sessionScenario(); s.roster = prototypeRoster(1.1, 0.52, 0); s.bulk = { VIPER: 5 };
  expect(() => fleetSession(s)).toThrow();
});

it('builds the opening packet from paid orders instead of granting a fleet from a budget label', () => {
  const s = sessionScenario(); s.initialFleet = {}; s.targets = [{ id: 'empty', distance: 1250, fleet: {} }];
  s.stock = { alloy: 50000, crystal: 20000, deuterium: 5000 };
  const r = fleetSession(s);
  expect(r.launches).toHaveLength(1);
  expect(r.launches[0]!.at).toBeGreaterThanOrEqual(r.orders[0]!.due);
  expect(r.orders[0]!.at).toBe(0);
  expect(r.built.VIPER).toBe(24);
  expect(r.hullConservationError.VIPER).toBe(0);
});

it('keeps unfinished paid orders out of usable fleet when the session ends', () => {
  const s = sessionScenario(); s.initialFleet = {}; s.end = 1; s.windows = [{ start: 0, end: 1 }];
  const r = fleetSession(s);
  expect(r.orders.length).toBeGreaterThan(0);
  expect(r.home).toEqual({});
  expect(r.away).toEqual({});
  expect(r.launches).toEqual([]);
  expect(r.orders.every(o => !o.done)).toBe(true);
});

it('can explicitly choose a smaller available wing and charges its actual fuel', () => {
  const s = sessionScenario(); s.initialFleet = { VIPER: 12 }; s.minimumDispatchFraction = 0.5;
  s.targets = [{ id: 'empty', distance: 1250, fleet: {} }]; s.windows = [{ start: 0, end: 1 }];
  const r = fleetSession(s);
  expect(r.launches[0]!.sent).toEqual({ VIPER: 12 });
  expect(r.fuelSpent).toBe(missionFuel({ VIPER: 12 }, 1250, 2));
  expect(r.launches[0]!.at).toBe(0);
});

it('waits for a paid research gate before buying a hull and records actual completion', () => {
  const s = sessionScenario(); s.initialFleet = {}; s.packet = { VIPER: 1 }; s.desiredFleet = { VIPER: 1 };
  s.hullRequires = { VIPER: ['permission'] }; s.windows = [{ start: 0, end: 90 }];
  s.development = [{ id: 'permission', queue: 'research', minutes: 20, requires: [],
    cost: { alloy: 500, crystal: 100, deuterium: 5 } }];
  s.targets = [{ id: 'empty', distance: 1250, fleet: {} }];
  const r = fleetSession(s);
  expect(r.orders[0]!.at).toBe(20);
  expect(r.firstBuilt.VIPER).toBe(r.orders[0]!.due);
  expect(r.launches[0]!.at).toBeGreaterThanOrEqual(r.firstBuilt.VIPER!);
});

it('uses a stronger ready packet without granting it when its research completes', () => {
  const s = sessionScenario(); s.initialFleet = { DART: 2 }; s.desiredFleet = { DART: 2, VIPER: 1 };
  s.packet = { DART: 2 }; s.packetChoices = [{ VIPER: 1 }, { DART: 2 }]; s.hullRequires = { VIPER: ['permission'] };
  s.development = [{ id: 'permission', queue: 'research', minutes: 20, requires: [], cost: { alloy: 500, crystal: 100, deuterium: 5 } }];
  s.targets = Array.from({ length: 5 }, (_, i) => ({ id: String(i), distance: 1250, fleet: {} }));
  const r = fleetSession(s);
  expect(r.launches[0]!.sent).toEqual({ DART: 2 });
  const upper = r.launches.find(l => l.sent.VIPER === 1)!;
  expect(upper.at).toBeGreaterThanOrEqual(r.firstBuilt.VIPER!);
  expect(r.firstBuilt.VIPER).toBeGreaterThan(20);
});

it('skips a known hopeless fight and can choose another known suitable target', () => {
  const s = sessionScenario(); s.maxExpectedLossFraction = 0.3; s.windows = [{ start: 0, end: 1 }];
  s.targets = [{ id: 'hopeless', distance: 1250, fleet: { CITADEL: 100 } },
    { id: 'safe', distance: 1250, fleet: {} }];
  const r = fleetSession(s);
  expect(r.launches).toHaveLength(1);
  expect(r.launches[0]!.target).toBe('safe');
  expect(r.targets[0]!.attempted).toBe(false);
});

it('does not use the actual battle random seed to choose a supposedly safe attack', () => {
  const a = sessionScenario(); a.maxExpectedLossFraction = 0.3; a.windows = [{ start: 0, end: 1 }];
  const b = { ...a, seed: 1337 };
  expect(fleetSession(a).launches.map(l => l.target)).toEqual(fleetSession(b).launches.map(l => l.target));
});

it('adds salvaged ground units to surviving ground units instead of overwriting them', () => {
  const s = sessionScenario(); s.targets = [{ id: 'ground', distance: 1250, fleet: { THORN: 20 } }];
  s.windows = [{ start: 0, end: 1 }];
  expect(fleetSession(s).targets[0]!.fleet.THORN).toBe(15);
});

it('rejects cyclic development rather than waiting the entire season for an impossible gate', () => {
  const s = sessionScenario();
  const a = { queue: 'research' as const, cost: { alloy: 1, crystal: 0, deuterium: 0 }, minutes: 1 };
  s.development = [{ ...a, id: 'a', requires: ['b'] }, { ...a, id: 'b', requires: ['a'] }];
  expect(() => fleetSession(s)).toThrow();
});

it.each([1, 7, 42, 99, 1337])('preserves physical and resource invariants under wins, losses and smaller wings (seed %i)', seed => {
  for (const candidate of [false, true]) {
    const s = sessionScenario(); s.seed = seed; s.minimumDispatchFraction = 0.5;
    s.targets.push({ id: 'heavy', distance: 2500, fleet: { CITADEL: 50 } });
    if (candidate) {
      s.roster = prototypeRoster(1.1, 0.52, 0); s.bulk = { VIPER: 5, SENTINEL: 5, CITADEL: 13 }; s.hangar = 120;
    }
    const r = fleetSession(s);
    expect(r.launches.length).toBeLessThanOrEqual(s.targets.length);
    expect(new Set(r.launches.map(l => l.target)).size).toBe(r.launches.length);
    expect(r.maxCommittedBulk).toBeLessThanOrEqual(s.hangar);
    for (const l of r.launches) expect(s.windows.some(w => l.at >= w.start && l.at < w.end)).toBe(true);
    for (const o of r.orders) {
      expect(o.count).toBeGreaterThan(0); expect(Number.isInteger(o.count)).toBe(true);
      expect(o.due).toBeGreaterThan(o.at);
      expect(s.windows.some(w => o.at >= w.start && o.at < w.end)).toBe(true);
    }
    for (const n of [...Object.values(r.home), ...Object.values(r.away), ...Object.values(r.losses)]) {
      expect(Number.isInteger(n)).toBe(true); expect(n).toBeGreaterThanOrEqual(0);
    }
    for (const k of ['alloy', 'crystal', 'deuterium'] as const) {
      expect(r.stock[k]).toBeGreaterThanOrEqual(0); expect(r.works[k]).toBeGreaterThanOrEqual(0);
    }
    for (const n of Object.values(r.hullConservationError)) expect(n).toBe(0);
    for (const n of Object.values(r.resourceConservationError)) expect(Math.abs(n)).toBeLessThan(1e-7);
  }
});
