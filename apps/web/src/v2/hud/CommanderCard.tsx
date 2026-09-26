import { useTranslation } from 'react-i18next';
import { duration } from '../../lib/time.js';
import type { CountryCode } from '@astera/rules';
import { Flag } from '../identity/Flag.js';

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
  clan: { tag: string; name: string } | null;
  /** The galaxy's name (`season.shardName`), when there is one. */
  galaxy: string | null;
  /** Null outside a live season. */
  seasonDay: number | null;
  /** Your place on the ladder and how many stand on it; null while unranked. */
  rank: { place: number; of: number } | null;
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
export function CommanderCard({ name, country, clan, galaxy, seasonDay: day, rank, worlds, shield, now }: CommanderCardProps) {
  const { t, i18n } = useTranslation();
  const shieldLeft = shield === null ? 0 : shield.until - now;
  const where = [galaxy, day === null ? null : t('menu.profile.seasonDay', { day })]
    .filter((part): part is string => part !== null)
    .join(' · ');

  const cells: readonly (readonly [string, string])[] = [
    [t('menu.profile.rank'), rank === null ? '—' : `${String(rank.place)} / ${String(rank.of)}`],
    [t('menu.profile.worlds'), `${String(worlds.held)} / ${String(worlds.max)}`],
    [t('menu.profile.shield'), shieldLeft > 0 ? duration(shieldLeft / 60_000) : t('menu.profile.shieldNone')],
  ];

  return (
    <section aria-label={t('menu.profile.label')} data-commander-card className="flex flex-col gap-2 rounded-control border border-v2-line bg-v2-panel p-3 font-v2-ui">
      <div className="flex items-center gap-2.5">
        <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-control border border-v2-self/70 bg-v2-raise text-body font-bold text-v2-ink">
          {initials(name)}
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="flex min-w-0 items-center gap-1.5">
            {country && <Flag code={country} language={i18n.resolvedLanguage ?? 'en'} />}
            <span className="truncate text-caption font-medium text-v2-ink">{name}</span>
          </span>
          {clan === null ? (
            <span className="text-caption text-v2-ink-3">{t('menu.profile.noClan')}</span>
          ) : (
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="shrink-0 rounded-chip border border-v2-ally/60 px-1 font-v2-mono text-micro font-semibold text-v2-ally">{clan.tag}</span>
            <span className="truncate text-caption font-medium text-v2-ink">{clan.name}</span>
            </span>
          )}
          {where.length > 0 && <span className="truncate text-caption text-v2-ink-3">{where}</span>}
        </div>
      </div>
      <dl className="grid grid-cols-3 gap-1.5">
        {cells.map(([label, value]) => (
          <div key={label} className="flex min-w-0 flex-col gap-0.5 rounded-control bg-v2-deep/60 px-2 py-1.5">
            <dt className="truncate text-micro text-v2-ink-3">{label}</dt>
            <dd className="truncate font-v2-mono text-caption font-medium text-v2-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
