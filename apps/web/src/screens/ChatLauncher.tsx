import { useTranslation } from 'react-i18next';
import { useChatUnread } from '../api/queries.js';
import { haptic } from '../lib/haptics.js';
import { ChatIcon } from '../ui/icons/index.js';

/**
 * Chat belongs to the disc, not to the commander menu.
 *
 * The control stays inside the Galaxy viewport so conversation is one tap away
 * while the world remains visible. It owns the unread signal too: chat activity
 * must not turn the account menu into an unrelated notification surface.
 */
export function ChatLauncher({ onOpen }: { onOpen: () => void }) {
  const { t } = useTranslation();
  const unread = useChatUnread().data?.count ?? 0;
  const label =
    unread > 0 ? t('chat.launcherUnread', { count: unread }) : t('chat.launcher');

  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => {
        haptic('tap');
        onOpen();
      }}
      className="pointer-events-auto absolute bottom-3 right-3 z-20 grid size-11 place-items-center rounded-md border border-line bg-deep/95 text-dim shadow-[0_10px_30px_rgba(0,0,0,0.4)] transition-colors hover:border-crystal/60 hover:text-bone active:scale-95"
    >
      <ChatIcon className="size-5" />
      {unread > 0 && (
        <span
          className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border border-deep bg-threat shadow-[0_0_6px_var(--color-threat)]"
          aria-hidden="true"
        />
      )}
    </button>
  );
}
