import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from './context.js';
import { keys } from './keys.js';

export function useReturnStatus(enabled: boolean) {
  const api = useApi();
  return useQuery({ queryKey: keys.returnStatus, queryFn: api.returnStatus, enabled,
    staleTime: 60_000, refetchInterval: 60_000, refetchOnWindowFocus: true });
}
export function useApplyToReturn() {
  const api = useApi();
  const queries = useQueryClient();
  return useMutation({ mutationFn: api.applyToReturn,
    onSuccess: (status) => { queries.setQueryData(keys.returnStatus, status); },
    onError: () => { void queries.invalidateQueries({ queryKey: keys.returnStatus }); },
  });
}
