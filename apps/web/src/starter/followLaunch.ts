import type { Focus } from '../galaxy/FocusPanel.js';

/**
 * WHATEVER LEAVES THE SHIP TAKES THE CAMERA WITH IT (owner playtest 2026-11-06, starter galaxy only).
 * A probe, a fleet or a Prospector is followed the moment it is out, so the first flights are watched,
 * not imagined. Only the commander's own outbound craft count: an inbound raid or a craft coming
 * home never pulls the view away.
 */
export interface Craft { key: string; focus: Focus }

interface ThreadLike { id?: string | undefined; kind: string; leg?: 'outbound' | 'return' | undefined }
interface RunLike { id: string; status: string }

export function ownCraft(threads: readonly ThreadLike[], runs: readonly RunLike[]): Craft[] {
  return [
    ...runs.filter(run => run.status !== 'done').map(run => ({ key: `run:${run.id}`, focus: { kind: 'run' as const, id: run.id } })),
    ...threads.flatMap(thread => thread.id !== undefined && thread.kind !== 'incoming' && thread.leg !== 'return'
      ? [{ key: `thread:${thread.id}`, focus: { kind: 'thread' as const, key: thread.id } }]
      : []),
  ];
}

/** The first look (`seen` null) only learns what is already out; later, the first new craft is followed. */
export function followLaunch(seen: ReadonlySet<string> | null, craft: readonly Craft[]): { seen: Set<string>; focus: Focus | null } {
  const now = new Set(craft.map(one => one.key));
  if (seen === null) return { seen: now, focus: null };
  return { seen: now, focus: craft.find(one => !seen.has(one.key))?.focus ?? null };
}
