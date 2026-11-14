import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useApi } from '../api/context.js';
import { keys } from '../api/keys.js';
import { describeError } from '../i18n/errors.js';
import { GameButton, RoundButton } from '../game-ui/index.js';
import { useNativeBack } from '../platform/nativeBack.js';
import type { ChatChannel } from './ChatScreen.js';

export function ChatReactionRoster({ channel, messageId, anchor, onClose }: {
  channel: ChatChannel; messageId: string; anchor: HTMLButtonElement; onClose: () => void;
}) {
  const { t } = useTranslation();
  const api = useApi();
  const panel = useRef<HTMLDivElement>(null);
  useNativeBack(panel, onClose);
  const [position, setPosition] = useState({ left: 8, top: 8 });
  const prefix = channel === 'general' ? keys.chatMessages : channel === 'clan' ? keys.clanChat : keys.dmMessages;
  const details = useQuery({ queryKey: [...prefix, 'reactions', messageId], queryFn: () => api.messageReactionDetails(channel, messageId), refetchInterval: 5_000 });
  useLayoutEffect(() => {
    const rect = anchor.getBoundingClientRect();
    const width = Math.min(272, window.innerWidth - 16);
    const height = panel.current?.offsetHeight ?? 156;
    setPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
      top: Math.max(8, rect.top > height + 8 ? rect.top - height - 8 : Math.min(rect.bottom + 8, window.innerHeight - height - 8)) });
    panel.current?.focus();
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !panel.current?.contains(event.target)) onClose();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); }
      if (event.key === 'Tab') {
        event.preventDefault();
        const controls = Array.from(panel.current?.querySelectorAll<HTMLElement>('button, [tabindex="0"]') ?? []);
        const current = controls.findIndex(control => control === document.activeElement);
        const next = current < 0 ? (event.shiftKey ? controls.length - 1 : 0) : (current + (event.shiftKey ? -1 : 1) + controls.length) % controls.length;
        controls[next]?.focus();
      }
    };
    const scroll = (event: Event) => { if (event.target instanceof Node && !panel.current?.contains(event.target)) onClose(); };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', escape, true);
    window.addEventListener('resize', onClose);
    window.addEventListener('scroll', scroll, true);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('keydown', escape, true);
      window.removeEventListener('resize', onClose);
      window.removeEventListener('scroll', scroll, true);
      if (anchor.isConnected) anchor.focus({ preventScroll: true });
    };
  }, [anchor, onClose]);
  return createPortal(
    /* WHO REACTED (C3): the kit's small panel beside the chip, its close key the kit's. */
    <div ref={panel} role="dialog" aria-modal="true" aria-label={t('chat.reactions')} tabIndex={-1}
      className="gk gk-pop fixed z-[110] w-[272px] max-w-[calc(100vw-16px)] overflow-hidden outline-none"
      style={position}>
      <div className="flex items-center justify-between border-b border-v2-line pl-3">
        <span className="gk-display tracking-wide">{t('chat.reactions')}</span>
        <RoundButton small glyph="close" label={t('sheet.close')} onPress={onClose} />
      </div>
      <div data-reaction-roster style={{ height: 120, overflowY: 'auto', overscrollBehavior: 'contain' }} tabIndex={0}>
        {details.isError ? <div role="alert" className="flex flex-wrap items-center gap-2 px-3 py-2 text-v2-warn">{describeError(details.error)}
          <GameButton size="sm" glyph="refresh" onPress={() => { void details.refetch(); }}>{t('surface.retry')}</GameButton></div>
          : !details.data ? <p role="status" className="gk-copy px-3 py-2">{t('surface.waitingChat')}</p>
          : details.data.participants.length === 0 ? <p className="gk-copy px-3 py-2">{t('chat.noReactions')}</p>
          : details.data.participants.map(person => <div key={person.playerId} className="flex h-10 items-center gap-3 px-3 text-v2-ink">
            <span className="shrink-0 text-title">{person.emoji}</span><span className="min-w-0 truncate" title={person.username}>{person.username}</span>
          </div>)}
      </div>
    </div>, document.body,
  );
}
