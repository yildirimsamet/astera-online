import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAnnouncements, useMarkAnnouncementsRead } from '../api/queries.js';
import { RichContent } from '../ui/RichContent.js';
import { BellIcon } from '../ui/icons/index.js';
import { EmptyState, SkeletonText, Unreachable } from '../ui/kit/index.js';

export function AnnouncementsScreen() {
  const { t, i18n } = useTranslation();
  const dateFormat = useMemo(() => new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }), [i18n.language]);
  const announcements = useAnnouncements();
  const markRead = useMarkAnnouncementsRead();
  const unreadIds = announcements.data?.announcements
    .filter((announcement) => !announcement.seen)
    .map((announcement) => announcement.id) ?? [];
  const unreadKey = unreadIds.join(',');

  useEffect(() => {
    if (unreadIds.length > 0) markRead.mutate(unreadIds);
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
      <div className="py-2">
        <EmptyState
          icon={<BellIcon className="size-7" />}
          title={t('community.announcements.empty')}
        />
      </div>
    );
  }

  return (
    <ol className="flex flex-col gap-4 pb-6 pt-3">
      {announcements.data.announcements.map((announcement) => (
        <li key={announcement.id} className="plate overflow-hidden">
          <header className="border-b border-line-soft px-2 py-3">
            <div className="flex items-start justify-between gap-2">
              <h3 className="name text-bone">{announcement.title}</h3>
              {!announcement.seen && (
                <span className="shrink-0 rounded-full bg-opportunity/15 px-2 py-1 text-micro text-opportunity">
                  {t('community.announcements.new')}
                </span>
              )}
            </div>
            <time
              dateTime={announcement.publishedAt.toISOString()}
              className="mt-1 block text-micro text-faint"
            >
              {dateFormat.format(announcement.publishedAt)}
            </time>
          </header>
          <RichContent html={announcement.bodyHtml} className="px-2 py-2" />
        </li>
      ))}
    </ol>
  );
}
