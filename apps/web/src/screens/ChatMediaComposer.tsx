import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { CHAT_MEDIA, type ChatMedia } from '@astera/rules';
import { useApi } from '../api/context.js';
import { describeError } from '../i18n/errors.js';
import { youtubeVideoId } from '../lib/chatMedia.js';
import { GameButton, Glyph, RoundButton } from '../game-ui/index.js';
import { haptic } from '../lib/haptics.js';
import { OWN_SOUND, playSound } from '../lib/sound.js';
import { useOwnPress } from '../ui/kit/useOwnPress.js';
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
  // The menu's own key says whether it is open, so it is the kit's face on a plain button (C3).
  const toggle = useOwnPress(() => { playSound('tap'); haptic('tap'); setMenu(!menu); });
  const pick = (types: string): void => { setAccept(types); setYoutube(false); requestAnimationFrame(() => input.current?.click()); };
  const again = useOwnPress(() => { if (retryFile) { playSound('tap'); haptic('tap'); void upload(retryFile); } });
  return <div className="gk mb-2">
    <input ref={input} type="file" accept={accept} aria-label={t('chat.media.add')} hidden tabIndex={-1} onChange={event => {
      const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) void upload(file);
    }} />
    {value ? <div className="relative rounded-control border border-v2-self/30 bg-v2-deep/50 px-2">
      <div className="absolute right-0 top-0 z-10"><RoundButton small glyph="close" label={t('chat.media.remove')} onPress={() => { if (!disabled) remove(); }} /></div>
      <ChatMediaAttachment key={value.kind === 'youtube' ? value.videoId : value.assetId} media={value} preview />
    </div> : <button type="button" {...OWN_SOUND} className="gk-btn gk-btn--sm" disabled={disabled || progress !== null}
      aria-expanded={menu} onPointerDown={toggle.onPointerDown} onClick={toggle.onClick}><span className="gk-btn__glyph"><Glyph id="plus" /></span><span>{t('chat.media.add')}</span></button>}
    {menu && !value && progress === null && !disabled ? <div className="mt-2 rounded-control border border-v2-line-hi bg-v2-raise p-2">
      <div className="flex flex-wrap gap-2">
        <GameButton size="sm" onPress={() => { pick('image/jpeg,image/png,image/webp,image/gif'); }}>{t('chat.media.photo')}</GameButton>
        <GameButton size="sm" onPress={() => { pick('video/mp4,video/webm'); }}>{t('chat.media.video')}</GameButton>
        <GameButton size="sm" onPress={() => { setYoutube(true); setError(''); }}>{t('chat.media.youtube')}</GameButton>
      </div>
      {youtube ? <div className="mt-2 flex flex-col gap-2">
        <label className="grid gap-1 text-caption font-semibold text-v2-ink-2">{t('chat.media.url')}<input type="url" value={url} placeholder="https://youtu.be/…" className="gk-field__input" onChange={event => { setUrl(event.target.value); }} onKeyDown={event => { if (event.key === 'Enter') event.preventDefault(); }} /></label>
        <GameButton size="sm" tone="action" onPress={() => {
          const videoId = youtubeVideoId(url);
          if (!videoId) { setError(t('chat.media.invalidYoutube')); return; }
          onChange({ kind: 'youtube', videoId }); setMenu(false); setYoutube(false); setUrl(''); setError('');
        }}>{t('chat.media.attach')}</GameButton>
      </div> : <p className="mt-2 text-caption leading-snug text-v2-ink-2">{t('chat.media.fileLimits')} {t('chat.media.pasteHint')}</p>}
    </div> : null}
    {progress !== null ? <div className="flex items-center gap-2 rounded-control border border-v2-self/30 px-2 py-1 text-caption text-v2-ink">
      <progress className="h-1 min-w-0 flex-1 accent-v2-self" value={progress} max={100} aria-label={t('chat.media.uploading', { percent: progress })} />
      <span role="status">{t('chat.media.uploading', { percent: progress })}</span><GameButton size="sm" onPress={remove}>{t('chat.dm.cancel')}</GameButton>
    </div> : null}
    {error ? <div role="alert" className="mt-1 flex flex-wrap items-center gap-2 text-caption text-v2-warn">{error}
      {retryFile ? <button type="button" {...OWN_SOUND} className="gk-btn gk-btn--sm" disabled={disabled || progress !== null}
        onPointerDown={again.onPointerDown} onClick={again.onClick}><span className="gk-btn__glyph"><Glyph id="refresh" /></span><span>{t('chat.media.retry')}</span></button> : null}
      <GameButton size="sm" onPress={remove}>{t('chat.dm.cancel')}</GameButton>
    </div> : null}
  </div>;
}
