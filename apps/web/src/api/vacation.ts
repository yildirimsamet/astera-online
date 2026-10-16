import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from './context.js';
import { keys } from './keys.js';

export function useVacation(days: number) {
  const api = useApi();
  return useQuery({ queryKey: [...keys.vacation, days], queryFn: () => api.vacation(days), refetchInterval: 15_000, placeholderData: previous => previous });
}

function useVacationRefresh() {
  const client = useQueryClient();
  return async () => {
    await Promise.all([keys.vacation, keys.planet, keys.planets, keys.season, keys.galaxy, keys.pending].map(queryKey => client.invalidateQueries({ queryKey })));
  };
}
export function useStartVacation() {
  const api = useApi();
  const refresh = useVacationRefresh();
  return useMutation({ mutationFn: (input: { days: number; fingerprint: string; requestId: string }) => api.startVacation(input), onSuccess: refresh });
}
export function useEndVacation() {
  const api = useApi();
  const refresh = useVacationRefresh();
  return useMutation({ mutationFn: (vacationId: string) => api.endVacation(vacationId), onSuccess: refresh });
}
