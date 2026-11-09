import { playSound } from '../lib/sound.js';
import { haptic } from '../lib/haptics.js';
import { observe } from '../lib/playerAnalytics/runtime.js';
import type { StarterFeature, VesselModule } from '@astera/rules';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Api } from '../api/client.js';
import { useApi } from '../api/context.js';
import { keys } from '../api/keys.js';
import { useApplyPlanet } from '../api/queries.js';
import { vesselToPlanetView } from './adapter.js';

/** A ship's commands answer with the ship, and that one answer moves every surface reading it. */
export function useRepairVessel() {
  const api = useApi();
  const apply = useApplyPlanet();
  return useMutation({
    mutationFn: ({ module, stage }: { module: VesselModule; stage: number }) => api.orderVesselRepair(module, stage),
    // A short arc struck (owner playtest 2026-11-07): the long weld belongs to the prologue's patch.
    onSuccess: ({ vessel }) => { playSound('arc'); haptic('commit'); return apply(vesselToPlanetView(vessel)); },
  });
}

/** Every ready crate at once; the ship that answers carries the fuller store. */
export function useOpenCrates() {
  const api = useApi();
  const apply = useApplyPlanet();
  return useMutation({
    mutationFn: () => api.openVesselCrates(),
    onSuccess: ({ vessel, opened }) => {
      observe('outcome_visible', { surface: 'starter_crate', count: opened.length }, 'live');
      void apply(vesselToPlanetView(vessel));
    },
  });
}

export function useMarkUnlockSeen() {
  const api = useApi();
  const apply = useApplyPlanet();
  return useMutation({
    mutationFn: (feature: StarterFeature) => api.markVesselUnlockSeen(feature),
    onSuccess: ({ vessel }) => apply(vesselToPlanetView(vessel)),
  });
}

export function useMigration() {
  const api = useApi();
  return useQuery({ queryKey: keys.migration, queryFn: ({ signal }) => api.vesselMigration({ signal }) });
}

/** A loaded tank changes the ship and what the panel may offer, together. */
export function useLoadFuel() {
  const api = useApi();
  const apply = useApplyPlanet();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (amount: number) => api.loadVesselFuel(amount),
    onSuccess: ({ vessel }) => { void apply(vesselToPlanetView(vessel)); void client.invalidateQueries({ queryKey: keys.migration }); },
  });
}

export function useMigrate() {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (slot: number | null) => api.migrateVessel(slot),
    onMutate: () => { observe('vessel_migration_started', {}, 'live'); },
    onSuccess: () => { observe('vessel_migration_landed', {}, 'live'); },
    // A refusal means the panel was out of date: the addresses, or what stands in the way.
    onError: () => { void client.invalidateQueries({ queryKey: keys.migration }); },
  });
}

export const arrivalQuery = (api: Api) => ({
  queryKey: keys.arrival,
  queryFn: ({ signal }: { signal: AbortSignal }) => api.starterArrival({ signal }),
  staleTime: Infinity,
});

export function useMarkArrivalSeen() {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api.markArrivalSeen(),
    onSuccess: () => { void client.invalidateQueries({ queryKey: keys.arrival }); },
  });
}

export function useDepartures(enabled: boolean) {
  const api = useApi();
  return useQuery({ queryKey: keys.departures, queryFn: ({ signal }) => api.starterDepartures({ signal }), enabled });
}

/** The main galaxy's newcomers in flight. Read when one lands (the `inbound` event) and on opening. */
export function useInbound(enabled: boolean) {
  const api = useApi();
  return useQuery({ queryKey: keys.inbound, queryFn: ({ signal }) => api.starterInbound({ signal }), enabled });
}

const HALF_AN_HOUR = 30 * 60_000;

/** The main galaxy's picture. Nothing wakes it: it is read when the ship opens and every half hour. */
/** Read only once someone reaches the zoom limit: most sessions never ask. */
export function useUniverse(enabled: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: keys.universe,
    queryFn: ({ signal }) => api.universe({ signal }),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useMainSky(enabled: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: keys.mainSky,
    queryFn: ({ signal }) => api.mainSky({ signal }),
    enabled,
    staleTime: HALF_AN_HOUR,
    gcTime: HALF_AN_HOUR,
  });
}
