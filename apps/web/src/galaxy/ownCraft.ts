import type { MiningRun, PendingThread } from '../api/schemas.js';
import type { Focus } from './FocusPanel.js';
import { threadKey } from './threadKey.js';

export type CraftFocus = Extract<Focus, { kind: 'thread' } | { kind: 'run' }>;

interface Candidate {
  identity: string;
  departedAt: number;
  focus: CraftFocus;
}

/**
 * Reconcile everything this commander owns in the air, without naming vehicle kinds.
 *
 * A drawable pending thread has a path; a live mining row has not reached `done`.
 * Those are stable payload capabilities, so a new probe, missile or future craft
 * automatically joins this path without another launch-specific focus callback.
 */
export function reconcileOwnCraft(
  previous: ReadonlySet<string> | null,
  pending: readonly PendingThread[],
  runs: readonly MiningRun[],
): { seen: ReadonlySet<string>; focus: CraftFocus | null } {
  const candidates: Candidate[] = [];

  pending.forEach((thread, index) => {
    if (!thread.path) return;
    const key = threadKey(thread, index);
    candidates.push({
      identity: `thread:${key}`,
      departedAt: thread.path.departAt.getTime(),
      focus: { kind: 'thread', key },
    });
  });

  for (const run of runs) {
    if (run.status === 'done') continue;
    candidates.push({
      identity: `run:${run.id}`,
      departedAt: run.departAt.getTime(),
      focus: { kind: 'run', id: run.id },
    });
  }

  const seen = new Set(previous ?? []);
  for (const candidate of candidates) seen.add(candidate.identity);
  if (previous === null) return { seen, focus: null };

  let newest: Candidate | null = null;
  for (const candidate of candidates) {
    if (previous.has(candidate.identity)) continue;
    if (
      newest === null
      || candidate.departedAt > newest.departedAt
      || (candidate.departedAt === newest.departedAt
        && candidate.identity.localeCompare(newest.identity) > 0)
    ) {
      newest = candidate;
    }
  }

  return { seen, focus: newest?.focus ?? null };
}
