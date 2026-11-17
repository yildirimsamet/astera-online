import { alloyRate, crystalRate, moduleStage, productionMult, vesselRate, welcomeBox, welcomeNext } from '@astera/rules';
import { and, eq, inArray } from 'drizzle-orm';
import type { Clock } from '../clock.js';
import type { Db, Queryable, Tx } from '../db/client.js';
import { buildings, players, satellites, vessels, welcomeWeek } from '../db/schema.js';
import { capitalPlanet } from './ownership.js';
import { GameError, orbitFromRows, refreshWealth, saveResources, withPlanetLock } from './planet.js';
import { progressOf, withVesselLock } from './starter/vessel.js';

interface Rate { alloy: number; crystal: number }

/** What the capital makes an hour: its refinery and extractor at its orbit's pace. */
async function capitalRate(q: Queryable, planetId: string): Promise<Rate> {
  const [levels, orbit] = await Promise.all([
    q.select({ type: buildings.type, level: buildings.level }).from(buildings)
      .where(and(eq(buildings.planetId, planetId), inArray(buildings.type, ['REFINERY', 'EXTRACTOR', 'CORE']))),
    q.select({ slot: satellites.slot, type: satellites.type }).from(satellites).where(eq(satellites.planetId, planetId)),
  ]);
  const level = (type: string) => levels.find(row => row.type === type)?.level ?? 0;
  const mult = productionMult(orbitFromRows(orbit, level('CORE')));
  return { alloy: alloyRate(level('REFINERY')) * mult, crystal: crystalRate(level('EXTRACTOR')) * mult };
}

/** Where the box goes: the ship while it flies, the capital once it has landed. Null without a ship ever. */
async function destination(q: Queryable, accountId: string) {
  const [ship] = await q.select().from(vessels).where(eq(vessels.accountId, accountId));
  if (!ship) return null;
  if (ship.status !== 'DEPARTED') {
    const progress = progressOf(ship);
    const rate = { alloy: vesselRate.alloy(moduleStage(progress, 'REFINERY')), crystal: vesselRate.crystal(moduleStage(progress, 'EXTRACTOR')) };
    return { kind: 'ship' as const, rate };
  }
  const [player] = await q.select({ id: players.id }).from(players).where(eq(players.accountId, accountId)).limit(1);
  if (!player) return null;
  const capital = await capitalPlanet(q, player.id);
  return { kind: 'capital' as const, planetId: capital.id, rate: await capitalRate(q, capital.id) };
}

/** The welcome week as the panel draws it, or null for an account it is not for. */
export async function welcomeView(db: Db, accountId: string, now: Date) {
  const to = await destination(db, accountId);
  if (!to) return { welcome: null };
  const [row] = await db.select().from(welcomeWeek).where(eq(welcomeWeek.accountId, accountId));
  const opened = row?.opened ?? 0;
  const next = welcomeNext(opened, row ? row.lastOpenedAt.getTime() : null);
  return {
    welcome: {
      opened,
      box: next.box,
      // Ready "now" reads as now; a later moment as itself.
      readyAt: next.readyAtMs === null ? null : new Date(Math.max(next.readyAtMs, now.getTime())).toISOString(),
      preview: next.box === null ? null : welcomeBox(next.box, to.rate),
    },
  };
}

/** Counts the box under the row's lock: two presses at once open one. */
async function takeBox(tx: Tx, accountId: string, now: Date): Promise<number> {
  await tx.insert(welcomeWeek).values({ accountId, opened: 0, lastOpenedAt: now }).onConflictDoNothing();
  const [row] = await tx.select().from(welcomeWeek).where(eq(welcomeWeek.accountId, accountId)).for('update');
  const next = welcomeNext(row!.opened, row!.opened === 0 ? null : row!.lastOpenedAt.getTime());
  if (next.box === null) throw new GameError('WELCOME_DONE', 'Every welcome box is open', 409);
  if (next.readyAtMs! > now.getTime()) throw new GameError('WELCOME_NOT_READY', 'The next box is not ready yet', 409, { readyAt: new Date(next.readyAtMs!).toISOString() });
  await tx.update(welcomeWeek).set({ opened: next.box, lastOpenedAt: now }).where(eq(welcomeWeek.accountId, accountId));
  return next.box;
}

/** Opens the next box into the ship or the capital, in the transaction that counts it. */
export async function openWelcomeBox(db: Db, accountId: string, clock: Clock) {
  const to = await destination(db, accountId);
  if (!to) throw new GameError('WELCOME_NOT_ELIGIBLE', 'This account has no welcome week', 404);
  const granted = to.kind === 'ship'
    ? await withVesselLock(db, accountId, clock, async (tx, vessel) => {
      const box = welcomeBox(await takeBox(tx, accountId, vessel.now), to.rate);
      vessel.row = { ...vessel.row, alloy: vessel.row.alloy + box.alloy, crystal: vessel.row.crystal + box.crystal };
      return box;
    })
    : await withPlanetLock(db, to.planetId, clock, async (tx, planet) => {
      const box = welcomeBox(await takeBox(tx, accountId, clock.now()), to.rate);
      planet.alloy += box.alloy;
      planet.crystal += box.crystal;
      await saveResources(tx, to.planetId, { alloy: planet.alloy, crystal: planet.crystal, deuterium: planet.deuterium });
      await refreshWealth(tx, planet);
      return box;
    });
  return { granted, ...(await welcomeView(db, accountId, clock.now())) };
}

