import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { SeasonInfo } from '../api/schemas.js';
import { full, signed } from '../lib/format.js';
import { haptic } from '../lib/haptics.js';
import { AttackIcon, ClanIcon, GalaxyIcon, LeaderboardIcon, ShieldedIcon } from '../ui/icons/index.js';
import { NextSeason } from '../ui/NextSeason.js';
import { useOwnPress } from '../ui/kit/index.js';

export type SeasonResult = Exclude<SeasonInfo['result'], null | undefined>;

/** One acknowledgement per person and world, never one global "seen" bit. */
export const seasonRecapKey = (result: SeasonResult): string =>
  `astera:season-recap:${result.accountId}:${result.seasonId}`;

export function seasonRecapSeen(result: SeasonResult): boolean {
  try {
    return window.localStorage.getItem(seasonRecapKey(result)) === 'seen';
  } catch {
    return false;
  }
}

export function rememberSeasonRecap(result: SeasonResult): void {
  try {
    window.localStorage.setItem(seasonRecapKey(result), 'seen');
  } catch {
    // Storage may be unavailable in a private or embedded browser. The record is
    // still reachable; at worst this one ceremonial surface opens again.
  }
}

export function useSeasonRecapOpening(
  status: string | undefined,
  result: SeasonResult | null | undefined,
  onOpen: () => void,
): void {
  const shown = useRef<string | null>(null);
  useEffect(() => {
    if (status !== 'frozen' || !result) return;
    const identity = `${result.accountId}:${result.seasonId}`;
    if (shown.current === identity) return;
    shown.current = identity;
    if (!seasonRecapSeen(result)) onOpen();
  }, [onOpen, result, status]);
}

export function SeasonRecap({
  result,
  galaxy,
  players,
  endsAt,
  canExplore = true,
  onClose,
}: {
  result: SeasonResult;
  galaxy: string;
  players?: number;
  /** When the season froze. The wait before the next galaxy is derived from it. */
  endsAt?: Date | null;
  /**
   * Whether there is still a galaxy behind this screen to go back to.
   *
   * From the game it is the way out: closing lands on the final disc. From the
   * server list there is nothing behind it — the season is gone and the commander
   * is picking a new one — so the same button would promise something that does
   * not exist, and the screen would read as having no way out at all.
   */
  canExplore?: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const close = useCallback((): void => {
    rememberSeasonRecap(result);
    haptic('tap');
    onClose();
  }, [onClose, result]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [close]);

  // The recap covers the screen the moment a season result lands, so its close is
  // another control that can appear under a finger already mid-gesture (D109a).
  const dismiss = useOwnPress(close);

  const title =
    result.finalRank === 1
      ? t('seasonRecap.titles.sovereign', { galaxy })
      : result.finalRank <= 3
        ? t('seasonRecap.titles.vanguard')
        : result.dominion > 0
          ? t('seasonRecap.titles.conqueror')
          : t('seasonRecap.titles.commander');
  const quiet = result.recap.battles === 0;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-void/95"
      role="dialog"
      aria-modal="true"
      aria-labelledby="season-recap-title"
    >
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(89,200,255,0.16),transparent_34%),radial-gradient(circle_at_18%_72%,rgba(90,211,155,0.08),transparent_30%)]" />
      <main className="relative mx-auto flex min-h-dvh w-full max-w-xl flex-col px-4 pb-[calc(22px+env(safe-area-inset-bottom))] pt-[calc(28px+env(safe-area-inset-top))]">
        <button
          type="button"
          aria-label={t('seasonRecap.close')}
          {...dismiss}
          className="absolute right-3 top-[calc(20px+env(safe-area-inset-top))] flex size-11 items-center justify-center rounded-chip text-figure leading-none text-faint hover:bg-raised hover:text-bone"
        >
          &times;
        </button>

        <header className="text-center">
          <GalaxyIcon className="mx-auto size-8 text-crystal drop-shadow-[0_0_12px_var(--color-crystal-glow)]" />
          <p className="legend mt-4 text-crystal">{t('seasonRecap.eyebrow')}</p>
          <p className="legend mt-1">
            {t('seasonRecap.finalRecord', { galaxy })}
          </p>
          <h1
            id="season-recap-title"
            className="headline mt-6 text-hero"
          >
            {title}
          </h1>
          <p className="mt-3 text-body text-dim">
            {t('seasonRecap.planet', {
              commander: result.recap.commanderName,
              planet: result.recap.planetName,
            })}
          </p>
        </header>

        <section className="mt-8 grid grid-cols-2 gap-3" aria-label={t('seasonRecap.finalRecord', { galaxy })}>
          <HeroFigure
            icon={<LeaderboardIcon className="size-5" />}
            label={
              players === undefined
                ? t('seasonRecap.rankAlone', { rank: result.finalRank })
                : t('seasonRecap.rank', { rank: result.finalRank, players })
            }
            value={`#${full(result.finalRank)}`}
          />
          <HeroFigure
            icon={<GalaxyIcon className="size-5" />}
            label={t('seasonRecap.dominion')}
            value={signed(result.dominion)}
          />
        </section>

        <section className="plate plate-cut mt-3 grid grid-cols-3 divide-x divide-line-soft px-2 py-4">
          <Figure label={t('seasonRecap.battles')} value={full(result.recap.battles)} />
          <Figure label={t('seasonRecap.attacks')} value={full(result.recap.attacks)} />
          <Figure label={t('seasonRecap.defences')} value={full(result.recap.defences)} />
        </section>

        <section className="mt-3 grid grid-cols-2 gap-3">
          <SmallFigure
            icon={<AttackIcon className="size-4 text-alert" />}
            label={t('seasonRecap.damageDealt')}
            value={full(result.damageDealt)}
          />
          <SmallFigure
            icon={<ShieldedIcon className="size-4 text-crystal" />}
            label={t('seasonRecap.damageTaken')}
            value={full(result.damageTaken)}
          />
        </section>

        {result.recap.clan ? (
          <section className="plate plate-cut mt-3 px-4 py-4" aria-label={t('seasonRecap.clan.heading')}>
            <div className="flex items-start gap-3">
              <span className="socket grid size-10 shrink-0 place-items-center rounded-control text-crystal">
                <ClanIcon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="legend text-crystal">{t('seasonRecap.clan.heading')}</p>
                <p className="name mt-1 truncate text-bone">
                  <span className="text-crystal">[{result.recap.clan.tag}]</span>{' '}
                  {result.recap.clan.name}
                </p>
              </div>
              {result.recap.clan.topThree ? (
                <span className="chip chip-opportunity shrink-0">{t('seasonRecap.clan.seal')}</span>
              ) : null}
            </div>
            <div className="mt-4 grid grid-cols-2 divide-x divide-line-soft">
              <Figure label={t('seasonRecap.clan.rank')} value={`#${full(result.recap.clan.finalRank)}`} />
              <Figure
                label={t('seasonRecap.clan.dominion')}
                value={result.recap.clan.dominion === 0 ? full(0) : signed(result.recap.clan.dominion)}
              />
            </div>
            <p className="mt-4 text-label leading-relaxed text-faint">{t('seasonRecap.clan.recordOnly')}</p>
          </section>
        ) : null}

        {quiet ? (
          <Story
            heading={t('seasonRecap.quietHeading')}
            body={t('seasonRecap.quietBody')}
          />
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {result.recap.rival && (
              <Story
                heading={t('seasonRecap.rivalHeading')}
                body={t('seasonRecap.rival', {
                  name: result.recap.rival.commanderName,
                  count: result.recap.rival.battles,
                })}
              />
            )}
            {result.recap.biggestRaid && (
              <Story
                heading={t('seasonRecap.biggestHeading')}
                body={t('seasonRecap.biggestRaid', {
                  value: full(result.recap.biggestRaid.value),
                  name: result.recap.biggestRaid.opponentName,
                })}
              />
            )}
          </div>
        )}

        <NextSeason endsAt={endsAt} className="mt-6" />

        <button type="button" className="slab slab-primary mt-auto w-full pt-4" onClick={close}>
          {t(canExplore ? 'seasonRecap.explore' : 'seasonRecap.close')}
        </button>
      </main>
    </div>
  );
}

function HeroFigure({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="plate plate-cut flex min-h-28 flex-col items-center justify-center px-3 py-4 text-center">
      <span className="text-crystal">{icon}</span>
      <p className="readout mt-2 text-readout text-bone">{value}</p>
      <p className="legend mt-1">{label}</p>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2 text-center">
      <p className="readout text-figure text-bone">{value}</p>
      <p className="legend mt-1">{label}</p>
    </div>
  );
}

function SmallFigure({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="plate flex items-center gap-3 px-3 py-3">
      {icon}
      <div className="min-w-0">
        <p className="legend">{label}</p>
        <p className="readout mt-1 text-title text-bone">{value}</p>
      </div>
    </div>
  );
}

function Story({ heading, body }: { heading: string; body: string }) {
  return (
    <div className="plate mt-3 px-4 py-3 sm:mt-0">
      <p className="legend text-opportunity">{heading}</p>
      <p className="mt-1 text-body leading-relaxed text-bone">{body}</p>
    </div>
  );
}
