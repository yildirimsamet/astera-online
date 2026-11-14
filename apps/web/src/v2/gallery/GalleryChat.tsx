import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CHAT_LANGUAGES, COMMUNITY_POLICY_VERSION } from '@astera/rules';
import { Api } from '../../api/client.js';
import { ApiProvider } from '../../api/context.js';
import { keys } from '../../api/keys.js';
import { ChatHost } from '../shell/ChatHost.js';

/**
 * THE CHAT IN THE GALLERY (C2, 2026-11-14): the galaxy's room with a conversation in it, the
 * same room empty, and the clan's room with its event lines — so the camera and the audit can
 * see the chat page at 350 px without a live server. Every write answers 404.
 *
 * Development only (`v2-gallery.html`); nothing here is imported by the game.
 */

const NOW = Date.now();
const noop = (): void => undefined;
const at = (minutes: number): Date => new Date(NOW - minutes * 60_000);

type Row = Record<string, unknown>;

const general = (id: string, minutes: number, over: Row): Row => ({
  id, language: 'tr', authorPlayerId: 'orin', planetId: 'p-orin', username: 'Orin', content: '', createdAt: at(minutes), self: false, ...over,
});

const GENERAL: Row[] = [
  general('g1', 52, { content: 'Kuzeydeki asteroit kuşağında kim var? Döteryum arıyorum.', clanTag: 'ORB', clanTier: 'SILVER' }),
  general('g2', 47, { username: 'Mira', authorPlayerId: 'mira', planetId: 'p-mira', content: 'Biz oradayız, uzak dur 😄', previousSeasonRank: 1, previousSeasonRanking: 'DOMINION',
    reactions: [{ emoji: '😂', count: 3, mine: false }, { emoji: '👏', count: 1, mine: true }] }),
  general('g3', 31, { username: 'Vega', authorPlayerId: 'vega', planetId: 'p-vega', content: 'Korsan üssü T2-06 bu gece yine dolu, kim gelir?', supporter: true }),
  general('g4', 12, { username: 'Samet', authorPlayerId: 'me', planetId: 'p-me', self: true, content: 'Ben gelirim, 20 dakikaya hazırım.',
    replyTo: { id: 'g3', username: 'Vega', content: 'Korsan üssü T2-06 bu gece yine dolu, kim gelir?' } }),
  general('g5', 2, { username: 'Astera', authorPlayerId: 'staff', planetId: undefined, admin: true, content: 'Bu akşam 21:00\'de asteroit yağmuru başlıyor.' }),
];

const clanLine = (id: string, minutes: number, over: Row): Row => ({
  id, authorPlayerId: 'mira', planetId: 'p', username: 'Mira', content: '', createdAt: at(minutes), self: false, ...over,
});

const CLAN: Row[] = [
  clanLine('e4', 1, { event: { kind: 'DEFENCE', params: { hostName: 'Ayşe', hostPlanetName: 'Kuzgun', grade: 'REPELLED', supporters: 2, attackerLost: 41, heroName: 'Mira' } } }),
  clanLine('m3', 3, { content: 'Geliyorum, 6 dk', clanTag: 'ORB', clanTier: 'GOLD' }),
  clanLine('e2', 5, { event: { kind: 'ALARM', params: { hostName: 'Ayşe', hostPlanetName: 'Kuzgun', arriveAt: new Date(NOW + 9 * 60_000).toISOString() } } }),
  clanLine('m1', 30, { username: 'Orin', authorPlayerId: 'orin', content: 'Sancak 6 oldu!', clanTag: 'ORB', clanTier: 'SILVER' }),
  clanLine('e1', 31, { event: { kind: 'LEVEL_UP', params: { level: 6 } } }),
];

function seed(view: string): QueryClient {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  const empty = view === 'chat-empty';
  client.setQueryData(keys.communityPolicy, { version: COMMUNITY_POLICY_VERSION, acceptedAt: new Date(NOW) });
  client.setQueryData(keys.clanBadge, {
    available: true, membership: { clanId: 'c', name: 'Orbit Wardens', tag: 'ORB', role: 'MEMBER', matureAt: at(9_000), mature: true },
    attention: false, attentionCount: 0, clanChatUnread: view === 'chat-clan' ? 0 : 2,
  });
  for (const language of CHAT_LANGUAGES) {
    const messages = empty ? [] : GENERAL.map((row) => ({ ...row, language }));
    client.setQueryData(keys.chatMessagesFor(language), { pages: [{ messages, nextBefore: null }], pageParams: [null] });
    client.setQueryData(keys.chatUnreadFor(language), { count: 0 });
  }
  client.setQueryData(keys.clanChat, { pages: [{ messages: [...CLAN].reverse(), nextBefore: null }], pageParams: [null] });
  client.setQueryData(keys.dmUnread, { count: empty ? 0 : 1 });
  client.setQueryData(keys.dmConversations, { conversations: [], totalUnread: 0 });
  client.setQueryData(keys.communityBlocks, { blocks: [] });
  return client;
}

export function GalleryChat({ view }: { view: string }) {
  const [client] = useState(() => seed(view));
  const [api] = useState(() => new Api({ fetch: () => Promise.resolve(new Response('{}', { status: 404 })) }));
  return (
    <QueryClientProvider client={client}>
      <ApiProvider api={api}>
        <ChatHost onClose={noop} onFocusPlanet={noop} channel={view === 'chat-clan' ? 'clan' : 'general'} />
      </ApiProvider>
    </QueryClientProvider>
  );
}
