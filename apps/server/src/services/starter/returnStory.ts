import { STARTER_FEATURES, isFeatureOpen } from '@astera/rules';
import { and, eq, gt, inArray, lt, or, isNull } from 'drizzle-orm';
import { z } from 'zod';
import type { Clock } from '../../clock.js';
import type { Db } from '../../db/client.js';
import { vesselNotifications, vessels } from '../../db/schema.js';
import { GameError } from '../planet.js';
import { readStarterPending } from './traffic.js';
import { readVessel } from './vessel.js';

const MAX_ENTRIES = 5;

const resources = z.object({ alloy: z.number(), crystal: z.number(), deuterium: z.number() });
const total = (held: z.infer<typeof resources>): number => held.alloy + held.crystal + held.deuterium;
const battleNote = z.object({
  grade: z.enum(['REPELLED', 'PARTIAL', 'DECISIVE']), attacking: z.boolean(), loot: resources, lost: z.number().default(0),
  opponent: z.string().optional(), opponentKind: z.string().optional(), firstVictory: z.boolean().optional(), beatenBy: z.string().optional(),
});
const homeNote = z.object({ cargo: resources, ships: z.number().default(0), wasted: resources.optional() });

const TOLD = ['BATTLE_REPORT', 'PROBE_DETECTED', 'FLEET_HOME'];

/**
 * WHAT HAPPENED WHILE YOU WERE GONE, in the shape the main story has, so the away card reads a ship
 * the way it reads a world. Written from the ship's own notes. A read closes nothing: only the
 * dismissal does, and a phone that reloads mid-story tells it again.
 */
export async function readStarterReturn(db: Db, accountId: string, clock: Clock) {
  const vessel = await readVessel(db, accountId, clock);
  const [row] = await db.select({ returnSeenAt: vessels.returnSeenAt, enlistedAt: vessels.enlistedAt, unlocksSeen: vessels.unlocksSeen }).from(vessels).where(eq(vessels.id, vessel.id));
  const now = clock.now();
  const since = row?.returnSeenAt ?? row?.enlistedAt ?? now;
  const notes = await db.select().from(vesselNotifications)
    .where(and(eq(vesselNotifications.vesselId, vessel.id), inArray(vesselNotifications.kind, TOLD), gt(vesselNotifications.createdAt, since)));

  const raids = [];
  let scans = 0;
  // What landed, not what was carried: a haul loses what finds no room in the works (F5).
  const carried = { alloy: 0, crystal: 0, deuterium: 0 };
  let lost = 0;
  let shipsHome = 0;
  for (const note of notes) {
    if (note.kind === 'PROBE_DETECTED') { scans += 1; continue; }
    if (note.kind === 'FLEET_HOME') {
      const home = homeNote.safeParse(note.payload);
      if (home.success) {
        const wasted = home.data.wasted ?? { alloy: 0, crystal: 0, deuterium: 0 };
        carried.alloy += home.data.cargo.alloy - wasted.alloy;
        carried.crystal += home.data.cargo.crystal - wasted.crystal;
        carried.deuterium += home.data.cargo.deuterium - wasted.deuterium;
        lost += total(wasted);
        shipsHome += home.data.ships;
      }
      continue;
    }
    const battle = battleNote.safeParse(note.payload);
    if (battle.success) {
      const { attacking, grade, loot, lost: shipsLost, opponent, opponentKind, firstVictory, beatenBy } = battle.data;
      // An outpost raid's own two outcomes (F4f), which the card leads with as the signal does.
      const outpost = attacking && opponentKind === 'OUTPOST' && opponent !== undefined
        ? { opponent, ...(firstVictory === true ? { firstVictory } : {}), ...(beatenBy ? { beatenBy } : {}) }
        : {};
      raids.push({
        kind: attacking ? 'raid_result' as const : 'raided' as const,
        params: { grade, loot: Math.round(total(loot)), lost: shipsLost, ...outpost },
        at: note.createdAt,
      });
    }
  }
  raids.sort((a, b) => b.at.getTime() - a.at.getTime());
  const alloy = Math.round(vessel.bufferAlloy);
  const crystal = Math.round(vessel.bufferCrystal);
  const deuterium = Math.round(vessel.bufferDeuterium);
  const haul = { alloy: Math.round(carried.alloy), crystal: Math.round(carried.crystal), deuterium: Math.round(carried.deuterium) };
  // The player's own orders lead, so the card's cap never drops one of them for other news (F5).
  const entries = [
    ...raids.filter(raid => raid.kind === 'raid_result'),
    // Each resource by name: a lump of "resources" could not be checked against the bar (E-03).
    ...(total(carried) + shipsHome > 0 ? [{ kind: 'fleet_returned' as const, params: { resources: Math.round(total(carried)), ships: shipsHome, ...haul, lost: Math.round(lost) }, at: now }] : []),
    ...raids.filter(raid => raid.kind === 'raided'),
    ...(scans > 0 ? [{ kind: 'scan_detected' as const, params: { count: scans }, at: now }] : []),
    ...(alloy + crystal + deuterium > 0 ? [{ kind: 'accrued' as const, params: { alloy, crystal, deuterium }, at: now }] : []),
  ];
  const { pending } = await readStarterPending(db, accountId, clock);
  return {
    awayMinutes: Math.max(0, Math.round((now.getTime() - since.getTime()) / 60_000)),
    asOf: now,
    entries: entries.slice(0, MAX_ENTRIES),
    pending,
    // What came back online and is still to be announced; the galaxy announces it, the card names it (F5).
    newUnlocks: STARTER_FEATURES.filter(feature => isFeatureOpen(vessel, feature) && !(row?.unlocksSeen ?? []).includes(feature)),
  };
}

/** Never backwards, so a late dismissal reopens nothing, and never past the present, so a forged one swallows nothing. */
export async function closeStarterReturn(db: Db, accountId: string, asOf: Date, clock: Clock): Promise<void> {
  const now = clock.now();
  const until = asOf > now ? now : asOf;
  const closed = await db.update(vessels).set({ returnSeenAt: until })
    .where(and(eq(vessels.accountId, accountId), or(isNull(vessels.returnSeenAt), lt(vessels.returnSeenAt, until))))
    .returning({ id: vessels.id });
  if (closed.length > 0) return;
  const [ship] = await db.select({ id: vessels.id }).from(vessels).where(eq(vessels.accountId, accountId));
  if (!ship) throw new GameError('VESSEL_NOT_FOUND', 'This account has no colony ship', 404);
}
