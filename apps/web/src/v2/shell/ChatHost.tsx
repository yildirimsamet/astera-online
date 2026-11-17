import { BlockedPlayersSheet, PersonRow } from '../../screens/CommunityBlocks.js';
import { useEffect, useRef, useState } from 'react';
import { addChatMute, readChatMutes, writeChatMutes, type ChatMuteAuthor } from '../../lib/chatMutes.js';
import { EmptyState, GameButton, RoundButton, artIconSrc } from '../../game-ui/index.js';
import { useTranslation } from 'react-i18next';
import { useChatUnread, useClanBadge, useDmUnread } from '../../api/queries.js';
import { ChatScreen, type ChatChannel } from '../../screens/ChatScreen.js';
import { Sheet } from '../kit/Sheet.js';

/** A phone keyboard is far taller than this; browser bars and typing never grow the page by it. */
const KEYBOARD_CLOSED_PX = 150;
/**
 * How long the page must stay taller before the keyboard counts as gone. As the keyboard rises,
 * the app shell (system bars hidden, resized for the keyboard) can lay the window out at full
 * height for a moment; blurring then closed the keyboard it mistook for gone (owner 2026-11-17).
 */
const KEYBOARD_SETTLE_MS = 300;

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
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const viewport = window.visualViewport;
    const measure = (): number => viewport?.height ?? window.innerHeight;
    let previous = measure();
    // The height with the keyboard up, held while a taller page waits to settle.
    let keyboardUp: number | null = null;
    let settle: ReturnType<typeof setTimeout> | undefined;
    const composing = (): HTMLTextAreaElement | null => {
      const field = document.activeElement;
      return field instanceof HTMLTextAreaElement && host.current?.contains(field) ? field : null;
    };
    // iOS pans the visual viewport; Android may resize the layout viewport instead.
    const sync = (): void => {
      const height = measure();
      host.current?.style.setProperty('--chat-viewport-height', `${String(height)}px`);
      host.current?.style.setProperty('--chat-viewport-top', `${String(viewport?.offsetTop ?? 0)}px`);
      // Android's keyboard-hide key keeps the composer focused; the compose layout follows focus.
      if (height - previous > KEYBOARD_CLOSED_PX && composing()) keyboardUp ??= previous;
      previous = height;
      if (keyboardUp === null) return;
      // Every further change restarts the wait: only a page that STAYS taller lets go.
      clearTimeout(settle);
      settle = setTimeout(() => {
        if (keyboardUp !== null && measure() - keyboardUp > KEYBOARD_CLOSED_PX) composing()?.blur();
        keyboardUp = null;
      }, KEYBOARD_SETTLE_MS);
    };
    sync();
    viewport?.addEventListener('resize', sync);
    viewport?.addEventListener('scroll', sync);
    window.addEventListener('resize', sync);
    return () => {
      clearTimeout(settle);
      viewport?.removeEventListener('resize', sync);
      viewport?.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
    };
  }, []);
  useEffect(() => { writeChatMutes(accountId, mutedPlayers); }, [accountId, mutedPlayers]);
  const mute = (author: ChatMuteAuthor): void => { setMutedPlayers(current => addChatMute(current, author)); };
  const generalUnread = useChatUnread().data?.count ?? 0;
  const clanUnread = useClanBadge().data?.clanChatUnread ?? 0;
  const dmUnread = useDmUnread().data?.count ?? 0;

  return (
    <>
      <div ref={host} data-chat-host>
      <Sheet title={t('bell.chat')} kit={{ art: artIconSrc('hud-chat') }} titleAction={(<>
        <RoundButton small glyph="mute" label={t('chat.personalMutes.title')} onPress={() => { setShowMuted(true); }} />
        <RoundButton small glyph="block" label={t('moderation.blocks.title')} onPress={() => { setShowBlocked(true); }} />
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
      </div>
      {showBlocked ? <BlockedPlayersSheet onClose={() => { setShowBlocked(false); }} /> : null}
      {/* THE MUTED LIST (C4): each commander a row with their own key; an empty list says how to add one. */}
      {showMuted && <Sheet title={t('chat.personalMutes.title')} kit={{ art: artIconSrc('hud-chat') }} detents={['fit']} onClose={() => { setShowMuted(false); }}>
        <div className="gk grid gap-3 pb-3">
          <p className="gk-copy">{t('chat.personalMutes.hint')}</p>
          {mutedPlayers.length === 0 ? (
            <EmptyState art={artIconSrc('hud-chat')} title={t('chat.personalMutes.empty')} body={t('chat.personalMutes.emptyHint')} />
          ) : (
            <ul className="grid gap-1.5">
              {mutedPlayers.map(player => (
                <PersonRow key={player.playerId} name={player.username} action={(
                  <GameButton size="sm" spoken={t('chat.personalMutes.unmute', { name: player.username })}
                    onPress={() => { setMutedPlayers(current => current.filter(muted => muted.playerId !== player.playerId)); }}>
                    {t('chat.personalMutes.unmuteShort')}
                  </GameButton>
                )} />
              ))}
            </ul>
          )}
        </div>
      </Sheet>}
    </>
  );
}
