import { expect, it } from 'vitest';
import { buildingCost, buildMinutes, RESEARCH_PROJECTS, storageCap, alloyRate, instrumentCost, satelliteCost } from '../packages/rules/src/index.js';
import { emptyWorld, quoteWorldOrder, completeWorldOrder, worldStats, developmentReserve, worldProtection } from './costed-world.js';
import { designBuilding, designIncome, designResearch } from './economy-design-model.js';

it('protects each new-design resource using its own actual production instead of historical rates', () => {
  const w = emptyWorld(); w.design = { seasonDays: 14 };
  w.buildings.REFINERY = 6; w.buildings.EXTRACTOR = 4; w.buildings.DEUTERIUM_PLANT = 3; w.buildings.VAULT = 6;
  const p = worldProtection(w), s = worldStats(w);
  expect(p.alloy).toBe(Math.round(s.storage.alloy * 0.15));
  expect(p.crystal).toBe(Math.round(s.storage.crystal * 0.15));
  // Containment capacity is not passive D production and creates no protected resource grant.
  expect(p.deuterium).toBeLessThan(s.storage.deuterium * 0.15);
  w.buildings.DEUTERIUM_PLANT = 0;
  expect(worldProtection(w).deuterium).toBe(0);
});

it('uses target-derived production and invoices only when the new design is explicitly selected', () => {
  const w = emptyWorld(); w.design = { seasonDays: 14 };
  const core = quoteWorldOrder(w, { building: 'CORE', level: 1 }, 0)!;
  expect(core.cost).toEqual(designBuilding('CORE', 1, 14).cost);
  expect(core.minutes).toBe(designBuilding('CORE', 1, 14).minutes);
  completeWorldOrder(w, { building: 'CORE', level: 1 });
  completeWorldOrder(w, { building: 'REFINERY', level: 1 });
  expect(worldStats(w).rate.alloy).toBe(designIncome(1).alloy);
  expect(worldStats(w).works.alloy).toBe(designIncome(1).alloy * 12);
  expect(quoteWorldOrder(w, { research: 'STARSHIP_ENGINEERING', level: 1 }, 0)?.cost)
    .toEqual(designResearch('STARSHIP_ENGINEERING', 1, 14).cost);
  expect(quoteWorldOrder(w, { research: 'SHIP_POWER', level: 1 }, 0)).toBeNull();
  w.prices = { earlyMilitary: 0.2, lateMilitary: 0.5 };
  expect(() => quoteWorldOrder(w, { building: 'CORE', level: 2 }, 0)).toThrow();
});

it('does not demand an impossible reserve on top of a capacity-sized invoice', () => {
  expect(developmentReserve({ alloy: 100, crystal: 20, deuterium: 0 },
    { alloy: 150, crystal: 200, deuterium: 0 }, { alloy: 120, crystal: 10, deuterium: 0 }, 3))
    .toEqual({ alloy: 30, crystal: 60, deuterium: 0 });
});

it('charges orbital and sensor hardware, enforcing Core, Uplink, unique satellites and sensor ceilings', () => {
  const w = emptyWorld();
  expect(quoteWorldOrder(w, { satellite: 'UPLINK' }, 0)).toBeNull();
  w.buildings.CORE = 1;
  expect(quoteWorldOrder(w, { instrument: 'TELESCOPE', level: 1 }, 0)).toBeNull();
  expect(quoteWorldOrder(w, { satellite: 'UPLINK' }, 0)?.cost).toEqual(satelliteCost('UPLINK'));
  completeWorldOrder(w, { satellite: 'UPLINK' });
  expect(quoteWorldOrder(w, { satellite: 'UPLINK' }, 0)).toBeNull();
  expect(quoteWorldOrder(w, { satellite: 'DERRICK' }, 0)).toBeNull();
  expect(quoteWorldOrder(w, { instrument: 'TELESCOPE', level: 1 }, 0)?.cost).toEqual(instrumentCost('TELESCOPE', 0));
  completeWorldOrder(w, { instrument: 'TELESCOPE', level: 1 });
  expect(quoteWorldOrder(w, { instrument: 'TELESCOPE', level: 2 }, 0)).toBeNull();
  w.buildings.CORE = 12;
  completeWorldOrder(w, { instrument: 'TELESCOPE', level: 5 });
  expect(quoteWorldOrder(w, { instrument: 'TELESCOPE', level: 6 }, 0)).toBeNull();
});

it('starts with no invented industrial income or installed shipyard', () => {
  const world = emptyWorld();
  expect(worldStats(world).rate).toEqual({ alloy: 0, crystal: 0, deuterium: 0 });
  expect(world.buildings.SHIPYARD).toBe(0);
  expect(world.tech).toEqual({});
});

it('prices each building rung once and enforces Core and synthesis gates', () => {
  const w = emptyWorld();
  expect(quoteWorldOrder(w, { building: 'REFINERY', level: 1 }, 0)).toBeNull();
  const core = quoteWorldOrder(w, { building: 'CORE', level: 1 }, 0)!;
  expect(core.cost).toEqual(buildingCost('CORE', 0));
  expect(core.minutes).toBe(buildMinutes(core.cost, 0));
  completeWorldOrder(w, { building: 'CORE', level: 1 });
  expect(quoteWorldOrder(w, { building: 'REFINERY', level: 1 }, 0)).not.toBeNull();
  expect(quoteWorldOrder(w, { building: 'DEUTERIUM_PLANT', level: 1 }, 0)).toBeNull();
  expect(quoteWorldOrder(w, { building: 'CORE', level: 1 }, 0)).toBeNull();
});

it('quotes actual research rungs and rejects skipping prerequisite research', () => {
  const w = emptyWorld();
  expect(quoteWorldOrder(w, { research: 'SHIP_POWER', level: 1 }, 0)).toBeNull();
  const q = quoteWorldOrder(w, { research: 'STARSHIP_ENGINEERING', level: 1 }, 0)!;
  expect(q.cost).toEqual(RESEARCH_PROJECTS.STARSHIP_ENGINEERING.costAt(1));
  completeWorldOrder(w, { research: 'STARSHIP_ENGINEERING', level: 1 });
  expect(quoteWorldOrder(w, { research: 'SHIP_POWER', level: 1 }, 0)).not.toBeNull();
  expect(quoteWorldOrder(w, { research: 'SHIP_POWER', level: 3 }, 0)).toBeNull();
});

it('derives storage from paid Vault and production levels rather than fixed 48 hours', () => {
  const w = emptyWorld(); w.buildings.REFINERY = 3; w.buildings.VAULT = 2;
  expect(worldStats(w).storage.alloy).toBe(storageCap(alloyRate(3), 2));
});

it('scales the actual research invoice and its duration without changing production or prerequisites', () => {
  const w = emptyWorld();
  const reference = quoteWorldOrder(w, { research: 'STARSHIP_ENGINEERING', level: 1 }, 0)!;
  w.prices = { earlyMilitary: 0.5, lateMilitary: 0.8 };
  const q = quoteWorldOrder(w, { research: 'STARSHIP_ENGINEERING', level: 1 }, 0)!;
  expect(q.cost.alloy).toBe(Math.ceil(reference.cost.alloy * 0.5));
  expect(q.minutes).toBeLessThan(reference.minutes);
  expect(quoteWorldOrder(w, { research: 'SHIP_POWER', level: 1 }, 0)).toBeNull();
  expect(worldStats(w)).toEqual(worldStats(emptyWorld()));
  w.prices.earlyMilitary = -1;
  expect(() => quoteWorldOrder(w, { research: 'STARSHIP_ENGINEERING', level: 1 }, 0)).toThrow();
});

it('extends offline accumulation capacity without multiplying hourly income or spendable storage', () => {
  const w = emptyWorld(); w.buildings.REFINERY = 2; w.buildings.EXTRACTOR = 2;
  const before = worldStats(w); w.collectorHours = 12;
  const after = worldStats(w);
  expect(after.rate).toEqual(before.rate);
  expect(after.storage).toEqual(before.storage);
  expect(after.works.alloy).toBeCloseTo(after.rate.alloy * 12);
  expect(after.works.alloy).toBeGreaterThan(before.works.alloy);
  w.collectorHours = -1;
  expect(() => worldStats(w)).toThrow();
});
