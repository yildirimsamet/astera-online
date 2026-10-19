import { capabilities } from '../platform/runtime.js';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { ChatMedia } from '@astera/rules';
import { useApi } from '../api/context.js';
import { CloseIcon } from '../ui/icons/index.js';
import { useNativeBack } from '../platform/nativeBack.js';
import type { ChatChannel } from './ChatScreen.js';

interface AttachmentProps {
  media: ChatMedia; channel?: ChatChannel; messageId?: string; onLoad?: () => void; preview?: boolean;
}

export function ChatMediaAttachment(props: AttachmentProps) {
  const api = useApi();
  if (api.mediaNeedsBearer && props.media.kind !== 'youtube') return <NativeAttachment
    key={`${props.media.kind}:${props.media.assetId}:${props.channel ?? ''}:${props.messageId ?? ''}`} {...props} media={props.media} />;
  return <AttachmentView {...props} />;
}

/** Avoid eager 50 MB video downloads; images start near the viewport, with abort/URL cleanup. */
function NativeAttachment(props: AttachmentProps & { media: Exclude<ChatMedia, { kind: 'youtube' }> }) {
  const { t } = useTranslation();
  const api = useApi();
  const anchor = useRef<HTMLDivElement>(null);
  const [requested, setRequested] = useState(false);
  const [source, setSource] = useState<{ url: string; key: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const key = `${props.media.assetId}:${props.channel ?? ''}:${props.messageId ?? ''}`;
  useEffect(() => {
    if (props.media.kind !== 'image') return;
    if (!('IntersectionObserver' in window)) { setRequested(true); return; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setRequested(true); observer.disconnect(); }
    }, { rootMargin: '160px' });
    if (anchor.current) observer.observe(anchor.current);
    return () => { observer.disconnect(); };
  }, [key, props.media.kind]);
  useEffect(() => {
    if (!requested) return;
    const controller = new AbortController();
    let release: (() => void) | undefined;
    setSource(null); setFailed(false);
    void api.chatMediaSource(props.media, props.channel, props.messageId, controller.signal).then(value => {
      if (controller.signal.aborted) { value.release(); return; }
      release = value.release; setSource({ url: value.url, key });
    }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => { controller.abort(); release?.(); };
  }, [api, key, requested]);
  if (failed) return <p role="status" className="my-2 text-micro text-v2-warn">{t('chat.media.loadFailed')}</p>;
  return <div ref={anchor}>
    {source?.key === key ? <AttachmentView {...props} sourceUrl={source.url} autoPlay={props.media.kind === 'video'} />
      : props.media.kind === 'video' && !requested ? <button type="button" onClick={() => { setRequested(true); }}
        className="my-2 flex min-h-20 w-[min(68vw,360px)] max-w-full items-center justify-center gap-2 rounded-control border border-v2-line-hi bg-v2-deep px-4 text-body text-v2-ink hover:border-v2-self/50">
        <span aria-hidden="true">▶</span>{t('chat.media.play')}
      </button> : <div role="status" className="my-2 flex min-h-20 w-[min(68vw,360px)] max-w-full animate-pulse items-center justify-center rounded-control border border-v2-line-hi bg-v2-deep text-micro text-v2-ink-2">
        {t(props.media.kind === 'video' ? 'chat.media.video' : 'chat.media.photo')}
      </div>}
  </div>;
}

function AttachmentView({ media, channel, messageId, onLoad, preview = false, sourceUrl, autoPlay = false }: AttachmentProps & { sourceUrl?: string; autoPlay?: boolean }) {
  const { t } = useTranslation();
  const api = useApi();
  const [expanded, setExpanded] = useState(false);
  const [portrait, setPortrait] = useState(false);
  const [failed, setFailed] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  useNativeBack(dialog, () => { setExpanded(false); }, expanded);
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
  if (media.kind === 'youtube' && !capabilities().thirdPartyEmbeds) return <div className="my-2 grid max-w-full gap-1 rounded-control border border-v2-line-hi bg-v2-deep px-3 py-2">
    <a href={`https://www.youtube.com/watch?v=${media.videoId}`} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center text-body text-v2-self underline underline-offset-4">{t('chat.media.openYouTube')}</a>
    <p className="text-micro leading-relaxed text-v2-ink-2">{t('chat.media.externalNotice')}</p>
  </div>;
  if (media.kind === 'youtube') return <div className="my-2 max-w-full">
    <div className={`${portrait ? 'w-[min(68vw,240px,18dvh)]' : width} max-w-full overflow-hidden rounded-control border border-v2-line-hi bg-v2-deep`} style={{ aspectRatio: portrait ? '9 / 16' : '16 / 9' }}>
      <iframe title={t('chat.media.youtube')} src={`https://www.youtube-nocookie.com/embed/${media.videoId}`} loading="lazy"
        className="h-full w-full border-0" referrerPolicy="strict-origin-when-cross-origin" allow="fullscreen; encrypted-media; picture-in-picture" allowFullScreen />
    </div>
    {!preview ? <button type="button" className="mt-1 min-h-8 rounded-control border border-v2-line-hi px-2 text-micro text-v2-ink-2 hover:border-v2-self/50 hover:text-v2-self"
      onClick={() => { setPortrait(current => !current); }}>{t(portrait ? 'chat.media.showLandscape' : 'chat.media.showPortrait')}</button> : null}
  </div>;
  const url = sourceUrl ?? api.chatMediaUrl(media.assetId, channel, messageId);
  if (media.kind === 'video') return <video controls playsInline autoPlay={autoPlay} preload="metadata" className={`my-2 ${width} ${preview ? 'max-h-[min(8rem,18dvh)]' : 'max-h-64'} max-w-full rounded-control border border-v2-line-hi bg-v2-deep`} onLoadedMetadata={onLoad} onError={() => { setFailed(true); }} aria-label={t('chat.media.video')}>
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
