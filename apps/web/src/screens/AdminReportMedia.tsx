import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChatMedia } from '@astera/rules';
import { useApi } from '../api/context.js';
import { Button } from '../v2/kit/Surface.js';

/** Review is explicit; the queue never embeds or prefetches reported media. */
export function AdminReportMedia({ reportId, media }: { reportId: string; media: ChatMedia }) {
  const { t } = useTranslation();
  if (media.kind === 'youtube') return <a
    className="flex min-h-11 items-center text-caption text-v2-self underline underline-offset-4"
    href={`https://www.youtube.com/watch?v=${media.videoId}`} target="_blank" rel="noopener noreferrer"
  >{t('moderation.admin.mediaYouTube')}</a>;
  return <ReviewFile key={`${reportId}:${media.assetId}`} reportId={reportId} media={media} />;
}

function ReviewFile({ reportId, media }: { reportId: string; media: Exclude<ChatMedia, { kind: 'youtube' }> }) {
  const api = useApi();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<{ url: string; release: () => void } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    let release: (() => void) | undefined;
    setSource(null);
    setFailed(false);
    void api.adminReportMediaSource(reportId, media, controller.signal).then(value => {
      if (controller.signal.aborted) { value.release(); return; }
      release = value.release;
      setSource(value);
    }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => { controller.abort(); release?.(); };
  }, [api, media, open, reportId]);
  const unavailable = () => {
    source?.release();
    setSource(null);
    setFailed(true);
  };
  return <div className="grid min-w-0 gap-2">
    <Button size="lg" onClick={() => { setOpen(value => !value); }}>{t(open ? 'moderation.admin.closeMedia' : 'moderation.admin.reviewMedia')}</Button>
    {open ? failed ? <p role="alert" className="text-caption text-v2-warn">{t('moderation.admin.mediaFailed')}</p>
      : source ? media.kind === 'image' ? <img src={source.url} alt={t('moderation.admin.mediaImage')}
        className="max-h-80 max-w-full rounded-control object-contain" onError={unavailable} />
        : <video src={source.url} aria-label={t('moderation.admin.mediaVideo')} controls preload="none"
          className="max-h-80 w-full rounded-control" onError={unavailable} />
        : <p role="status" className="text-caption text-v2-ink-2">{t('moderation.admin.mediaOpening')}</p> : null}
  </div>;
}
