import type { TechLevels } from '@astera/rules';
import { useGalaxy } from '../api/queries.js';
import { useWorld } from '../api/world.js';
import { radiationAtTarget } from '../lib/targetRadiation.js';
import { useNow } from '../lib/time.js';
import { RadiationIndicator } from './RadiationIndicator.js';

export function TargetRadiationInstrument({ target, tech, planetProtection }: {
  target: { kind: 'PLANET' | 'MONUMENT'; id: string }; tech?: TechLevels; planetProtection?: number;
}) {
  const { data } = useGalaxy();
  const { worlds } = useWorld();
  const now = useNow(1000);
  const protection = planetProtection ?? (target.kind === 'PLANET'
    ? worlds.find(world => world.planet.id === target.id)?.planet.radiationProtectionHpPerMinute : undefined);
  const state = radiationAtTarget(target, data?.hpRadiation ?? [], now, tech, protection);
  return state ? <RadiationIndicator state={state} variant="dial" now={now} /> : null;
}
