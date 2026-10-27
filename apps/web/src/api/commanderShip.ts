import { useQuery } from '@tanstack/react-query';
import { refreshAfter } from '../galaxy/parkedShip.js';
import { useApi } from './context.js';
import { keys } from './keys.js';

export { commanderShipSchema, type CommanderShipView } from './commanderShipSchemas.js';

export function useCommanderShip(enabled: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: keys.commanderShip, queryFn: () => api.commanderShip(), enabled, retry: false,
    staleTime: 30_000, refetchInterval: query => refreshAfter(query.state.data, Date.now()),
  });
}
