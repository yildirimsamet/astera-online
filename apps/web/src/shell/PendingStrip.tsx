import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fleetCount } from '@astera/rules';
import { useMining, usePending } from '../api/queries.js';
import type { MiningRun, PendingThread } from '../api/schemas.js';
import { threadKey } from '../galaxy/threadKey.js';
import type { CraftFocus } from '../galaxy/ownCraft.js';
import i18n from '../i18n/index.js';
import { countdown, useNow } from '../lib/time.js';
import { Sheet } from '../ui/kit/index.js';

/**
 * DESIGN LAW #1, made visible.
 *
 * "Every session must end with something in flight." A player can only act on
 * that if they can see it, so this strip is always on screen, counting down. Its
 * sheet is the complete owned-flight roster: mission threads and mining runs meet
 * here even though the API keeps them separate. When it is empty it says so
 * plainly — an empty strip is a prompt, not decoration.
 */
export function PendingStrip({ onFocus }: { onFocus?: (focus: CraftFocus) => void }) {
  const { t } = useTranslation();
  const { data } = usePending();
  const mining = useMining();
  const now = useNow(1000);
  const threads = data?.pending ?? [];
  const runs = (mining.data?.runs ?? []).filter((run) => run.status !== 'done');
  const [open, setOpen] = useState(false);

  const items: AirborneItem[] = [
    ...threads.map((thread, index): AirborneItem => ({
      key: `thread:${threadKey(thread, index)}`,
      title: title(thread),
      detail: thread.fleet
        ? t('pendingStrip.craftCount', { count: fleetCount(thread.fleet) })
        : thread.kind === 'incoming'
          ? t('pendingStrip.incomingHint')
          : t('pendingStrip.craftUnknown'),
      arrival: arrivalOf(thread),
      leg: thread.leg,
      incoming: thread.kind === 'incoming',
      engages: thread.kind === 'fleet' && thread.leg === 'outbound',
      ...(thread.path
        ? { focus: { kind: 'thread', key: threadKey(thread, index) } }
        : {}),
    })),
    ...runs.map((run): AirborneItem => ({
      key: `run:${run.id}`,
      title: runTitle(run),
      detail: t('pendingStrip.drillCount', { count: run.craft }),
      arrival: runArrival(run),
      leg: run.status === 'returning' ? 'return' : 'outbound',
      incoming: false,
      engages: false,
      focus: { kind: 'run', id: run.id },
    })),
  ].sort((a, b) => a.arrival - b.arrival || a.key.localeCompare(b.key));

  const incoming = items.find((item) => item.incoming);
  const soonest = items[0];
  const shown = incoming ?? soonest;

  return (
    <>
      <button
        type="button"
        aria-label={t('pendingStrip.openFlights')}
        onClick={() => { setOpen(true); }}
        className={`w-full border-t px-4 py-2 text-left transition-colors hover:bg-raised/60 ${
          incoming ? 'border-alert/40 bg-alert/10' : 'border-line-soft bg-deep/80'
        }`}
      >
        {shown ? (
          <span className="flex items-center gap-3">
            <span className={`legend min-w-0 truncate ${incoming ? 'text-threat-ink' : ''}`}>
              {shown.title}
            </span>
            {shown.leg && (
              <span className="legend rounded-chip border border-line-soft px-2 py-1">
                {t(shown.leg === 'return' ? 'pendingStrip.returnLeg' : 'pendingStrip.outboundLeg')}
              </span>
            )}
            <span className="h-px flex-1 bg-line-soft" />
            <span className={`num text-caption whitespace-nowrap ${incoming ? 'text-threat-ink' : 'text-bone'}`}>
              {shown.arrival <= now && shown.engages
                ? t('pendingStrip.engaging')
                : countdown(shown.arrival - now)}
            </span>
            {items.length > 1 && (
              <span className="num text-label text-faint">
                {t('pendingStrip.more', { count: items.length - 1 })}
              </span>
            )}
            <span aria-hidden className="text-faint">⌃</span>
          </span>
        ) : (
          <span className="flex items-center justify-between gap-3">
            <span className="legend text-faint">{t('pendingStrip.empty')}</span>
            <span aria-hidden className="text-faint">⌃</span>
          </span>
        )}
      </button>

      {open && (
        <Sheet
          eyebrow={t('pendingStrip.sheetEyebrow')}
          title={t('pendingStrip.sheetTitle')}
          onClose={() => { setOpen(false); }}
        >
          {items.length === 0 ? (
            <p className="pt-4 text-body text-dim">{t('pendingStrip.sheetEmpty')}</p>
          ) : (
            <div className="space-y-2 pt-4">
              {items.map((item) => {
                const focus = item.focus;
                const body = (
                  <>
                    <span className="min-w-0 flex-1">
                      <span className="name block truncate text-bone">
                        {item.title}
                      </span>
                      <span className="mt-1 block text-label text-faint">{item.detail}</span>
                    </span>
                    <span className="num shrink-0 text-caption text-crystal">
                      {countdown(item.arrival - now)}
                    </span>
                    {focus && <span aria-hidden className="text-faint">›</span>}
                  </>
                );
                return focus ? (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      onFocus?.(focus);
                    }}
                    className="plate flex min-h-14 w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-bone/[0.03] active:bg-raised/60"
                  >
                    {body}
                  </button>
                ) : (
                  <div key={item.key} className="plate flex min-h-14 items-center gap-3 px-3 py-3">
                    {body}
                  </div>
                );
              })}
            </div>
          )}
        </Sheet>
      )}
    </>
  );
}

interface AirborneItem {
  key: string;
  title: string;
  detail: string;
  arrival: number;
  leg?: 'outbound' | 'return';
  incoming: boolean;
  engages: boolean;
  focus?: CraftFocus;
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
 * Every owned line therefore names the owner; the anonymous inbound warning is
 * the deliberate exception.
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

const runTitle = (run: MiningRun): string => {
  if (run.status === 'returning') return i18n.t('pendingStrip.drillHome');
  if (run.targetKind === 'debris') return i18n.t('pendingStrip.salvageOut');
  return i18n.t('pendingStrip.drillOut', { index: run.asteroidIndex ?? '—' });
};

const runArrival = (run: MiningRun): number =>
  (run.status === 'returning' ? run.homeAt ?? run.arriveAt : run.arriveAt).getTime();

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
