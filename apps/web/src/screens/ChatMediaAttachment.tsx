import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { ChatMedia } from '@astera/rules';
import { useApi } from '../api/context.js';
import { CloseIcon } from '../ui/icons/index.js';
import type { ChatChannel } from './ChatScreen.js';

export function ChatMediaAttachment({ media, channel, messageId, onLoad, preview = false }: {
  media: ChatMedia; channel?: ChatChannel; messageId?: string; onLoad?: () => void; preview?: boolean;
}) {
  const { t } = useTranslation();
  const api = useApi();
  const [expanded, setExpanded] = useState(false);
  const [failed, setFailed] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!expanded) return;
    dialog.current?.querySelector('button')?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setExpanded(false); }
      if (event.key === 'Tab') { event.preventDefault(); dialog.current?.querySelector('button')?.focus(); }
    };
    document.addEventListener('keydown', close, true);
    return () => { document.removeEventListener('keydown', close, true); opener.current?.focus({ preventScroll: true }); };
  }, [expanded]);
  if (failed) return <p role="status" className="my-2 text-micro text-v2-warn">{t('chat.media.loadFailed')}</p>;
  const width = preview ? 'w-[min(44vw,240px,32dvh)]' : 'w-[min(68vw,360px)]';
  if (media.kind === 'youtube') return <div className={`my-2 ${width} max-w-full overflow-hidden rounded-control border border-v2-line-hi bg-v2-deep`} style={{ aspectRatio: '16 / 9' }}>
    <iframe title={t('chat.media.youtube')} src={`https://www.youtube-nocookie.com/embed/${media.videoId}`} loading="lazy"
      className="h-full w-full border-0" referrerPolicy="strict-origin-when-cross-origin" allow="fullscreen; encrypted-media; picture-in-picture" allowFullScreen />
  </div>;
  const url = api.chatMediaUrl(media.assetId, channel, messageId);
  if (media.kind === 'video') return <video controls playsInline preload="metadata" className={`my-2 ${width} ${preview ? 'max-h-[min(8rem,18dvh)]' : 'max-h-64'} max-w-full rounded-control border border-v2-line-hi bg-v2-deep`} onLoadedMetadata={onLoad} onError={() => { setFailed(true); }} aria-label={t('chat.media.video')}>
    <source src={url} type={media.mimeType} />
  </video>;
  return <>
    <button ref={opener} type="button" aria-label={t('chat.media.openImage')} className="my-2 block max-w-full overflow-hidden rounded-control border border-v2-line-hi bg-v2-deep" onClick={() => { setExpanded(true); }}>
      <img src={url} alt={t('chat.media.photo')} loading="lazy" className={`${preview ? 'max-h-[min(8rem,18dvh)] w-auto' : 'max-h-64 w-[min(68vw,320px)]'} max-w-full object-contain`} onLoad={onLoad} onError={() => { setFailed(true); }} />
    </button>
    {expanded ? createPortal(<div className="fixed inset-0 z-[120] flex items-center justify-center bg-v2-deep/95 p-4" onClick={() => { setExpanded(false); }}>
      <div ref={dialog} role="dialog" aria-modal="true" aria-label={t('chat.media.photo')} onClick={event => { event.stopPropagation(); }} className="relative max-h-full max-w-full">
        <button type="button" className="absolute right-2 top-2 grid size-10 place-items-center rounded-full border border-v2-line-hi bg-v2-deep text-v2-ink shadow-xl" aria-label={t('sheet.close')} onClick={() => { setExpanded(false); }}><CloseIcon className="size-5" /></button>
        <img src={url} alt={t('chat.media.photo')} className="max-h-[85dvh] max-w-full rounded-control object-contain" />
      </div>
    </div>, document.body) : null}
  </>;
}
