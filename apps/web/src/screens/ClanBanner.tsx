import { CLAN_PERK_LADDER, type ClanPerkRung } from '@astera/rules';
import { PerkArt } from '../ui/PerkArt.js';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useClanLedger, useClanWarActions } from '../api/queries.js';
import type { ClanLedger, ClanWar } from '../api/schemas.js';
import { describeError } from '../i18n/errors.js';
import { compact, full } from '../lib/format.js';
import { haptic } from '../lib/haptics.js';
import { playSound } from '../lib/sound.js';
import { RESOURCE_ART } from '../ui/assets.js';
import { HoldButton } from '../v2/kit/HoldButton.js';
import { Button, Plate } from '../v2/kit/Surface.js';

const RESOURCE_KEYS = ['alloy', 'crystal', 'deuterium'] as const;
const FILL = { alloy: 'bg-v2-alloy', crystal: 'bg-v2-crystal', deuterium: 'bg-v2-deut' } as const;
const EMPTY = { alloy: 'bg-v2-alloy/15', crystal: 'bg-v2-crystal/15', deuterium: 'bg-v2-deut/15' } as const;
const TOP = CLAN_PERK_LADDER.length;

type Resources = ClanWar['treasury'];
const sum = (r: Resources): number => r.alloy + r.crystal + r.deuterium;

/** The perk a rung opens, in the player's words: a name and what it changes. */
function usePerkCopy() {
  const { t } = useTranslation();
  return {
    title: (rung: ClanPerkRung): string => t(`clanWar.perk.${rung.perk}.title`, { value: rung.value, pct: Math.round(rung.value * 100) }),
    body: (rung: ClanPerkRung): string => t(`clanWar.perk.${rung.perk}.body`, { value: rung.value, pct: Math.round(rung.value * 100) }),
  };
}

/**
 * KLAN SANCAĞI (F2 P1, owner 2026-11-10). The clan level as a banner of ten notches: every open
 * perk glows, the next one says what it opens and how full the purse is, and a tap on any notch
 * explains its rung. The leader raises it with a hold; the new notch lights with a sound and a
 * thud. At the top the banner turns gold. Under it, the Katkı Defteri: who carries the clan.
 */
export function ClanBanner({ war, role, selfPlayerId, canGive, onDonate }: {
  war: ClanWar;
  role: 'LEADER' | 'MEMBER';
  selfPlayerId?: string | undefined;
  canGive: boolean;
  onDonate: () => void;
}) {
  const { t } = useTranslation();
  const copy = usePerkCopy();
  const actions = useClanWarActions();
  const ledger = useClanLedger();
  const level = war.level ?? 1;
  const gold = level >= TOP;
  const [picked, setPicked] = useState<number | null>(null);
  const [raised, setRaised] = useState<number | null>(null);
  const shown = picked ?? Math.min(TOP, level + 1);
  const rung = CLAN_PERK_LADDER[shown - 1];
  const state = (at: number): 'open' | 'next' | 'locked' => at <= level ? 'open' : at === level + 1 ? 'next' : 'locked';
  const need = war.nextCost ? sum(war.nextCost) : 0;
  const purse = need > 0 ? Math.min(100, Math.round((sum(war.treasury) / need) * 100)) : 100;
  const open = CLAN_PERK_LADDER.filter((step) => step.level <= level)
    // A corridor rung replaces the one below it: list each perk once, at its highest rung.
    .filter((step, _i, all) => all.filter((other) => other.perk === step.perk).at(-1) === step);

  const raise = (): void => {
    actions.upgrade.mutate(level, {
      onSuccess: () => {
        haptic('thunk');
        playSound('claim');
        setRaised(level + 1);
        setPicked(level + 1);
      },
    });
  };

  return (
    <Plate className="flex flex-col gap-3 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-caption font-semibold text-v2-ink">{t('clanWar.banner')}</h3>
        <span className={`font-v2-mono text-micro ${gold ? 'text-v2-premium' : 'text-v2-self'}`}>{t('clanWar.level', { level })}</span>
      </div>

      <div className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-3">
        {/* The banner: a hanging cloth, ten notches from the hem (1) to the pole (10). */}
        <div data-banner="" data-gold={String(gold)} className="relative flex flex-col items-center">
          <span aria-hidden="true" className={`h-1 w-full rounded-full ${gold ? 'bg-v2-premium' : 'bg-v2-line-hi'}`} />
          <ol className={`relative flex w-10 flex-col-reverse gap-0.5 px-1 pb-4 pt-1 ${gold
            ? 'bg-gradient-to-b from-v2-premium/30 to-v2-premium/10'
            : 'bg-gradient-to-b from-v2-ally/25 to-v2-ally/5'}`}
            style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% calc(100% - 0.75rem), 0 100%)' }}>
            {CLAN_PERK_LADDER.map((step) => {
              const at = state(step.level);
              const lit = at === 'open';
              return (
                <li key={step.level}>
                  <button type="button" data-rung={step.level} data-state={at}
                    aria-label={t('clanWar.rungLabel', { level: step.level, perk: copy.title(step) })}
                    aria-pressed={shown === step.level}
                    onClick={() => { haptic('tap'); setPicked(step.level); }}
                    className={`relative grid h-5 w-full place-items-center rounded-cell font-v2-mono text-micro leading-none transition-colors ${
                      lit ? (gold ? 'bg-v2-premium text-v2-deep shadow-[0_0_8px_var(--color-v2-premium)]' : 'bg-v2-ally text-v2-deep shadow-[0_0_6px_var(--color-v2-ally)]')
                        : at === 'next' ? 'border border-v2-self text-v2-self' : 'border border-v2-line text-v2-ink-3'
                    } ${shown === step.level ? 'ring-1 ring-v2-ink ring-offset-1 ring-offset-v2-deep' : ''}`}>
                    {at === 'next' && <span aria-hidden="true" className="absolute inset-0 animate-pulse rounded-cell bg-v2-self/20" />}
                    {raised === step.level && <span aria-hidden="true" className="absolute -inset-1 animate-ping rounded-cell bg-v2-ally/50" />}
                    <span className="relative">{step.level}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          {rung && (
            <div data-rung-card="" className="rounded-control border border-v2-line bg-v2-deep/60 px-2.5 py-2">
              {gold && picked === null ? (
                <p className="flex items-center gap-2 text-caption font-semibold text-v2-premium">
                  <PerkArt perk="BANNER" className="size-12 drop-shadow-[0_0_10px_var(--color-v2-premium)]" />
                  {t('clanWar.allOpen')}
                </p>
              ) : (
                <div className="flex gap-2">
                  <PerkArt perk={rung.perk} className={`size-10 ${state(rung.level) === 'locked' ? 'opacity-45 grayscale' : ''}`} />
                  <div className="min-w-0 flex-1">
                  <p className="flex items-baseline justify-between gap-2">
                    <span className="text-caption font-semibold text-v2-ink">{t('clanWar.rungTitle', { level: rung.level, perk: copy.title(rung) })}</span>
                    <span className={`shrink-0 text-micro ${state(rung.level) === 'open' ? 'text-v2-ally' : state(rung.level) === 'next' ? 'text-v2-self' : 'text-v2-ink-3'}`}>
                      {t(`clanWar.rungState.${state(rung.level)}`)}
                    </span>
                  </p>
                  <p className="mt-0.5 text-micro leading-snug text-v2-ink-2">{copy.body(rung)}</p>
                  {state(rung.level) === 'next' && (
                    <p className="mt-1 font-v2-mono text-micro text-v2-self">{t('clanWar.purseFull', { pct: purse })}</p>
                  )}
                  </div>
                </div>
              )}
            </div>
          )}
          <p data-perks-open="" className="text-micro leading-snug text-v2-ink-3">
            <span className="text-v2-ink-2">{t('clanWar.perksOpen')} </span>
            {open.map((step) => copy.title(step)).join(' · ')}
          </p>
          {/* The purse and its two doors sit beside the cloth: the banner is tall, the column is not. */}
          {!war.maxLevel && <Purse war={war} ledger={ledger.data ?? null} />}
          {!war.maxLevel && (
            <div className="mt-auto flex flex-col gap-2">
              <Button size="sm" disabled={!canGive} onClick={onDonate}>{t('clanWar.donate')}</Button>
              {role === 'LEADER' && (
                <div data-banner-raise="">
                  <HoldButton
                    label={t('clanWar.raise', { level: level + 1 })}
                    disabledReason={actions.upgrade.isPending ? t('clanWar.raising')
                      : !war.canUpgrade || war.level === null ? t('clanWar.raiseNotYet') : null}
                    onCommit={raise}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {actions.upgrade.isError && <p role="alert" className="text-caption text-v2-warn">{describeError(actions.upgrade.error)}</p>}

      {ledger.data && <Ledger ledger={ledger.data} need={need} selfPlayerId={selfPlayerId} />}
    </Plate>
  );
}

/** Contributors first, biggest first; one line each. */
const ordered = (ledger: ClanLedger) => [...ledger.members].sort((a, b) =>
  sum(b.donated) - sum(a.donated) || b.supportWaves - a.supportWaves || a.name.localeCompare(b.name));

/**
 * THE PURSE, resource by resource against the next rung, and one bar split by who filled it since
 * the last rung was bought — the gap is the reason to give, the slices are who already did.
 */
function Purse({ war, ledger }: { war: ClanWar; ledger: ClanLedger | null }) {
  const { t } = useTranslation();
  const need = war.nextCost ? sum(war.nextCost) : 0;
  const slices = ledger && need > 0
    ? ordered(ledger).filter((member) => sum(member.towardNext) > 0)
    : [];
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-micro text-v2-ink-3">{t('clanWar.nextCost')}</p>
      {RESOURCE_KEYS.map((key) => {
        const have = war.treasury[key];
        const cost = war.nextCost?.[key] ?? 0;
        if (cost === 0 && have === 0) return null;
        const share = cost > 0 ? Math.min(100, Math.round((have / cost) * 100)) : 100;
        return (
          <div key={key} data-treasury={key} className="grid grid-cols-[0.875rem_minmax(0,1fr)_auto] items-center gap-2">
            <img src={RESOURCE_ART[key]} alt="" aria-hidden className="size-3.5 object-contain" />
            <span aria-hidden="true" className={`h-1.5 overflow-hidden rounded-full ${EMPTY[key]}`}>
              <span className={`block h-full rounded-full ${FILL[key]}`} style={{ width: `${String(share)}%` }} />
            </span>
            <span className="font-v2-mono text-micro text-v2-ink">
              {full(have)}{cost > 0 && <span className="text-v2-ink-3"> / {full(cost)}</span>}
            </span>
          </div>
        );
      })}
      {slices.length > 0 && <p aria-hidden="true" className="text-micro text-v2-ink-3">{t('clanWar.purseSplit')}</p>}
      {slices.length > 0 && (
        <span role="img" aria-label={t('clanWar.purseSplit')} className="flex h-1.5 overflow-hidden rounded-full bg-v2-line">
          {slices.map((member, i) => (
            <span key={member.playerId} data-purse-slice={member.playerId}
              className={`h-full ${i % 2 === 0 ? 'bg-v2-ally' : 'bg-v2-ally/55'}`}
              style={{ width: `${String(Math.round((sum(member.towardNext) / need) * 1000) / 10)}%` }} />
          ))}
        </span>
      )}
    </div>
  );
}

const DAY_BAR = 10;

/**
 * "SON 24 SAAT" (F2 P6): one bar per hour, the hour just gone on the right, scaled to the clan's
 * busiest hour. A quiet hour keeps a faint stub so the line reads as a day, not as a gap.
 */
function LastDay({ hours, peak, self }: { hours: readonly number[]; peak: number; self: boolean }) {
  const { t } = useTranslation();
  const total = hours.reduce((sum, count) => sum + count, 0);
  return (
    <span className="flex w-14 shrink-0 flex-col items-end">
      <svg data-last-day role="img" viewBox={`0 0 ${String(hours.length * 2)} 12`} preserveAspectRatio="none"
        aria-label={total > 0 ? t('clanWar.ledgerDayAria', { count: total }) : t('clanWar.ledgerDayNone')}
        className="mt-0.5 h-5 w-14">
        {hours.map((count, hour) => {
          const height = count > 0 ? Math.max(1.5, (count / peak) * DAY_BAR) : 0.75;
          return (
            <rect key={hour} data-hour={hour} data-quiet={count === 0 ? 'true' : undefined}
              x={hour * 2} y={11 - height} width={1.5} height={height} rx={0.4}
              className={count === 0 ? 'fill-v2-line' : self ? 'fill-v2-self' : 'fill-v2-ally'} />
          );
        })}
      </svg>
      <span aria-hidden="true" className={`font-v2-mono text-micro leading-none ${total > 0 ? 'text-v2-ink-2' : 'text-v2-ink-3'}`}>
        {total > 0 ? full(total) : '–'}
      </span>
    </span>
  );
}

/**
 * KATKI DEFTERİ (F2 P6). Owner: "Kim ne yapıyor görünür olsun." Each member's season in one row —
 * what they gave, their share of the rung being filled, and the defence they flew. Own row lit.
 */
function Ledger({ ledger, need, selfPlayerId }: { ledger: ClanLedger; need: number; selfPlayerId?: string | undefined }) {
  const { t } = useTranslation();
  // One scale for the whole clan, so a tall bar means the same in every row.
  const peak = Math.max(1, ...ledger.members.flatMap((member) => member.lastDay));
  return (
    <section className="flex flex-col">
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="text-micro font-semibold uppercase tracking-wide text-v2-ink-3">{t('clanWar.ledger')}</h4>
        <span aria-hidden="true" className="text-micro text-v2-ink-3">{t('clanWar.ledgerDay')}</span>
      </div>
      <ul>
        {ordered(ledger).map((member) => {
          const self = member.playerId === selfPlayerId;
          const deeds = [
            member.supportWaves > 0 ? t('clanWar.ledgerWaves', { count: member.supportWaves }) : null,
            member.alarmAnswers > 0 ? t('clanWar.ledgerAlarms', { count: member.alarmAnswers }) : null,
            member.supportBattles > 0 ? t('clanWar.ledgerBattles', { count: member.supportBattles }) : null,
            member.aidSent > 0 ? t('clanWar.ledgerAid', { count: member.aidSent }) : null,
            member.jointWar > 0 ? t('clanWar.ledgerWar', { count: member.jointWar }) : null,
          ].filter((deed): deed is string => deed !== null);
          const given = sum(member.donated);
          const toward = need > 0 ? Math.round((sum(member.towardNext) / need) * 100) : 0;
          return (
            <li key={member.playerId} data-testid="ledger-row" data-player={member.playerId} data-self={String(self)}
              className={`flex items-start gap-2 border-b border-v2-line/60 px-1 py-1.5 last:border-b-0 ${self ? 'rounded-control bg-v2-self/10' : ''}`}>
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-caption font-semibold ${self ? 'text-v2-self' : 'text-v2-ink'}`}>{member.name}</span>
                <span className="block text-micro leading-snug text-v2-ink-2">
                  {given === 0 && deeds.length === 0 ? t('clanWar.ledgerNothing') : deeds.join(' · ')}
                </span>
              </span>
              {given > 0 && (
                <span className="shrink-0 text-right font-v2-mono text-micro leading-snug">
                  <span className="block text-v2-ink">{t('clanWar.ledgerGiven', { amount: compact(given) })}</span>
                  {toward > 0 && <span className="block text-v2-ink-3">{t('clanWar.ledgerToward', { pct: toward })}</span>}
                </span>
              )}
              <LastDay hours={member.lastDay} peak={peak} self={self} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
