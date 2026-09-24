import { usePending, usePlanet } from '../../api/queries.js';
import { useWorld } from '../../api/world.js';
import { outlineQueues, outlineWorlds } from '../../lib/outline.js';
import { useAirborne, type StripFocus } from '../../shell/PendingStrip.js';
import { Outline } from '../hud/Outline.js';
import type { ShellRoute } from './GameShell.js';

/**
 * THE DESK OUTLINE, WIRED. Spec E11 · K10.
 *
 * The flights are the strip's own rows (`useAirborne`), the worlds the world list
 * the Fleet page reads, the active world's lanes its own optimistic view. A world or
 * a flight is shown on the galaxy; a lane opens the page that holds it — research
 * its page, Construction the world's Production, the Yard its Fleet group.
 */
export function OutlineHost({ onFocusPlanet, onFocusCraft, onRoute }: {
  onFocusPlanet: (planetId: string) => void;
  onFocusCraft: (focus: StripFocus) => void;
  onRoute: ShellRoute;
}) {
  const { items, now } = useAirborne();
  const { activePlanetId, capitalPlanetId, worlds } = useWorld();
  const active = usePlanet().data;
  const threads = usePending().data?.pending ?? [];

  return (
    <Outline
      now={now}
      worlds={outlineWorlds(worlds, { activePlanetId, capitalPlanetId }, threads)}
      flights={items}
      queues={outlineQueues(worlds, active, activePlanetId)}
      onWorld={onFocusPlanet}
      onFlight={(item) => { if (item.focus) onFocusCraft(item.focus); }}
      onQueue={(queue) => {
        if (queue.lane === 'research' || queue.worldId === null) {
          onRoute('research');
          return;
        }
        onRoute('planet', undefined, undefined, {
          planetId: queue.worldId,
          group: queue.lane === 'yard' ? 'reach' : 'grow',
        });
      }}
    />
  );
}
