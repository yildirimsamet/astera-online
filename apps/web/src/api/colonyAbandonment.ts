import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from './context.js';
import { keys } from './keys.js';
import type { PlanetsView } from './schemas.js';
import { useApplyPlanet } from './queries.js';
import { useWorld } from './world.js';

export function useColonyAbandonment(planetId: string) {
  const api = useApi();
  return useQuery({
    queryKey: ['colony-abandonment', planetId],
    queryFn: () => api.colonyAbandonment(planetId),
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
}

export function useAbandonColony() {
  const api = useApi();
  const cache = useQueryClient();
  const applyPlanet = useApplyPlanet();
  const { selectPlanet } = useWorld();
  return useMutation({
    mutationFn: (planetId: string) => api.abandonColony(planetId),
    retry: false,
    // A lost response can hide a committed change. Re-read ownership rather than retrying the write.
    onError: async () => {
      await Promise.all([keys.planets, keys.galaxy, keys.notifications, keys.pending, keys.skins]
        .map(queryKey => cache.invalidateQueries({ queryKey })));
    },
    onSuccess: async result => {
      // A pre-abandonment read must never put the lost world back into the selector.
      await Promise.all([
        cache.cancelQueries({ queryKey: keys.planets }),
        cache.cancelQueries({ queryKey: keys.planet }),
      ]);
      await applyPlanet(result.capital);
      cache.setQueryData<PlanetsView>(keys.planets, current => current ? {
        ...current,
        planets: current.planets.filter(world => world.planet.id !== result.abandonedPlanetId),
      } : current);
      selectPlanet(result.capital.planet.id);
      cache.removeQueries({ queryKey: keys.planetById(result.abandonedPlanetId), exact: true });
      await Promise.all([keys.galaxy, keys.leaderboard, keys.notifications, keys.pending, keys.skins]
        .map(queryKey => cache.invalidateQueries({ queryKey })));
    },
  });
}
