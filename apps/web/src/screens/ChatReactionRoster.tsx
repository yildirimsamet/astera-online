import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useApi } from '../api/context.js';
import { keys } from '../api/keys.js';
import { describeError } from '../i18n/errors.js';
import { CloseIcon } from '../ui/icons/index.js';
import type { ChatChannel } from './ChatScreen.js';

export function ChatReactionRoster({ channel, messageId, anchor, onClose }: {
  channel: ChatChannel; messageId: string; anchor: HTMLButtonElement; onClose: () => void;
}) {
  const { t } = useTranslation();
  const api = useApi();
  const panel = useRef<HTMLDivElement>(null);
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
    <div ref={panel} role="dialog" aria-modal="true" aria-label={t('chat.reactions')} tabIndex={-1}
      className="fixed z-[110] w-[272px] max-w-[calc(100vw-16px)] overflow-hidden rounded-control border border-v2-line-hi bg-v2-raise shadow-xl outline-none"
      style={position}>
      <div className="flex h-10 items-center justify-between border-b border-v2-line px-3 text-label font-semibold text-v2-ink">
        {t('chat.reactions')}
        <button type="button" className="grid size-8 place-items-center rounded-full hover:bg-v2-line/60" aria-label={t('sheet.close')} onClick={onClose}><CloseIcon className="size-4" /></button>
      </div>
      <div data-reaction-roster style={{ height: 108, overflowY: 'auto', overscrollBehavior: 'contain' }} tabIndex={0}>
        {details.isError ? <p role="alert" className="px-3 py-2 text-micro text-v2-warn">{describeError(details.error)} <button type="button" className="underline" onClick={() => { void details.refetch(); }}>{t('surface.retry')}</button></p>
          : !details.data ? <p role="status" className="px-3 py-2 text-micro text-v2-ink-3">{t('surface.waitingChat')}</p>
          : details.data.participants.length === 0 ? <p className="px-3 py-2 text-micro text-v2-ink-3">{t('chat.noReactions')}</p>
          : details.data.participants.map(person => <div key={person.playerId} className="flex h-9 items-center gap-3 px-3 text-caption text-v2-ink">
            <span className="shrink-0">{person.emoji}</span><span className="min-w-0 truncate" title={person.username}>{person.username}</span>
          </div>)}
      </div>
    </div>, document.body,
  );
}
