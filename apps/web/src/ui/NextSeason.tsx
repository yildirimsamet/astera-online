import { SEASON } from '@astera/rules';
import { useTranslation } from 'react-i18next';
import { countdown, useNow } from '../lib/time.js';

/**
 * WHAT THE QUINCE BETWEEN TWO SEASONS IS FOR.
 *
 * A frozen galaxy sits for `SEASON.afterglowMinutes` before the next one opens.
 * Without this the wait reads as a fault: the game is over, nothing responds, and
 * nothing on screen says whether that is deliberate or broken. It is deliberate —
 * the final standings are frozen so the record cannot move while it is being read,
 * and the rollover that follows is one atomic write.
 *
 * Derived from `endsAt` plus the rules constant rather than from a field on the
 * payload, so it cannot disagree with the worker that actually does the rollover.
 */
export function NextSeason({
  endsAt,
  className = '',
}: {
  endsAt: Date | null | undefined;
  className?: string;
}) {
  const { t } = useTranslation();
  const now = useNow(1000);
  if (!endsAt) return null;

  const left = endsAt.getTime() + SEASON.afterglowMinutes * 60_000 - now;
  return (
    <div className={`plate px-4 py-3 text-center ${className}`} role="status">
      <p className="legend text-crystal">
        {left > 0
          ? t('seasonRecap.nextIn', { duration: countdown(left) })
          : t('seasonRecap.nextNow')}
      </p>
      <p className="mt-1 text-[12px] leading-snug text-dim">{t('seasonRecap.nextWhy')}</p>
    </div>
  );
}
