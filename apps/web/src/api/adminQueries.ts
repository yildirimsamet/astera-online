import type { ChatMedia } from '@astera/rules';
import { refreshQueries } from './refreshQueries.js';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from './context.js';
import type { AdminMaskInput, AdminMuteInput } from './adminSchemas.js';

export function useAdminPlayers() {
  const api = useApi();
  return useInfiniteQuery({ queryKey: ['admin', 'players'],
    queryFn: ({ pageParam }) => api.adminPlayers(pageParam ?? undefined),
    initialPageParam: null as string | null, getNextPageParam: page => page.nextBefore,
    staleTime: 15_000, refetchInterval: 30_000,
  });
}
export function useAdminChatScopes(enabled = true) {
  const api = useApi();
  return useQuery({ queryKey: ['admin', 'chatScopes'], queryFn: api.adminChatScopes, enabled,
    staleTime: 30_000, refetchInterval: enabled ? 30_000 : false,
  });
}
export function useAdminModeration() {
  const api = useApi();
  const client = useQueryClient();
  return {
    mute: useMutation({ mutationFn: (input: AdminMuteInput) => api.adminMute(input),
      onSuccess: () => { void refreshQueries(client, { queryKey: ['admin', 'players'] }); },
    }),
    mask: useMutation({ mutationFn: (input: AdminMaskInput) => api.adminMask(input),
      onSuccess: () => {
        void refreshQueries(client, { queryKey: ['chat'] });
        void refreshQueries(client, { queryKey: ['clan', 'chat'] });
        void refreshQueries(client, { queryKey: ['admin', 'clanChat'] });
      },
    }),
  };
}
export function useAdminClanChat(clanId: string) {
  const api = useApi();
  return useInfiniteQuery({ queryKey: ['admin', 'clanChat', clanId],
    queryFn: ({ pageParam }) => api.adminClanChat(clanId, pageParam ?? undefined),
    initialPageParam: null as string | null, getNextPageParam: page => page.nextBefore,
    enabled: clanId.length > 0, staleTime: 3_000, refetchInterval: clanId ? 5_000 : false,
  });
}
export function useAdminPostClanChat(clanId: string) {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({ mutationFn: (input: { content: string; replyToMessageId?: string; media?: ChatMedia }) =>
    api.adminPostClanChat(clanId, input.content, input.replyToMessageId, input.media),
  onSuccess: () => { void refreshQueries(client, { queryKey: ['admin', 'clanChat', clanId] }); },
  });
}
