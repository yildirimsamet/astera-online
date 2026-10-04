import { CHAT, CLAN, REACTION_EMOJIS, type ReactionEmoji } from '@astera/rules';
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type SyntheticEvent,
  type UIEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  useChatMessages,
  useChatUnread,
  useClanActions,
  useClanBadge,
  useClanChat,
  useMarkChatRead,
  usePostChat,
  useDmUnread,
  useDmConversations,
  useDmContacts,
  useDmMessages,
  usePostDm,
  useMarkDmRead,
  useSetDmBlock,
  useMessageReaction,
} from '../api/queries.js';
import { describeError } from '../i18n/errors.js';
import { currentLanguage } from '../i18n/index.js';
import { isLanguage, LANGUAGES, LANGUAGE_LABEL, type Language } from '../i18n/languages.js';
import { chatRelativeTime } from '../lib/chatTime.js';
import { commanderLabel } from '../lib/identity.js';
import { haptic } from '../lib/haptics.js';
import { useNow } from '../lib/time.js';
import { ClanIcon, CloseIcon, PlusIcon, SendIcon } from '../ui/icons/index.js';
import { Unreachable, Waiting } from '../ui/kit/index.js';
import { Segmented } from '../v2/kit/Segmented.js';
import { EmptyState } from '../v2/kit/Surface.js';

interface MessageRow {
  id: string;
  authorPlayerId: string;
  planetId?: string;
  username: string;
  clanTag?: string | null;
  content: string;
  createdAt: Date;
  self: boolean;
  /** The author speaks with admin authority. Marked in gold; see the row below. */
  admin?: boolean;
  replyTo?: { id: string; username: string; content: string } | null;
  reactions?: { emoji: ReactionEmoji; count: number; mine: boolean }[];
}

/** Which room: the galaxy's general channel or the commander's clan. */
export type ChatChannel = 'general' | 'clan' | 'dm';

const CHAT_LANGUAGE_STORAGE_KEY = 'astera.chat.language.v1';

function initialChatLanguage(): Language {
  try {
    const stored = localStorage.getItem(CHAT_LANGUAGE_STORAGE_KEY);
    if (isLanguage(stored)) return stored;
  } catch {
    // A blocked preference store must not prevent the chat from opening.
  }
  return currentLanguage();
}

export function ChatScreen({
  onFocusPlanet,
  initialChannel = 'general',
  initialClanDraft = '',
}: {
  onFocusPlanet: (planetId: string) => void;
  initialChannel?: ChatChannel;
  /** A line handed in to the clan composer (a report told to the clan, M4); the reader sends it. */
  initialClanDraft?: string;
}) {
  const { t } = useTranslation();
  const [channel, setChannel] = useState<ChatChannel>(initialChannel);
  const [chatLanguage, setChatLanguage] = useState<Language>(initialChatLanguage);
  const [generalDrafts, setGeneralDrafts] = useState<Partial<Record<Language, string>>>({});
  const [generalReplies, setGeneralReplies] = useState<Partial<Record<Language, MessageRow | null>>>({});
  const [clanDraft, setClanDraft] = useState(initialClanDraft);
  const [clanReply, setClanReply] = useState<MessageRow | null>(null);
  const badge = useClanBadge();
  const inClan = badge.data?.membership !== null && badge.data?.membership !== undefined;
  const general = useChatMessages(chatLanguage);
  const generalUnreadQuery = useChatUnread(chatLanguage);
  const clan = useClanChat(inClan);
  const postGeneral = usePostChat(chatLanguage);
  const markGeneral = useMarkChatRead(chatLanguage);
  const clanActions = useClanActions();
  const generalUnread = generalUnreadQuery.data?.count ?? 0;
  const clanUnread = badge.data?.clanChatUnread ?? 0;
  const dmUnread = useDmUnread().data?.count ?? 0;

  const generalMessages = useMemo(
    () => [...(general.data?.pages ?? [])].reverse().flatMap((page) => page.messages),
    [general.data?.pages],
  );
  const clanMessages = useMemo(
    () => [...(clan.data?.pages ?? [])].reverse().flatMap((page) => page.messages),
    [clan.data?.pages],
  );

  const tabs = [
    {
      id: 'general' as const,
      label: t('chat.general'),
      dot: generalUnread > 0,
      name: generalUnread > 0
        ? t('chat.channelUnread', { channel: t('chat.general'), count: generalUnread })
        : t('chat.general'),
    },
    {
      id: 'clan' as const,
      label: t('chat.clan'),
      dot: clanUnread > 0,
      name: clanUnread > 0
        ? t('chat.channelUnread', { channel: t('chat.clan'), count: clanUnread })
        : t('chat.clan'),
    },
    {
      id: 'dm' as const,
      label: t('chat.dm.title'),
      dot: dmUnread > 0,
      name: dmUnread > 0
        ? t('chat.channelUnread', { channel: t('chat.dm.title'), count: dmUnread })
        : t('chat.dm.title'),
    },
  ];

  return (
    <div className="chat-type flex h-full min-h-0 flex-col">
      {/*
        D6: the two rooms and, for the galaxy's room, its language — one row, the
        language a small select at the end rather than a page-wide field.
      */}
      <div className="flex shrink-0 items-center gap-2 border-b border-v2-line px-3 pb-2">
        <div className="min-w-0 flex-1">
          <Segmented
            options={tabs}
            value={channel}
            onChange={setChannel}
            label={t('chat.channelsLabel')}
            tabId={(id) => `chat-tab-${id}`}
          />
        </div>
        {channel === 'general' ? (
          <label className="shrink-0">
            <span className="sr-only">{t('chat.languageLabel')}</span>
            <select
              aria-label={t('chat.languageLabel')}
              className="h-8 max-w-[7.5rem] rounded-control border border-v2-line-hi bg-v2-deep px-2 text-micro text-v2-ink outline-none focus:border-v2-self"
              value={chatLanguage}
              onChange={(event) => {
                const next = event.currentTarget.value;
                if (!isLanguage(next)) return;
                setChatLanguage(next);
                try {
                  localStorage.setItem(CHAT_LANGUAGE_STORAGE_KEY, next);
                } catch {
                  // Keep the current selection usable when storage is blocked or full.
                }
              }}
            >
              {LANGUAGES.map((language) => (
                <option key={language} value={language}>{LANGUAGE_LABEL[language]}</option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <div
        id={`chat-panel-${channel}`}
        role="tabpanel"
        aria-labelledby={`chat-tab-${channel}`}
        className="flex min-h-0 flex-1 flex-col"
      >
        {channel === 'general' ? (
          general.isError ? (
            <Unreachable what={t('surface.whatChat')} onRetry={() => { void general.refetch(); }} />
          ) : !general.data ? (
            <Waiting>{t('surface.waitingChat')}</Waiting>
          ) : (
            <ChannelPanel
              key={chatLanguage}
              messages={generalMessages}
              listLabel={t('chat.list')}
              empty={t('chat.empty')}
              loadingOlder={t('chat.loadingOlder')}
              placeholder={t('chat.placeholder')}
              draft={generalDrafts[chatLanguage] ?? ''}
              replyTarget={generalReplies[chatLanguage] ?? null}
              onReplyTarget={(target) => { setGeneralReplies((current) => ({ ...current, [chatLanguage]: target })); }}
              onDraft={(draft) => {
                setGeneralDrafts((current) => ({ ...current, [chatLanguage]: draft }));
              }}
              onFocusPlanet={onFocusPlanet}
              hasNextPage={general.hasNextPage}
              fetchingOlder={general.isFetchingNextPage}
              onOlder={() => general.fetchNextPage()}
              onMarkRead={(id) => { markGeneral.mutate(id); }}
              posting={postGeneral.isPending}
              postError={postGeneral.isError ? postGeneral.error : null}
              onPost={(content, replyToMessageId, done) => {
                postGeneral.mutate(replyToMessageId ? { content, replyToMessageId } : content, { onSuccess: done });
              }}
              maxChars={CHAT.maxChars}
              tone="general"
            />
          )
        ) : channel === 'dm' ? (
          <DmPanel />
        ) : !inClan ? (
          <div className="px-2 py-6">
            <EmptyState icon={<ClanIcon className="size-6" />} title={t('chat.clanLocked')}>
              {t('chat.clanLockedHint')}
            </EmptyState>
          </div>
        ) : clan.isError ? (
          <Unreachable what={t('clan.chat.heading')} onRetry={() => { void clan.refetch(); }} />
        ) : !clan.data ? (
          <Waiting>{t('clan.chat.waiting')}</Waiting>
        ) : (
          <ChannelPanel
            key="clan"
            messages={clanMessages}
            listLabel={t('clan.chat.list')}
            empty={t('clan.chat.empty')}
            loadingOlder={t('clan.chat.loadingOlder')}
            placeholder={t('clan.chat.placeholder')}
            draft={clanDraft}
            replyTarget={clanReply}
            onReplyTarget={setClanReply}
            onDraft={setClanDraft}
            onFocusPlanet={onFocusPlanet}
            hasNextPage={clan.hasNextPage}
            fetchingOlder={clan.isFetchingNextPage}
            onOlder={() => clan.fetchNextPage()}
            onMarkRead={(id) => { clanActions.readChat.mutate(id); }}
            posting={clanActions.postChat.isPending}
            postError={clanActions.postChat.isError ? clanActions.postChat.error : null}
            onPost={(content, replyToMessageId, done) => {
              clanActions.postChat.mutate(replyToMessageId ? { content, replyToMessageId } : content, { onSuccess: done });
            }}
            maxChars={CLAN.chatMaxChars}
            tone="clan"
          />
        )}
      </div>
    </div>
  );
}

function DmPanel() {
  const { t } = useTranslation();
  const conversations = useDmConversations();
  const [selectedPeerId, setSelectedPeerId] = useState<string | null>(null);
  const [closedPeers, setClosedPeers] = useState<ReadonlySet<string>>(() => new Set());
  const [temporaryPeers, setTemporaryPeers] = useState<{ playerId: string; username: string; country: string }[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [replies, setReplies] = useState<Record<string, MessageRow | null>>({});
  const contacts = useDmContacts(search, pickerOpen);
  const post = usePostDm();
  const markRead = useMarkDmRead();
  const block = useSetDmBlock();

  const saved = conversations.data?.conversations ?? [];
  const tabs = [
    ...saved.filter((conversation) => !closedPeers.has(conversation.peer.playerId)).map((conversation) => ({
      ...conversation.peer, unreadCount: conversation.unreadCount,
    })),
    ...temporaryPeers.filter((peer) => !closedPeers.has(peer.playerId) && !saved.some((conversation) => conversation.peer.playerId === peer.playerId))
      .map((peer) => ({ ...peer, unreadCount: 0 })),
  ];
  const activePeerId = tabs.some((tab) => tab.playerId === selectedPeerId)
    ? selectedPeerId : tabs[0]?.playerId ?? null;
  const activePeer = tabs.find((tab) => tab.playerId === activePeerId);
  const activeConversation = saved.find((conversation) => conversation.peer.playerId === activePeerId);
  const messages = useDmMessages(activeConversation?.id);
  const chatMessages = useMemo(
    () => [...(messages.data?.pages ?? [])].reverse().flatMap((page) => page.messages),
    [messages.data?.pages],
  );
  const unavailableReason = activeConversation?.canSend === false
    ? activeConversation.unavailableReason
    : messages.data?.pages[0]?.canSend === false
      ? messages.data.pages[0].unavailableReason
      : null;
  const disabledReason = unavailableReason === 'WAITING' ? t('chat.dm.waitingHint')
    : unavailableReason === 'SEASON_ENDED' ? t('chat.dm.seasonEndedHint')
      : unavailableReason === 'BLOCKED' ? t('chat.dm.blockedHint') : null;

  const selectContact = (peer: { playerId: string; username: string; country: string }) => {
    setClosedPeers((current) => {
      const next = new Set(current);
      next.delete(peer.playerId);
      return next;
    });
    setTemporaryPeers((current) => current.some((item) => item.playerId === peer.playerId) ? current : [...current, peer]);
    setSelectedPeerId(peer.playerId);
    setPickerOpen(false);
    setSearch('');
    post.reset();
  };

  if (conversations.isError) {
    return <Unreachable what={t('chat.dm.title')} onRetry={() => { void conversations.refetch(); }} />;
  }
  if (!conversations.data) return <Waiting>{t('chat.dm.loading')}</Waiting>;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-stretch gap-1 border-b border-v2-line px-3 py-1.5">
        <div role="tablist" aria-label={t('chat.dm.conversations')} className="flex min-w-0 flex-1 gap-1 overflow-x-auto pb-1.5">
          {tabs.map((peer) => (
            <span key={peer.playerId} className={`flex max-w-40 shrink-0 items-center rounded-t-control border border-b-0 ${
              activePeerId === peer.playerId ? 'border-v2-line-hi bg-v2-raise' : 'border-v2-line bg-v2-deep'
            }`}>
              <button
                type="button"
                role="tab"
                aria-selected={activePeerId === peer.playerId}
                aria-label={peer.unreadCount > 0
                  ? t('chat.channelUnread', { channel: peer.username, count: peer.unreadCount })
                  : peer.username}
                className="min-w-0 truncate px-2 py-1.5 text-micro text-v2-ink"
                onClick={() => { setSelectedPeerId(peer.playerId); setPickerOpen(false); }}
              >
                {peer.username}
                {peer.unreadCount > 0 ? <span aria-hidden className="ml-1 text-v2-self">●</span> : null}
              </button>
              <button
                type="button"
                aria-label={t('chat.dm.closeTab', { name: peer.username })}
                className="grid size-6 shrink-0 place-items-center text-v2-ink-3 hover:text-v2-ink"
                onClick={() => {
                  setClosedPeers((current) => new Set(current).add(peer.playerId));
                  if (selectedPeerId === peer.playerId) setSelectedPeerId(null);
                }}
              ><CloseIcon className="size-3" /></button>
            </span>
          ))}
        </div>
        <button
          type="button"
          aria-label={t('chat.dm.start')}
          className="grid size-8 shrink-0 place-items-center rounded-control border border-v2-line-hi bg-v2-raise text-v2-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-v2-self"
          onClick={() => { setPickerOpen(true); }}
        ><PlusIcon className="size-4" /></button>
      </div>

      {pickerOpen ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <div className="flex items-center gap-2">
            <input
              type="search"
              aria-label={t('chat.dm.searchLabel')}
              placeholder={t('chat.dm.searchPlaceholder')}
              value={search}
              onChange={(event) => { setSearch(event.currentTarget.value); }}
              className="h-10 min-w-0 flex-1 rounded-control border border-v2-line-hi bg-v2-deep px-3 text-caption text-v2-ink outline-none focus:border-v2-self"
            />
            <button type="button" onClick={() => { setPickerOpen(false); }} className="text-caption text-v2-ink-2">{t('chat.dm.cancel')}</button>
          </div>
          {contacts.isError ? <Unreachable what={t('chat.dm.contacts')} onRetry={() => { void contacts.refetch(); }} /> : null}
          {contacts.data?.contacts.length === 0 ? <p className="py-5 text-caption text-v2-ink-3">{t('chat.dm.noContacts')}</p> : null}
          <div className="mt-2 grid gap-1">
            {contacts.data?.contacts.map((peer) => (
              <button
                key={peer.playerId}
                type="button"
                className="rounded-control border border-v2-line bg-v2-deep px-3 py-2 text-left text-caption text-v2-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-v2-self"
                onClick={() => { selectContact(peer); }}
              >{peer.username}</button>
            ))}
          </div>
        </div>
      ) : !activePeer || !activePeerId ? (
        <div className="px-3 py-6"><EmptyState title={t('chat.dm.empty')} /></div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center justify-between border-b border-v2-line px-3 py-1.5">
            <span className="min-w-0 truncate text-caption font-semibold text-v2-ink">{activePeer.username}</span>
            {activeConversation ? (
              <button
                type="button"
                disabled={block.isPending}
                aria-label={t(activeConversation.blockedByMe ? 'chat.dm.unblock' : 'chat.dm.block', { name: activePeer.username })}
                className="shrink-0 px-2 py-1 text-micro text-v2-ink-3 underline underline-offset-2 disabled:opacity-50"
                onClick={() => { block.mutate({ targetPlayerId: activePeerId, blocked: !activeConversation.blockedByMe }); }}
              >{t(activeConversation.blockedByMe ? 'chat.dm.unblockShort' : 'chat.dm.blockShort')}</button>
            ) : null}
          </div>
          {messages.isError ? (
            <Unreachable what={activePeer.username} onRetry={() => { void messages.refetch(); }} />
          ) : activeConversation && !messages.data ? (
            <Waiting>{t('chat.dm.loading')}</Waiting>
          ) : (
            <ChannelPanel
              key={activePeerId}
              messages={chatMessages}
              listLabel={t('chat.dm.list', { name: activePeer.username })}
              empty={t('chat.dm.emptyConversation', { name: activePeer.username })}
              loadingOlder={t('chat.loadingOlder')}
              placeholder={t('chat.dm.placeholder', { name: activePeer.username })}
              draft={drafts[activePeerId] ?? ''}
              replyTarget={replies[activePeerId] ?? null}
              onReplyTarget={(target) => { setReplies((current) => ({ ...current, [activePeerId]: target })); }}
              onDraft={(draft) => { setDrafts((current) => ({ ...current, [activePeerId]: draft })); }}
              onFocusPlanet={() => undefined}
              hasNextPage={messages.hasNextPage}
              fetchingOlder={messages.isFetchingNextPage}
              onOlder={() => messages.fetchNextPage()}
              onMarkRead={(messageId) => {
                if (activeConversation) markRead.mutate({ conversationId: activeConversation.id, messageId });
              }}
              posting={post.isPending}
              postError={post.isError ? post.error : null}
              onPost={(content, replyToMessageId, done) => {
                post.mutate({ recipientPlayerId: activePeerId, content, ...(replyToMessageId ? { replyToMessageId } : {}) }, { onSuccess: done });
              }}
              maxChars={CHAT.maxChars}
              tone="dm"
              disabledReason={disabledReason}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ChannelPanel({
  messages,
  listLabel,
  empty,
  loadingOlder,
  placeholder,
  draft,
  onDraft,
  replyTarget,
  onReplyTarget,
  onFocusPlanet,
  hasNextPage,
  fetchingOlder,
  onOlder,
  onMarkRead,
  posting,
  postError,
  onPost,
  maxChars,
  tone,
  disabledReason = null,
}: {
  messages: readonly MessageRow[];
  listLabel: string;
  empty: string;
  loadingOlder: string;
  placeholder: string;
  draft: string;
  onDraft: (draft: string) => void;
  replyTarget: MessageRow | null;
  onReplyTarget: (target: MessageRow | null) => void;
  onFocusPlanet: (planetId: string) => void;
  hasNextPage: boolean;
  fetchingOlder: boolean;
  onOlder: () => Promise<unknown>;
  onMarkRead: (messageId: string) => void;
  posting: boolean;
  postError: unknown;
  onPost: (content: string, replyToMessageId: string | undefined, done: () => void) => void;
  /** Each channel's own server ceiling. The two are separate rules, not one. */
  maxChars: number;
  tone: 'general' | 'clan' | 'dm';
  disabledReason?: string | null;
}) {
  const { t } = useTranslation();
  const now = useNow(30_000);
  const history = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const marked = useRef<string | null>(null);
  const followingLatest = useRef(true);
  const requestingOlder = useRef(false);
  const prependSnapshot = useRef<{ scrollHeight: number; scrollTop: number } | null>(null);
  const previousLatestId = useRef<string | undefined>(undefined);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [actionMessageId, setActionMessageId] = useState<string | null>(null);
  const [pickerMessageId, setPickerMessageId] = useState<string | null>(null);
  const [pickerBelow, setPickerBelow] = useState(false);
  const reaction = useMessageReaction();
  const clearHold = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };
  const openActions = (messageId: string) => {
    setActionMessageId(messageId);
    setPickerMessageId(null);
  };
  useEffect(() => () => { if (holdTimer.current) clearTimeout(holdTimer.current); }, []);
  useEffect(() => {
    if (!actionMessageId && !pickerMessageId) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('[data-chat-message-actions], [data-chat-reaction-picker]')) return;
      setActionMessageId(null);
      setPickerMessageId(null);
    };
    document.addEventListener('pointerdown', closeOnOutsidePress, true);
    return () => { document.removeEventListener('pointerdown', closeOnOutsidePress, true); };
  }, [actionMessageId, pickerMessageId]);
  const oldestId = messages[0]?.id;
  const latestId = messages.at(-1)?.id;

  useEffect(() => {
    if (!followingLatest.current || !latestId || marked.current === latestId) return;
    marked.current = latestId;
    onMarkRead(latestId);
  }, [latestId, onMarkRead]);

  useLayoutEffect(() => {
    /**
     * Scroll the ONE box that owns the messages. `scrollIntoView()` also walks
     * outward toward the page viewport; on iOS that can preserve the visual
     * viewport pan Safari applied while the keyboard and composer were focused.
     * The first page starts at the bottom. After that, only somebody already at
     * the bottom follows a newly arrived message; scrolling up is an explicit
     * decision to keep reading history.
     */
    const log = history.current;
    if (!log || !latestId) return;
    if (previousLatestId.current === undefined || followingLatest.current) {
      log.scrollTop = log.scrollHeight;
      followingLatest.current = true;
    }
    previousLatestId.current = latestId;
  }, [latestId]);

  useLayoutEffect(() => {
    const snapshot = prependSnapshot.current;
    const log = history.current;
    if (!snapshot || !log) return;
    log.scrollTop = snapshot.scrollTop + (log.scrollHeight - snapshot.scrollHeight);
    prependSnapshot.current = null;
  }, [oldestId]);

  useLayoutEffect(() => {
    if (!actionMessageId) return;
    const log = history.current;
    const target = pickerMessageId
      ? log?.querySelector('[data-chat-reaction-picker]')
      : log?.querySelector('[data-chat-message-actions]');
    if (!log || !target) return;
    const overflow = target.getBoundingClientRect().bottom - log.getBoundingClientRect().bottom;
    if (overflow > 0) log.scrollTop += overflow + 8;
  }, [actionMessageId, pickerMessageId, pickerBelow]);

  const markLatestRead = (): void => {
    if (!latestId || marked.current === latestId) return;
    marked.current = latestId;
    onMarkRead(latestId);
  };

  const loadOlder = (log: HTMLDivElement): void => {
    if (!hasNextPage || fetchingOlder || requestingOlder.current) return;
    requestingOlder.current = true;
    prependSnapshot.current = { scrollHeight: log.scrollHeight, scrollTop: log.scrollTop };
    void onOlder().then(
      () => { requestingOlder.current = false; },
      () => {
        requestingOlder.current = false;
        prependSnapshot.current = null;
      },
    );
  };

  const handleHistoryScroll = (event: UIEvent<HTMLDivElement>): void => {
    const log = event.currentTarget;
    followingLatest.current = log.scrollHeight - log.scrollTop - log.clientHeight <= 48;
    if (followingLatest.current) markLatestRead();
    if (log.scrollTop <= 48) loadOlder(log);
  };

  const submit = (event: SyntheticEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || posting || disabledReason) return;
    onPost(content, replyTarget?.id, () => { onDraft(''); onReplyTarget(null); });
  };

  // Your own words in your colour; in the clan's room, in the allies' colour.
  const selfSurface = tone !== 'clan'
    ? 'border-v2-self/35 bg-v2-self/10'
    : 'border-v2-ally/40 bg-v2-ally/10';
  const selfInk = tone !== 'clan' ? 'text-v2-self' : 'text-v2-ally';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={history}
        className="relative min-h-0 flex-1 overflow-y-auto px-3 pb-3"
        role="log"
        aria-label={listLabel}
        aria-live="polite"
        aria-busy={fetchingOlder}
        onScroll={handleHistoryScroll}
      >
        {fetchingOlder ? (
          <div className="pointer-events-none absolute inset-x-0 top-2 z-10 text-center text-micro text-v2-ink-3" role="status">
            {loadingOlder}
          </div>
        ) : null}
        {messages.length === 0 ? (
          <div className="py-6"><EmptyState title={empty} /></div>
        ) : (
          <ol className={`flex flex-col gap-2.5 mt-2.5 pt-2.5 ${actionMessageId ? 'pb-3' : 'pb-3'}`}>
            {messages.map((message) => (
              <li key={message.id} data-chat-row={message.id} className={`relative flex items-start ${message.self ? 'justify-end' : ''} ${actionMessageId === message.id ? 'z-20' : ''}`}>
                <div className="relative min-w-0 max-w-[84%]">
                  <div
                    data-chat-message={message.id}
                    tabIndex={0}
                    aria-label={t('chat.messageActions', { name: message.username })}
                    onPointerDown={(event) => {
                      if ((event.target as HTMLElement).closest('button') || disabledReason) return;
                      clearHold();
                      holdTimer.current = setTimeout(() => { openActions(message.id); haptic('tap'); }, 450);
                    }}
                    onPointerUp={clearHold}
                    onPointerCancel={clearHold}
                    onPointerLeave={clearHold}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      if (!disabledReason) openActions(message.id);
                    }}
                    onKeyDown={(event) => {
                      if (event.target !== event.currentTarget) return;
                      if ((event.key === 'Enter' || (event.shiftKey && event.key === 'F10')) && !disabledReason) {
                        event.preventDefault(); openActions(message.id);
                      }
                    }}
                    /*
                      THE ADMIN IS RINGED IN GOLD — QUIETLY. Owner instruction, twice: the
                      same hairline every message has, tinted at 35%, and the name at full
                      strength. It wins over both ordinary surfaces, self included.
                    */
                    className={`min-w-0 rounded-control border px-2.5 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-v2-self ${message.self ? 'rounded-tr-cell' : 'rounded-tl-cell'} ${
                      message.admin === true
                        ? 'border-v2-premium/35 bg-v2-deep'
                        : message.self ? selfSurface : 'border-v2-line bg-v2-deep'
                    }`}
                  >
                    <div className="flex items-baseline gap-2">
                      {message.self ? (
                        <strong data-chat-author className={`min-w-0 truncate text-caption font-semibold ${message.admin === true ? 'text-v2-premium' : selfInk}`}>{commanderLabel(message.username, message.clanTag)}</strong>
                      ) : message.planetId !== undefined ? (
                        <button
                          type="button"
                          onClick={() => {
                            const planetId = message.planetId;
                            if (planetId === undefined) return;
                            haptic('tap');
                            onFocusPlanet(planetId);
                          }}
                          data-chat-author
                          className={`min-w-0 truncate text-caption font-semibold underline decoration-v2-ink-3/50 underline-offset-2 ${
                            message.admin === true ? 'text-v2-premium' : 'text-v2-ink'
                          }`}
                        >
                          {commanderLabel(message.username, message.clanTag)}
                        </button>
                      ) : (
                        <span data-chat-author className={`min-w-0 truncate text-caption font-semibold ${message.admin === true ? 'text-v2-premium' : 'text-v2-ink'}`}>{commanderLabel(message.username, message.clanTag)}</span>
                      )}
                      <time className="ml-auto shrink-0 font-v2-mono text-micro text-v2-ink-3" dateTime={message.createdAt.toISOString()}>
                        {chatRelativeTime(message.createdAt, now, t)}
                      </time>
                    </div>
                    {message.replyTo ? (
                      <div className="mt-1 max-w-full rounded-control border-l-2 border-v2-self bg-v2-raise px-2 py-1 text-micro" data-chat-reply={message.replyTo.id}>
                        <span className="block font-semibold text-v2-self">{message.replyTo.username}</span>
                        <span className="block truncate text-v2-ink-3">{message.replyTo.content}</span>
                      </div>
                    ) : null}
                    <p className="mt-0.5 whitespace-pre-wrap break-words text-caption leading-snug text-v2-ink-2">
                      {message.content}
                    </p>
                  </div>
                  {message.reactions?.length ? (
                    <div className="relative z-10 -mt-1 ml-2 flex flex-wrap gap-1" aria-label={t('chat.reactions')}>
                      {message.reactions.map((item) => (
                        <button key={item.emoji} type="button" disabled={disabledReason !== null || reaction.isPending}
                          aria-label={t('chat.reactionCount', { emoji: item.emoji, count: item.count })}
                          aria-pressed={item.mine}
                          className={`relative min-h-7 rounded-pill border bg-v2-deep px-2 py-0.5 text-micro leading-none shadow-sm after:absolute after:inset-x-0 after:-inset-y-1.5 ${item.mine ? 'border-v2-self text-v2-self' : 'border-v2-line-hi text-v2-ink-2'}`}
                          onClick={() => { reaction.mutate({ channel: tone, messageId: message.id, emoji: item.mine ? null : item.emoji }); }}
                        >{item.emoji} {item.count}</button>
                      ))}
                    </div>
                  ) : null}
                  {actionMessageId === message.id && !disabledReason ? (
                    <div data-chat-message-actions className={`absolute ${message.self ? 'right-0' : 'left-0'} z-20 mt-1 flex w-full min-w-24 items-center justify-between rounded-pill border border-v2-line-hi bg-v2-raise/95 p-0.5 shadow-lg ${message.reactions?.length ? 'top-1/2' : 'top-1/2'} !py-0`}>
                      <button type="button" aria-label={t('chat.addReaction')} className="grid size-7 place-items-center rounded-full text-figure text-v2-ink-2 hover:bg-v2-line/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-v2-self"
                        onClick={(event) => {
                          const log = history.current;
                          const row = event.currentTarget.closest('[data-chat-row]');
                          if (log && row) setPickerBelow(row.getBoundingClientRect().top - log.getBoundingClientRect().top < 72);
                          setPickerMessageId(pickerMessageId === message.id ? null : message.id);
                        }}
                      >☺</button>
                      <button type="button" aria-label={t('chat.reply')} className="grid size-7 place-items-center rounded-full text-figure text-v2-ink-2 hover:bg-v2-line/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-v2-self !py-0"
                        onClick={() => { onReplyTarget(message); setActionMessageId(null); setPickerMessageId(null); composer.current?.focus(); }}
                      >↩</button>
                    </div>
                  ) : null}
                  {pickerMessageId === message.id && !disabledReason ? (
                    <div data-chat-reaction-picker className={`absolute ${message.self ? 'right-0' : 'left-0'} z-30 grid w-max grid-cols-6 gap-0.5 rounded-pill border border-v2-line-hi bg-v2-raise p-1 shadow-xl ${pickerBelow ? 'bottom-1/2 mt-14' : 'bottom-1/2'}`} role="group" aria-label={t('chat.chooseReaction')}>
                      {REACTION_EMOJIS.map((emoji) => (
                        <button key={emoji} type="button" aria-label={t('chat.reactWith', { emoji })}
                          disabled={reaction.isPending} className="grid size-7 place-items-center rounded-full text-caption hover:bg-v2-line/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-v2-self"
                          onClick={() => { reaction.mutate({ channel: tone, messageId: message.id, emoji }); setPickerMessageId(null); setActionMessageId(null); }}
                        >{emoji}</button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      <form onSubmit={submit} className="shrink-0 border-t border-v2-line px-3 py-2">
        {disabledReason ? <p role="status" className="mb-2 text-micro text-v2-warn">{disabledReason}</p> : null}
        {replyTarget ? (
          <div className="mb-2 flex min-w-0 items-start gap-2 rounded-control border-l-2 border-v2-self bg-v2-raise px-2 py-1" data-chat-composer-reply={replyTarget.id}>
            <div className="min-w-0 flex-1 text-micro">
              <span className="block font-semibold text-v2-self">{t('chat.replyingTo', { name: replyTarget.username })}</span>
              <span className="block truncate text-v2-ink-2">{replyTarget.content}</span>
            </div>
            <button type="button" aria-label={t('chat.cancelReply')} onClick={() => { onReplyTarget(null); }}><CloseIcon className="size-4" /></button>
          </div>
        ) : null}
        <div className="flex items-center gap-2">
          <label className="min-w-0 flex-1">
            <span className="sr-only">{placeholder}</span>
            <textarea
              ref={composer}
              value={draft}
              disabled={disabledReason !== null}
              rows={1}
              placeholder={placeholder}
              onChange={(event) => {
                onDraft(Array.from(event.currentTarget.value).slice(0, maxChars).join(''));
              }}
              className="block h-10 w-full resize-none rounded-pill border border-v2-line-hi bg-v2-deep px-4 py-2.5 text-caption text-v2-ink placeholder:text-v2-ink-3 outline-none focus:border-v2-self"
            />
          </label>
          <button
            type="submit"
            aria-label={t('chat.send')}
            disabled={!draft.trim() || posting || disabledReason !== null}
            onClick={() => { haptic('tap'); }}
            className="grid size-10 shrink-0 place-items-center rounded-full bg-v2-self text-v2-self-ink disabled:bg-v2-raise disabled:text-v2-ink-3"
          >
            <SendIcon className="size-4" />
          </button>
        </div>
        {postError || reaction.error || maxChars - Array.from(draft).length <= 30 ? (
          <div className="mt-1 flex justify-between gap-2 text-micro">
            <span className="text-v2-warn">{postError || reaction.error ? describeError(postError ?? reaction.error) : ''}</span>
            {maxChars - Array.from(draft).length <= 30 ? (
              <span className="ml-auto text-v2-ink-3">{t('chat.remaining', { count: maxChars - Array.from(draft).length })}</span>
            ) : null}
          </div>
        ) : null}
      </form>
    </div>
  );
}
