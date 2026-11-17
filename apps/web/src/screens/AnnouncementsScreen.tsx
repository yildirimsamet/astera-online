import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAnnouncements, useMarkAnnouncementsRead } from '../api/queries.js';
import { EmptyState, artIconSrc } from '../game-ui/index.js';
import { RichContent } from '../ui/RichContent.js';
import { SkeletonText, Unreachable } from '../ui/kit/index.js';

/**
 * WORD FROM ASTERA COMMAND (C5, 2026-11-14): each announcement a plate on the kit, the newest
 * lit in the player's colour with its tag. Opening the page marks them read at once, so what
 * arrived new stays lit for this visit — otherwise the light went out before anyone saw it.
 */
export function AnnouncementsScreen() {
  const { t, i18n } = useTranslation();
  const dateFormat = useMemo(() => new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }), [i18n.language]);
  const announcements = useAnnouncements();
  const markRead = useMarkAnnouncementsRead();
  const [fresh, setFresh] = useState<ReadonlySet<string>>(() => new Set());
  const unreadIds = announcements.data?.announcements
    .filter((announcement) => !announcement.seen)
    .map((announcement) => announcement.id) ?? [];
  const unreadKey = unreadIds.join(',');

  useEffect(() => {
    if (unreadIds.length === 0) return;
    setFresh((current) => new Set([...current, ...unreadIds]));
    markRead.mutate(unreadIds);
  }, [markRead.mutate, unreadKey]);

  if (announcements.isError) {
    return (
      <Unreachable
        what={t('surface.whatAnnouncements')}
        onRetry={() => { void announcements.refetch(); }}
      />
    );
  }
  if (!announcements.data) return <SkeletonText lines={7} className="mt-2" />;
  if (announcements.data.announcements.length === 0) {
    return (
      <div className="gk py-3">
        <EmptyState art={artIconSrc('menu-news')} title={t('community.announcements.emptyTitle')} body={t('community.announcements.empty')} />
      </div>
    );
  }

  return (
    <ol className="gk flex flex-col gap-3 pb-6 pt-3">
      {announcements.data.announcements.map((announcement) => {
        const lit = !announcement.seen || fresh.has(announcement.id);
        return (
          <li key={announcement.id} className="gk-notice" {...(lit ? { 'data-new': '' } : {})}>
            <header className="gk-notice__head">
              <div className="flex items-start justify-between gap-2">
                <h3 className="gk-notice__title gk-display">{announcement.title}</h3>
                {lit && <span className="gk-newtag">{t('community.announcements.new')}</span>}
              </div>
              <time dateTime={announcement.publishedAt.toISOString()} className="gk-note">
                {dateFormat.format(announcement.publishedAt)}
              </time>
            </header>
            <RichContent html={announcement.bodyHtml} className="gk-notice__body" />
          </li>
        );
      })}
    </ol>
  );
}
