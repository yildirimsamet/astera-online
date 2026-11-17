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
import { Flag } from '../v2/identity/Flag.js';
import { ATMOSPHERE } from '../ui/atmosphere.js';
import { full } from '../lib/format.js';
import { AwardPicture } from './AwardTile.js';
import { AwardSheet } from './AwardSheet.js';
import { LegacyProfileView, PodiumPlace } from './LegacyProfile.js';
import { legacyAwardTitle, legacyEditionLabel } from './presentation.js';
import { useLegacyProfile, useLegacySeasons, type LegacySource } from './queries.js';
import { useLegacyDialogFocus } from './useLegacyDialogFocus.js';
import { Banner, GameButton, Glyph, SectionTag, artIconSrc } from '../game-ui/index.js';
import type { CssVars } from '../game-ui/style.js';
import { haptic } from '../lib/haptics.js';
import { OWN_SOUND, playSound } from '../lib/sound.js';
import { useOwnPress } from '../ui/kit/useOwnPress.js';

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
    <Sheet placement="card" detents={['fit']} kit={{ art: artIconSrc('trophy') }} eyebrow={t('legacy.title')}
      title={data?.commanderName ?? name} onClose={onClose}>
      <div ref={focus} tabIndex={-1} data-legacy-peek className="gk-legacy gk-peek">
        {profile.isError ? <Banner tone="hostile" role="alert" title={t('legacy.profile.failed')} />
          : !data ? <p role="status" className="gk-legacy__note">{t('legacy.profile.loading')}</p>
          : <>
            <div className="gk-peek__who">
              {data.country && <Flag code={data.country} language={i18n.resolvedLanguage ?? 'en'} size="small" />}
              {data.activeTitle && <span className="gk-legacy__title"><Glyph id="star" /><span>{legacyAwardTitle(data.activeTitle)}</span></span>}
              <span className="gk-legacy__count gk-num">
                {t('legacy.peek.summary', { seasons: full(data.career.seasons), pieces: full(data.collection.count) })}
              </span>
            </div>

            <section aria-label={t('legacy.shelf.heading')} className="gk-legacy__part">
              <SectionTag as="h3">{t('legacy.shelf.heading')}</SectionTag>
              <ul aria-label={t('legacy.shelf.heading')} className="legacy-peek-shelf legacy-peek-grid gk-peek__shelf">
                {slots.map((award, slot) => (
                  <li key={award?.id ?? `empty-${String(slot)}`} className="gk-peek__slot">
                    {award ? <PeekPiece award={award} onOpen={() => { setOpen(award); }} />
                      : <span aria-hidden="true" className="gk-peek__empty"><span className="legacy-peek-socket" /></span>}
                  </li>
                ))}
              </ul>
              {data.showcase.length === 0 && (
                <p className="gk-legacy__note">{data.self ? t('legacy.shelf.emptySelf') : t('legacy.shelf.emptyOther')}</p>
              )}
            </section>

            <div className="gk-legacy__places gk-well gk-peek__best">
              <PodiumPlace rank={data.career.bestHonorRank} label={t('legacy.stats.bestHonor')} />
              <PodiumPlace rank={data.career.bestDominionRank} label={t('legacy.stats.bestDominion')} />
            </div>

            {recent.length > 0 && (
              <section aria-label={t('legacy.peek.recent')} className="gk-legacy__part">
                <SectionTag as="h3">{t('legacy.peek.recent')}</SectionTag>
                <ol className="gk-well gk-peek__seasons">
                  {recent.map(season => {
                    const honor = season.honorScore !== null && season.honorScore > 0 ? season.honorRank : null;
                    const dominion = season.dominion > 0 ? season.dominionRank : null;
                    const place = (label: string, rank: number | null) => `${label} ${rank === null ? '—' : `#${String(rank)}`}`;
                    return (
                      <li key={season.resultId} className="gk-peek__season">
                        <span className="gk-peek__seasonname">
                          <strong>{t('legacy.seasons.ordinal', { ordinal: season.ordinal })}</strong>
                          <span> · {season.galaxy}</span>
                        </span>
                        <span className="gk-peek__seasonplaces gk-num">
                          {place(t('legacy.seasons.honor'), honor)} · {place(t('legacy.peek.dominionShort'), dominion)}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </section>
            )}

            <GameButton tone="action" size="lg" wide glyph="next" onPress={onOpenProfile}>{t('legacy.profile.full')}</GameButton>
          </>}
      </div>
      {open && data && <AwardSheet profile={data} award={open} onClose={() => { setOpen(null); }} />}
    </Sheet>
  );
}

/** A piece on the small shelf: its picture on its rarity's pool of light, its name in its metal. */
function PeekPiece({ award, onOpen }: { award: LegacyAward; onOpen: () => void }) {
  const own = useOwnPress(() => { playSound('tap'); haptic('tap'); onOpen(); });
  const edition = legacyEditionLabel(award);
  return (
    <button type="button" {...OWN_SOUND} onPointerDown={own.onPointerDown} onClick={own.onClick}
      data-legacy-peek-piece data-rarity={award.rarity}
      aria-label={[legacyAwardTitle(award), edition].filter(Boolean).join(' · ')} className="gk-peek__piece">
      <span className="legacy-peek-piece gk-peek__art">
        <AwardPicture award={award} className="gk-peek__pic" />
      </span>
      <span aria-hidden="true" className="legacy-rarity-text gk-peek__name">{legacyAwardTitle(award)}</span>
      <span aria-hidden="true" className="gk-peek__edition gk-num">{edition}</span>
    </button>
  );
}

/** The whole Legacy of any commander, as a page over the galaxy. */
export function LegacyProfileSheet({ source, name, onClose }: { source: LegacySource; name: string; onClose: () => void }) {
  const { t } = useTranslation();
  const focus = useLegacyDialogFocus();
  const profile = useLegacyProfile(source);
  return (
    <Sheet detents={['full']} kit={{ art: artIconSrc('trophy') }} eyebrow={profile.data?.commanderName ?? name} title={t('legacy.title')} onClose={onClose}>
      <div ref={focus} tabIndex={-1} className="outline-none">
      {profile.data ? <LegacyProfileView profile={profile.data} />
        : profile.isError ? <Banner tone="hostile" role="alert" title={t('legacy.profile.failed')} />
        : <p role="status" className="gk-legacy__note">{t('legacy.profile.loading')}</p>}
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
 * shelf is the reason to go and fill it. On the kit since C23: a gold-rimmed plate, one press.
 */
export function LegacyEntryCard({ onOpen }: { onOpen: () => void }) {
  const { t } = useTranslation();
  const data = useLegacyProfile({ kind: 'me' }).data;
  const slots = Array.from({ length: LEGACY_SHOWCASE_SLOTS }, (_, slot) => data?.showcase.find(row => row.slot === slot)?.award ?? null);
  const own = useOwnPress(() => { playSound('tap'); haptic('tap'); onOpen(); });
  const art: CssVars = { '--legacy-entry-art': `url(${ATMOSPHERE.commander.src})` };
  return (
    <button type="button" {...OWN_SOUND} aria-label={t('legacy.profile.mine')} data-legacy-entry className="gk-legacydoor" style={art}
      onPointerDown={own.onPointerDown} onClick={own.onClick}>
      <span className="gk-legacydoor__head">
        <span className="gk-label gk-legacydoor__eyebrow">{t('legacy.title')}</span>
        {data?.activeTitle
          ? <span className="gk-legacydoor__title">{legacyAwardTitle(data.activeTitle)}</span>
          : <span className="gk-legacydoor__title gk-legacydoor__title--none">{t('legacy.noTitle')}</span>}
        {data && (
          <span className="gk-legacydoor__count gk-num">
            {t('legacy.peek.summary', { seasons: full(data.career.seasons), pieces: full(data.collection.count) })}
          </span>
        )}
      </span>
      <span aria-hidden="true" className="legacy-peek-shelf gk-legacydoor__shelf">
        {slots.map((award, slot) => (
          <span key={award?.id ?? `empty-${String(slot)}`} className="gk-legacydoor__slot">
            {award
              ? <span data-rarity={award.rarity} className="legacy-peek-piece gk-legacydoor__piece"><AwardPicture award={award} className="gk-legacydoor__art" /></span>
              : <span className="legacy-peek-socket gk-legacydoor__socket" />}
          </span>
        ))}
      </span>
      <span className="gk-legacydoor__go">
        {t('legacy.profile.mine')}
        <Glyph id="next" />
      </span>
    </button>
  );
}
