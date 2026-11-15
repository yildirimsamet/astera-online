import { ClanTag } from '../../ui/ClanTag.js';
import type { ClanTagTier } from '../../api/schemas.js';
import { useTranslation } from 'react-i18next';
import { duration } from '../../lib/time.js';
import type { CountryCode } from '@astera/rules';
import { ATMOSPHERE } from '../../ui/atmosphere.js';
import { AtmosphereImage } from '../../ui/AtmosphereArt.js';
import { Flag } from '../identity/Flag.js';
import { RankingScores } from '../../ui/RankingScores.js';
import { Glyph, artIconSrc, type GlyphId } from '../../game-ui/index.js';

const DAY_MS = 86_400_000;

/**
 * THE AVATAR'S LETTERS: the first of two words, or the first two of one. The mock's
 * "KS". Letters by code point, so a name that opens with "Ş" keeps it whole.
 */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter((word) => word.length > 0);
  const [first, second] = words;
  if (first === undefined) return '?';
  const letters = second === undefined
    ? Array.from(first).slice(0, 2)
    : [Array.from(first)[0] ?? '', Array.from(second)[0] ?? ''];
  return letters.join('').toUpperCase();
}

/** Which day of the season `now` falls on: the first day is day one. */
export function seasonDay(startsAt: number, now: number): number {
  return Math.max(1, Math.floor((now - startsAt) / DAY_MS) + 1);
}

export interface CommanderCardProps {
  name: string;
  country?: CountryCode;
  clan: { tag: string; name: string; tier?: ClanTagTier | null | undefined } | null;
  /** The galaxy's name (`season.shardName`), when there is one. */
  galaxy: string | null;
  /** Null outside a live season. */
  seasonDay: number | null;
  /** Your place on the ladder and how many stand on it; null while unranked. */
  rank: { place: number; of: number } | null;
  honor?: { score: number; dominion: number };
  /** Worlds held against the most a commander can hold (a capital and three colonies). */
  worlds: { held: number; max: number };
  shield: { until: number; kind: 'NEWCOMER' | 'RECOVERY' } | null;
  /** Server time. */
  now: number;
}

/**
 * THE COMMANDER PAGE OPENS ON THE COMMANDER (owner, 2026-09-24).
 *
 * The chip at top left is the mock's avatar, and the mock says what it opens: the
 * profile, the ranking, the rewards and the settings. The sheet had the last three
 * and nothing of the first, so the chip looked like a profile and opened a menu.
 *
 * Three readings, each against what gives it meaning: a place against the field it
 * was taken in, the worlds against the most one commander may hold, the shield as
 * the time until you can be attacked. The name is the sheet's title, just above.
 */
export function CommanderCard({ name, country, clan, galaxy, seasonDay: day, rank, honor, worlds, shield, now }: CommanderCardProps) {
  const { t, i18n } = useTranslation();
  const shieldLeft = shield === null ? 0 : shield.until - now;
  const where = [galaxy, day === null ? null : t('menu.profile.seasonDay', { day })]
    .filter((part): part is string => part !== null)
    .join(' · ');

  const cells: readonly { glyph: GlyphId; label: string; value: string; on?: boolean }[] = [
    { glyph: 'ranking', label: t(honor ? 'leaderboard.honorRank' : 'menu.profile.rank'), value: rank === null ? '—' : `${String(rank.place)} / ${String(rank.of)}` },
    { glyph: 'colony', label: t('menu.profile.worlds'), value: `${String(worlds.held)} / ${String(worlds.max)}` },
    { glyph: 'shield', label: t('menu.profile.shield'), value: shieldLeft > 0 ? duration(shieldLeft / 60_000) : t('menu.profile.shieldNone'), on: shieldLeft > 0 },
  ];

  // The kit's cut plate (C23): the observation room behind, the medallion of the top bar, the readings in glass.
  return (
    <section aria-label={t('menu.profile.label')} data-commander-card className="gk-cut gk-cut--self gk-cmdr">
      <AtmosphereImage art={ATMOSPHERE.commanderRoom} />
      <div className="gk-cmdr__id">
        <span className="gk-medal gk-cmdr__medal" aria-hidden="true">
          <span className="gk-medal__face gk-display">{initials(name)}</span>
          <img className="gk-medal__ring" src={artIconSrc('hud-medallion')} alt="" draggable={false} />
        </span>
        <div className="gk-cmdr__who">
          <span className="gk-cmdr__name">
            {country && <Flag code={country} language={i18n.resolvedLanguage ?? 'en'} className="gk-cmdr__flag" />}
            <span className="gk-display gk-outlined">{name}</span>
          </span>
          {clan === null ? (
            <span className="gk-cmdr__clan gk-cmdr__clan--none">{t('menu.profile.noClan')}</span>
          ) : (
            <span className="gk-cmdr__clan">
              <ClanTag tag={clan.tag} tier={clan.tier} bracket={false} className="gk-cmdr__tag" />
              <span className="gk-cmdr__clanname">{clan.name}</span>
            </span>
          )}
          {where.length > 0 && <span className="gk-cmdr__where">{where}</span>}
        </div>
      </div>
      {honor ? <div className="gk-cmdr__scores"><RankingScores honor={honor.score} dominion={honor.dominion} /></div> : null}
      <dl className="gk-cmdr__cells gk-well">
        {cells.map(({ glyph, label, value, on = false }) => (
          <div key={label} data-cell="" className="gk-cmdr__cell" {...(on ? { 'data-on': '' } : {})}>
            <dt className="gk-label gk-cmdr__label"><Glyph id={glyph} />{label}</dt>
            <dd className="gk-cmdr__value gk-display gk-num">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
