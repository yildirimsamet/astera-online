import { advanceVesselEconomy } from '@astera/rules';
import { and, asc, eq, gt, inArray, isNull, lte, ne } from 'drizzle-orm';
import type { Clock } from '../clock.js';
import type { Db } from '../db/client.js';
import { notifications, planets, players, pushDevices, returnReminders, starterGalaxies, starterDepartures, vesselMigrations, vesselNotifications, vessels } from '../db/schema.js';
import { loadLocked } from './planet.js';
import { mainTarget, planPlanetReturn, planStarterReturn, starterTarget } from './returnPlanning.js';
import { nextReturnCheck } from './returnSchedule.js';
import { sendPush } from './notificationCenter.js';
import { returnMessage, type ReturnEvent } from './returnCopy.js';
export { planPlanetReturn, planStarterReturn } from './returnPlanning.js';

const HOUR = 3_600_000, DAY = 24 * HOUR;
const lastDiscovery = new WeakMap<Db, number>();

/** Bounded ten-minute backfill; command paths use eligibility from their existing locked read. */
async function discover(db: Db, clock: Clock): Promise<void> {
  const now = clock.now().getTime(), previous = lastDiscovery.get(db);
  if (previous !== undefined && now >= previous && now - previous < 10 * 60_000) return;
  lastDiscovery.set(db, now);
  const ships = await db.selectDistinct({ ship: vessels }).from(vessels).innerJoin(pushDevices, eq(pushDevices.accountId, vessels.accountId))
    .leftJoin(returnReminders, eq(returnReminders.accountId, vessels.accountId)).where(and(ne(vessels.status, 'DEPARTED'), isNull(returnReminders.accountId))).limit(100);
  for (const { ship } of ships) await db.transaction(tx => planStarterReturn(tx, ship, clock.now(), true));
  const worlds = await db.selectDistinct({ id: planets.id, accountId: players.accountId, lastActiveAt: players.lastActiveAt }).from(planets).innerJoin(players, eq(players.id, planets.controllerPlayerId))
    .innerJoin(pushDevices, eq(pushDevices.accountId, players.accountId)).leftJoin(returnReminders, eq(returnReminders.accountId, players.accountId))
    .where(and(eq(planets.kind, 'CAPITAL'), isNull(returnReminders.accountId))).limit(100);
  for (const world of worlds) await db.transaction(async tx => {
    const planet = await loadLocked(tx, world.id, clock);
    if (planet.returnEligible) { await planPlanetReturn(tx, planet); return; }
    // An absence older than both summaries began before this phone was known: nothing is owed for it.
    const stage = clock.now().getTime() - world.lastActiveAt.getTime() >= 3 * DAY ? 2 : 0;
    await tx.insert(returnReminders).values({ accountId: world.accountId, planetId: world.id, absenceAt: world.lastActiveAt, summaryStage: stage, nextCheckAt: nextReturnCheck(world.lastActiveAt, stage, null) }).onConflictDoNothing();
  });
}

function eventKind(kind: string): ReturnEvent['kind'] {
  if (['BATTLE_REPORT', 'raided', 'raid_result', 'death_star_result', 'colony_lost', 'colony_captured', 'convoy_result'].includes(kind)) return 'battle';
  if (['PROBE_DETECTED', 'scan_detected'].includes(kind)) return 'probe';
  if (['REPAIR_DONE', 'DOCK_DONE'].includes(kind)) return 'repair';
  if (['FLEET_HOME', 'fleet_returned'].includes(kind)) return 'fleet';
  return 'other';
}

export async function sweepReturnSignals(db: Db, clock: Clock): Promise<void> {
  await discover(db, clock);
  const now = clock.now();
  const due = await db.select().from(returnReminders).where(lte(returnReminders.nextCheckAt, now))
    .orderBy(asc(returnReminders.nextCheckAt)).limit(100);
  for (const reminder of due) {
    const messages = await db.transaction(async tx => {
      // Commands lock the world before its reminder. A removed season leaves no work behind.
      if (reminder.planetId) {
        const [world] = await tx.select({ id: planets.id }).from(planets).where(eq(planets.id, reminder.planetId));
        if (!world) { await tx.delete(returnReminders).where(and(eq(returnReminders.accountId, reminder.accountId), eq(returnReminders.planetId, reminder.planetId))); return []; }
      }
      const main = reminder.planetId ? await loadLocked(tx, reminder.planetId, clock) : null;
      const [locked] = await tx.select().from(returnReminders).where(eq(returnReminders.accountId, reminder.accountId)).for('update', { skipLocked: true });
      if (!locked?.nextCheckAt || locked.nextCheckAt > now) return [];
      const ref = locked.vesselId ?? locked.planetId;
      if (!ref) { await tx.delete(returnReminders).where(eq(returnReminders.accountId, locked.accountId)); return []; }
      let lastSeen: Date, funded: boolean;
      let events: ReturnEvent[];
      if (locked.vesselId) {
        const [ship] = await tx.select().from(vessels).where(eq(vessels.id, locked.vesselId));
        if (!ship || ship.status === 'DEPARTED' || ship.status === 'DEPARTING') {
          await tx.update(returnReminders).set({ nextCheckAt: null }).where(eq(returnReminders.accountId, locked.accountId)); return [];
        }
        lastSeen = ship.lastSeenAt;
        const [galaxy] = await tx.select({ epoch: starterGalaxies.epoch }).from(starterGalaxies).where(eq(starterGalaxies.id, ship.starterGalaxyId));
        if (!galaxy) return [];
        const held = advanceVesselEconomy({ ...ship, disruptedUntilMinutes: 0 }, ship.modules, (now.getTime() - galaxy.epoch.getTime()) / 60_000);
        const target = await starterTarget(tx, ship);
        funded = target?.subject === locked.subject && held.alloy + held.bufferAlloy >= target.alloy && held.crystal + held.bufferCrystal >= target.crystal;
        const notes = await tx.select({ kind: vesselNotifications.kind }).from(vesselNotifications).where(and(eq(vesselNotifications.vesselId, ship.id), gt(vesselNotifications.createdAt, lastSeen), inArray(vesselNotifications.kind, ['REPAIR_DONE', 'DOCK_DONE', 'PROBE_DETECTED', 'FLEET_HOME', 'BATTLE_REPORT'])));
        const departures = await tx.select({ name: starterDepartures.displayName }).from(starterDepartures).where(and(eq(starterDepartures.starterGalaxyId, ship.starterGalaxyId), gt(starterDepartures.at, lastSeen)));
        events = [...notes.map(note => ({ kind: eventKind(note.kind) })), ...departures.map(departure => ({ kind: 'departure' as const, name: departure.name }))];
      } else {
        if (!main) return [];
        const [player] = await tx.select().from(players).where(eq(players.id, main.playerId));
        if (!player) return [];
        lastSeen = player.lastActiveAt;
        const [landing] = await tx.select().from(vesselMigrations).where(and(eq(vesselMigrations.playerId, player.id), eq(vesselMigrations.status, 'DONE')));
        const target = landing?.completedAt && now.getTime() - landing.completedAt.getTime() < 7 * DAY ? await mainTarget(tx, main) : undefined;
        funded = target?.subject === locked.subject && main.alloy + main.bufferAlloy >= target.alloy && main.crystal + main.bufferCrystal >= target.crystal;
        const notes = await tx.select({ kind: notifications.kind }).from(notifications).where(and(eq(notifications.playerId, player.id), gt(notifications.createdAt, lastSeen)));
        events = notes.map(note => ({ kind: eventKind(note.kind) }));
      }
      const output: { kind: 'repair_funded' | 'while_away'; events: ReturnEvent[]; ref: string }[] = [];
      const awayMs = now.getTime() - lastSeen.getTime();
      const stage = lastSeen.getTime() === locked.absenceAt.getTime() ? locked.summaryStage : 0;
      let nextRepairAt = locked.nextRepairAt;
      if (nextRepairAt && nextRepairAt <= now) {
        if (awayMs < 3 * HOUR) nextRepairAt = new Date(lastSeen.getTime() + 3 * HOUR);
        else if (funded && locked.lastFundedAt && now.getTime() - locked.lastFundedAt.getTime() < DAY) nextRepairAt = new Date(locked.lastFundedAt.getTime() + DAY);
        else {
          if (funded) {
            output.push({ kind: 'repair_funded', events: [], ref });
            await tx.update(returnReminders).set({ lastFundedAt: now }).where(eq(returnReminders.accountId, locked.accountId));
          }
          nextRepairAt = null;
        }
      }
      let nextStage = stage;
      if (stage < 2 && awayMs >= (stage === 0 ? DAY : 3 * DAY)) {
        if (events.length) output.push({ kind: 'while_away', events, ref });
        nextStage = awayMs >= 3 * DAY ? 2 : 1;
      }
      await tx.update(returnReminders).set({ absenceAt: lastSeen, summaryStage: nextStage, nextRepairAt, nextCheckAt: nextReturnCheck(lastSeen, nextStage, nextRepairAt) }).where(eq(returnReminders.accountId, locked.accountId));
      return output;
    });
    if (messages.length) {
      const phones = await db.select().from(pushDevices).where(eq(pushDevices.accountId, reminder.accountId));
      for (const message of messages) await sendPush(db, phones, locale => returnMessage(message.kind, locale, message.ref, message.events.length, { events: message.events }), now);
    }
  }
}
