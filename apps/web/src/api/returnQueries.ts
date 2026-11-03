import { refreshQueries } from './refreshQueries.js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from './context.js';
import { keys } from './keys.js';
import { NET_MS, safetyNetMs } from './liveChannel.js';

export function useReturnStatus(enabled: boolean) {
  const api = useApi();
  return useQuery({ queryKey: keys.returnStatus, queryFn: api.returnStatus, enabled,
    staleTime: 60_000, refetchOnWindowFocus: true,
    // The queue moves with no event; only someone in the waiting room is watching it.
    refetchInterval: query => query.state.data?.placement?.role === 'WAITING' ? NET_MS : safetyNetMs() });
}
export function useApplyToReturn() {
  const api = useApi();
  const queries = useQueryClient();
  return useMutation({ mutationFn: api.applyToReturn,
    onSuccess: (status) => { queries.setQueryData(keys.returnStatus, status); },
    onError: () => { void refreshQueries(queries, { queryKey: keys.returnStatus }); },
  });
}
