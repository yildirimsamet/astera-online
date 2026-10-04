import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Tx } from '../db/client.js';
import { monuments, monumentWaves } from '../db/schema.js';
import { advanceMonument, resolveMonumentArrival } from '../services/monumentArrival.js';
import { resolveMonumentFlightLoss, resolveMonumentReturn } from '../services/monumentMovement.js';
import { publish, publishShard } from '../stream/bus.js';
import type { Handler } from './handlers.js';
import { resolveMonumentProbe } from '../services/monumentProbe.js';
import { monumentProbes } from '../db/schema.js';

const identitySchema = z.string().uuid();
const generationSchema = z.object({ generation: z.number().int().nonnegative().safe() });
const lossSchema = generationSchema.extend({ scope: z.enum(['HOLD', 'FLIGHT']) });

export const onMonumentProbe: Handler = async ({ db, clock, adminUsernames }, event) => {
  const probeId = identitySchema.parse(event.refId);
  const { leg } = z.object({ leg: z.enum(['OUT', 'HOME']) }).parse(event.payload);
  await db.transaction(async (tx) => {
    const [probe] = await tx.select({ seasonId: monumentProbes.seasonId }).from(monumentProbes).where(eq(monumentProbes.id, probeId));
    if (probe?.seasonId !== event.seasonId) return;
    await resolveMonumentProbe(tx, { probeId, leg, at: clock.now(), adminUsernames: [...adminUsernames ?? []] });
  });
};

/** Choose from the authoritative status before taking any world/target locks. */
async function arrive(tx: Tx, waveId: string, seasonId: string, generation: number, at: Date, adminUsernames: readonly string[]): Promise<void> {
  const [wave] = await tx.select().from(monumentWaves).where(eq(monumentWaves.id, waveId));
  if (wave?.seasonId !== seasonId || wave.generation !== generation) return;
  if (wave.status === 'RETURNING') await resolveMonumentReturn(tx, { waveId, generation, at });
  else if (wave.status === 'OUTBOUND') await resolveMonumentArrival(tx, { waveId, generation, at, adminUsernames });
}

export const onMonumentArrival: Handler = async ({ db, clock, adminUsernames }, event) => {
  const waveId = identitySchema.parse(event.refId);
  const { generation } = generationSchema.parse(event.payload);
  await db.transaction((tx) => arrive(tx, waveId, event.seasonId, generation, clock.now(), [...adminUsernames ?? []]));
};

export const onMonumentLoss: Handler = async ({ db, clock, adminUsernames }, event) => {
  const id = identitySchema.parse(event.refId);
  const { generation, scope } = lossSchema.parse(event.payload);
  const at = clock.now();
  if (at < event.resolveAt) return;
  await db.transaction(async (tx) => {
    if (scope === 'FLIGHT') {
      const [wave] = await tx.select().from(monumentWaves).where(eq(monumentWaves.id, id));
      if (wave?.seasonId !== event.seasonId || wave.generation !== generation) return;
      if (wave.arriveAt !== null && wave.arriveAt <= at) await arrive(tx, id, event.seasonId, generation, at, [...adminUsernames ?? []]);
      else await resolveMonumentFlightLoss(tx, { waveId: id, generation, at });
    } else {
      const [m] = await tx.select().from(monuments).where(eq(monuments.id, id));
      if (m?.seasonId !== event.seasonId || m.generation !== generation || m.settledAt >= at) return;
      const { locked } = await advanceMonument(tx, { monumentId: id, at, adminUsernames: [...adminUsernames ?? []] });
      for (const playerId of new Set(locked.waves.map((wave) => wave.playerId))) await publish(tx, playerId, 'private:monument');
      if (locked.monument.generation !== generation) await publishShard(tx, event.seasonId, 'control');
    }
  });
};

export const onMonumentRespawn: Handler = async ({ db, clock, adminUsernames }, event) => {
  const id = identitySchema.parse(event.refId);
  const { generation } = generationSchema.parse(event.payload);
  const at = clock.now();
  if (at < event.resolveAt) return;
  await db.transaction(async (tx) => {
    const [m] = await tx.select().from(monuments).where(eq(monuments.id, id));
    if (m?.seasonId !== event.seasonId || m.generation !== generation) return;
    await advanceMonument(tx, { monumentId: id, at, adminUsernames: [...adminUsernames ?? []] });
  });
};
