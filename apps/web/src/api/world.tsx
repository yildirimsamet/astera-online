import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { PlanetView } from './schemas.js';
import { useApi } from './context.js';
import { keys } from './keys.js';

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

/** Commander-wide world selection, persisted per season and commander. */
export function WorldProvider({ children }: { children: ReactNode }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const worldsQuery = useQuery({
    queryKey: keys.planets,
    queryFn: api.planets,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });
  const data = worldsQuery.data;
  const storageKey = data ? `astera:world:v1:${data.seasonId}:${data.playerId}` : null;
  const [requested, setRequested] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    for (const world of data.planets) {
      queryClient.setQueryData(keys.planetById(world.planet.id), world);
    }
  }, [data, queryClient]);

  useEffect(() => {
    if (!storageKey || !data) return;
    const stored = storedWorld(storageKey);
    const valid = data.planets.some((world) => world.planet.id === stored);
    const next = valid ? stored! : data.capitalPlanetId;
    setRequested(next);
    if (!valid) rememberWorld(storageKey, next);
  }, [data, storageKey]);

  const activePlanetId = requested && data?.planets.some((world) => world.planet.id === requested)
    ? requested
    : data?.capitalPlanetId ?? null;

  const value = useMemo<WorldContextValue>(() => ({
    activePlanetId,
    capitalPlanetId: data?.capitalPlanetId ?? null,
    worlds: data?.planets ?? [],
    selectPlanet: (planetId) => {
      if (!data?.planets.some((world) => world.planet.id === planetId)) return;
      setRequested(planetId);
      if (storageKey) rememberWorld(storageKey, planetId);
    },
  }), [activePlanetId, data, storageKey]);

  return <WorldContext.Provider value={value}>{children}</WorldContext.Provider>;
}

export function useWorld(): WorldContextValue {
  // The capital alias remains a supported one-release compatibility surface.
  // Screens embedded by legacy/tests may therefore omit the selector provider;
  // all query hooks interpret this null id as `/api/planet`, never as an id to
  // interpolate into a URL. The real application always mounts WorldProvider.
  return useContext(WorldContext) ?? CAPITAL_ALIAS_WORLD;
}
