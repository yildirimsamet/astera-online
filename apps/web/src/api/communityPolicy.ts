import { COMMUNITY_POLICY_VERSION } from '@astera/rules';
import { useQuery } from '@tanstack/react-query';
import { keys } from './keys.js';
import { useApi } from './context.js';

export function useCommunityPolicy() {
  const api = useApi(); return useQuery({ queryKey: keys.communityPolicy, queryFn: () => api.communityPolicy(), retry: false, staleTime: 5 * 60_000 });
}
export function policyIsAccepted(policy: ReturnType<typeof useCommunityPolicy>): boolean {
  return policy.data?.version === COMMUNITY_POLICY_VERSION && policy.data.acceptedAt !== null;
}
