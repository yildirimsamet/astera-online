import { SHIP_DAMAGE, healthGroupKey, shipCanFight, shipHealthGroups, shipHpRepairCost, shipScrapReturn,
  type Fleet, type HpDamageLot, type HpDamageLots } from '@astera/rules';
import type { MaintenanceSelection, RepairRequest } from '../api/client.js';
import type { DockLot } from './repairStation.js';

export type MaintenanceRow = HpDamageLot & { key: string; busy: boolean; minutes: number }
  & ({ source: 'HOME' } | { source: 'DOCK'; lotId: string });

export function homeMaintenanceRows(fleet: Fleet, damage: HpDamageLots | null | undefined): MaintenanceRow[] {
  return shipHealthGroups(fleet, damage).map((lot) => ({ ...lot, source: 'HOME', key: healthGroupKey(lot), busy: false, minutes: 0 }));
}

export function dockMaintenanceRows(lots: readonly DockLot[], keyBy: 'HEALTH' | 'LOT' = 'HEALTH'): MaintenanceRow[] {
  return lots.map((lot) => ({ ...lot, source: 'DOCK', lotId: lot.id,
    key: keyBy === 'LOT' ? lot.id : `${lot.id}:${healthGroupKey(lot)}`,
    busy: lot.repairing, minutes: lot.minutes }));
}

/** A rounded number never grants eligibility or hides a surviving sliver as zero. */
export function healthDisplay(lot: Pick<HpDamageLot, 'damageBp' | 'remainderBp'>): {
  percent: number; relation: 'exact' | 'above' | 'below';
} {
  const canFight = shipCanFight(lot);
  const raw = ((SHIP_DAMAGE.destroyedBp - lot.damageBp) - (lot.remainderBp ?? 0)) / 100;
  const percent = Math.round(raw * 100) / 100;
  if (percent === 0) return { percent: 0.01, relation: 'below' };
  if (percent === 100 && (lot.damageBp > 0 || (lot.remainderBp ?? 0) > 0)) return { percent, relation: 'below' };
  if (percent === 5 && canFight) return { percent, relation: 'above' };
  if (percent === 5 && (lot.damageBp > 9500 || (lot.remainderBp ?? 0) > 0)) return { percent, relation: 'below' };
  return { percent, relation: 'exact' };
}

/** New arrivals start unselected; a changed health group invalidates confirmation. */
export function maintenanceChoice(rows: readonly MaintenanceRow[], quantities: Readonly<Record<string, number>>, pct: number) {
  const selected: (MaintenanceRow & { chosen: number })[] = [];
  const byKey = new Map(rows.map(row => [row.key, row]));
  let stale = false;
  for (const [key, count] of Object.entries(quantities)) {
    if (count === 0) continue;
    const row = byKey.get(key);
    if (!row || row.busy || !Number.isSafeInteger(count) || count < 1 || count > row.count) { stale = true; continue; }
    selected.push({ ...row, chosen: count });
  }
  const fleet: Fleet = {};
  const damage = selected.map((row) => {
    fleet[row.hull] = (fleet[row.hull] ?? 0) + row.chosen;
    return { hull: row.hull, count: row.chosen, damageBp: row.damageBp, remainderBp: row.remainderBp ?? 0 };
  });
  const sources = new Set(selected.map((row) => row.source));
  const tooMany = selected.length > SHIP_DAMAGE.repairLotsPerOrder;
  if (sources.size > 1) stale = true;
  let selection: MaintenanceSelection | null = null;
  let repair: RepairRequest | null = null;
  if (!stale && !tooMany && selected.length > 0) {
    if (sources.has('HOME')) selection = { source: 'HOME', groups: damage };
    else {
      const lots = selected.flatMap((row) => row.source === 'DOCK'
        ? [{ id: row.lotId, count: row.chosen, damageBp: row.damageBp, remainderBp: row.remainderBp ?? 0 }] : []);
      selection = { source: 'DOCK', lots };
      repair = { lots };
    }
  }
  return { selected, selection, repair, stale, tooMany, ships: selected.reduce((sum, row) => sum + row.chosen, 0),
    damagedOnly: damage.every((lot) => lot.damageBp > 0 || lot.remainderBp > 0),
    repairCost: shipHpRepairCost(damage, pct), scrap: shipScrapReturn(fleet, damage),
    minutes: selected.reduce((sum, row) => sum + row.minutes * row.chosen / row.count, 0) };
}
