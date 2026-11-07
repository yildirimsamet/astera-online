import { useEffect } from 'react';
import { usePlanet } from '../api/queries.js';
import { observe } from '../lib/playerAnalytics/runtime.js';
import { announceVessel } from './vesselAnalytics.js';

/** Watches the ship for as long as a session stands on one. */
export function useVesselMilestones(): void {
  const vessel = usePlanet().data?.vessel;
  useEffect(() => {
    if (vessel) announceVessel(vessel, (name, properties) => { observe(name, properties ?? {}, 'live'); });
  }, [vessel]);
}
