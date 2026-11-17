import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { CHAT_LANGUAGES, COMMUNITY_POLICY_VERSION } from '@astera/rules';
import { chatMuteStorageKey } from '../../lib/chatMutes.js';
import { Api } from '../../api/client.js';
import { ApiProvider } from '../../api/context.js';
import { keys } from '../../api/keys.js';
import { ChatHost } from '../shell/ChatHost.js';

/**
 * THE CHAT IN THE GALLERY (C2, 2026-11-14): the galaxy's room with a conversation in it, the
 * same room empty, and the clan's room with its event lines — so the camera and the audit can
 * see the chat page at 350 px without a live server. Every write answers 404.
 *
 * C3 adds the private room (`chat-dm`, `chat-dm-empty`, `chat-dm-new`), a held message's keys
 * (`chat-actions`, `chat-react`), who reacted (`chat-roster`), the report sheet (`chat-report`)
 * and the operator's photo (`chat-media`). A view that needs a press makes it once on arrival,
 * finding the control by what a reader hears, so the same view shows the old and the new page.
 *
 * C4 adds the muted list (`chat-muted`, `chat-muted-empty`), the blocked list (`chat-blocked`),
 * blocking a player (`chat-block`) and the rules a newcomer accepts before writing (`chat-policy`).
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

const PHOTO = '/assets/images/landing/chapter-fleet-v1-768.webp';

const MEDIA: Row = general('g6', 1, { username: 'Astera', authorPlayerId: 'staff', planetId: undefined, admin: true, content: 'Yeni filo boyaları geldi.',
  media: { kind: 'image', assetId: 'a1', mimeType: 'image/webp', width: 768, height: 432 } });

const peer = (playerId: string, username: string) => ({ playerId, username, country: 'TR' });
const thread = (id: string, who: ReturnType<typeof peer>, unreadCount: number): Row => ({
  id, peer: who, lastMessage: { id: `${id}-m`, content: '…', createdAt: at(5) }, unreadCount, blockedByMe: false, communityBlockedByMe: false, canSend: true, unavailableReason: null,
});
const MIRA = peer('mira', 'Mira');
const THREADS: Row[] = [thread('t1', MIRA, 2), thread('t2', peer('orin', 'Orin'), 0), thread('t3', peer('vega', 'Vega'), 0)];
const DM: Row[] = [
  { id: 'd1', authorPlayerId: 'mira', username: 'Mira', content: 'T2-06\'ya birlikte gidelim mi?', createdAt: at(40), self: false, previousSeasonRank: 1, previousSeasonRanking: 'DOMINION' },
  { id: 'd2', authorPlayerId: 'me', username: 'Samet', content: 'Olur, kalkanım 20 dakikaya hazır.', createdAt: at(35), self: true },
  { id: 'd3', authorPlayerId: 'mira', username: 'Mira', content: 'Ben önden sonda atarım.', createdAt: at(3), self: false, reactions: [{ emoji: '👍', count: 1, mine: true }] },
];
const CONTACTS = [peer('orin', 'Orin'), peer('vega', 'Vega'), peer('lyra', 'Lyra'), peer('kael', 'Kael Draven')];

const ACCOUNT = 'gallery';
const MUTED = [{ playerId: 'orin', username: 'Orin' }, { playerId: 'kael', username: 'Kael Draven' }];
const BLOCKED = [
  { accountId: '0d6c9a4e-6b1f-4c43-9d1e-2f5d8b7a1c01', username: 'Vega', createdAt: at(2_000).toISOString() },
  { accountId: '0d6c9a4e-6b1f-4c43-9d1e-2f5d8b7a1c02', username: 'Kael Draven', createdAt: at(9_000).toISOString() },
];

/** The muted list lives on the device: the gallery writes it before the chat reads it. */
function seedMutes(view: string): void {
  try {
    if (view === 'chat-muted') localStorage.setItem(chatMuteStorageKey(ACCOUNT), JSON.stringify(MUTED));
    else localStorage.removeItem(chatMuteStorageKey(ACCOUNT));
  } catch { /* A gallery without storage shows the empty list. */ }
}

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

function threadsOf(view: string): { conversations: Row[]; totalUnread: number } {
  const shown = view.startsWith('chat-dm') && view !== 'chat-dm-empty';
  return { conversations: shown ? THREADS : [], totalUnread: shown ? 2 : 0 };
}

/** The reads a held page asks again (a read marker refreshes the letters); every write answers 404. */
function answer(view: string): typeof fetch {
  return (input) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const body = url.includes('/api/dm/conversations') ? threadsOf(view)
      : url.includes('/api/dm/contacts') ? { contacts: CONTACTS }
        : url.includes('/api/community/blocks') ? { blocks: BLOCKED }
          : url.includes('/api/community/policy') ? policyOf(view) : null;
    return Promise.resolve(body === null ? new Response('{}', { status: 404 }) : new Response(JSON.stringify(body), { status: 200 }));
  };
}

function policyOf(view: string): { version: string; acceptedAt: Date | null } {
  return { version: COMMUNITY_POLICY_VERSION, acceptedAt: view === 'chat-policy' ? null : new Date(NOW) };
}

function seed(view: string): QueryClient {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  const empty = view === 'chat-empty';
  client.setQueryData(keys.communityPolicy, policyOf(view));
  client.setQueryData(keys.clanBadge, {
    available: true, membership: { clanId: 'c', name: 'Orbit Wardens', tag: 'ORB', role: 'MEMBER', matureAt: at(9_000), mature: true },
    attention: false, attentionCount: 0, clanChatUnread: view === 'chat-clan' ? 0 : 2,
  });
  for (const language of CHAT_LANGUAGES) {
    const rows = view === 'chat-media' ? [...GENERAL, MEDIA] : GENERAL;
    const messages = empty ? [] : rows.map((row) => ({ ...row, language }));
    client.setQueryData(keys.chatMessagesFor(language), { pages: [{ messages, nextBefore: null }], pageParams: [null] });
    client.setQueryData(keys.chatUnreadFor(language), { count: 0 });
  }
  client.setQueryData(keys.clanChat, { pages: [{ messages: [...CLAN].reverse(), nextBefore: null }], pageParams: [null] });
  client.setQueryData(keys.dmUnread, { count: empty ? 0 : 1 });
  client.setQueryData(keys.dmConversations, threadsOf(view));
  client.setQueryData(keys.dmMessagesFor('t1'), { pages: [{ messages: DM, nextBefore: null, canSend: true, unavailableReason: null }], pageParams: [null] });
  client.setQueryData(keys.dmContacts(''), { contacts: CONTACTS });
  client.setQueryData([...keys.chatMessages, 'reactions', 'g2'], { participants: [
    { playerId: 'orin', username: 'Orin', emoji: '😂' }, { playerId: 'vega', username: 'Vega', emoji: '😂' },
    { playerId: 'lyra', username: 'Lyra', emoji: '😂' }, { playerId: 'me', username: 'Samet', emoji: '👏' },
  ] });
  client.setQueryData(keys.communityBlocks, { blocks: [] });
  return client;
}

/** Waits for a control, then presses it the way the page hears a press. */
function pressWhenThere(find: () => Element | null | undefined, press: (element: Element) => void, then?: () => void): () => void {
  let left = 40;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const look = (): void => {
    const element = find();
    if (element) { press(element); then?.(); return; }
    if (left-- > 0) timer = setTimeout(look, 50);
  };
  timer = setTimeout(look, 50);
  return () => { clearTimeout(timer); };
}

const byLabel = (label: string): Element | null => document.querySelector(`button[aria-label="${CSS.escape(label)}"]`);
const click = (element: Element): void => { if (element instanceof HTMLElement) element.click(); };
const hold = (element: Element): void => { element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })); };

/** The one press a view stands on: a held message, its emoji key, its report key, a reaction, a new letter, the photo key. */
function useArrivalPress(view: string): void {
  const { t } = useTranslation();
  useEffect(() => {
    const message = (): Element | null => document.querySelector('[data-chat-message="g3"]');
    if (view === 'chat-actions') return pressWhenThere(message, hold);
    if (view === 'chat-react') {
      let inner: (() => void) | undefined;
      const outer = pressWhenThere(message, hold, () => { inner = pressWhenThere(() => byLabel(t('chat.addReaction')), click); });
      return () => { outer(); inner?.(); };
    }
    if (view === 'chat-block') {
      let inner: (() => void) | undefined;
      const outer = pressWhenThere(message, hold, () => { inner = pressWhenThere(() => byLabel(t('moderation.blocks.action')), click); });
      return () => { outer(); inner?.(); };
    }
    if (view === 'chat-muted' || view === 'chat-muted-empty') return pressWhenThere(() => byLabel(t('chat.personalMutes.title')), click);
    if (view === 'chat-blocked') return pressWhenThere(() => byLabel(t('moderation.blocks.title')), click);
    if (view === 'chat-report') {
      let inner: (() => void) | undefined;
      const outer = pressWhenThere(message, hold, () => { inner = pressWhenThere(() => byLabel(t('moderation.report')), click); });
      return () => { outer(); inner?.(); };
    }
    if (view === 'chat-roster') return pressWhenThere(() => byLabel(t('chat.reactionCount', { emoji: '😂', count: 3 })), click);
    if (view === 'chat-dm-new') return pressWhenThere(() => byLabel(t('chat.dm.start')), click);
    if (view === 'chat-media') {
      return pressWhenThere(() => Array.from(document.querySelectorAll('form button[aria-expanded]')).find((button) => button.textContent.includes(t('chat.media.add'))), click);
    }
    return undefined;
  }, [t, view]);
}

function Stage({ view }: { view: string }) {
  useArrivalPress(view);
  return <ChatHost accountId={ACCOUNT} onClose={noop} onFocusPlanet={noop} isAdmin={view === 'chat-media'}
    channel={view === 'chat-clan' ? 'clan' : view.startsWith('chat-dm') ? 'dm' : 'general'} />;
}

export function GalleryChat({ view }: { view: string }) {
  const [client] = useState(() => { seedMutes(view); return seed(view); });
  const [api] = useState(() => {
    const gallery = new Api({ fetch: answer(view) });
    gallery.chatMediaUrl = () => PHOTO;
    return gallery;
  });
  return (
    <QueryClientProvider client={client}>
      <ApiProvider api={api}>
        <Stage view={view} />
      </ApiProvider>
    </QueryClientProvider>
  );
}
