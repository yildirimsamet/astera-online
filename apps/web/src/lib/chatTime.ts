import moment from 'moment';
import type { TFunction } from 'i18next';

/** Locked chat boundaries, measured from server-derived now with Moment durations. */
export function chatRelativeTime(createdAt: Date, now: number, t: TFunction): string {
  const elapsed = moment.duration(Math.max(0, now - createdAt.getTime()));
  const minutes = Math.floor(elapsed.asMinutes());
  if (minutes < 1) return t('chat.time.justNow');
  if (minutes < 60) return t('chat.time.minutes', { count: minutes });
  if (minutes < 24 * 60) {
    return t('chat.time.hours', {
      hours: Math.floor(elapsed.asHours()),
      minutes: minutes % 60,
    });
  }
  return t('chat.time.days', { count: Math.floor(elapsed.asDays()) });
}
