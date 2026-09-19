import { z } from 'zod';
import type { Db } from '../db/client.js';
import type { Clock } from '../clock.js';
import { perfSessions } from '../db/schema.js';

/**
 * A PERFORMANCE RECORDING, AS THE PHONE SENDS IT. Owner request, 2026-09-19.
 *
 * One sample a second, for at most two hours. Every field is a number the client
 * measured itself; nothing here is trusted beyond its shape and its size, and none
 * of it reaches a player — the route is admin-only and nothing reads it back.
 */
export const PERF_MAX_SAMPLES = 2 * 60 * 60;

const count = z.number().int().min(0).max(1_000_000_000);
const ms = z.number().min(0).max(3_600_000);

const perfSampleSchema = z.object({
  /** Seconds since the recording started. */
  t: z.number().int().min(0).max(PERF_MAX_SAMPLES * 2),
  /** Frames the galaxy drew in this second. */
  fps: count,
  /** The longest gap between two display frames: a stall, whoever caused it. */
  jankMaxMs: ms,
  /** Display frames later than 50ms (a hitch) and 250ms (a freeze). */
  jank50: count,
  jank250: count,
  longTaskMs: ms,
  longTasks: count,
  /** CPU time spent submitting the galaxy's draws, summed and worst. */
  renderMs: ms,
  renderMaxMs: ms,
  calls: count,
  triangles: count,
  geometries: count,
  textures: count,
  programs: count,
  heapMb: z.number().min(0).max(100_000).nullable(),
  requests: count,
  kb: z.number().min(0).max(10_000_000),
  galaxy: z.boolean(),
  hidden: z.boolean(),
  /** What was on the disc: planets, contacts, flights and so on. */
  ctx: z.record(z.string().max(32), z.number().min(0).max(1_000_000_000))
    .refine((record) => Object.keys(record).length <= 24, 'too many context keys'),
}).strict();

export const perfSessionSchema = z.object({
  startedAt: z.coerce.date(),
  endedAt: z.coerce.date(),
  device: z.object({
    userAgent: z.string().max(400),
    dpr: z.number().min(0).max(10),
    width: count,
    height: count,
    quality: z.string().max(16),
    refreshHz: z.number().min(0).max(1000).nullable(),
    cores: count.nullable(),
    memoryGb: z.number().min(0).max(1024).nullable(),
  }).strict(),
  summary: z.record(z.string().max(48), z.union([z.number(), z.string().max(200), z.null()]))
    .refine((record) => Object.keys(record).length <= 80, 'too many summary keys'),
  samples: z.array(perfSampleSchema).max(PERF_MAX_SAMPLES),
}).strict();

export type PerfSession = z.infer<typeof perfSessionSchema>;

export async function savePerfSession(
  db: Db,
  accountId: string,
  session: PerfSession,
  clock: Clock,
): Promise<{ id: string }> {
  const [row] = await db.insert(perfSessions).values({
    accountId,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    device: session.device,
    summary: session.summary,
    samples: session.samples,
    createdAt: clock.now(),
  }).returning({ id: perfSessions.id });
  if (!row) throw new Error('perf session insert returned nothing');
  return row;
}
