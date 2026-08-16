import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Fleet, BuildingId, HullId, SatelliteId } from '@blindspace/rules';
import { useApi } from './context.js';

export const keys = {
  season: ['season'],
  planet: ['planet'],
  galaxy: ['galaxy'],
  intel: ['intel'],
  leaderboard: ['leaderboard'],
  notifications: ['notifications'],
  unlocks: ['unlocks'],
  pending: ['pending'],
  traffic: ['traffic'],
} as const;

/**
 * Read policy.
 *
 * Nothing polls. The world only changes when an event resolves, and the stream
 * says when that happened — so the client refetches on an event or on focus, and
 * otherwise sits still. Polling a game where a fleet lands in forty minutes is
 * pure battery cost.
 */
const READ = { staleTime: 15_000, refetchOnWindowFocus: true } as const;

export function useSeason() {
  const api = useApi();
  return useQuery({ queryKey: keys.season, queryFn: api.season, staleTime: 5 * 60_000 });
}

export function usePlanet() {
  const api = useApi();
  return useQuery({ queryKey: keys.planet, queryFn: api.planet, ...READ });
}

export function useGalaxy() {
  const api = useApi();
  return useQuery({ queryKey: keys.galaxy, queryFn: api.galaxy, ...READ });
}

export function useIntel() {
  const api = useApi();
  return useQuery({ queryKey: keys.intel, queryFn: api.intel, ...READ });
}

/**
 * What is still in flight.
 *
 * The one thing that genuinely benefits from a timer: a radar warning can appear
 * without any event reaching this tab, because the fuse is lit server-side at
 * `arriveAt − lead`. A minute is cheap and it is the difference between finding
 * out and finding out too late.
 */
export function usePending() {
  const api = useApi();
  return useQuery({
    queryKey: keys.pending,
    queryFn: api.pending,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}

/** Ambient galaxy motion. Cheap, and stale data here costs nothing. */
export function useTraffic() {
  const api = useApi();
  return useQuery({
    queryKey: keys.traffic,
    queryFn: api.traffic,
    staleTime: 45_000,
    refetchInterval: 60_000,
  });
}

export function useLeaderboard() {
  const api = useApi();
  return useQuery({ queryKey: keys.leaderboard, queryFn: api.leaderboard, staleTime: 60_000 });
}

export function useUnlocks() {
  const api = useApi();
  return useQuery({ queryKey: keys.unlocks, queryFn: api.unlocks, ...READ });
}

export function useNotifications() {
  const api = useApi();
  return useQuery({ queryKey: keys.notifications, queryFn: api.notifications, ...READ });
}

/** Anything that spends resources moves the planet, the ladder and the map. */
function useInvalidator() {
  const client = useQueryClient();
  return (...groups: readonly (readonly string[])[]) => {
    for (const key of groups) void client.invalidateQueries({ queryKey: key });
  };
}

export function useUpgrade() {
  const api = useApi();
  const invalidate = useInvalidator();
  return useMutation({
    mutationFn: (type: BuildingId) => api.upgrade(type),
    onSuccess: () => {
      invalidate(keys.planet, keys.galaxy, keys.leaderboard);
    },
  });
}

export function useBuild() {
  const api = useApi();
  const invalidate = useInvalidator();
  return useMutation({
    mutationFn: ({ hull, count }: { hull: HullId; count: number }) => api.build(hull, count),
    onSuccess: () => {
      invalidate(keys.planet, keys.leaderboard);
    },
  });
}

export function useInstallSatellite() {
  const api = useApi();
  const invalidate = useInvalidator();
  return useMutation({
    mutationFn: (type: SatelliteId) => api.installSatellite(type),
    // A new Telescope level changes what every reading is allowed to say.
    onSuccess: () => {
      invalidate(keys.planet, keys.intel, keys.galaxy, keys.leaderboard);
    },
  });
}

export function useWatch() {
  const api = useApi();
  const invalidate = useInvalidator();
  return useMutation({
    mutationFn: ({ targetPlanetId, slot }: { targetPlanetId: string; slot: number }) =>
      api.watch(targetPlanetId, slot),
    onSuccess: () => {
      invalidate(keys.intel, keys.galaxy, keys.unlocks);
    },
  });
}

export function useProbe() {
  const api = useApi();
  const invalidate = useInvalidator();
  return useMutation({
    mutationFn: (targetPlanetId: string) => api.probe(targetPlanetId),
    onSuccess: () => {
      invalidate(keys.planet, keys.intel, keys.pending);
    },
  });
}

/** IRREVERSIBLE. The confirmation lives in the UI; the server has no recall. */
export function useLaunch() {
  const api = useApi();
  const invalidate = useInvalidator();
  return useMutation({
    mutationFn: ({ targetPlanetId, fleet }: { targetPlanetId: string; fleet: Fleet }) =>
      api.launch(targetPlanetId, fleet),
    onSuccess: () => {
      invalidate(keys.planet, keys.galaxy, keys.intel, keys.pending);
    },
  });
}
