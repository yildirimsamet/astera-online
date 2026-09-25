import { useTranslation } from 'react-i18next';
import { useChatUnread, useClanBadge } from '../../api/queries.js';
import { ChatScreen, type ChatChannel } from '../../screens/ChatScreen.js';
import { Sheet } from '../kit/Sheet.js';

/**
 * CHAT, A PAGE OF ITS OWN. Owner, 2026-09-24: "Signals ve Chronicle kalsın, chat'i
 * kaldır" — chat left the bell for its round button on the galaxy, low on the right
 * where a thumb reaches it. People chat live, and it is what keeps them coming back.
 *
 * A full page whose log owns its scrolling. It opens on the channel with something
 * unread, as the old launcher did; a world named in a message flies the camera there
 * after the page closes, so the move is seen.
 */
export function ChatHost({ onClose, onFocusPlanet, channel, draft }: {
  onClose: () => void;
  onFocusPlanet: (planetId: string) => void;
  /** The room it was asked to open on (the war room's "Clan chat", E9); unread decides otherwise. */
  channel?: ChatChannel;
  /** A clan line to start the composer with (a report told to the clan, M4). */
  draft?: string;
}) {
  const { t } = useTranslation();
  const generalUnread = useChatUnread().data?.count ?? 0;
  const clanUnread = useClanBadge().data?.clanChatUnread ?? 0;

  return (
    <Sheet title={t('bell.chat')} onClose={onClose} detents={['full']} contained>
      <div className="min-h-0 flex-1">
        <ChatScreen
          initialChannel={channel ?? (generalUnread === 0 && clanUnread > 0 ? 'clan' : 'general')}
          {...(draft ? { initialClanDraft: draft } : {})}
          onFocusPlanet={(planetId) => {
            onClose();
            onFocusPlanet(planetId);
          }}
        />
      </div>
    </Sheet>
  );
}
