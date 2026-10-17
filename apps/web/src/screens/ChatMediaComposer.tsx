import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { CHAT_MEDIA, type ChatMedia } from '@astera/rules';
import { useApi } from '../api/context.js';
import { describeError } from '../i18n/errors.js';
import { youtubeVideoId } from '../lib/chatMedia.js';
import { CloseIcon, PlusIcon } from '../ui/icons/index.js';
import { ChatMediaAttachment } from './ChatMediaAttachment.js';

export function ChatMediaComposer({ value, onChange, onBusy, disabled, pasteTarget }: {
  value: ChatMedia | null; onChange: (media: ChatMedia | null) => void; onBusy: (busy: boolean) => void; disabled: boolean; pasteTarget: RefObject<HTMLTextAreaElement | null>;
}) {
  const { t } = useTranslation();
  const api = useApi();
  const input = useRef<HTMLInputElement>(null);
  const request = useRef<AbortController | null>(null);
  const [menu, setMenu] = useState(false);
  const [youtube, setYoutube] = useState(false);
  const [url, setUrl] = useState('');
  const [accept, setAccept] = useState('image/jpeg,image/png,image/webp,image/gif');
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [retryFile, setRetryFile] = useState<File | null>(null);
  useEffect(() => () => { request.current?.abort(); request.current = null; }, []);

  const upload = useCallback(async (file: File) => {
    if (disabled || request.current !== null) return;
    setError(''); setRetryFile(file);
    const limit = file.type.startsWith('image/') ? CHAT_MEDIA.imageMaxBytes : CHAT_MEDIA.videoMaxBytes;
    if (!CHAT_MEDIA.mimeTypes.some(type => type === file.type) || file.size === 0 || file.size > limit) {
      setError(t('chat.media.fileLimits')); return;
    }
    const controller = new AbortController();
    request.current = controller;
    onChange(null); onBusy(true); setProgress(0);
    try {
      const result = await api.uploadChatMedia(file, controller.signal, setProgress);
      if (request.current !== controller) return;
      onChange(result.media); setMenu(false); setRetryFile(null);
    } catch (failure) {
      if (!controller.signal.aborted && request.current === controller) setError(describeError(failure));
    } finally {
      if (request.current === controller) { request.current = null; setProgress(null); onBusy(false); }
    }
  }, [api, onChange, onBusy, t, disabled]);
  useEffect(() => {
    const target = pasteTarget.current;
    if (!target) return;
    const paste = (event: ClipboardEvent) => {
      const imageItem = Array.from(event.clipboardData?.items ?? []).find(item => item.kind === 'file' && item.type.startsWith('image/'));
      const file = imageItem?.getAsFile() ?? Array.from(event.clipboardData?.files ?? []).find(item => item.type.startsWith('image/'));
      if (!file) return;
      event.preventDefault();
      if (!disabled && request.current === null) void upload(file);
    };
    target.addEventListener('paste', paste);
    return () => { target.removeEventListener('paste', paste); };
  }, [pasteTarget, disabled, upload]);
  const remove = () => {
    request.current?.abort(); request.current = null;
    onChange(null); onBusy(false); setProgress(null); setError(''); setRetryFile(null); setYoutube(false); setMenu(false);
  };
  const control = 'min-h-9 rounded-control border border-v2-line-hi bg-v2-deep px-3 text-caption text-v2-ink hover:border-v2-self/50 disabled:opacity-50';
  return <div className="mb-2">
    <input ref={input} type="file" accept={accept} aria-label={t('chat.media.add')} hidden tabIndex={-1} onChange={event => {
      const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) void upload(file);
    }} />
    {value ? <div className="relative rounded-control border border-v2-self/30 bg-v2-deep/50 px-2">
      <button type="button" aria-label={t('chat.media.remove')} className="absolute right-1 top-1 z-10 grid size-8 place-items-center rounded-full bg-v2-raise text-v2-ink" onClick={remove} disabled={disabled}><CloseIcon className="size-4" /></button>
      <ChatMediaAttachment key={value.kind === 'youtube' ? value.videoId : value.assetId} media={value} preview />
    </div> : <button type="button" className="flex min-h-8 items-center gap-1.5 rounded-control px-2 text-micro text-v2-self hover:bg-v2-self/10 disabled:opacity-50" disabled={disabled || progress !== null}
      aria-expanded={menu} onClick={() => { setMenu(!menu); }}><PlusIcon className="size-4" />{t('chat.media.add')}</button>}
    {menu && !value && progress === null ? <div className="rounded-control border border-v2-line-hi bg-v2-raise p-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" className={control} disabled={disabled} onClick={() => { setAccept('image/jpeg,image/png,image/webp,image/gif'); setYoutube(false); requestAnimationFrame(() => input.current?.click()); }}>{t('chat.media.photo')}</button>
        <button type="button" className={control} disabled={disabled} onClick={() => { setAccept('video/mp4,video/webm'); setYoutube(false); requestAnimationFrame(() => input.current?.click()); }}>{t('chat.media.video')}</button>
        <button type="button" className={control} disabled={disabled} onClick={() => { setYoutube(true); setError(''); }}>{t('chat.media.youtube')}</button>
      </div>
      {youtube ? <div className="mt-2 flex flex-col gap-2">
        <label className="text-micro text-v2-ink-3">{t('chat.media.url')}<input type="url" value={url} placeholder="https://youtu.be/…" className="mt-1 h-9 w-full rounded-control border border-v2-line-hi bg-v2-deep px-2 text-caption text-v2-ink" onChange={event => { setUrl(event.target.value); }} onKeyDown={event => { if (event.key === 'Enter') event.preventDefault(); }} /></label>
        <button type="button" className={control} disabled={disabled || !url.trim()} onClick={() => {
          const videoId = youtubeVideoId(url);
          if (!videoId) { setError(t('chat.media.invalidYoutube')); return; }
          onChange({ kind: 'youtube', videoId }); setMenu(false); setYoutube(false); setUrl(''); setError('');
        }}>{t('chat.media.attach')}</button>
      </div> : <p className="mt-2 text-micro text-v2-ink-3">{t('chat.media.fileLimits')} {t('chat.media.pasteHint')}</p>}
    </div> : null}
    {progress !== null ? <div className="flex items-center gap-2 rounded-control border border-v2-self/30 px-2 py-2 text-micro text-v2-ink">
      <progress className="h-1 min-w-0 flex-1 accent-v2-self" value={progress} max={100} aria-label={t('chat.media.uploading', { percent: progress })} />
      <span role="status">{t('chat.media.uploading', { percent: progress })}</span><button type="button" className={control} onClick={remove}>{t('chat.dm.cancel')}</button>
    </div> : null}
    {error ? <div role="alert" className="mt-1 flex flex-wrap items-center gap-2 text-micro text-v2-warn">{error}
      {retryFile ? <button type="button" className={control} disabled={disabled || progress !== null} onClick={() => { void upload(retryFile); }}>{t('chat.media.retry')}</button> : null}
      <button type="button" className={control} onClick={remove}>{t('chat.dm.cancel')}</button>
    </div> : null}
  </div>;
}
