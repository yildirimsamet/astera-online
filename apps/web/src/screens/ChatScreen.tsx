import { useEffect, useMemo, useRef, useState, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useChatMessages, useMarkChatRead, usePostChat } from '../api/queries.js';
import { chatRelativeTime } from '../lib/chatTime.js';
import { describeError } from '../i18n/errors.js';
import { haptic } from '../lib/haptics.js';
import { useNow } from '../lib/time.js';
import { Button, EmptyState } from '../ui/kit/index.js';
import { SendIcon } from '../ui/icons/index.js';
import { Unreachable, Waiting } from '../ui/kit/index.js';

export function ChatScreen({ onFocusPlanet }: { onFocusPlanet: (planetId: string) => void }) {
  const { t } = useTranslation();
  const chat = useChatMessages();
  const post = usePostChat();
  const markRead = useMarkChatRead();
  const [draft, setDraft] = useState('');
  const now = useNow(30_000);
  const bottom = useRef<HTMLDivElement>(null);
  const marked = useRef<string | null>(null);
  const messages = useMemo(
    () => [...(chat.data?.pages ?? [])].reverse().flatMap((page) => page.messages),
    [chat.data?.pages],
  );
  const latestId = messages.at(-1)?.id;

  useEffect(() => {
    if (!latestId || marked.current === latestId) return;
    marked.current = latestId;
    markRead.mutate(latestId);
  }, [latestId, markRead]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [latestId]);

  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || post.isPending) return;
    post.mutate(content, {
      onSuccess: () => {
        setDraft('');
      },
    });
  };

  if (chat.isError) {
    return <Unreachable what={t('surface.whatChat')} onRetry={() => { void chat.refetch(); }} />;
  }
  if (!chat.data) return <Waiting>{t('surface.waitingChat')}</Waiting>;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3" role="log" aria-label={t('chat.list')} aria-live="polite">
        {chat.hasNextPage && (
          <div className="py-3 text-center">
            <Button
              size="sm"
              variant="ghost"
              disabled={chat.isFetchingNextPage}
              onClick={() => { void chat.fetchNextPage(); }}
            >
              {chat.isFetchingNextPage ? t('chat.loadingOlder') : t('chat.older')}
            </Button>
          </div>
        )}
        {messages.length === 0 ? (
          <div className="py-6"><EmptyState title={t('chat.empty')} /></div>
        ) : (
          <ol className="space-y-2 py-3">
            {messages.map((message) => (
              <li
                key={message.id}
                className={`max-w-[88%] rounded-control border px-3 py-2 ${
                  message.self
                    ? 'ml-auto border-crystal/25 bg-crystal/8'
                    : 'mr-auto border-line-soft bg-deep'
                }`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  {message.self ? (
                    <strong className="name truncate text-crystal">
                      {message.username}
                    </strong>
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
        <div ref={bottom} />
      </div>

      <form onSubmit={submit} className="shrink-0 border-t border-line-soft bg-void/80 px-4 pb-3 pt-3">
        <div className="flex items-center gap-2">
          <label className="min-w-0 flex-1">
            <span className="sr-only">{t('chat.placeholder')}</span>
            <textarea
              value={draft}
              rows={1}
              placeholder={t('chat.placeholder')}
              onChange={(event) => { setDraft(Array.from(event.target.value).slice(0, 280).join('')); }}
              className="field block min-h-11 resize-none py-3 text-body"
            />
          </label>
          <Button
            type="submit"
            size="md"
            variant="primary"
            disabled={!draft.trim() || post.isPending}
            icon={<SendIcon className="size-4" />}
            className="flex"
          >
            {t('chat.send')}
          </Button>
        </div>
        <div className={`mt-1 flex min-h-4 justify-between gap-3 text-micro ${post.isError ? '' : 'hidden'}`}>
          <span className="text-threat">{post.isError ? describeError(post.error) : ''}</span>
          <span className="ml-auto text-faint">{t('chat.remaining', { count: 280 - Array.from(draft).length })}</span>
        </div>
      </form>
    </div>
  );
}
