import { fleetCount, fleetEntries } from '@astera/rules';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useClanSupportActions, useSetDefencePosture } from '../api/queries.js';
import type { ClanSupportWave, PlanetView } from '../api/schemas.js';
import { Banner, GameButton, GameHold, Glyph, InfoPeek, SectionTag, TimerRow, Toggle } from '../game-ui/index.js';
import { describeError } from '../i18n/errors.js';
import { hullName } from '../i18n/names.js';
import { supportVerdict } from '../lib/clanAlarm.js';
import { compact } from '../lib/format.js';
import { factorLabel, hostFactor } from '../lib/supportFactor.js';
import { clockTime, countdown, durationPrecise, useNow } from '../lib/time.js';
import { HonorSoloNotice } from '../ui/HonorSoloNotice.js';

/**
 * KLAN SAVUNMA DESTEĞİ ON THE HANGAR PAGE (`docs/clan-defense-support-plan.md`, K1 · K4), on the
 * game kit since G2-h3 (2026-11-15).
 *
 * Two pieces under the Hangar's own room, because the bay IS the Hangar's: the posture
 * card (the retreat and clan support, independent since F1) and the bay itself — who stands
 * here, who is flying in, and the room it holds, which is this world's own Hangar room. Each
 * answers the four questions where it is read: what a switch does is the sentence under it,
 * what a wave costs to send back is written on the hold that sends it.
 */

interface Toggles { escape: boolean; support: boolean }

/** A season dealt before the rule has no posture, and draws (and asks the server) nothing. */
export function DefencePostureCard({ planet }: { planet: PlanetView }) {
  const posture = planet.defencePosture ?? null;
  return posture ? <PostureCard planet={planet} posture={posture} /> : null;
}

/**
 * TWO SWITCHES, EACH THE DECISION ITSELF (G2-h3): flipping one applies it, as a breaker does —
 * no form to save. Closing the door on waves that stand here sends them home, so that one move
 * waits on a short hold with the count said above it; Keep leaves the door open.
 */
function PostureCard({ planet, posture }: {
  planet: PlanetView;
  posture: NonNullable<PlanetView['defencePosture']>;
}) {
  const { t } = useTranslation();
  const save = useSetDefencePosture();
  const [draft, setDraft] = useState<Toggles>({ escape: posture.escape, support: posture.support });
  /** The posture waiting on the hold. */
  const [asking, setAsking] = useState<Toggles | null>(null);
  const current = posture.stance ?? posture.posture;
  useEffect(() => {
    setDraft({ escape: posture.escape, support: posture.support });
    setAsking(null);
    // The stored posture is the reset trigger: a save, or another tab's change, lands as a new one.
  }, [current]);

  const locked = posture.supportLocked !== null;
  const waves = planet.clanSupport?.waves.length ?? 0;

  const apply = (next: Toggles): void => {
    setAsking(null);
    setDraft(next);
    save.mutate({ planetId: planet.planet.id, ...next }, {
      onError: () => { setDraft({ escape: posture.escape, support: posture.support }); },
    });
  };
  const flip = (next: Toggles): void => {
    if (save.isPending) return;
    if (posture.support && !next.support && waves > 0) { setAsking(next); return; }
    apply(next);
  };

  return (
    <section data-defence-posture="" className="gk-posture gk-well">
      <HonorSoloNotice look="kit" />
      <SectionTag>{t('clanSupport.postureTitle')}</SectionTag>
      <Toggle checked={draft.escape} label={t('clanSupport.escapeLabel')} sub={t('clanSupport.escapeOn')}
        onChange={(on) => { flip({ ...draft, escape: on }); }} />
      <Toggle checked={draft.support} locked={locked} label={t('clanSupport.supportLabel')}
        sub={locked ? t('clanSupport.supportLocked') : t('clanSupport.supportOn')}
        onChange={(on) => { flip({ ...draft, support: on }); }} />
      {!draft.escape && !draft.support && <p data-tone="warn" className="gk-posture__note">{t('clanSupport.holdBoth')}</p>}
      {draft.escape && draft.support && (
        <p data-posture-both="" data-tone="self" className="gk-posture__note">{t('clanSupport.bothOn')}</p>
      )}
      {asking && (
        <div className="gk-posture__ask">
          <Banner tone="warn" variant="strip" role={null} title={t('clanSupport.confirmClose', { count: waves })} />
          <GameHold weight="reversible" size="md" tone="danger" glyph="recall" label={t('clanSupport.confirm')}
            onCommit={() => { apply(asking); }} />
          <GameButton tone="ghost" size="sm" onPress={() => { setAsking(null); }}>{t('clanSupport.keep')}</GameButton>
        </div>
      )}
      {save.isPending && <p role="status" className="gk-posture__note">{t('clanSupport.saving')}</p>}
      {save.isError && <p role="alert" data-tone="warn" className="gk-posture__note">{describeError(save.error)}</p>}
    </section>
  );
}

/** How many wave rows show before the list folds (owner: cut, tighten). */
const FOLD_AFTER = 3;

export function ClanSupportBay({ planet }: { planet: PlanetView }) {
  const { t } = useTranslation();
  const bay = planet.clanSupport ?? null;
  const [open, setOpen] = useState(false);
  const now = useNow();
  if (!bay) return null;
  const supporting = planet.defencePosture?.support === true;
  // F1: with the retreat on too, an outmatched line lifts together instead of never retreating.
  const lifts = planet.defencePosture?.escape === true;
  if (!supporting && bay.waves.length === 0) {
    // Outside a clan the switch is locked and the card above says why; "turn it on" would be a dead end.
    if (planet.defencePosture?.supportLocked != null) return null;
    return <p data-support-bay="closed" className="gk-sub gk-sbay__closed">{t('clanSupport.closedEmpty')}</p>;
  }
  const taken = bay.room.used + bay.room.reserved;
  const scale = Math.max(bay.room.total, taken, 1);
  const share = (value: number): string => `${String(Math.round((value / scale) * 1000) / 10)}%`;
  const shown = open ? bay.waves : bay.waves.slice(0, FOLD_AFTER);
  const factor = hostFactor(planet, now);

  return (
    <section data-support-bay="" className="gk-sbay gk-well">
      <p className="gk-sbay__head">
        <span className="gk-label">{t('clanSupport.bayTitle')}</span>
        <span className="gk-sbay__figure gk-num">
          {compact(taken)}<span className="gk-sbay__total"> / {compact(bay.room.total)}</span>
        </span>
      </p>
      <span role="img" aria-label={t('clanSupport.bayReading', { used: compact(taken), total: compact(bay.room.total) })}
        className="gk-bar gk-sbay__bar">
        {bay.room.used > 0 && <span data-part="standing" className="gk-sbay__part" style={{ width: share(bay.room.used) }} />}
        {bay.room.reserved > 0 && <span data-part="inbound" className="gk-sbay__part" style={{ width: share(bay.room.reserved) }} />}
      </span>
      <p className="gk-sbay__legend">
        <span className="gk-sbay__key"><span aria-hidden="true" data-part="standing" className="gk-sbay__swatch" />{t('clanSupport.bayLegendStanding')}</span>
        <span className="gk-sbay__key"><span aria-hidden="true" data-part="inbound" className="gk-sbay__swatch" />{t('clanSupport.bayLegendInbound')}</span>
      </p>
      {bay.alarms?.map((alarm) => <AlarmAnswer key={alarm.id} alarm={alarm} waves={bay.waves} now={now} />)}
      <p className="gk-sub">{t('clanSupport.bayHint')}</p>
      {/* The stakes the host accepted: the factor the standing support puts on its Dominion; its rule one press away. */}
      <div data-support-factor="" className="gk-sbay__factor">
        <InfoPeek
          fact={<span className="gk-num">{factor === 1 ? t('clanSupport.bayFactorNone') : t('clanSupport.bayFactor', { factor: factorLabel(factor) })}</span>}
          rule={<p className="gk-sub">{t('clanSupport.bayFactorRule')}</p>}
          about={t('clanSupport.bayFactorAbout')}
        />
      </div>
      {bay.waves.length === 0 ? (
        <p className="gk-sub">{t('clanSupport.empty')}</p>
      ) : (
        <ul className="gk-tlist">
          {shown.map((wave) => <WaveRow key={wave.id} wave={wave} />)}
        </ul>
      )}
      {!open && bay.waves.length > FOLD_AFTER && (
        <GameButton tone="ghost" size="sm" onPress={() => { setOpen(true); }}>
          {t('clanSupport.more', { count: bay.waves.length - FOLD_AFTER })}
        </GameButton>
      )}
      <p className="gk-sub">{t(lifts ? 'clanSupport.ruleLineLift' : 'clanSupport.ruleLine')}</p>
    </section>
  );
}

type Alarm = NonNullable<NonNullable<PlanetView['clanSupport']>['alarms']>[number];

/**
 * THE CLAN'S ANSWER TO YOUR ALARM (F2 E6). Who of the called saw it, how many waves fly to
 * answer it, and the first of them against the raid's clock — in time, or too late.
 */
function AlarmAnswer({ alarm, waves, now }: { alarm: Alarm; waves: readonly ClanSupportWave[]; now: number }) {
  const { t } = useTranslation();
  const answering = waves.filter((wave) => wave.alarmId === alarm.id && (wave.status === 'OUTBOUND' || wave.status === 'STATIONED'))
    .sort((a, b) => a.arriveAt.getTime() - b.arriveAt.getTime());
  const first = answering[0];
  // Between the landing and the next read the alarm is still listed: a verdict on it means nothing.
  const landed = alarm.arriveAt.getTime() <= now;
  const verdict = first ? supportVerdict(first.arriveAt, alarm.arriveAt) : null;
  // A wave already on station is no longer "landing before the raid": it stands guard.
  const standing = first !== undefined && first.arriveAt.getTime() <= now;
  return (
    <p data-clan-alarm={alarm.id} className="gk-sbay__alarm">
      <Glyph id="siren" />
      <span className="gk-sbay__alarm-text">
        <span className="gk-sbay__alarm-seen">
          {t('clanSupport.alarmSeen', { seen: alarm.seen, count: alarm.called })}
        </span>
        {!landed && ' · '}
        {landed ? null : verdict === null
          ? <span>{t('clanSupport.alarmNoAnswer')}</span>
          : standing ? <span data-tone="good">{t('clanSupport.alarmAnswersStanding', { count: answering.length })}</span>
          : <span data-tone={verdict.inTime ? 'good' : 'warn'}>
            {t(verdict.inTime ? 'clanSupport.alarmAnswersInTime' : 'clanSupport.alarmAnswersLate', {
              count: answering.length, time: durationPrecise(verdict.minutes),
            })}
          </span>}
        <span className="gk-sbay__alarm-clock gk-num">
          {landed ? t('clanSupport.alarmRaidLanded') : t('clanSupport.alarmRaidIn', { time: countdown(alarm.arriveAt.getTime() - now) })}
        </span>
      </span>
    </p>
  );
}

/**
 * A WAVE AT THIS WORLD, as the Fleet page draws one: the ring runs down its stay (or its flight
 * in); under it the room it takes, and the short hold that sends it home with its price on it.
 */
function WaveRow({ wave }: { wave: ClanSupportWave }) {
  const { t } = useTranslation();
  const now = useNow();
  const actions = useClanSupportActions();
  const inbound = wave.status === 'OUTBOUND';
  const landing = inbound && wave.arriveAt.getTime() <= now;
  const ends = inbound ? wave.arriveAt : wave.expiresAt;
  const from = inbound ? wave.sentAt : (wave.stationedAt ?? wave.arriveAt);
  const clock = landing ? { waiting: t('clanSupport.landing') }
    : ends ? { time: countdown(ends.getTime() - now), at: inbound ? t('now.at', { time: clockTime(ends) }) : t('clanSupport.timeLeft') }
      : {};
  return (
    <li data-support-wave={wave.id} className="gk-flight">
      <TimerRow
        tone="self"
        glyph="support"
        remaining={ends ? Math.max(0, ends.getTime() - now) : 0}
        total={ends ? ends.getTime() - from.getTime() : 0}
        title={wave.sender.name}
        detail={fleetEntries(wave.fleet).map(([hull, n]) => `${String(n)} ${hullName(hull)}`).join(' · ')}
        {...clock}
      />
      <p className="gk-flight__more gk-flight__note">
        <span className="gk-num">{t('clanSupport.waveMeta', { ships: fleetCount(wave.fleet), bulk: compact(wave.bulk) })}</span>
        {wave.damaged && <span className="gk-sbay__damaged">{t('clanSupport.damaged')}</span>}
      </p>
      {wave.outOfBand && <p data-tone="warn" className="gk-flight__more gk-flight__note">{t('clanSupport.outOfBand')}</p>}
      {!landing && (actions.sendBack.isPending ? (
        <p role="status" className="gk-flight__more gk-flight__turning">{t('fleetPage.recalling')}</p>
      ) : (
        <div className="gk-flight__more">
          <GameHold weight="reversible" size="md" tone="steel" glyph="recall" label={t('clanSupport.sendBack')}
            detail={t('clanSupport.sendBackCost')} onCommit={() => { actions.sendBack.mutate(wave.id); }} />
        </div>
      ))}
      {actions.sendBack.isError && (
        <p role="alert" data-tone="warn" className="gk-flight__more gk-flight__note">{describeError(actions.sendBack.error)}</p>
      )}
    </li>
  );
}
