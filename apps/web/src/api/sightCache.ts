import type { QueryClient } from '@tanstack/react-query';
import { keys } from './keys.js';
import type { GalaxyView, IntelView } from './schemas.js';

/**
 * THE MAP'S READINGS COME OFF THE INTEL READ. Scaling plan F1.8 (Q15).
 *
 * `/api/galaxy` and `/api/intel` both run `readTelescopes`, and the map's `fleet`
 * is that same reading, rounded (`routes/galaxy.ts`). A watched fleet moving now
 * reads `intel` alone and this copies the reading onto the held map. Only a world
 * that already shows one is rewritten: which worlds the caller resolves is the
 * map's own fog, and nothing here may add a reading the server did not.
 */
export async function readIntelSnapshot(client: QueryClient, read: () => Promise<IntelView>): Promise<IntelView> {
  const intel = await read();
  const byTarget = new Map(intel.watching.map((watch) => [watch.targetPlanetId, watch.reading]));
  client.setQueryData<GalaxyView>(keys.galaxy, (galaxy) => {
    if (!galaxy) return galaxy;
    const planets = galaxy.planets.map((world) => {
      const reading = world.fleet ? byTarget.get(world.id) : undefined;
      if (!world.fleet || !reading) return world;
      const fleet = { status: reading.status, staleMinutes: Math.round(reading.staleMinutes),
        etaMinutes: reading.etaMinutes, clarity: reading.state };
      if (fleet.status === world.fleet.status && fleet.staleMinutes === world.fleet.staleMinutes
        && fleet.etaMinutes === world.fleet.etaMinutes && fleet.clarity === world.fleet.clarity) return world;
      return { ...world, fleet };
    });
    return planets.some((world, index) => world !== galaxy.planets[index]) ? { ...galaxy, planets } : galaxy;
  });
  return intel;
}
