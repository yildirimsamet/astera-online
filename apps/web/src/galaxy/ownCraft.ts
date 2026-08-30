import type {
  MiningRun,
  PendingThread,
  StrategicInterception,
  StrategicInterceptionImpact,
} from '../api/schemas.js';
import type { Focus } from './FocusPanel.js';
import { threadKey } from './threadKey.js';

export type CraftFocus = Extract<Focus, { kind: 'thread' } | { kind: 'run' }>;
export type InterceptionFocus = Extract<Focus, { kind: 'interception' }>;
export type InterceptionImpactFocus = Extract<Focus, { kind: 'interceptionImpact' }>;

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

/**
 * Focus only a freshly launched interceptor owned by this commander.
 *
 * Participants see the same interception payload, so presence alone cannot tell
 * whether this is our battery or our Death Star being destroyed. The target world
 * does: an interceptor always launches from the world it defends. Existing events
 * are baselined on mount and completed eight-second flights never seize the camera.
 */
export function reconcileOwnInterceptions(
  previous: ReadonlySet<string> | null,
  interceptions: readonly StrategicInterception[],
  controlledPlanetIds: ReadonlySet<string>,
  now = Date.now(),
): { seen: ReadonlySet<string>; focus: InterceptionFocus | null } {
  const seen = new Set(previous ?? []);
  for (const event of interceptions) seen.add(event.id);
  if (previous === null) return { seen, focus: null };

  let newest: StrategicInterception | null = null;
  for (const event of interceptions) {
    if (
      previous.has(event.id)
      || !controlledPlanetIds.has(event.targetPlanetId)
      || event.launchAt.getTime() > now
      || event.impactAt.getTime() <= now
    ) continue;
    if (
      newest === null
      || event.launchAt.getTime() > newest.launchAt.getTime()
      || (event.launchAt.getTime() === newest.launchAt.getTime()
        && event.id.localeCompare(newest.id) > 0)
    ) newest = event;
  }

  return {
    seen,
    focus: newest ? { kind: 'interception', id: newest.id } : null,
  };
}

/**
 * Give the defender one last camera hand-off at the collision itself.
 *
 * The launch projection lasts only eight seconds. A slow tab, a first traffic read
 * racing the SSE commit, or opening the game mid-flight can miss that window even
 * though the durable public impact still arrives. The server marks only the
 * defender as eligible. Collision focus is a distinct phase so it always resolves
 * against the durable impact coordinate, even if a launch follow was attempted.
 */
export function reconcileOwnInterceptionImpacts(
  previous: ReadonlySet<string> | null,
  impacts: readonly StrategicInterceptionImpact[],
): { seen: ReadonlySet<string>; focus: InterceptionImpactFocus | null } {
  const seen = new Set(previous ?? []);
  for (const impact of impacts) seen.add(impact.id);

  const candidate = impacts.find((impact) => (
    impact.focusEligible
    && !(previous?.has(impact.id) ?? false)
  ));
  return {
    seen,
    focus: candidate ? { kind: 'interceptionImpact', id: candidate.id } : null,
  };
}
