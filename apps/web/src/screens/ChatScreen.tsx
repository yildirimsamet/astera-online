import { CHAT, CLAN } from '@astera/rules';
import { useEffect, useMemo, useRef, useState, type ReactNode, type SyntheticEvent } from 'react';
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
import { chatRelativeTime } from '../lib/chatTime.js';
import { haptic } from '../lib/haptics.js';
import { useNow } from '../lib/time.js';
import { ClanIcon, SendIcon } from '../ui/icons/index.js';
import { Button, EmptyState, Segmented, Unreachable, Waiting } from '../ui/kit/index.js';
import type { ChatChannel } from './ChatLauncher.js';

interface MessageRow {
  id: string;
  authorPlayerId: string;
  planetId: string;
  username: string;
  content: string;
  createdAt: Date;
  self: boolean;
}

export function ChatScreen({
  onFocusPlanet,
  initialChannel = 'general',
}: {
  onFocusPlanet: (planetId: string) => void;
  initialChannel?: ChatChannel;
}) {
  const { t } = useTranslation();
  const [channel, setChannel] = useState<ChatChannel>(initialChannel);
  const [generalDraft, setGeneralDraft] = useState('');
  const [clanDraft, setClanDraft] = useState('');
  const badge = useClanBadge();
  const inClan = badge.data?.membership !== null && badge.data?.membership !== undefined;
  const general = useChatMessages();
  const generalUnreadQuery = useChatUnread();
  const clan = useClanChat(inClan);
  const postGeneral = usePostChat();
  const markGeneral = useMarkChatRead();
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
      label: <ChannelLabel tone="general" unread={generalUnread}>{t('chat.general')}</ChannelLabel>,
      hint: generalUnread > 0
        ? t('chat.channelUnread', { channel: t('chat.general'), count: generalUnread })
        : t('chat.general'),
    },
    {
      id: 'clan' as const,
      label: <ChannelLabel tone="clan" unread={clanUnread}>{t('chat.clan')}</ChannelLabel>,
      hint: clanUnread > 0
        ? t('chat.channelUnread', { channel: t('chat.clan'), count: clanUnread })
        : t('chat.clan'),
    },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-line-soft bg-void px-3 py-2">
        <Segmented
          segments={tabs}
          value={channel}
          onSelect={setChannel}
          label={t('chat.channelsLabel')}
          role="tablist"
          size="sm"
          panelId={(id) => `chat-panel-${id}`}
          tabId={(id) => `chat-tab-${id}`}
        />
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
              key="general"
              messages={generalMessages}
              listLabel={t('chat.list')}
              empty={t('chat.empty')}
              older={t('chat.older')}
              loadingOlder={t('chat.loadingOlder')}
              placeholder={t('chat.placeholder')}
              draft={generalDraft}
              onDraft={setGeneralDraft}
              onFocusPlanet={onFocusPlanet}
              hasNextPage={general.hasNextPage}
              fetchingOlder={general.isFetchingNextPage}
              onOlder={() => { void general.fetchNextPage(); }}
              onMarkRead={(id) => { markGeneral.mutate(id); }}
              posting={postGeneral.isPending}
              postError={postGeneral.isError ? postGeneral.error : null}
              onPost={(content, done) => { postGeneral.mutate(content, { onSuccess: done }); }}
              maxChars={CHAT.maxChars}
              tone="general"
            />
          )
        ) : !inClan ? (
          <div className="px-4 py-6">
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
            older={t('clan.chat.older')}
            loadingOlder={t('clan.chat.loadingOlder')}
            placeholder={t('clan.chat.placeholder')}
            draft={clanDraft}
            onDraft={setClanDraft}
            onFocusPlanet={onFocusPlanet}
            hasNextPage={clan.hasNextPage}
            fetchingOlder={clan.isFetchingNextPage}
            onOlder={() => { void clan.fetchNextPage(); }}
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

function ChannelLabel({
  children,
  unread,
  tone,
}: {
  children: ReactNode;
  unread: number;
  tone: 'general' | 'clan';
}) {
  return (
    <span className="inline-flex items-center justify-center gap-1.5">
      <span>{children}</span>
      {unread > 0 ? (
        <span
          className={`size-2 rounded-full ${tone === 'general' ? 'bg-threat' : 'bg-opportunity'}`}
          aria-hidden="true"
        />
      ) : null}
    </span>
  );
}

function ChannelPanel({
  messages,
  listLabel,
  empty,
  older,
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
  older: string;
  loadingOlder: string;
  placeholder: string;
  draft: string;
  onDraft: (draft: string) => void;
  onFocusPlanet: (planetId: string) => void;
  hasNextPage: boolean;
  fetchingOlder: boolean;
  onOlder: () => void;
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
  const latestId = messages.at(-1)?.id;

  useEffect(() => {
    if (!latestId || marked.current === latestId) return;
    marked.current = latestId;
    onMarkRead(latestId);
  }, [latestId, onMarkRead]);

  useEffect(() => {
    /**
     * Scroll the ONE box that owns the messages. `scrollIntoView()` also walks
     * outward toward the page viewport; on iOS that can preserve the visual
     * viewport pan Safari applied while the keyboard and composer were focused.
     */
    const log = history.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [latestId]);

  const submit = (event: SyntheticEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || posting) return;
    onPost(content, () => { onDraft(''); });
  };

  const selfSurface = tone === 'general'
    ? 'border-crystal/25 bg-crystal/8'
    : 'border-opportunity/30 bg-opportunity/8';
  const selfInk = tone === 'general' ? 'text-crystal' : 'text-opportunity';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={history} className="min-h-0 flex-1 overflow-y-auto px-4 pb-3" role="log" aria-label={listLabel} aria-live="polite">
        {hasNextPage ? (
          <div className="py-3 text-center">
            <Button size="sm" variant="ghost" disabled={fetchingOlder} onClick={onOlder}>
              {fetchingOlder ? loadingOlder : older}
            </Button>
          </div>
        ) : null}
        {messages.length === 0 ? (
          <div className="py-6"><EmptyState title={empty} /></div>
        ) : (
          <ol className="space-y-2 py-3">
            {messages.map((message) => (
              <li
                key={message.id}
                className={`max-w-[88%] rounded-control border px-3 py-2 ${
                  message.self ? `ml-auto ${selfSurface}` : 'mr-auto border-line-soft bg-deep'
                }`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  {message.self ? (
                    <strong className={`name truncate ${selfInk}`}>{message.username}</strong>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        haptic('tap');
                        onFocusPlanet(message.planetId);
                      }}
                      className="name truncate text-bone underline decoration-bone/35 underline-offset-2"
                    >
                      {message.username}
                    </button>
                  )}
                  <time className="shrink-0 text-micro text-faint" dateTime={message.createdAt.toISOString()}>
                    {chatRelativeTime(message.createdAt, now, t)}
                  </time>
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-body leading-relaxed text-dim">
                  {message.content}
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>

      <form onSubmit={submit} className="shrink-0 border-t border-line-soft bg-void/80 px-4 pb-3 pt-3">
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
              className="field block min-h-11 resize-none py-3"
            />
          </label>
          <Button
            type="submit"
            size="md"
            variant="primary"
            disabled={!draft.trim() || posting}
            icon={<SendIcon className="size-4" />}
            className="flex"
          >
            {t('chat.send')}
          </Button>
        </div>
        <div className="mt-1 flex min-h-4 justify-between gap-3 text-micro">
          <span className="text-threat-ink">{postError ? describeError(postError) : ''}</span>
          <span className="ml-auto text-faint">
            {t('chat.remaining', { count: maxChars - Array.from(draft).length })}
          </span>
        </div>
      </form>
    </div>
  );
}
