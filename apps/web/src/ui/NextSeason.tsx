import { SEASON } from '@astera/rules';
import { useTranslation } from 'react-i18next';
import { Banner } from '../game-ui/surfaces.js';
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
 * On the kit since C18: a status banner, the clock its glyph, the wait its title.
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
    <div className={`gk ${className}`}>
      <Banner
        tone="info"
        glyph="clock"
        role="status"
        title={left > 0 ? t('seasonRecap.nextIn', { duration: countdown(left) }) : t('seasonRecap.nextNow')}
        body={t('seasonRecap.nextWhy')}
      />
    </div>
  );
}
