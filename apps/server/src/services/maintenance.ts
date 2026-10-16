import { and, eq } from 'drizzle-orm';
import { HULLS, dockLocation, fleetCount, fleetEntries, selectHealthGroups, shipScrapReturn, type Fleet, type HpDamageLot, type HpDamageLots } from '@astera/rules';
import type { Db } from '../db/client.js';
import type { Clock } from '../clock.js';
import { shipDamageLots, units } from '../db/schema.js';
import { readHomeHealth, writeHomeHealth } from './homeHealth.js';
import { idempotentMutation } from './idempotency.js';
import { GameError, assertWorldOperational, loadLocked, recomputePlayerWealth, saveResources, setUnits } from './planet.js';
import { loadPlanetViewData, buildPlanetView } from './planetView.js';
import { dockLotsOf, landHpShips } from './shipDamage.js';
import { assertWorkshopOpen } from './workshop.js';
import { fleetChangesWatch, publishWatchChanges } from './watchEvents.js';

export type MaintenanceSelection = { source: 'HOME'; groups: HpDamageLots }
  | { source: 'DOCK'; lots: readonly { id: string; count: number; damageBp?: number; remainderBp?: number }[] };
export type MaintenanceAction = 'DOCK' | 'RETURN' | 'SCRAP';

/** Under the planet lock: exact selection, movement and refund commit together. */
export async function maintenanceAction(db: Db, playerId: string, planetId: string, action: MaintenanceAction,
  selection: MaintenanceSelection, key: string, clock: Clock) {
  const receipt = await idempotentMutation(db, { playerId, operation: `maintenance:${planetId}:${action}`, key,
    body: selection, now: clock.now() }, async (tx) => {
    const planet = await loadLocked(tx, planetId, clock, { expectedPlayerId: playerId });
    assertWorldOperational(planet);
    if (action !== 'RETURN') await assertWorkshopOpen(tx, planet);
    const fleet: Fleet = {};
    const damage: HpDamageLot[] = [];
    if (selection.source === 'HOME') {
      if (selection.groups.some(group => HULLS[group.hull].ground)) {
        throw new GameError('BAD_MAINTENANCE_SELECTION', 'Ground defenses cannot enter ship maintenance', 400);
      }
      if (action === 'RETURN') throw new GameError('BAD_MAINTENANCE_SELECTION', 'Only docked ships can be returned', 400);
      const home = await readHomeHealth(tx, planetId);
      let chosen;
      try { chosen = selectHealthGroups(home.fleet, home.damage, selection.groups); }
      catch (error) {
        if (!(error instanceof RangeError)) throw error;
        throw new GameError('SHIP_SELECTION_CHANGED', 'The selected health group changed; refresh the selection', 409);
      }
      Object.assign(fleet, chosen.selected);
      damage.push(...chosen.selectedDamage);
      if (action === 'DOCK' && damage.reduce((total, lot) => total + lot.count, 0) !== fleetCount(fleet)) {
        throw new GameError('SHIP_NOT_DAMAGED', 'Only damaged ships can enter the workshop', 409);
      }
      const counts = { ...chosen.remaining };
      for (const [hull] of fleetEntries(chosen.selected)) counts[hull] ??= 0;
      await setUnits(tx, planetId, counts, 'home', playerId);
      await writeHomeHealth(tx, planetId, chosen.remaining, chosen.remainingDamage);
    } else {
      if (action === 'DOCK') throw new GameError('BAD_MAINTENANCE_SELECTION', 'Those ships are already docked', 400);
      const waiting = await dockLotsOf(tx, planetId);
      const seen = new Set<string>();
      if (selection.lots.length === 0) throw new GameError('SHIP_SELECTION_CHANGED', 'No ships selected', 409);
      for (const picked of selection.lots) {
        const lot = waiting.find((row) => row.id === picked.id);
        if (!lot || seen.has(picked.id) || !Number.isSafeInteger(picked.count) || picked.count < 1 || picked.count > lot.count) {
          throw new GameError('SHIP_SELECTION_CHANGED', 'The selected dock group changed; refresh the selection', 409);
        }
        if (HULLS[lot.hull].ground) throw new GameError('BAD_MAINTENANCE_SELECTION', 'Ground defenses cannot enter ship maintenance', 400);
        if (lot.repairing) throw new GameError('REPAIR_LOT_BUSY', 'Cancel the repair before moving or scrapping these ships', 409);
        if (action === 'SCRAP' && ((picked.damageBp !== undefined && picked.damageBp !== lot.damageBp)
          || (picked.remainderBp !== undefined && picked.remainderBp !== (lot.remainderBp ?? 0)))) {
          throw new GameError('SHIP_SELECTION_CHANGED', 'The selected ships have changed health; refresh the quote', 409);
        }
        seen.add(picked.id);
        fleet[lot.hull] = (fleet[lot.hull] ?? 0) + picked.count;
        damage.push({ hull: lot.hull, count: picked.count, damageBp: lot.damageBp, remainderBp: lot.remainderBp ?? 0 });
        const condition = and(eq(units.planetId, planetId), eq(units.location, dockLocation(lot.id)));
        if (picked.count === lot.count) {
          await tx.delete(units).where(condition);
          await tx.delete(shipDamageLots).where(eq(shipDamageLots.id, lot.id));
        } else await tx.update(units).set({ count: lot.count - picked.count }).where(condition);
      }
    }
    const returned = action === 'SCRAP' ? shipScrapReturn(fleet, damage) : { alloy: 0, crystal: 0, deuterium: 0 };
    if (action === 'DOCK') {
      for (const lot of damage) {
        const [row] = await tx.insert(shipDamageLots).values({ planetId, hull: lot.hull, damageBp: lot.damageBp,
          remainderBp: lot.remainderBp ?? 0, createdAt: planet.now }).returning({ id: shipDamageLots.id });
        if (!row) throw new Error('manual dock insert returned no row');
        await setUnits(tx, planetId, { [lot.hull]: lot.count }, dockLocation(row.id), playerId);
      }
    } else if (action === 'RETURN') {
      await landHpShips(tx, { planetId, ownerPlayerId: playerId, fleet, damage, at: planet.now });
    } else await saveResources(tx, planetId, { alloy: planet.alloy + returned.alloy,
      crystal: planet.crystal + returned.crystal, deuterium: planet.deuterium + returned.deuterium });
    if ((selection.source === 'HOME' || action === 'RETURN') && fleetChangesWatch(fleet)) {
      await publishWatchChanges(tx, [planetId]);
    }
    await recomputePlayerWealth(tx, playerId, clock.now());
    return { returned };
  });
  const planet = await db.transaction(async tx => {
    await loadLocked(tx, planetId, clock, { expectedPlayerId: playerId });
    return loadPlanetViewData(tx, planetId, clock);
  });
  return { ...receipt, planet: buildPlanetView(planet) };
}
