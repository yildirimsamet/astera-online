import type {
  StrategicInterception,
  StrategicInterceptionImpact,
} from '../api/schemas.js';
import type { Focus } from './FocusPanel.js';

export type CraftFocus = Extract<Focus, { kind: 'thread' } | { kind: 'run' }>;
export type InterceptionFocus = Extract<Focus, { kind: 'interception' }>;
export type InterceptionImpactFocus = Extract<Focus, { kind: 'interceptionImpact' }>;

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
