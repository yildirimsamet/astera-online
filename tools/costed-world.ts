/** Current-rule structural adapter for the candidate ledger. Prices are a reference, not new balance. */
import { alloyRate, crystalRate, deuteriumRate, storageCap, collectorCap, deuteriumStorageCap,
  deuteriumCollectorCap, flightSlots, buildingCost, buildMinutes, researchMinutes,
  RESEARCH_PROJECTS, plantCeiling, DEUTERIUM, instrumentCost, instrumentMaxed, satelliteCost,
  satelliteSlots, seeingUnlocked, productionMult, protectedHours, vaultProtects } from '../packages/rules/src/index.js';
import type { BuildingId, ResearchProjectId, InstrumentId, SatelliteId, Resources } from '../packages/rules/src/types.js';
import type { TechLevels } from '../packages/rules/src/tech.js';
import { designBuilding, designIncome, designInvoice, designResearch, designSeason } from './economy-design-model.js';

export interface CostedWorld {
  buildings: Record<BuildingId, number>; tech: TechLevels;
  /** Explicit target-derived candidate; incompatible with historical invoice multipliers. */
  design?: { seasonDays: number };
  /** Candidate invoice factors; early = Engineering1/Power1–2, late = remaining selected military rungs. */
  prices?: { earlyMilitary: number; lateMilitary: number };
  collectorHours?: number;
  instruments?: Partial<Record<InstrumentId, number>>;
  orbit?: SatelliteId[];
}
export type WorldOrder = { building: BuildingId; level: number } | { research: ResearchProjectId; level: number }
  | { instrument: InstrumentId; level: number } | { satellite: SatelliteId };
export const worldQueue = (order: WorldOrder) => 'research' in order ? 'research' as const : 'construction' as const;
export const cloneWorld = (w: CostedWorld): CostedWorld => ({ ...w, buildings: { ...w.buildings }, tech: { ...w.tech },
  instruments: { ...w.instruments }, orbit: [...(w.orbit ?? [])] });
/** An aspirational military reserve may not deadlock a purchase that fits the actual store. */
export function developmentReserve(rate: Resources, storage: Resources, bill: Resources, hours: number): Resources {
  return {
    alloy: Math.min(rate.alloy * hours, Math.max(0, storage.alloy - bill.alloy)),
    crystal: Math.min(rate.crystal * hours, Math.max(0, storage.crystal - bill.crystal)),
    deuterium: Math.min(rate.deuterium * hours, Math.max(0, storage.deuterium - bill.deuterium)),
  };
}
export function emptyWorld(): CostedWorld {
  return { buildings: { CORE: 0, REFINERY: 0, EXTRACTOR: 0, VAULT: 0, SHIPYARD: 0, DEUTERIUM_PLANT: 0 }, tech: {} };
}
export function worldProtection(w: CostedWorld): Resources {
  const b = w.buildings;
  if (!w.design) return vaultProtects(b.VAULT, b.REFINERY, b.EXTRACTOR, b.DEUTERIUM_PLANT);
  const rate = worldStats(w).rate, hours = protectedHours(b.VAULT);
  return { alloy: Math.round(Math.max(100, rate.alloy * hours)),
    crystal: Math.round(Math.max(50, rate.crystal * hours)), deuterium: Math.round(rate.deuterium * hours) };
}
export function worldStats(w: CostedWorld) {
  if (w.design) {
    designSeason(w.design.seasonDays);
    if (w.prices) throw new Error('Mixed economy designs');
  }
  if (w.collectorHours !== undefined && (!Number.isFinite(w.collectorHours) || w.collectorHours <= 0)) throw new Error('Invalid Works hours');
  const b = w.buildings;
  const mult = productionMult(w.orbit ?? []);
  const rate = w.design ? { alloy: designIncome(b.REFINERY).alloy * mult, crystal: designIncome(b.EXTRACTOR).crystal * mult,
    deuterium: designIncome(b.DEUTERIUM_PLANT).deuterium * mult }
    : { alloy: alloyRate(b.REFINERY) * mult, crystal: crystalRate(b.EXTRACTOR) * mult, deuterium: deuteriumRate(b.DEUTERIUM_PLANT) * mult };
  const collectorHours = w.collectorHours ?? (w.design ? 12 : undefined);
  return { rate, yard: b.SHIPYARD, bays: flightSlots(b.CORE),
    storage: { alloy: storageCap(rate.alloy, b.VAULT), crystal: storageCap(rate.crystal, b.VAULT),
      deuterium: deuteriumStorageCap(rate.deuterium, rate.crystal, b.VAULT) },
    works: collectorHours === undefined ? { alloy: collectorCap(rate.alloy), crystal: collectorCap(rate.crystal),
      deuterium: deuteriumCollectorCap(rate.deuterium, rate.crystal) } : {
      alloy: rate.alloy * collectorHours, crystal: rate.crystal * collectorHours,
      deuterium: (rate.deuterium + rate.crystal * DEUTERIUM.containmentRatio) * collectorHours } };
}
export function quoteWorldOrder(w: CostedWorld, order: WorldOrder, at: number) {
  if (w.design) { designSeason(w.design.seasonDays); if (w.prices) throw new Error('Mixed economy designs'); }
  if (w.prices && Object.values(w.prices).some(n => !Number.isFinite(n) || n <= 0)) throw new Error('Invalid invoice factors');
  if (('level' in order && (!Number.isInteger(order.level) || order.level < 1)) || !Number.isFinite(at) || at < 0) throw new Error('Invalid world order');
  if ('satellite' in order) {
    const orbit = w.orbit ?? [];
    if (orbit.includes(order.satellite) || orbit.length >= satelliteSlots(w.buildings.CORE)) return null;
    const effort = { UPLINK: 0.5, FOUNDRY: 4, DERRICK: 4, BEACON: 5 }[order.satellite];
    const cost = w.design ? designInvoice(designIncome(order.satellite === 'UPLINK' ? 1 : 6),
      { alloy: effort, crystal: effort, deuterium: 0 }) : satelliteCost(order.satellite);
    return { cost, minutes: buildMinutes(cost, w.buildings.CORE, {}), queue: 'construction' as const };
  }
  if ('instrument' in order) {
    const level = w.instruments?.[order.instrument] ?? 0;
    if (order.level !== level + 1 || order.level > w.buildings.CORE || instrumentMaxed(order.instrument, level)
      || (['TELESCOPE', 'RADAR'].includes(order.instrument) && !seeingUnlocked(w.orbit ?? []))) return null;
    const cost = w.design ? designInvoice(designIncome(Math.min(30, (level + 1) * 2)),
      { alloy: 0.8 * 2 ** level, crystal: 1.2 * 2 ** level, deuterium: 0 }) : instrumentCost(order.instrument, level);
    return { cost, minutes: buildMinutes(cost, w.buildings.CORE, {}), queue: 'construction' as const };
  }
  if ('building' in order) {
    const current = w.buildings[order.building];
    if (order.level !== current + 1 || (order.building !== 'CORE' && order.level > w.buildings.CORE)
      || (order.building === 'DEUTERIUM_PLANT' && order.level > plantCeiling(w.tech.DEUTERIUM_SYNTHESIS ?? 0))) return null;
    if (w.design) return { ...designBuilding(order.building, order.level, w.design.seasonDays), queue: 'construction' as const };
    const cost = buildingCost(order.building, current);
    return { cost, minutes: buildMinutes(cost, w.buildings.CORE, {}), queue: 'construction' as const };
  }
  const p = RESEARCH_PROJECTS[order.research];
  if (order.level !== (w.tech[order.research] ?? 0) + 1 || order.level > p.maxLevel
    || at < p.availableAtMinutes || w.buildings.CORE < (p.requiredCore ?? 0)
    || (p.prerequisite !== null && (w.tech[p.prerequisite] ?? 0) === 0)) return null;
  if (w.design) return { ...designResearch(order.research, order.level, w.design.seasonDays), queue: 'research' as const };
  const base = p.costAt(order.level);
  const military = ['STARSHIP_ENGINEERING', 'SHIP_POWER', 'SHIP_ARMOR'].includes(order.research);
  const early = (order.research === 'STARSHIP_ENGINEERING' && order.level === 1)
    || (order.research === 'SHIP_POWER' && order.level <= 2);
  const factor = military && w.prices ? (early ? w.prices.earlyMilitary : w.prices.lateMilitary) : 1;
  const cost = { alloy: Math.ceil(base.alloy * factor), crystal: Math.ceil(base.crystal * factor), deuterium: Math.ceil(base.deuterium * factor) };
  return { cost, minutes: researchMinutes(cost, w.buildings.CORE), queue: 'research' as const };
}
export function completeWorldOrder(w: CostedWorld, order: WorldOrder) {
  if ('building' in order) w.buildings[order.building] = order.level;
  else if ('research' in order) w.tech[order.research] = order.level;
  else if ('instrument' in order) (w.instruments ??= {})[order.instrument] = order.level;
  else (w.orbit ??= []).push(order.satellite);
}
