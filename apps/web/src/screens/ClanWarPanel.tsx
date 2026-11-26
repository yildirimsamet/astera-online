import { CLAN, MOBILE_HULLS, fleetCount, pacesForMinutes, shipCanFight, shipHealthGroups, healthGroupKey, type MissionPace } from '@astera/rules';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCapsuleStock, useClanWarActions } from '../api/queries.js';
import { HonorSoloNotice } from '../ui/HonorSoloNotice.js';
import type { CapsuleIdView, ClanWar, PlanetView } from '../api/schemas.js';
import { sumFleets } from '../lib/fleetPage.js';
import { capsuleChoices } from '../lib/synthesis.js';
import { CapsuleRow } from '../ui/CapsuleRow.js';
import { describeError } from '../i18n/errors.js';
import { hullName, monumentName } from '../i18n/names.js';
import { healthDisplay } from '../lib/maintenanceInventory.js';
import { decimal, full } from '../lib/format.js';
import { haptic } from '../lib/haptics.js';
import { OWN_SOUND, playSound } from '../lib/sound.js';
import { countdown, duration, useNow } from '../lib/time.js';
import { planetArt } from '../ui/assets.js';
import { HullMark } from '../ui/icons/hulls.js';
import { PaceRow } from '../ui/PaceRow.js';
import { RadiationPreview } from '../ui/RadiationPreview.js';
import { RulesRow } from '../ui/RulesRow.js';
import { initials } from '../v2/hud/CommanderCard.js';
import { GameButton, GameHold, Glyph, Toggle } from '../game-ui/index.js';
import { ClanBanner } from './ClanBanner.js';
import { ClanConfirmation } from './ClanConfirmation.js';
import { ClanDonateSheet } from './ClanDonateSheet.js';
import { ClanWaveSheet } from './ClanWaveSheet.js';

/** A commander who can sit in the war room: the clan's members, in their seat order. */
export interface WarSeatMember {
  playerId: string;
  username: string;
}

type Operation = NonNullable<ClanWar['operation']>;
type Wave = Operation['contributions'][number];

/**
 * THE WAR ROOM. E9, and the mock: "Operasyon, toplanma noktasından hedefe uzanan bir hat
 * üzerinde dalgalar olarak görünür. Beş koltuk katkılarıyla birlikte gösterilir. Form
 * doldurmak yerine 'Dalga gönder' standart fırlatma ekranını açar."
 *
 * Top to bottom, the order a member reads it in: the target and the line the waves fly on,
 * named at both ends and at every wave still flying; the five seats with each commander's
 * share of the strike (tap one for their wave); the clan hangar; the one-line rule and the
 * two ways on — clan chat and "Send a wave", which opens the launch page. Below the fold,
 * designed in the same hand: the leader's held launch with its pace, the shared treasury as
 * progress toward the next level with its own gift page, and why the room exists.
 *
 * No browser form controls: worlds are chips, amounts are sliders, agreements are switches.
 */
export function ClanWarPanel({ war, role, mature, worlds, members = [], selfPlayerId, onOpenClanChat }: {
  war: ClanWar;
  role: 'LEADER' | 'MEMBER';
  mature: boolean;
  worlds: readonly PlanetView[];
  members?: readonly WarSeatMember[];
  selfPlayerId?: string | undefined;
  onOpenClanChat?: () => void;
}) {
  const { t } = useTranslation();
  const actions = useClanWarActions();
  const now = useNow();
  const [waveOpen, setWaveOpen] = useState(false);
  const [donateOpen, setDonateOpen] = useState(false);
  const [cancelOperationId, setCancelOperationId] = useState<string | null>(null);
  const [acknowledgeStartShield, setAcknowledgeStartShield] = useState(false);
  const [wantedPace, setWantedPace] = useState<MissionPace>(1);
  const [acknowledgeRadiation, setAcknowledgeRadiation] = useState(false);
  const capsuleStock = useCapsuleStock();
  const [capsules, setCapsules] = useState<CapsuleIdView[]>([]);
  const operation = war.operation;

  if (!war.available) return <p className="gk-inote">{t('clanWar.unavailable')}</p>;

  const hangar = <ClanHangar war={war} />;
  const treasury = <ClanBanner war={war} role={role} selfPlayerId={selfPlayerId} canGive={worlds.length > 0} onDonate={() => { setDonateOpen(true); }} />;
  // Why the room exists: a member reads it once, so it waits one press away.
  const purpose = (
    <RulesRow glyph="help" title={t('clanWar.purpose')}>
      <p className="gk-sub">{t('clanWar.purposeHint')}</p>
    </RulesRow>
  );
  const donation = donateOpen && (
    <ClanDonateSheet war={war} worlds={worlds} onClose={() => { setDonateOpen(false); }} />
  );

  if (!operation) {
    return (
      <div className="gk-war">
        {purpose}
        <section className="gk-well gk-war__state">
          <p className="gk-inote"><Glyph id="target" />{t('clanWar.target')}</p>
          <p className="gk-sub">{t('clanWar.noTarget')}</p>
        </section>
        {hangar}
        {treasury}
        {donation}
      </div>
    );
  }

  const assembling = operation.status === 'ASSEMBLING';
  const confirmingCancel = cancelOperationId === operation.id && role === 'LEADER' && assembling;
  const inbound = operation.contributions.some((wave) => wave.status === 'OUTBOUND');
  const critical = operation.contributions.some(wave => wave.status === 'STAGED' && wave.damage.some(lot => !shipCanFight(lot)));
  const startReason = operation.status !== 'ASSEMBLING' ? t('clanWar.notAssembling')
    : critical ? t('clanWar.criticalReason')
    : inbound ? t('clanWar.inboundReason')
      : operation.pool.waves === 0 ? t('clanWar.noWaveReason')
        : operation.pool.combatHulls === 0 ? t('clanWar.noCombatReason') : null;
  /*
    WHEN THE STRIKE LANDS IS THE LEADER'S CALL. Review 2026-09-22, #2 · plan §15.5a.
    The server times the combined leg at full speed; the rungs divide it, so the arrival on screen
    is the arrival the strike flies. A rung that stops being legal falls back to full speed.
  */
  const strikeMinutes = operation.pool.strikeMinutes ?? null;
  const strikePaces = strikeMinutes === null ? [] : operation.pool.paces ?? pacesForMinutes(strikeMinutes);
  const strikePace = strikePaces.includes(wantedPace) ? wantedPace : 1;
  const radiation = operation.radiationByPace.find((forecast) => forecast.pace === strikePace);
  const ownRadiationLoss = radiation?.own.some((forecast) => forecast.destroyed > 0) ?? false;
  const strikeRefusal = startReason
    ?? (operation.startShieldWouldDrop !== null && !acknowledgeStartShield ? t('clanWar.acknowledgeFirst')
      : (radiation?.missingConsents.length ?? 0) > 0 ? t('clanWar.radiationMemberRequired')
      : ownRadiationLoss && !acknowledgeRadiation ? t('monument.consent')
      : actions.start.isPending ? t('clanWar.starting') : null);
  const sendRefusal = !mature ? t('clanWar.immature') : worlds.length === 0 ? t('clanWar.noOrigin') : null;
  // What the strike leaves with is the staged pool, exactly as the server prices the capsules.
  const pooled = sumFleets(...operation.contributions.filter((wave) => wave.status === 'STAGED').map((wave) => wave.fleet));
  const wearing = capsuleStock ? capsuleChoices('clan_war', pooled, capsuleStock)
    .filter((one) => one.enough && capsules.includes(one.id)).map((one) => one.id) : [];

  return (
    <div className="gk-war">
      <HonorSoloNotice look="kit" />
      <WarTarget operation={operation} now={now} />
      <Seats operation={operation} members={members} selfPlayerId={selfPlayerId} now={now} />
      {hangar}

      {assembling && (
        <section className="gk-war__send">
          <p className="gk-inote"><Glyph id="recall" />{t('clanWar.roomNote')}</p>
          <div className="gk-war__pair">
            <GameButton glyph="chat" disabledReason={onOpenClanChat ? null : t('clanWar.chat')} onPress={() => { onOpenClanChat?.(); }}>
              {t('clanWar.chat')}
            </GameButton>
            <GameButton tone="action" glyph="plus" marks={{ 'data-wave-open': '' }} disabledReason={sendRefusal} onPress={() => { setWaveOpen(true); }}>
              {t('clanWar.composer')}
            </GameButton>
          </div>
        </section>
      )}

      {role === 'LEADER' && assembling && (
        <section className="gk-well gk-war__lead">
          <p className="gk-label gk-war__leadhead"><Glyph id="flag" />{t('clanWar.leaderTitle')}</p>
          {strikeMinutes !== null && (
            <>
              <p data-clan-strike-eta className="gk-inote" data-tone="self"><Glyph id="clock" />{t('clanWar.strikeEta', {
                time: duration(operation.pool.meetings.find(m=>m.pace===strikePace)?.minutes ?? strikeMinutes / strikePace) })}</p>
              <PaceRow data-clan-pace paces={strikePaces} pace={strikePace} onChange={(pace) => {
                setWantedPace(pace); setAcknowledgeRadiation(false);
              }}
                reset={strikePaces.length > 0 && strikePace !== wantedPace}
                hint={t('clanWar.paceHint')} />
            </>
          )}
          {radiation?.own.map((forecast, index) => <RadiationPreview key={index} combat radiation={{ kind: 'HP',
            doseHp: forecast.doseHp, destroyed: forecast.destroyed, lostFleet: forecast.lostFleet,
            lots: forecast.health, docks: forecast.health.some((lot) => lot.needsDock) }} />)}
          {ownRadiationLoss && <Toggle checked={acknowledgeRadiation} onChange={setAcknowledgeRadiation} label={t('monument.radiation')} />}
          {radiation?.missingConsents.map((member) => <p key={member.playerId} className="gk-inote" data-tone="hostile">
            <Glyph id="radiation" />{t('clanWar.radiationMember', { name: member.username, count: member.count })}
          </p>)}
          {operation.startShieldWouldDrop && (
            <div className="gk-war__shield">
              <p className="gk-inote" data-tone="hostile"><Glyph id="shield" />{t('clanWar.launchShield', { kind: operation.startShieldWouldDrop.kind })}</p>
              <Toggle checked={acknowledgeStartShield} onChange={setAcknowledgeStartShield} label={t('clanWar.acknowledgeShield')} />
            </div>
          )}
          {/* The leader pays for the whole strike (owner 2026-11-25). */}
          {capsuleStock && <CapsuleRow kind="clan_war" fleet={pooled} held={capsuleStock} chosen={capsules} onChange={setCapsules} />}
          {/* Every wave flies into battle and none comes back on a press: the kit's final hold, its reason on its face. */}
          <div data-strike-commit="">
            <GameHold
              weight="final"
              glyph="attack"
              commitSound="impact"
              label={t('clanWar.launch')}
              disabledReason={strikeRefusal}
              onCommit={() => {
                actions.start.mutate({ acknowledgeShieldLoss: acknowledgeStartShield, pace: strikePace,
                  ...(acknowledgeRadiation ? { acknowledgeRadiationLoss: true } : {}),
                  ...(wearing.length > 0 ? { capsules: wearing } : {}) });
              }}
            />
          </div>
          {actions.start.isError && <p role="alert" className="gk-inote" data-tone="warn"><Glyph id="warn" />{describeError(actions.start.error)}</p>}
          {confirmingCancel ? (
            <ClanConfirmation
              title={t('clanWar.cancelTitle')}
              body={t('clanWar.cancelBody')}
              confirm={t('clanWar.cancelConfirm')}
              back={t('clanWar.cancelBack')}
              busy={actions.cancel.isPending}
              error={actions.cancel.isError ? describeError(actions.cancel.error) : null}
              onCancel={() => { setCancelOperationId(null); }}
              onConfirm={() => {
                if (actions.cancel.isPending) return;
                actions.cancel.mutate(undefined, { onSuccess: () => { setCancelOperationId(null); } });
              }}
            />
          ) : (
            <GameButton size="sm" glyph="close" className="gk-war__cancel" pending={actions.cancel.isPending}
              onPress={() => { actions.cancel.reset(); setCancelOperationId(operation.id); }}>
              {t('clanWar.cancel')}
            </GameButton>
          )}
          {actions.cancel.isError && !confirmingCancel && <p role="alert" className="gk-inote" data-tone="warn"><Glyph id="warn" />{describeError(actions.cancel.error)}</p>}
        </section>
      )}

      {operation.status === 'RETURNING' && (
        <section className="gk-well gk-war__state">
          <p className="gk-inote" data-tone="self"><Glyph id="recall" />{t('clanWar.returning')}</p>
          <p className="gk-sub">{t('clanWar.returningHint')}</p>
        </section>
      )}

      {treasury}
      {purpose}
      {donation}
      {waveOpen && (
        <ClanWaveSheet
          operation={operation}
          worlds={worlds}
          onClose={() => { setWaveOpen(false); }}
          onSent={() => { setWaveOpen(false); }}
        />
      )}
    </div>
  );
}

/** Where the gathering point sits on the line; the target is the far end. */
const GATHER = 72;

/** Where a wave stands on the line, or null when it is off it (home, lost, recalled). */
function placeOf(wave: Wave, now: number): number | null {
  if (wave.status === 'STAGED') return GATHER;
  if (wave.status === 'IN_BATTLE') return 100;
  if (wave.status !== 'OUTBOUND') return null;
  if (!wave.arrivesAt) return GATHER / 2;
  const span = wave.arrivesAt.getTime() - wave.sentAt.getTime();
  const done = span > 0 ? (now - wave.sentAt.getTime()) / span : 1;
  return Math.max(4, Math.min(1, done) * GATHER);
}

/** A label near either end is pinned inside the row rather than centred off its edge. */
const anchor = (at: number): 'start' | 'mid' | 'end' => (at < 14 ? 'start' : at > 86 ? 'end' : 'mid');

/**
 * THE TARGET AND THE LINE THE WAVES FLY ON. E9: who is struck, where the clan gathers, how
 * long the target holds, and every wave as a mark on the line — flying to the gathering
 * point (named, with its ships and the time it lands there), waiting there (counted at the
 * gathering), or in the battle at the far end.
 */
function WarTarget({ operation, now }: { operation: Operation; now: number }) {
  const { t } = useTranslation();
  const flying = operation.contributions
    .map((wave) => ({ wave, at: placeOf(wave, now) }))
    .filter((entry): entry is { wave: Wave; at: number } => entry.at !== null && entry.wave.status === 'OUTBOUND')
    .sort((a, b) => a.at - b.at);
  const staged = operation.contributions.filter((wave) => wave.status === 'STAGED').length;

  return (
    <section data-war-target="" className="gk-well gk-war__target">
      <div className="gk-war__head">
        {operation.target.kind === 'MONUMENT'
          ? <span className="gk-war__mark" aria-hidden="true"><Glyph id="banner" /></span>
          : <img src={planetArt(operation.target.planetId)} alt="" className="gk-war__world" />}
        <div className="gk-war__who">
          <p className="gk-crewlist__name">
            <span className="gk-label">{t('clanWar.target')}</span>
            {operation.target.kind !== 'MONUMENT' && operation.target.username
              ? <span className="gk-chip gk-crewlist__chip gk-num" data-tone="hostile">{operation.target.username}</span> : null}
          </p>
          <p className="gk-war__name">{operation.target.kind === 'MONUMENT'
            ? monumentName(operation.target.monumentOrdinal ?? undefined)
            : operation.target.planetName}</p>
          {operation.status === 'ASSEMBLING' && (
            <p className="gk-sub gk-num">{t('clanWar.expires', { time: countdown(operation.expiresAt.getTime() - now) })}</p>
          )}
        </div>
        <span aria-live="polite" className="gk-chip gk-crewlist__chip" data-tone="self">
          {t(`clanWar.operationStatus.${operation.status}`)}
        </span>
      </div>

      <div data-war-line="" className="gk-war__line">
        {/* Waves in flight, named above the line on two alternating rows so neighbours never collide. */}
        {flying.map(({ wave, at }, index) => (
          <span key={`label-${wave.id}`} data-wave-label="" className="gk-war__tag" data-row={index % 2} data-anchor={anchor(at)}
            style={{ left: `${String(at)}%` }}>
            <b>{wave.username} · {fleetCount(wave.fleet)}</b>
            {wave.arrivesAt && <span className="gk-num">{duration(Math.max(1, (wave.arrivesAt.getTime() - now) / 60_000))}</span>}
          </span>
        ))}
        {staged > 0 && (
          <span className="gk-war__tag gk-war__ready" data-row={0} data-anchor={anchor(GATHER)} style={{ left: `${String(GATHER)}%` }}>
            {t('clanWar.readyCount', { count: staged })}
          </span>
        )}

        <span aria-hidden="true" className="gk-war__track" />
        <span aria-hidden="true" className="gk-war__run" style={{ width: `${String(GATHER)}%` }} />
        <span aria-hidden="true" className="gk-war__node" style={{ left: `${String(GATHER)}%` }} />
        <span aria-hidden="true" className="gk-war__node" data-end="" />
        {operation.contributions.map((wave) => {
          const at = placeOf(wave, now);
          return at === null ? null : (
            <span key={wave.id} data-wave-marker="" title={wave.username} className="gk-war__dot" style={{ left: `${String(at)}%` }} />
          );
        })}

        {/* The gathering's name ends at its node, so the target's name always has the far stretch to itself. */}
        <span className="gk-war__end" data-anchor="end" style={{ left: `calc(${String(GATHER)}% + 8px)` }}>
          {t('clanWar.gatherAt', { world: operation.staging.name })}
        </span>
        <span className="gk-war__end" data-end="">{t('clanWar.target')}</span>
      </div>
    </section>
  );
}

/**
 * THE FIVE SEATS. The clan's commanders as the mock seats them — initials, a name, and
 * under each the share of the strike their waves carry (you in your colour, allies in
 * theirs); the open seats say so. A seat opens that commander's waves below it: where each
 * came from, what it carries, where it is, and — on yours — the recall.
 */
function Seats({ operation, members, selfPlayerId, now }: {
  operation: Operation;
  members: readonly WarSeatMember[];
  selfPlayerId: string | undefined;
  now: number;
}) {
  const { t } = useTranslation();
  const actions = useClanWarActions();
  const waves = operation.contributions;
  // A commander who left mid-operation still has a wave in the strike: they keep a seat.
  const seated = [...members];
  for (const wave of waves) {
    if (!seated.some((member) => member.playerId === wave.playerId)) {
      seated.push({ playerId: wave.playerId, username: wave.username });
    }
  }
  const seats = seated.slice(0, Math.max(CLAN.maxMembers, 1));
  const totalBulk = waves.reduce((sum, wave) => sum + wave.bulk, 0);
  const bulkOf = (playerId: string): number =>
    waves.filter((wave) => wave.playerId === playerId).reduce((sum, wave) => sum + wave.bulk, 0);
  const firstWithWave = seats.find((member) => member.playerId === selfPlayerId && bulkOf(member.playerId) > 0)
    ?? seats.find((member) => waves.some((wave) => wave.playerId === member.playerId));
  const [chosen, setChosen] = useState<string | null>(null);
  const selected = seats.find((member) => member.playerId === chosen) ?? firstWithWave ?? null;
  const theirs = selected ? waves.filter((wave) => wave.playerId === selected.playerId) : [];

  return (
    <section className="gk-well gk-war__crew">
      <div role="group" aria-label={t('clanWar.seats')} className="gk-war__seats">
        {Array.from({ length: CLAN.maxMembers }, (_, index) => {
          const member = seats[index];
          if (!member) {
            return (
              <button key={`open-${String(index)}`} type="button" disabled className="gk-warseat" data-empty="">
                <span className="gk-warseat__face" aria-hidden="true"><Glyph id="plus" /></span>
                <span className="gk-warseat__name">{t('clanWar.seatEmpty')}</span>
              </button>
            );
          }
          const self = member.playerId === selfPlayerId;
          const share = totalBulk > 0 ? Math.round((bulkOf(member.playerId) / totalBulk) * 100) : 0;
          const on = selected?.playerId === member.playerId;
          return (
            <button
              key={member.playerId}
              type="button"
              {...OWN_SOUND}
              aria-pressed={on}
              aria-label={`${member.username} · ${String(share)}%`}
              {...(self ? { 'data-self': '' } : {})}
              onClick={() => { playSound('tab'); haptic('tap'); setChosen(member.playerId); }}
              className="gk-warseat"
            >
              <span className="gk-warseat__face gk-num">{initials(member.username)}</span>
              <span aria-hidden="true" className="gk-warseat__share">
                <span data-seat-share="" data-tone={self ? 'self' : 'ally'} style={{ width: `${String(share)}%` }} />
              </span>
              <span className="gk-warseat__name">{self ? t('clanWar.seatYou') : member.username}</span>
            </button>
          );
        })}
      </div>

      <p className="gk-sub">{t('clanWar.stagingRadiation')}</p>

      {selected && (
        <div data-seat-waves="" className="gk-war__waves">
          {theirs.length === 0 ? (
            <p className="gk-sub">{t('clanWar.seatNoWave', { name: selected.username })}</p>
          ) : theirs.map((wave) => (
            <div key={wave.id} className="gk-war__wave">
              <p className="gk-crewlist__name">
                <strong>{t('clanWar.wave', { name: wave.username, world: wave.originPlanetName })}</strong>
                <span className="gk-war__status">{t(`clanWar.status.${wave.status}`)}</span>
              </p>
              <p className="gk-war__hulls">
                {MOBILE_HULLS.filter((hull) => (wave.fleet[hull] ?? 0) > 0).map((hull) => (
                  <span key={hull}><HullMark hull={hull} className="gk-war__hullmark" />{hullName(hull)} <b className="gk-num">×{wave.fleet[hull] ?? 0}</b></span>
                ))}
              </p>
              {shipHealthGroups(wave.fleet, wave.damage).filter(lot => lot.damageBp > 0 || (lot.remainderBp ?? 0) > 0).map(lot => {
                const health = healthDisplay(lot);
                const critical = !shipCanFight(lot);
                return <div key={healthGroupKey(lot)} data-staged-health="" className="gk-war__health" {...(critical ? { 'data-tone': 'warn' } : {})}>
                  <p className="gk-war__healthline">
                    <span>{hullName(lot.hull)} ×{full(lot.count)}</span>
                    <span className="gk-num">{t(`repairStation.maintenance.health${health.relation === 'above' ? 'Above' : health.relation === 'below' ? 'Below' : 'Exact'}`,
                      { pct: decimal(health.percent, Number.isInteger(health.percent) ? 0 : 2) })}</span>
                  </p>
                  <span aria-hidden="true" className="gk-war__bar"><span style={{ width: `${String(health.percent)}%` }} /></span>
                  {critical && <p className="gk-inote" data-tone="warn"><Glyph id="critical" />{t('repairStation.maintenance.critical')}</p>}
                </div>;
              })}
              <p className="gk-sub gk-num">
                {t('clanWar.waveMeta', { ships: fleetCount(wave.fleet), bulk: full(wave.bulk) })}
                {wave.arrivesAt && <> · {t('clanWar.eta', { time: countdown(wave.arrivesAt.getTime() - now) })}</>}
              </p>
              {wave.canRecall && (
                <GameHold weight="reversible" size="md" tone="steel" glyph="recall" label={t('clanWar.recall')}
                  disabledReason={actions.recall.isPending ? t('clanWar.recall') : null}
                  onCommit={() => { actions.recall.mutate(wave.id); }} />
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** The clan hangar in the allies' colour: what stands in it, then what is on its way. */
function ClanHangar({ war }: { war: ClanWar }) {
  const { t } = useTranslation();
  const total = Math.max(1, war.hangar.total);
  const share = (value: number): string => `${String(Math.round((Math.max(0, value) / total) * 100))}%`;
  return (
    <section data-clan-hangar="" className="gk-well gk-war__hangar">
      <p className="gk-war__hangarhead">
        <span className="gk-label">{t('clanWar.hangar')}</span>
        <b className="gk-num">{full(war.hangar.used)} / {full(war.hangar.total)}</b>
      </p>
      <span aria-hidden="true" className="gk-war__bar gk-war__bar--hangar">
        <span data-part="used" className="gk-war__used" style={{ width: share(war.hangar.used) }} />
        <span data-part="reserved" className="gk-war__reserved" style={{ width: share(war.hangar.reserved) }} />
      </span>
      <p className="gk-sub">{t('clanWar.capacity', {
        used: full(war.hangar.used), reserved: full(war.hangar.reserved), total: full(war.hangar.total),
      })} · <span className="gk-war__status">{t('clanWar.level', { level: war.level ?? 1 })}</span></p>
      <p className="gk-sub">{t('clanWar.hangarHint')}</p>
    </section>
  );
}
