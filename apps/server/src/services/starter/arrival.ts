import { eq, sql } from 'drizzle-orm';
import type { Clock } from '../../clock.js';
import type { Db } from '../../db/client.js';
import { vesselBattleReports, vesselMissions } from '../../db/schema.js';
import { publishShard } from '../../stream/bus.js';
import { resolveVesselBattle } from './combat.js';
import { landMission, turnBack } from './fleet.js';
import { resolveMiningLanding } from './mining.js';
import { ringShip } from './push.js';
import { landVesselProbe, resolveVesselProbe } from './probe.js';

/**
 * A LANDING, BY WHAT IS LANDING. The row is locked for the whole of it: a redelivered event finds
 * this flight no longer outbound and does nothing.
 */
export async function resolveMissionArrival(db: Db, missionId: string, clock: Clock): Promise<void> {
  const { felt, battled } = await db.transaction(async (tx): Promise<{ felt: string | null; battled: boolean }> => {
    const quiet = { felt: null, battled: false };
    const [mission] = await tx.select().from(vesselMissions).where(eq(vesselMissions.id, missionId)).for('update');
    if (mission?.status !== 'OUTBOUND') return quiet;
    switch (mission.kind) {
      case 'PROBE': return { felt: await resolveVesselProbe(tx, mission, clock), battled: false };
      case 'MINE': await resolveMiningLanding(tx, mission, clock); return quiet;
      case 'SCOUT': await turnBack(tx, mission, clock.now()); return quiet;
      case 'PASSING': await tx.update(vesselMissions).set({ status: 'DONE' }).where(eq(vesselMissions.id, mission.id)); return quiet;
      case 'ATTACK':
      case 'RAID_SITE':
      case 'PIRATE': await resolveVesselBattle(tx, mission, clock); return { felt: null, battled: true };
    }
  });
  if (felt) await ringShip(db, felt, { kind: 'probe_detected', refId: missionId }, clock.now());
  if (!battled) return;
  // Asks the report: a flight that turned back at the door fought nobody and has nothing to say.
  const [report] = await db.select({ attacker: vesselBattleReports.attackerVesselId, defender: vesselBattleReports.defenderVesselId })
    .from(vesselBattleReports).where(eq(vesselBattleReports.missionId, missionId));
  if (report?.attacker) await ringShip(db, report.attacker, { kind: 'raid_over', refId: missionId }, clock.now());
  if (report?.defender) await ringShip(db, report.defender, { kind: 'raided', refId: missionId }, clock.now());
}

export async function resolveMissionReturn(db: Db, missionId: string, clock: Clock): Promise<void> {
  await db.transaction(async (tx) => {
    const [mission] = await tx.select().from(vesselMissions).where(eq(vesselMissions.id, missionId)).for('update');
    if (mission?.status !== 'RETURNING') return;
    if (mission.kind === 'PROBE') await landVesselProbe(tx, mission, clock);
    else await landMission(tx, mission, clock);
  });
}

/** Past every honest reason for being late: the poll, the retries, a reaped claim, a short outage. */
const STRANDED_GRACE_MS = 5 * 60_000;
const STRANDED_BATCH = 100;

/** The server could not resolve this flight, so it never happened: the craft come home. A probe was spent. */
async function releaseFlight(db: Db, missionId: string, clock: Clock): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [mission] = await tx.select().from(vesselMissions).where(eq(vesselMissions.id, missionId)).for('update');
    if (mission?.status !== 'OUTBOUND' && mission?.status !== 'RETURNING') return false;
    // A probe that never arrived read nothing; one on its way home brings what it read.
    if (mission.kind === 'PROBE' && mission.status === 'OUTBOUND') await tx.update(vesselMissions).set({ status: 'CANCELLED' }).where(eq(vesselMissions.id, mission.id));
    else if (mission.kind === 'PROBE') await landVesselProbe(tx, mission, clock);
    else {
      if (mission.status === 'OUTBOUND') await tx.update(vesselMissions).set({ status: 'RETURNING' }).where(eq(vesselMissions.id, mission.id));
      await landMission(tx, { ...mission, status: 'RETURNING' }, clock);
    }
    await publishShard(tx, mission.starterGalaxyId, 'arrival');
    return true;
  });
}

/**
 * A FLIGHT NOTHING WILL EVER RESOLVE, the main queue's D28 and D46 (`worker/abandon.ts`) in one sweep.
 * Its event gave up or is gone, so it holds a bay and blocks the jump for good, and only this can see it.
 * One that cannot be released does not stop the rest, and is thrown afterwards for the worker to log.
 */
export async function sweepStrandedFlights(db: Db, clock: Clock): Promise<number> {
  const cutoff = new Date(clock.now().getTime() - STRANDED_GRACE_MS).toISOString();
  const stranded = await db.execute<{ id: string }>(sql`
    select m.id from vessel_missions m
    where (m.status = 'OUTBOUND' and m.arrive_at < ${cutoff}::timestamptz and not exists (
        select 1 from starter_events e where e.ref_id = m.id and e.kind = 'vessel_mission_arrival' and e.status in ('pending', 'processing')))
       or (m.status = 'RETURNING' and coalesce(m.return_at, m.arrive_at) < ${cutoff}::timestamptz and not exists (
        select 1 from starter_events e where e.ref_id = m.id and e.kind = 'vessel_mission_return' and e.status in ('pending', 'processing')))
    limit ${STRANDED_BATCH}
  `);
  let released = 0;
  let failure: Error | undefined;
  for (const { id } of stranded) {
    try {
      if (await releaseFlight(db, id, clock)) released++;
    } catch (err) {
      failure ??= err instanceof Error ? err : new Error(String(err));
    }
  }
  if (failure) throw failure;
  return released;
}
