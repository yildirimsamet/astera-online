import { z } from 'zod';
import { createSchool, schoolAction, tickSchool, type SchoolAction } from './world.js';
import { sensorReach, sensorSphere } from '@astera/rules';

const key = 'astera.flight-school.v1';
const action = z.union([
  z.object({ kind: z.enum(['continue', 'home', 'collect', 'watch', 'mine', 'probe', 'raid', 'defend']) }).strict(),
  z.object({ kind: z.literal('order'), subject: z.string().max(40), count: z.number().int().positive().max(30) }).strict(),
  z.object({ kind: z.literal('range'), level: z.number().int().min(1).max(5).nullable() }).strict(),
]);
const timestamp = z.number().finite().nonnegative().max(8_640_000_000_000_000);
const record = z.object({ version: z.literal(1), startedAt: timestamp,
  events: z.array(z.object({ at: timestamp, action }).strict()).max(250) }).strict();
export interface SchoolRecord { version: 1; startedAt: number; events: { at: number; action: SchoolAction }[] }

export function restoreSchool(now: number) {
  const empty = () => ({ world: createSchool(now), record: { version: 1 as const, startedAt: now, events: [] } satisfies SchoolRecord });
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return empty();
    const saved = record.parse(JSON.parse(raw));
    if (saved.startedAt > now) return empty();
    let world = createSchool(saved.startedAt), last = saved.startedAt;
    for (const event of saved.events) {
      if (event.at < last || event.at > now) return empty();
      world = tickSchool(world, event.at);
      // Existing ledgers assigned the watch immediately after the planet
      // comparison, before the fleet close-up was added. Preserve that progress.
      if (world.scene === 'traffic' && event.action.kind === 'watch') world = schoolAction(world, { kind: 'continue' }, event.at);
      world = schoolAction(world, event.action, event.at);
      last = event.at;
    }
    world = tickSchool(world, now);
    if (world.scene === 'sight' || world.scene === 'warning') {
      const radar = world.scene === 'warning';
      const reach = schoolSensorRange(world, radar);
      world = { ...world, sceneAt: now, reach: { from: radar ? 0 : sensorReach(0), to: reach, at: now + 2000, ...(radar ? { radar: true } : {}) } };
    } else if (world.scene === 'traffic') world = { ...world, sceneAt: now };
    return { world, record: saved };
  } catch { return empty(); }
}
const schoolSensorRange = (world: ReturnType<typeof createSchool>, radar: boolean): number => radar
  ? sensorSphere({ x: 0, y: 0, z: 0 }, world.instruments.TELESCOPE, world.instruments.RADAR).detect
  : sensorReach(world.instruments.TELESCOPE);
export function saveSchool(value: SchoolRecord): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Training remains playable without storage. */ }
}
export function clearSchool(): void {
  try { localStorage.removeItem(key); } catch { /* Optional storage. */ }
}
