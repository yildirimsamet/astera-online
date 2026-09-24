import { useTranslation } from 'react-i18next';
import { useChatUnread, useClanBadge } from '../../api/queries.js';
import { ChatScreen } from '../../screens/ChatScreen.js';
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
export function ChatHost({ onClose, onFocusPlanet }: { onClose: () => void; onFocusPlanet: (planetId: string) => void }) {
  const { t } = useTranslation();
  const generalUnread = useChatUnread().data?.count ?? 0;
  const clanUnread = useClanBadge().data?.clanChatUnread ?? 0;

  return (
    <Sheet title={t('bell.chat')} onClose={onClose} detents={['full']} contained>
      <div className="min-h-0 flex-1">
        <ChatScreen
          initialChannel={generalUnread === 0 && clanUnread > 0 ? 'clan' : 'general'}
          onFocusPlanet={(planetId) => {
            onClose();
            onFocusPlanet(planetId);
          }}
        />
      </div>
    </Sheet>
  );
}
