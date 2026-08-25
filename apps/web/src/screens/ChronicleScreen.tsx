import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useChronicle } from '../api/queries.js';
import { chatRelativeTime } from '../lib/chatTime.js';
import { haptic } from '../lib/haptics.js';
import { useNow } from '../lib/time.js';
import {
  AlloyIcon,
  CoreIcon,
  DrillIcon,
  GalaxyIcon,
  LeaderboardIcon,
  PlanetIcon,
} from '../ui/icons/index.js';
import { Button, EmptyState } from '../ui/kit/index.js';
import { Unreachable, Waiting } from '../ui/kit/index.js';

const GROUP_MS = 8 * 60_000;

export function ChronicleScreen({
  onFocusPlanet,
  focusablePlanetIds,
}: {
  onFocusPlanet: (planetId: string) => void;
  /** Omit in isolated surfaces; the live galaxy passes this to avoid dead links. */
  focusablePlanetIds?: readonly string[];
}) {
  const { t } = useTranslation();
  const chronicle = useChronicle();
  const now = useNow(30_000);
  /**
   * A RUN OF THE SAME THING IS ONE ROW WITH A COUNT. `interface.md` I4.
   *
   * The rule was written for Signals and implemented here for exactly one kind —
   * bombardment — so a galaxy in which several Death Stars landed inside a few
   * minutes printed the same headline and the same twelve-word sentence seven
   * times down a phone. Everything after the first row was the reader learning
   * nothing. Any kind folds now, against the same subject and the same window.
   */
  const events = useMemo(() => {
    const rows = (chronicle.data?.pages ?? []).flatMap((page) => page.events);
    const grouped: { event: (typeof rows)[number]; count: number }[] = [];
    for (const event of rows) {
      const previous = grouped.find((entry) =>
        entry.event.kind === event.kind
        && entry.event.subjectPlanetId === event.subjectPlanetId
        && entry.event.occurredAt.getTime() - event.occurredAt.getTime() <= GROUP_MS);
      if (previous) previous.count += 1;
      else grouped.push({ event, count: 1 });
    }
    return grouped;
  },
    [chronicle.data?.pages],
  );

  if (chronicle.isError) {
    return <Unreachable what={t('surface.whatChronicle')} onRetry={() => { void chronicle.refetch(); }} />;
  }
  if (!chronicle.data) return <Waiting>{t('surface.waitingChronicle')}</Waiting>;

  return (
    <div role="log" aria-label={t('chronicle.list')} aria-live="polite" className="py-2">
      {events.length === 0 ? (
        <div className="py-6"><EmptyState title={t('chronicle.empty')} /></div>
      ) : (
        <ol className="divide-y divide-line-soft">
          {events.map(({ event, count }) => {
            let title: string;
            let detail: string;
            let tone = 'border-opportunity/35 text-opportunity';
            let icon = <GalaxyIcon className="size-4" />;
            switch (event.kind) {
              case 'bombardment':
                title = t(count > 1 ? 'chronicle.bombardmentGrouped' : 'chronicle.bombardment', {
                  planet: event.payload.planetName,
                  count,
                });
                detail = t('chronicle.bombardmentDetail', { commander: event.payload.commanderName });
                tone = 'border-threat/35 text-threat';
                icon = <PlanetIcon className="size-4" />;
                break;
              case 'core_tier':
                title = t('chronicle.coreTier', { planet: event.payload.planetName, tier: event.payload.tier });
                detail = t('chronicle.coreTierDetail', { commander: event.payload.commanderName });
                icon = <CoreIcon className="size-4" />;
                break;
              case 'isotope_exhausted':
                title = t('chronicle.isotopeExhausted', { number: event.payload.asteroidIndex });
                detail = t('chronicle.isotopeExhaustedDetail');
                icon = <DrillIcon className="size-4" />;
                break;
              case 'wreck_formed':
                title = t('chronicle.wreckFormed', { planet: event.payload.planetName });
                detail = t('chronicle.wreckFormedDetail');
                icon = <AlloyIcon className="size-4" />;
                break;
              case 'wreck_exhausted':
                title = t('chronicle.wreckExhausted', { planet: event.payload.planetName });
                detail = t('chronicle.wreckExhaustedDetail');
                icon = <AlloyIcon className="size-4" />;
                break;
              case 'dominion_leader':
                title = t('chronicle.dominionLeader', { commander: event.payload.commanderName });
                detail = t('chronicle.dominionLeaderDetail', { planet: event.payload.planetName });
                icon = <LeaderboardIcon className="size-4" />;
                break;
              case 'season_act':
                title = t(`chronicle.act.${event.payload.act}.title`);
                detail = t(`chronicle.act.${event.payload.act}.detail`);
                break;
              case 'neutral_claim':
                title = t('chronicle.neutralClaim', {
                  planet: event.payload.planetName,
                  tier: event.payload.tier,
                });
                detail = t('chronicle.neutralClaimDetail');
                icon = <PlanetIcon className="size-4" />;
                break;
              case 'death_star_impact':
                title = t('chronicle.deathStarImpact', { planet: event.payload.planetName });
                detail = t(`chronicle.deathStarOutcome.${
                  event.payload.outcome === 'FIRST_STRIKE' && !event.payload.capturable
                    ? 'CAPITAL_STRIKE'
                    : event.payload.outcome
                }`);
                tone = 'border-threat/35 text-threat';
                icon = <PlanetIcon className="size-4" />;
                break;
              case 'control_transfer':
                title = t('chronicle.controlTransfer', { planet: event.payload.planetName });
                detail = t('chronicle.controlTransferDetail', {
                  commander: event.payload.commanderName,
                });
                icon = <CoreIcon className="size-4" />;
                break;
            }
            const focus = event.subjectPlanetId
                && (!focusablePlanetIds || focusablePlanetIds.includes(event.subjectPlanetId))
                ? () => { onFocusPlanet(event.subjectPlanetId!); }
                : null;
            return (
              <li key={event.id} className="flex gap-3 px-4 py-3">
                <div className={`mt-1 grid size-9 shrink-0 place-items-center rounded-full border ${tone}`}>
                  {icon}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  {/*
                    WHEN sits on the headline's own line rather than under the
                    body. It is the second thing read on every row of a log and it
                    was the last, three lines down, in the faintest ink on screen.
                  */}
                  <div className="flex items-baseline gap-2">
                    {focus ? (
                      <button
                        type="button"
                        onClick={() => {
                          haptic('tap');
                          focus();
                        }}
                        className="name min-w-0 flex-1 text-left text-bone underline decoration-transparent underline-offset-2 transition-colors hover:decoration-bone/40"
                      >
                        {title}
                      </button>
                    ) : <p className="name min-w-0 flex-1 text-bone">{title}</p>}
                    {count > 1 && (
                      <span className="chip shrink-0" aria-label={t('chronicle.repeatCount', { count })}>
                        ×{count}
                      </span>
                    )}
                    <time
                      className="num shrink-0 text-micro text-faint"
                      dateTime={event.occurredAt.toISOString()}
                    >
                      {chatRelativeTime(event.occurredAt, now, t)}
                    </time>
                  </div>
                  <p className="text-caption leading-snug text-dim">{detail}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {chronicle.hasNextPage && (
        <div className="px-4 pt-4 text-center">
          <Button size="sm" variant="ghost" disabled={chronicle.isFetchingNextPage} onClick={() => { void chronicle.fetchNextPage(); }}>
            {chronicle.isFetchingNextPage ? t('chronicle.loadingOlder') : t('chronicle.older')}
          </Button>
        </div>
      )}
    </div>
  );
}
