import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../api/context.js';
import { keys } from '../api/keys.js';
import type { LegacyCollectedAward } from '../api/legacySchemas.js';

/** How a profile is reached: your own, a seat in this galaxy, an archived result, or its public id. */
export type LegacySource =
  | { kind: 'me' }
  | { kind: 'player'; playerId: string }
  | { kind: 'result'; resultId: string }
  | { kind: 'public'; publicId: string };

const sourceKey = (source: LegacySource): string =>
  source.kind === 'me' ? 'me' : source.kind === 'player' ? `player:${source.playerId}`
    : source.kind === 'result' ? `result:${source.resultId}` : `public:${source.publicId}`;

/** A Legacy is permanent: a minute of staleness costs nothing, and every edit invalidates it. */
const LEGACY_STALE_MS = 60_000;

export function useLegacyProfile(source: LegacySource) {
  const api = useApi();
  return useQuery({
    queryKey: keys.legacyProfile(sourceKey(source)),
    queryFn: () => source.kind === 'me' ? api.legacyMe()
      : source.kind === 'player' ? api.legacyPlayer(source.playerId)
      : source.kind === 'result' ? api.legacyResult(source.resultId)
      : api.legacyProfile(source.publicId),
    staleTime: LEGACY_STALE_MS,
  });
}

/**
 * Every piece a commander holds. Read after the profile, which evaluates the award ledger
 * first, so a visitor never sees a collection older than the profile above it.
 */
export function useLegacyCollection(publicId: string | null) {
  const api = useApi();
  return useQuery({
    queryKey: keys.legacyCollection(publicId ?? 'none'),
    enabled: publicId !== null,
    staleTime: LEGACY_STALE_MS,
    queryFn: async (): Promise<LegacyCollectedAward[]> => {
      const awards: LegacyCollectedAward[] = [];
      let cursor: string | undefined;
      for (;;) {
        const next = await api.legacyCollection(publicId ?? '', cursor);
        awards.push(...next.awards);
        if (next.nextCursor === null) break;
        cursor = next.nextCursor;
      }
      return awards;
    },
  });
}

export function useLegacySeasons(publicId: string | null) {
  const api = useApi();
  return useInfiniteQuery({
    queryKey: keys.legacySeasons(publicId ?? 'none'),
    enabled: publicId !== null,
    staleTime: LEGACY_STALE_MS,
    initialPageParam: undefined as number | undefined,
    queryFn: ({ pageParam }) => api.legacySeasons(publicId ?? '', pageParam),
    getNextPageParam: last => last.nextCursor ?? undefined,
  });
}

/** Your own ladders, for the goals still ahead. Only the owner can read them. */
export function useLegacyProgress(enabled: boolean) {
  const api = useApi();
  return useQuery({ queryKey: keys.legacyProgress, queryFn: api.legacyProgress, enabled, staleTime: LEGACY_STALE_MS });
}

export function useLegacyAward(publicId: string | null, awardId: string | null) {
  const api = useApi();
  return useQuery({
    queryKey: keys.legacyAward(publicId ?? 'none', awardId ?? 'none'),
    enabled: publicId !== null && awardId !== null,
    staleTime: LEGACY_STALE_MS,
    queryFn: () => api.legacyAward(publicId ?? '', awardId ?? ''),
  });
}

export function useSetLegacyShowcase() {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (awardIds: readonly string[]) => api.setLegacyShowcase(awardIds),
    onSettled: () => client.invalidateQueries({ queryKey: keys.legacy }),
  });
}

export function useSetLegacyTitle() {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (awardId: string | null) => api.setLegacyTitle(awardId),
    onSettled: () => client.invalidateQueries({ queryKey: keys.legacy }),
  });
}
