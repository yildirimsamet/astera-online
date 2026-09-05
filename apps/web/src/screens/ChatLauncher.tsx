import { useTranslation } from 'react-i18next';
import { useChatUnread, useClanBadge } from '../api/queries.js';
import { haptic } from '../lib/haptics.js';
import { ChatIcon } from '../ui/icons/index.js';

/**
 * Chat belongs to the disc, not to the commander menu.
 *
 * The control stays inside the Galaxy viewport so conversation is one tap away
 * while the world remains visible. It owns the unread signal too: chat activity
 * must not turn the account menu into an unrelated notification surface.
 */
export type ChatChannel = 'general' | 'clan';

export function ChatLauncher({ onOpen }: { onOpen: (channel: ChatChannel) => void }) {
  const { t } = useTranslation();
  const generalUnread = useChatUnread().data?.count ?? 0;
  const clanUnread = useClanBadge().data?.clanChatUnread ?? 0;
  const label = generalUnread > 0 && clanUnread > 0
    ? t('chat.launcherBothUnread', { general: generalUnread, clan: clanUnread })
    : clanUnread > 0
      ? t('chat.launcherClanUnread', { count: clanUnread })
      : generalUnread > 0
        ? t('chat.launcherUnread', { count: generalUnread })
        : t('chat.launcher');
  const preferred: ChatChannel = generalUnread > 0 ? 'general' : clanUnread > 0 ? 'clan' : 'general';

  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => {
        haptic('tap');
        onOpen(preferred);
      }}
      className="pointer-events-auto absolute bottom-2 right-1 z-20 grid size-9 place-items-center rounded-control border border-line bg-deep/95 text-dim shadow-[0_10px_30px_rgba(0,0,0,0.4)] transition-colors hover:border-crystal/60 hover:text-bone active:scale-95"
    >
      <ChatIcon className="size-5" />
      <span className="absolute -right-1 -top-1 flex gap-1" aria-hidden="true">
        {generalUnread > 0 ? (
          <span className="size-2.5 rounded-full border border-deep bg-threat shadow-[0_0_6px_var(--color-threat)]" />
        ) : null}
        {clanUnread > 0 ? (
          <span className="size-2.5 rounded-full border border-deep bg-opportunity shadow-[0_0_6px_var(--color-opportunity)]" />
        ) : null}
      </span>
    </button>
  );
}
