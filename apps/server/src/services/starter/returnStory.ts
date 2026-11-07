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
const battleNote = z.object({ grade: z.enum(['REPELLED', 'PARTIAL', 'DECISIVE']), attacking: z.boolean(), loot: resources, lost: z.number().default(0) });
const homeNote = z.object({ cargo: resources, ships: z.number().default(0) });

const TOLD = ['BATTLE_REPORT', 'PROBE_DETECTED', 'FLEET_HOME'];

/**
 * WHAT HAPPENED WHILE YOU WERE GONE, in the shape the main story has, so the away card reads a ship
 * the way it reads a world. Written from the ship's own notes. A read closes nothing: only the
 * dismissal does, and a phone that reloads mid-story tells it again.
 */
export async function readStarterReturn(db: Db, accountId: string, clock: Clock) {
  const vessel = await readVessel(db, accountId, clock);
  const [row] = await db.select({ returnSeenAt: vessels.returnSeenAt, enlistedAt: vessels.enlistedAt }).from(vessels).where(eq(vessels.id, vessel.id));
  const now = clock.now();
  const since = row?.returnSeenAt ?? row?.enlistedAt ?? now;
  const notes = await db.select().from(vesselNotifications)
    .where(and(eq(vesselNotifications.vesselId, vessel.id), inArray(vesselNotifications.kind, TOLD), gt(vesselNotifications.createdAt, since)));

  const raids = [];
  let scans = 0;
  const carried = { alloy: 0, crystal: 0, deuterium: 0 };
  let shipsHome = 0;
  for (const note of notes) {
    if (note.kind === 'PROBE_DETECTED') { scans += 1; continue; }
    if (note.kind === 'FLEET_HOME') {
      const home = homeNote.safeParse(note.payload);
      if (home.success) {
        carried.alloy += home.data.cargo.alloy;
        carried.crystal += home.data.cargo.crystal;
        carried.deuterium += home.data.cargo.deuterium;
        shipsHome += home.data.ships;
      }
      continue;
    }
    const battle = battleNote.safeParse(note.payload);
    if (battle.success) {
      raids.push({
        kind: battle.data.attacking ? 'raid_result' as const : 'raided' as const,
        params: { grade: battle.data.grade, loot: Math.round(total(battle.data.loot)), lost: battle.data.lost },
        at: note.createdAt,
      });
    }
  }
  raids.sort((a, b) => b.at.getTime() - a.at.getTime());
  const alloy = Math.round(vessel.bufferAlloy);
  const crystal = Math.round(vessel.bufferCrystal);
  const deuterium = Math.round(vessel.bufferDeuterium);
  const haul = { alloy: Math.round(carried.alloy), crystal: Math.round(carried.crystal), deuterium: Math.round(carried.deuterium) };
  const entries = [
    ...raids,
    ...(scans > 0 ? [{ kind: 'scan_detected' as const, params: { count: scans }, at: now }] : []),
    // Each resource by name: a lump of "resources" could not be checked against the bar (E-03).
    ...(total(carried) + shipsHome > 0 ? [{ kind: 'fleet_returned' as const, params: { resources: Math.round(total(carried)), ships: shipsHome, ...haul }, at: now }] : []),
    ...(alloy + crystal + deuterium > 0 ? [{ kind: 'accrued' as const, params: { alloy, crystal, deuterium }, at: now }] : []),
  ];
  const { pending } = await readStarterPending(db, accountId, clock);
  return {
    awayMinutes: Math.max(0, Math.round((now.getTime() - since.getTime()) / 60_000)),
    asOf: now,
    entries: entries.slice(0, MAX_ENTRIES),
    pending,
    newUnlocks: [],
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
