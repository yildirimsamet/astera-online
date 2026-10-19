import { BlockedPlayersSheet } from '../../screens/CommunityBlocks.js';
import { useEffect, useState } from 'react';
import { addChatMute, readChatMutes, writeChatMutes, type ChatMuteAuthor } from '../../lib/chatMutes.js';
import { MuteIcon } from '../../ui/icons/index.js';
import { useTranslation } from 'react-i18next';
import { useChatUnread, useClanBadge, useDmUnread } from '../../api/queries.js';
import { ChatScreen, type ChatChannel } from '../../screens/ChatScreen.js';
import { Sheet } from '../kit/Sheet.js';

/**
 * CHAT, A PAGE OF ITS OWN. Owner, 2026-09-24: "Signals ve Chronicle kalsın, chat'i
 * kaldır" — chat left the bell for its round button on the galaxy, low on the right
 * where a thumb reaches it. People chat live, and it is what keeps them coming back.
 *
 * A fixed-height panel whose log owns its scrolling. It opens on the channel with something
 * unread, as the old launcher did; a world named in a message flies the camera there
 * after the page closes, so the move is seen.
 */
interface ChatHostProps {
  accountId?: string;
  onClose: () => void;
  onFocusPlanet: (planetId: string) => void;
  /** The room it was asked to open on; unread decides otherwise. */
  channel?: ChatChannel;
  draft?: string;
  isAdmin?: boolean;
}

export function ChatHost(props: ChatHostProps) {
  // Switching accounts gets a fresh preference scope, including when the host stays mounted.
  return <PersonalChatHost key={props.accountId ?? 'anonymous'} {...props} />;
}

function PersonalChatHost({ accountId, onClose, onFocusPlanet, channel, draft, isAdmin = false }: ChatHostProps) {
  const { t } = useTranslation();
  const [mutedPlayers, setMutedPlayers] = useState(() => readChatMutes(accountId));
  const [showMuted, setShowMuted] = useState(false);
  const [showBlocked, setShowBlocked] = useState(false);
  useEffect(() => { writeChatMutes(accountId, mutedPlayers); }, [accountId, mutedPlayers]);
  const mute = (author: ChatMuteAuthor): void => { setMutedPlayers(current => addChatMute(current, author)); };
  const generalUnread = useChatUnread().data?.count ?? 0;
  const clanUnread = useClanBadge().data?.clanChatUnread ?? 0;
  const dmUnread = useDmUnread().data?.count ?? 0;

  return (
    <>
      <Sheet title={t('bell.chat')} titleAction={(<>
        <button type="button" aria-label={t('chat.personalMutes.title')} aria-haspopup="dialog"
          className="relative grid size-8 shrink-0 place-items-center rounded-control border border-v2-line text-v2-ink-2 hover:border-v2-self/50 hover:text-v2-self focus-visible:outline focus-visible:outline-2 focus-visible:outline-v2-self"
          onClick={() => { setShowMuted(true); }}>
          <MuteIcon className="size-4" />
          {mutedPlayers.length > 0 && <span aria-hidden className="absolute -top-1 -right-1 min-w-3.5 rounded-pill bg-v2-self px-0.5 font-v2-mono text-micro text-v2-self-ink">{mutedPlayers.length}</span>}
        </button>
        <button type="button" aria-label={t('moderation.blocks.title')} aria-haspopup="dialog" className="grid size-8 shrink-0 place-items-center rounded-control border border-v2-line text-v2-ink-2 hover:border-v2-self/50 hover:text-v2-self focus-visible:outline focus-visible:outline-2 focus-visible:outline-v2-self" onClick={() => { setShowBlocked(true); }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="size-4" aria-hidden="true"><path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3ZM8 12h8" /></svg>
        </button>
      </>)} onClose={onClose} detents={['full']} contained fixedHeight>
        <div className="min-h-0 flex-1">
          <ChatScreen
            isAdmin={isAdmin}
            mutedPlayers={mutedPlayers}
            onMute={mute}
            initialChannel={channel ?? (dmUnread > 0 ? 'dm' : generalUnread === 0 && clanUnread > 0 ? 'clan' : 'general')}
            {...(draft ? { initialClanDraft: draft } : {})}
            onFocusPlanet={(planetId) => {
              onClose();
              onFocusPlanet(planetId);
            }}
          />
        </div>
      </Sheet>
      {showBlocked ? <BlockedPlayersSheet onClose={() => { setShowBlocked(false); }} /> : null}
      {showMuted && <Sheet title={t('chat.personalMutes.title')} detents={['fit']} onClose={() => { setShowMuted(false); }}>
        <p className="mb-3 text-caption leading-relaxed text-v2-ink-2">{t('chat.personalMutes.hint')}</p>
        {mutedPlayers.length === 0 ? <p className="py-4 text-center text-caption text-v2-ink-2">{t('chat.personalMutes.empty')}</p> : (
          <ul className="grid gap-2">
            {mutedPlayers.map(player => <li key={player.playerId} className="flex min-w-0 items-center gap-3 rounded-control border border-v2-line bg-v2-deep/50 p-2.5">
              <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-control border border-v2-line-hi text-caption text-v2-ink-2">{player.username.slice(0, 2).toUpperCase()}</span>
              <span className="min-w-0 flex-1 truncate text-caption font-semibold text-v2-ink">{player.username}</span>
              <button type="button" aria-label={t('chat.personalMutes.unmute', { name: player.username })}
                className="min-h-9 shrink-0 rounded-control border border-v2-self/40 px-2 text-caption font-semibold text-v2-self hover:bg-v2-self/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-v2-self"
                onClick={() => { setMutedPlayers(current => current.filter(muted => muted.playerId !== player.playerId)); }}>
                {t('chat.personalMutes.unmuteShort')}
              </button>
            </li>)}
          </ul>
        )}
      </Sheet>}
    </>
  );
}
