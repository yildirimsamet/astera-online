import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQueries, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import type { PlanetView } from './schemas.js';
import { useApi } from './context.js';
import { keys } from './keys.js';
import { readPlanetSnapshot, readWorldSnapshots } from './planetCache.js';

interface WorldContextValue {
  activePlanetId: string | null;
  capitalPlanetId: string | null;
  worlds: readonly PlanetView[];
  selectPlanet: (planetId: string) => void;
}

const WorldContext = createContext<WorldContextValue | null>(null);
const CAPITAL_ALIAS_WORLD: WorldContextValue = {
  activePlanetId: null,
  capitalPlanetId: null,
  worlds: [],
  selectPlanet: () => undefined,
};

const storedWorld = (key: string): string | null => {
  try {
    return globalThis.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const rememberWorld = (key: string, planetId: string): void => {
  try {
    globalThis.localStorage.setItem(key, planetId);
  } catch {
    // Selection still works for this session when storage is unavailable.
  }
};

const combineWorlds = (results: UseQueryResult<PlanetView>[]): PlanetView[] =>
  results.flatMap((result) => result.data ? [result.data] : []);

/** Commander-wide world selection, persisted per season and commander. */
export function WorldProvider({ children }: { children: ReactNode }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const worldsQuery = useQuery({
    queryKey: keys.planets,
    queryFn: ({ signal }) => readWorldSnapshots(queryClient, api.planets, signal),
    staleTime: 15_000,
    // SSE is primary; this also heals a missed credit while the stream is down.
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const data = worldsQuery.data;
  const storageKey = data ? `astera:world:v1:${data.seasonId}:${data.playerId}` : null;
  const [requested, setRequested] = useState<{ storageKey: string; planetId: string } | null>(null);

  const worlds = useQueries({
    queries: (data?.planets ?? []).map((world) => ({
      queryKey: keys.planetById(world.planet.id),
      queryFn: () => readPlanetSnapshot(queryClient, keys.planetById(world.planet.id), () => api.planet(world.planet.id)),
      enabled: false,
      initialData: world,
      initialDataUpdatedAt: worldsQuery.dataUpdatedAt,
    })),
    combine: combineWorlds,
  });

  useEffect(() => {
    if (!storageKey || !data) return;
    // Resource refreshes preserve this visit's selection even if persistence fails.
    if (requested?.storageKey === storageKey
      && data.planets.some((world) => world.planet.id === requested.planetId)) return;
    const stored = storedWorld(storageKey);
    const valid = data.planets.some((world) => world.planet.id === stored);
    const next = valid ? stored! : data.capitalPlanetId;
    setRequested({ storageKey, planetId: next });
    if (!valid) rememberWorld(storageKey, next);
  }, [data, storageKey, requested]);

  const activePlanetId = requested?.storageKey === storageKey && data?.planets.some((world) => world.planet.id === requested.planetId)
    ? requested.planetId
    : data?.capitalPlanetId ?? null;

  const value = useMemo<WorldContextValue>(() => ({
    activePlanetId,
    capitalPlanetId: data?.capitalPlanetId ?? null,
    worlds,
    selectPlanet: (planetId) => {
      if (!storageKey || !data?.planets.some((world) => world.planet.id === planetId)) return;
      setRequested({ storageKey, planetId });
      rememberWorld(storageKey, planetId);
    },
  }), [activePlanetId, data, worlds, storageKey]);

  return <WorldContext.Provider value={value}>{children}</WorldContext.Provider>;
}

export function useWorld(): WorldContextValue {
  // The capital alias remains a supported one-release compatibility surface.
  // Screens embedded by legacy/tests may therefore omit the selector provider;
  // all query hooks interpret this null id as `/api/planet`, never as an id to
  // interpolate into a URL. The real application always mounts WorldProvider.
  return useContext(WorldContext) ?? CAPITAL_ALIAS_WORLD;
}
