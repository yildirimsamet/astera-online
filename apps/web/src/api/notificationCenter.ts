import type { AlertTiming, PaidAlertKind } from '@astera/rules';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from './context.js';
import { keys } from './keys.js';
import type { NotificationCenter } from './notificationCenterSchemas.js';

/** `enabled` is false where the centre does not exist (the web): nothing is read there. */
export function useNotificationCenter(enabled: boolean) {
  const api = useApi();
  return useQuery({ queryKey: keys.notificationCenter, queryFn: () => api.notificationCenter(), refetchInterval: 30_000, enabled });
}

/** Every mutation answers with the whole view; building and funding also move the world's store. */
function useCenterMutation<T>(call: (input: T) => Promise<NotificationCenter>, movesStore: boolean) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: call,
    onSuccess: async view => {
      client.setQueryData(keys.notificationCenter, view);
      if (movesStore) await Promise.all([keys.planet, keys.planets].map(queryKey => client.invalidateQueries({ queryKey })));
    },
  });
}
export function useBuildNotificationCenter() {
  const api = useApi();
  return useCenterMutation((planetId: string) => api.buildNotificationCenter(planetId), true);
}
export function useFundNotificationCenter() {
  const api = useApi();
  return useCenterMutation((input: { planetId: string; amount: number }) => api.fundNotificationCenter(input.planetId, input.amount), true);
}
export function useNotificationCenterSettings() {
  const api = useApi();
  return useCenterMutation((settings: { timing?: AlertTiming; muted?: PaidAlertKind[] }) => api.setNotificationCenter(settings), false);
}
