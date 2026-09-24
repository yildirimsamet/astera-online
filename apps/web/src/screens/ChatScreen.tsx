import { CHAT, CLAN } from '@astera/rules';
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
} from '../api/queries.js';
import { describeError } from '../i18n/errors.js';
import { currentLanguage } from '../i18n/index.js';
import { isLanguage, LANGUAGES, LANGUAGE_LABEL, type Language } from '../i18n/languages.js';
import { chatRelativeTime } from '../lib/chatTime.js';
import { commanderLabel } from '../lib/identity.js';
import { haptic } from '../lib/haptics.js';
import { useNow } from '../lib/time.js';
import { ClanIcon, SendIcon } from '../ui/icons/index.js';
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
}

/** Which room: the galaxy's general channel or the commander's clan. */
export type ChatChannel = 'general' | 'clan';

export function ChatScreen({
  onFocusPlanet,
  initialChannel = 'general',
}: {
  onFocusPlanet: (planetId: string) => void;
  initialChannel?: ChatChannel;
}) {
  const { t } = useTranslation();
  const [channel, setChannel] = useState<ChatChannel>(initialChannel);
  const [chatLanguage, setChatLanguage] = useState<Language>(() => currentLanguage());
  const [generalDrafts, setGeneralDrafts] = useState<Partial<Record<Language, string>>>({});
  const [clanDraft, setClanDraft] = useState('');
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
                if (isLanguage(next)) setChatLanguage(next);
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
              onPost={(content, done) => { postGeneral.mutate(content, { onSuccess: done }); }}
              maxChars={CHAT.maxChars}
              tone="general"
            />
          )
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
            onDraft={setClanDraft}
            onFocusPlanet={onFocusPlanet}
            hasNextPage={clan.hasNextPage}
            fetchingOlder={clan.isFetchingNextPage}
            onOlder={() => clan.fetchNextPage()}
            onMarkRead={(id) => { clanActions.readChat.mutate(id); }}
            posting={clanActions.postChat.isPending}
            postError={clanActions.postChat.isError ? clanActions.postChat.error : null}
            onPost={(content, done) => { clanActions.postChat.mutate(content, { onSuccess: done }); }}
            maxChars={CLAN.chatMaxChars}
            tone="clan"
          />
        )}
      </div>
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
}: {
  messages: readonly MessageRow[];
  listLabel: string;
  empty: string;
  loadingOlder: string;
  placeholder: string;
  draft: string;
  onDraft: (draft: string) => void;
  onFocusPlanet: (planetId: string) => void;
  hasNextPage: boolean;
  fetchingOlder: boolean;
  onOlder: () => Promise<unknown>;
  onMarkRead: (messageId: string) => void;
  posting: boolean;
  postError: unknown;
  onPost: (content: string, done: () => void) => void;
  /** Each channel's own server ceiling. The two are separate rules, not one. */
  maxChars: number;
  tone: 'general' | 'clan';
}) {
  const { t } = useTranslation();
  const now = useNow(30_000);
  const history = useRef<HTMLDivElement>(null);
  const marked = useRef<string | null>(null);
  const followingLatest = useRef(true);
  const requestingOlder = useRef(false);
  const prependSnapshot = useRef<{ scrollHeight: number; scrollTop: number } | null>(null);
  const previousLatestId = useRef<string | undefined>(undefined);
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
    if (!content || posting) return;
    onPost(content, () => { onDraft(''); });
  };

  // Your own words in your colour; in the clan's room, in the allies' colour.
  const selfSurface = tone === 'general'
    ? 'border-v2-self/35 bg-v2-self/10'
    : 'border-v2-ally/40 bg-v2-ally/10';
  const selfInk = tone === 'general' ? 'text-v2-self' : 'text-v2-ally';

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
          <ol className="flex flex-col gap-2.5 py-3">
            {messages.map((message) => (
              <li key={message.id} className={`flex items-start gap-2 ${message.self ? 'justify-end' : ''}`}>
                {!message.self && (
                  <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-control border border-v2-line-hi bg-v2-raise font-v2-mono text-micro font-bold text-v2-ink-2">
                    {initials(message.username)}
                  </span>
                )}
                <div
                  data-chat-message={message.id}
                  /*
                    THE ADMIN IS RINGED IN GOLD — QUIETLY. Owner instruction, twice: the
                    same hairline every message has, tinted at 35%, and the name at full
                    strength. It wins over both ordinary surfaces, self included.
                  */
                  className={`min-w-0 max-w-[84%] rounded-control border px-2.5 py-1.5 ${message.self ? 'rounded-tr-cell' : 'rounded-tl-cell'} ${
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
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-caption leading-snug text-v2-ink-2">
                    {message.content}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      <form onSubmit={submit} className="shrink-0 border-t border-v2-line px-3 pb-2 pt-2">
        <div className="flex items-center gap-2">
          <label className="min-w-0 flex-1">
            <span className="sr-only">{placeholder}</span>
            <textarea
              value={draft}
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
            disabled={!draft.trim() || posting}
            onClick={() => { haptic('tap'); }}
            className="grid size-10 shrink-0 place-items-center rounded-full bg-v2-self text-v2-self-ink disabled:bg-v2-raise disabled:text-v2-ink-3"
          >
            <SendIcon className="size-4" />
          </button>
        </div>
        <div className="mt-1 flex min-h-4 justify-between gap-2 text-micro">
          <span className="text-v2-warn">{postError ? describeError(postError) : ''}</span>
          <span className="ml-auto text-v2-ink-3">
            {t('chat.remaining', { count: maxChars - Array.from(draft).length })}
          </span>
        </div>
      </form>
    </div>
  );
}

/** Two letters for a commander's badge beside their words. */
const initials = (name: string): string => Array.from(name.trim()).slice(0, 2).join('').toLocaleUpperCase();
