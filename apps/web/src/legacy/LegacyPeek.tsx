/**
 * THE SMALL SHOWCASE: what a commander chose to be seen with, opened from their name on the
 * map. One glance answers "who is this": the title they wear, the six pieces on their shelf,
 * the best place they ever reached and how their last seasons went — and one tap more opens
 * the whole Legacy. It reads only the public profile; nothing about the world under the name.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LEGACY_SHOWCASE_SLOTS } from '@astera/rules';
import type { LegacyAward } from '../api/legacySchemas.js';
import { Sheet } from '../v2/kit/Sheet.js';
import { Button } from '../v2/kit/Surface.js';
import { Flag } from '../v2/identity/Flag.js';
import { ATMOSPHERE } from '../ui/atmosphere.js';
import { full } from '../lib/format.js';
import { AwardPicture } from './AwardTile.js';
import { AwardSheet } from './AwardSheet.js';
import { LegacyProfileView, PodiumPlace } from './LegacyProfile.js';
import { legacyAwardTitle, legacyEditionLabel } from './presentation.js';
import { useLegacyProfile, useLegacySeasons, type LegacySource } from './queries.js';
import { useLegacyDialogFocus } from './useLegacyDialogFocus.js';

/** Seasons shown under the shelf; the whole history is one tap away. */
const RECENT_SEASONS = 2;

export function LegacyPeek({ source, name, onClose, onOpenProfile }: {
  source: LegacySource;
  /** The name it was opened from, shown while the profile loads. */
  name: string;
  onClose: () => void;
  onOpenProfile: () => void;
}) {
  const { t, i18n } = useTranslation();
  const focus = useLegacyDialogFocus();
  const profile = useLegacyProfile(source);
  const data = profile.data;
  const seasons = useLegacySeasons(data?.publicId ?? null);
  const recent = seasons.data?.pages[0]?.seasons.slice(0, RECENT_SEASONS) ?? [];
  const [open, setOpen] = useState<LegacyAward | null>(null);
  const slots = Array.from({ length: LEGACY_SHOWCASE_SLOTS }, (_, slot) => data?.showcase.find(row => row.slot === slot)?.award ?? null);

  return (
    <Sheet placement="card" detents={['fit']} headerArt={ATMOSPHERE.legacy} eyebrow={t('legacy.title')}
      title={data?.commanderName ?? name} onClose={onClose}>
      <div ref={focus} tabIndex={-1} data-legacy-peek className="flex flex-col gap-3 pb-1 font-v2-ui text-v2-ink outline-none">
        {profile.isError ? <p role="alert" className="text-caption text-v2-hostile">{t('legacy.profile.failed')}</p>
          : !data ? <p role="status" className="text-caption text-v2-ink-2">{t('legacy.profile.loading')}</p>
          : <>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {data.country && <Flag code={data.country} language={i18n.resolvedLanguage ?? 'en'} size="small" />}
              {data.activeTitle && (
                <span className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-chip border border-v2-premium/45 bg-v2-void/55 px-2 py-0.5 text-micro font-semibold text-v2-premium">
                  <svg aria-hidden="true" viewBox="0 0 12 12" className="size-3 shrink-0"><path fill="currentColor" d="M6 .8l1.5 3.3 3.6.4-2.7 2.4.8 3.5L6 8.6 2.8 10.4l.8-3.5L.9 4.5l3.6-.4z" /></svg>
                  <span className="truncate">{legacyAwardTitle(data.activeTitle)}</span>
                </span>
              )}
              <span className="font-v2-mono text-micro text-v2-ink-2">
                {t('legacy.peek.summary', { seasons: full(data.career.seasons), pieces: full(data.collection.count) })}
              </span>
            </div>

            <section aria-label={t('legacy.shelf.heading')} className="flex flex-col gap-1.5">
              <h3 className="v2-legend">{t('legacy.shelf.heading')}</h3>
              <ul aria-label={t('legacy.shelf.heading')} className="legacy-peek-shelf legacy-peek-grid grid grid-cols-3 items-end gap-x-2 gap-y-3 rounded-control px-2 pb-3 pt-2">
                {slots.map((award, slot) => (
                  <li key={award?.id ?? `empty-${String(slot)}`} className="relative grid min-w-0 place-items-end justify-items-center">
                    {award ? (
                      <button type="button" data-legacy-peek-piece data-rarity={award.rarity} onClick={() => { setOpen(award); }}
                        aria-label={[legacyAwardTitle(award), legacyEditionLabel(award)].filter(Boolean).join(' · ')}
                        className="flex w-full min-w-0 flex-col items-center rounded-chip focus-visible:outline-2 focus-visible:outline-v2-self">
                        <span className="legacy-peek-piece relative grid aspect-square w-full place-items-center">
                          <AwardPicture award={award} className="relative z-[1] size-full" />
                        </span>
                        <span aria-hidden="true" className="legacy-rarity-text line-clamp-2 min-h-[2.3em] px-0.5 text-center text-micro font-semibold leading-tight">
                          {legacyAwardTitle(award)}
                        </span>
                        <span aria-hidden="true" className="min-h-[1.15em] font-v2-mono text-micro leading-tight text-v2-ink-2">{legacyEditionLabel(award)}</span>
                      </button>
                    ) : <span aria-hidden="true" className="grid aspect-square w-full place-items-center"><span className="legacy-peek-socket h-1 w-3/5 rounded-full" /></span>}
                  </li>
                ))}
              </ul>
              {data.showcase.length === 0 && (
                <p className="text-label text-v2-ink-2">{data.self ? t('legacy.shelf.emptySelf') : t('legacy.shelf.emptyOther')}</p>
              )}
            </section>

            <div className="grid grid-cols-2 gap-2 rounded-control border border-v2-line bg-v2-panel px-3 py-2">
              <PodiumPlace rank={data.career.bestHonorRank} label={t('legacy.stats.bestHonor')} />
              <PodiumPlace rank={data.career.bestDominionRank} label={t('legacy.stats.bestDominion')} />
            </div>

            {recent.length > 0 && (
              <section aria-label={t('legacy.peek.recent')} className="flex flex-col gap-1">
                <h3 className="v2-legend">{t('legacy.peek.recent')}</h3>
                <ol className="divide-y divide-v2-line overflow-hidden rounded-control border border-v2-line bg-v2-panel">
                  {recent.map(season => {
                    const honor = season.honorScore !== null && season.honorScore > 0 ? season.honorRank : null;
                    const dominion = season.dominion > 0 ? season.dominionRank : null;
                    const place = (label: string, rank: number | null) => `${label} ${rank === null ? '—' : `#${String(rank)}`}`;
                    return (
                      <li key={season.resultId} className="flex items-baseline justify-between gap-2 px-3 py-1.5 text-caption">
                        <span className="min-w-0 truncate">
                          <span className="font-semibold">{t('legacy.seasons.ordinal', { ordinal: season.ordinal })}</span>
                          <span className="text-v2-ink-3"> · {season.galaxy}</span>
                        </span>
                        <span className="shrink-0 font-v2-mono text-micro text-v2-ink-2">
                          {place(t('legacy.seasons.honor'), honor)} · {place(t('legacy.peek.dominionShort'), dominion)}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </section>
            )}

            <Button variant="primary" full onClick={onOpenProfile}>{t('legacy.profile.full')}</Button>
          </>}
      </div>
      {open && data && <AwardSheet profile={data} award={open} onClose={() => { setOpen(null); }} />}
    </Sheet>
  );
}

/** The whole Legacy of any commander, as a page over the galaxy. */
export function LegacyProfileSheet({ source, name, onClose }: { source: LegacySource; name: string; onClose: () => void }) {
  const { t } = useTranslation();
  const focus = useLegacyDialogFocus();
  const profile = useLegacyProfile(source);
  return (
    <Sheet detents={['full']} headerArt={ATMOSPHERE.legacy} eyebrow={profile.data?.commanderName ?? name} title={t('legacy.title')} onClose={onClose}>
      <div ref={focus} tabIndex={-1} className="outline-none">
      {profile.data ? <LegacyProfileView profile={profile.data} />
        : profile.isError ? <p role="alert" className="text-caption text-v2-hostile">{t('legacy.profile.failed')}</p>
        : <p role="status" className="text-caption text-v2-ink-2">{t('legacy.profile.loading')}</p>}
      </div>
    </Sheet>
  );
}

/** Name on the map → small showcase → whole profile, as one flow the galaxy opens. */
export function CommanderLegacy({ source, name, onClose }: { source: LegacySource; name: string; onClose: () => void }) {
  const [whole, setWhole] = useState(false);
  return whole
    ? <LegacyProfileSheet source={source} name={name} onClose={onClose} />
    : <LegacyPeek source={source} name={name} onClose={onClose} onOpenProfile={() => { setWhole(true); }} />;
}

/**
 * YOUR OWN LEGACY, AT THE TOP OF THE ACCOUNT PAGE: the title you wear, the six pieces on your
 * shelf in a row and one tap into the whole profile. Empty sockets are drawn, because an empty
 * shelf is the reason to go and fill it.
 */
export function LegacyEntryCard({ onOpen }: { onOpen: () => void }) {
  const { t } = useTranslation();
  const data = useLegacyProfile({ kind: 'me' }).data;
  const slots = Array.from({ length: LEGACY_SHOWCASE_SLOTS }, (_, slot) => data?.showcase.find(row => row.slot === slot)?.award ?? null);
  return (
    <button type="button" onClick={onOpen} aria-label={t('legacy.profile.mine')} data-legacy-entry
      className="legacy-entry relative flex flex-col gap-2 overflow-hidden rounded-control border border-v2-premium/35 p-3 text-left focus-visible:outline-2 focus-visible:outline-v2-self"
      style={{ ['--legacy-entry-art' as string]: `url(${ATMOSPHERE.commander.src})` }}>
      <span className="flex items-start justify-between gap-2">
        <span className="min-w-0">
          <span className="v2-legend block text-v2-premium">{t('legacy.title')}</span>
          {data?.activeTitle
            ? <span className="mt-0.5 block truncate text-caption font-semibold">{legacyAwardTitle(data.activeTitle)}</span>
            : <span className="mt-0.5 block text-label text-v2-ink-2">{t('legacy.noTitle')}</span>}
        </span>
        {data && (
          <span className="shrink-0 font-v2-mono text-micro text-v2-ink-2">
            {t('legacy.peek.summary', { seasons: full(data.career.seasons), pieces: full(data.collection.count) })}
          </span>
        )}
      </span>
      <span aria-hidden="true" className="legacy-peek-shelf grid grid-cols-6 items-end gap-1 rounded-control px-1.5 pb-2.5 pt-2">
        {slots.map((award, slot) => (
          <span key={award?.id ?? `empty-${String(slot)}`} className="relative grid aspect-[4/5] place-items-end justify-items-center">
            {award
              ? <span data-rarity={award.rarity} className="legacy-peek-piece grid size-full place-items-end justify-items-center"><AwardPicture award={award} className="relative z-[1] size-full" /></span>
              : <span className="legacy-peek-socket mb-0.5 h-1 w-3/5 rounded-full" />}
          </span>
        ))}
      </span>
      <span className="flex items-center justify-between text-label font-semibold text-v2-premium">
        {t('legacy.profile.mine')}
        <svg aria-hidden="true" viewBox="0 0 12 12" className="size-3"><path fill="none" stroke="currentColor" strokeWidth="1.6" d="M4.5 2.5 8 6l-3.5 3.5" /></svg>
      </span>
    </button>
  );
}
