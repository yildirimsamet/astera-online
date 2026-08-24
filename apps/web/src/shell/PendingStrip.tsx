import { useTranslation } from 'react-i18next';
import { usePending } from '../api/queries.js';
import type { PendingThread } from '../api/schemas.js';
import i18n from '../i18n/index.js';
import { countdown, useNow } from '../lib/time.js';

/**
 * DESIGN LAW #1, made visible.
 *
 * "Every session must end with something in flight." A player can only act on
 * that if they can see it, so this strip is always on screen, above the tabs,
 * counting down. When it is empty it says so plainly — an empty strip is the
 * game telling you there is no reason to come back yet, which is a prompt, not a
 * decoration.
 */
export function PendingStrip() {
  const { t } = useTranslation();
  const { data } = usePending();
  const now = useNow(1000);
  const threads = data?.pending ?? [];

  const byArrival = (a: PendingThread, b: PendingThread) =>
    arrivalOf(a) - arrivalOf(b) || (a.id ?? '').localeCompare(b.id ?? '');
  const incoming = threads.filter((thread) => thread.kind === 'incoming').sort(byArrival)[0];
  const soonest = [...threads].sort(byArrival)[0];
  const shown = incoming ?? soonest;

  return (
    <div
      className={`border-t px-4 py-2 ${
        incoming ? 'border-alert/40 bg-alert/10' : 'border-line-soft bg-deep/80'
      }`}
    >
      {shown ? (
        <div className="flex items-center gap-3">
          <span className={`legend min-w-0 truncate ${incoming ? 'text-[#e08a7c]' : ''}`}>
            {title(shown)}
          </span>
          {shown.leg && (
            <span className="rounded-sm border border-line-soft px-1.5 py-0.5 text-[9px] uppercase tracking-[0.13em] text-faint">
              {t(shown.leg === 'return' ? 'pendingStrip.returnLeg' : 'pendingStrip.outboundLeg')}
            </span>
          )}
          <span className="h-px flex-1 bg-line-soft" />
          <span className={`num text-[13px] ${incoming ? 'text-[#ffb9ae]' : 'text-bone'}`}>
            {arrivalOf(shown) <= now && shown.kind === 'fleet' && shown.leg === 'outbound'
              ? t('pendingStrip.engaging')
              : countdown(arrivalOf(shown) - now)}
          </span>
          {threads.length > 1 && (
            <span className="num text-[11px] text-faint">
              {t('pendingStrip.more', { count: threads.length - 1 })}
            </span>
          )}
        </div>
      ) : (
        <p className="legend text-faint">{t('pendingStrip.empty')}</p>
      )}
    </div>
  );
}

/**
 * WHOSE FLIGHT THIS IS, SAID OUT LOUD.
 *
 * The strip is a permanent bar at the foot of the screen and the focus rail opens
 * directly above it, so the two stack into what reads as one panel — and this row's
 * countdown then reads as belonging to whatever the player has just tapped. Focus
 * anything that is NOT yours, which is most of the disc, and the strip was quietly
 * attributing your own fleet's clock to somebody else's craft.
 *
 * Nothing about the strip changed except that every line now begins with "Your".
 * That is the whole fix: the countdown never moved, it was only ever unlabelled.
 */
const title = (thread: PendingThread): string => {
  if (thread.kind === 'incoming') return i18n.t('pendingStrip.incoming');
  if (thread.kind === 'probe') return i18n.t('pendingStrip.probe', { target: thread.targetName });
  if (thread.kind === 'death_star') return i18n.t('pendingStrip.deathStar', { target: thread.targetName });
  if (thread.kind === 'settlement') return i18n.t('pendingStrip.settlement', { target: thread.targetName });
  if (thread.kind === 'transfer') return i18n.t('pendingStrip.transfer', { target: thread.targetName });
  return i18n.t(thread.leg === 'return' ? 'pendingStrip.fleetHome' : 'pendingStrip.fleetOut', {
    target: thread.targetName,
  });
};

/**
 * THE INSTANT ITSELF, not a figure rebuilt from a rounded one.
 *
 * This used to be `answeredAt + minutesRemaining * 60_000`, which is accurate to
 * within half a minute and no better. The attacker's own strip read the exact
 * `arriveAt` off the thread's path, and a defender — whose inbound thread has no
 * path, deliberately — got the reconstruction. So the two players watching the
 * same fleet counted down to instants up to thirty seconds apart, which reads as
 * the game being unable to agree with itself about when it will land.
 *
 * `answeredAt` is no longer needed at all: an absolute timestamp does not have to
 * be anchored to anything.
 */
export const arrivalOf = (thread: PendingThread): number => thread.arriveAt.getTime();
