import type { Api } from '../api/client.js';

/** One recorded battle, fetched once per opening: the replay and the simulator read the same entry. */
export const battleReplayQuery = (api: Api, kind: 'BATTLE' | 'MONUMENT', id: string) => ({
  queryKey: ['battle-replay', kind, id] as const,
  queryFn: ({ signal }: { signal: AbortSignal }) => api.battleReplay(kind, id, { signal }),
  staleTime: Infinity, gcTime: 0, retry: false, refetchOnWindowFocus: false,
});
