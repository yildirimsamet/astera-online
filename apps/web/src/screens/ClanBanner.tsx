import { CLAN_PERK_LADDER, type ClanPerkRung } from '@astera/rules';
import { PerkArt } from '../ui/PerkArt.js';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useClanLedger, useClanWarActions } from '../api/queries.js';
import type { ClanLedger, ClanWar } from '../api/schemas.js';
import { describeError } from '../i18n/errors.js';
import { compact, full } from '../lib/format.js';
import { haptic } from '../lib/haptics.js';
import { OWN_SOUND, playSound } from '../lib/sound.js';
import { RESOURCE_ART } from '../ui/assets.js';
import { GameButton, GameHold, Glyph } from '../game-ui/index.js';

const RESOURCE_KEYS = ['alloy', 'crystal', 'deuterium'] as const;
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
 *
 * G7-j (2026-11-15): on the kit, the ten notches stand two rows of five on the cloth — 1–5 at the
 * hem, 6–10 above — so each is a thumb's 44 px instead of a 20 px sliver; the raise spends the
 * treasury on the kit's one-second hold.
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

  const pick = (at: number): void => { playSound('tab'); haptic('tap'); setPicked(at); };
  const rows = [CLAN_PERK_LADDER.slice(5, 10), CLAN_PERK_LADDER.slice(0, 5)];

  return (
    <section className="gk-well gk-standard" {...(gold ? { 'data-gold': '' } : {})}>
      <p className="gk-standard__head">
        <span className="gk-label">{t('clanWar.banner')}</span>
        <span className="gk-chip gk-crewlist__chip" data-tone={gold ? 'gold' : 'self'}>{t('clanWar.level', { level })}</span>
      </p>

      {/* The banner: a hanging cloth, ten notches from the hem (1–5) to the pole (6–10). */}
      <div data-banner="" data-gold={String(gold)} className="gk-standard__cloth">
        <span aria-hidden="true" className="gk-standard__pole" />
        <ol className="gk-standard__rungs" {...OWN_SOUND}>
          {rows.flat().map((step) => {
            const at = state(step.level);
            return (
              <li key={step.level}>
                <button type="button" data-rung={step.level} data-state={at}
                  aria-label={t('clanWar.rungLabel', { level: step.level, perk: copy.title(step) })}
                  aria-pressed={shown === step.level}
                  {...(raised === step.level ? { 'data-raised': '' } : {})}
                  onClick={() => { pick(step.level); }}
                  className="gk-standard__rung gk-num">
                  {step.level}
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {rung && (
        <div data-rung-card="" className="gk-well gk-standard__card" data-state={gold && picked === null ? 'gold' : state(rung.level)}>
          {gold && picked === null ? (
            <p className="gk-standard__all">
              <PerkArt perk="BANNER" className="gk-standard__art gk-standard__art--gold" />
              {t('clanWar.allOpen')}
            </p>
          ) : (
            <>
              <PerkArt perk={rung.perk} className="gk-standard__art" />
              <div className="gk-standard__words">
                <p className="gk-crewlist__name">
                  <strong>{t('clanWar.rungTitle', { level: rung.level, perk: copy.title(rung) })}</strong>
                  <span className="gk-standard__state">{t(`clanWar.rungState.${state(rung.level)}`)}</span>
                </p>
                <p className="gk-sub">{copy.body(rung)}</p>
                {state(rung.level) === 'next' && (
                  <p className="gk-standard__purse gk-num">{t('clanWar.purseFull', { pct: purse })}</p>
                )}
              </div>
            </>
          )}
        </div>
      )}
      <p data-perks-open="" className="gk-sub gk-standard__open">
        <b>{t('clanWar.perksOpen')} </b>
        {open.map((step) => copy.title(step)).join(' · ')}
      </p>
      {!war.maxLevel && <Purse war={war} ledger={ledger.data ?? null} />}
      {!war.maxLevel && (
        <div className="gk-standard__acts">
          <GameButton glyph="crate" disabledReason={canGive ? null : t('clanWar.noOrigin')} onPress={onDonate}>{t('clanWar.donate')}</GameButton>
          {role === 'LEADER' && (
            <div data-banner-raise="">
              {/* The treasury is spent on the rung and does not come back: the kit's spend weight. */}
              <GameHold
                weight="spends"
                size="md"
                glyph="up"
                commitSound="claim"
                label={t('clanWar.raise', { level: level + 1 })}
                disabledReason={actions.upgrade.isPending ? t('clanWar.raising')
                  : !war.canUpgrade || war.level === null ? t('clanWar.raiseNotYet') : null}
                onCommit={raise}
              />
            </div>
          )}
        </div>
      )}
      {actions.upgrade.isError && <p role="alert" className="gk-inote" data-tone="warn"><Glyph id="warn" />{describeError(actions.upgrade.error)}</p>}

      {ledger.data && <Ledger ledger={ledger.data} need={need} selfPlayerId={selfPlayerId} />}
    </section>
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
    <div className="gk-standard__purses">
      <p className="gk-label">{t('clanWar.nextCost')}</p>
      {RESOURCE_KEYS.map((key) => {
        const have = war.treasury[key];
        const cost = war.nextCost?.[key] ?? 0;
        if (cost === 0 && have === 0) return null;
        const share = cost > 0 ? Math.min(100, Math.round((have / cost) * 100)) : 100;
        return (
          <div key={key} data-treasury={key} className="gk-standard__res">
            <img src={RESOURCE_ART[key]} alt="" aria-hidden />
            <span aria-hidden="true" className="gk-standard__bar" data-resource={key}>
              <span style={{ width: `${String(share)}%` }} />
            </span>
            <span className="gk-num gk-standard__have">
              {full(have)}{cost > 0 && <span> / {full(cost)}</span>}
            </span>
          </div>
        );
      })}
      {slices.length > 0 && <p aria-hidden="true" className="gk-sub">{t('clanWar.purseSplit')}</p>}
      {slices.length > 0 && (
        <span role="img" aria-label={t('clanWar.purseSplit')} className="gk-standard__split">
          {slices.map((member, i) => (
            <span key={member.playerId} data-purse-slice={member.playerId} data-shade={i % 2}
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
    <span className="gk-ledgerbook__day">
      <svg data-last-day role="img" viewBox={`0 0 ${String(hours.length * 2)} 12`} preserveAspectRatio="none"
        aria-label={total > 0 ? t('clanWar.ledgerDayAria', { count: total }) : t('clanWar.ledgerDayNone')}
        className="gk-ledgerbook__spark">
        {hours.map((count, hour) => {
          const height = count > 0 ? Math.max(1.5, (count / peak) * DAY_BAR) : 0.75;
          return (
            <rect key={hour} data-hour={hour} data-quiet={count === 0 ? 'true' : undefined}
              x={hour * 2} y={11 - height} width={1.5} height={height} rx={0.4}
              data-tone={count === 0 ? 'quiet' : self ? 'self' : 'ally'} />
          );
        })}
      </svg>
      <span aria-hidden="true" className="gk-num gk-ledgerbook__count">
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
    <section className="gk-ledgerbook">
      <p className="gk-standard__head">
        <span className="gk-label">{t('clanWar.ledger')}</span>
        <span aria-hidden="true" className="gk-sub">{t('clanWar.ledgerDay')}</span>
      </p>
      <ul className="gk-ledgerbook__rows">
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
              className="gk-ledgerbook__row">
              <span className="gk-ledgerbook__who">
                <strong>{member.name}</strong>
                <span className="gk-sub">
                  {given === 0 && deeds.length === 0 ? t('clanWar.ledgerNothing') : deeds.join(' · ')}
                </span>
              </span>
              {given > 0 && (
                <span className="gk-num gk-ledgerbook__given">
                  <b>{t('clanWar.ledgerGiven', { amount: compact(given) })}</b>
                  {toward > 0 && <span>{t('clanWar.ledgerToward', { pct: toward })}</span>}
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
