import { CLAN, HULLS, MOBILE_HULLS, fleetCount, pacesForMinutes, type MissionPace } from '@astera/rules';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useClanWarActions } from '../api/queries.js';
import type { ClanWar, PlanetView } from '../api/schemas.js';
import { describeError } from '../i18n/errors.js';
import { hullName, monumentName } from '../i18n/names.js';
import { full } from '../lib/format.js';
import { countdown, duration, useNow } from '../lib/time.js';
import { planetArt, RESOURCE_ART } from '../ui/assets.js';
import { PaceRow } from '../ui/PaceRow.js';
import { RadiationPreview } from '../ui/RadiationPreview.js';
import { initials } from '../v2/hud/CommanderCard.js';
import { Icon } from '../v2/icons.js';
import { ClassEmblem } from '../v2/kit/ClassEmblem.js';
import { HoldButton } from '../v2/kit/HoldButton.js';
import { Button, Plate } from '../v2/kit/Surface.js';
import { Toggle } from '../v2/kit/Toggle.js';
import { ClanDonateSheet } from './ClanDonateSheet.js';
import { ClanWaveSheet } from './ClanWaveSheet.js';

/** A commander who can sit in the war room: the clan's members, in their seat order. */
export interface WarSeatMember {
  playerId: string;
  username: string;
}

type Operation = NonNullable<ClanWar['operation']>;
type Wave = Operation['contributions'][number];

const RESOURCE_KEYS = ['alloy', 'crystal', 'deuterium'] as const;
const FILL = { alloy: 'bg-v2-alloy', crystal: 'bg-v2-crystal', deuterium: 'bg-v2-deut' } as const;
const EMPTY = { alloy: 'bg-v2-alloy/15', crystal: 'bg-v2-crystal/15', deuterium: 'bg-v2-deut/15' } as const;

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
  const [acknowledgeStartShield, setAcknowledgeStartShield] = useState(false);
  const [wantedPace, setWantedPace] = useState<MissionPace>(1);
  const [acknowledgeRadiation, setAcknowledgeRadiation] = useState(false);
  const operation = war.operation;

  if (!war.available) return <p className="px-2 py-4 text-body text-v2-ink-2">{t('clanWar.unavailable')}</p>;

  const hangar = <ClanHangar war={war} />;
  const treasury = <Treasury war={war} role={role} canGive={worlds.length > 0} onDonate={() => { setDonateOpen(true); }} />;
  const purpose = (
    <Plate className="p-3">
      <h3 className="text-caption font-semibold text-v2-ink">{t('clanWar.purpose')}</h3>
      <p className="mt-1 text-micro leading-snug text-v2-ink-2">{t('clanWar.purposeHint')}</p>
    </Plate>
  );
  const donation = donateOpen && (
    <ClanDonateSheet war={war} worlds={worlds} onClose={() => { setDonateOpen(false); }} />
  );

  if (!operation) {
    return (
      <div className="flex min-w-0 flex-col gap-3 pb-5">
        {purpose}
        <Plate className="p-3">
          <h3 className="text-caption font-semibold text-v2-ink">{t('clanWar.target')}</h3>
          <p className="mt-1 text-caption leading-relaxed text-v2-ink-2">{t('clanWar.noTarget')}</p>
        </Plate>
        {hangar}
        {treasury}
        {donation}
      </div>
    );
  }

  const assembling = operation.status === 'ASSEMBLING';
  const inbound = operation.contributions.some((wave) => wave.status === 'OUTBOUND');
  const startReason = operation.status !== 'ASSEMBLING' ? t('clanWar.notAssembling')
    : inbound ? t('clanWar.inboundReason')
      : operation.pool.waves === 0 ? t('clanWar.noWaveReason')
        : operation.pool.combatHulls === 0 ? t('clanWar.noCombatReason') : null;
  /*
    WHEN THE STRIKE LANDS IS THE LEADER'S CALL. Review 2026-09-22, #2 · plan §15.5a.
    The server times the combined leg at full speed; the rungs divide it, so the arrival on screen
    is the arrival the strike flies. A rung that stops being legal falls back to full speed.
  */
  const strikeMinutes = operation.pool.strikeMinutes ?? null;
  const strikePaces = strikeMinutes === null ? [] : pacesForMinutes(strikeMinutes);
  const strikePace = strikePaces.includes(wantedPace) ? wantedPace : 1;
  const radiation = operation.radiationByPace.find((forecast) => forecast.pace === strikePace);
  const ownRadiationLoss = radiation?.own.some((forecast) => forecast.destroyed > 0) ?? false;
  const strikeRefusal = startReason
    ?? (operation.startShieldWouldDrop !== null && !acknowledgeStartShield ? t('clanWar.acknowledgeFirst')
      : (radiation?.missingConsents.length ?? 0) > 0 ? t('clanWar.radiationMemberRequired')
      : ownRadiationLoss && !acknowledgeRadiation ? t('monument.consent')
      : actions.start.isPending ? t('clanWar.starting') : null);
  const sendRefusal = !mature ? t('clanWar.immature') : null;

  return (
    <div className="flex min-w-0 flex-col gap-3 pb-5">
      <WarTarget operation={operation} now={now} />
      <Seats operation={operation} members={members} selfPlayerId={selfPlayerId} now={now} />
      {hangar}

      {assembling && (
        <div className="flex flex-col gap-2">
          <p className="rounded-control border border-v2-line bg-v2-deep/50 px-3 py-2 text-micro leading-snug text-v2-ink-2">
            {t('clanWar.roomNote')}
          </p>
          {sendRefusal && <p className="text-micro text-v2-warn">{sendRefusal}</p>}
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <button
              type="button"
              onClick={onOpenClanChat}
              disabled={!onOpenClanChat}
              className="flex min-h-10 items-center gap-1.5 rounded-control border border-v2-line-hi px-3 text-caption font-semibold text-v2-ink disabled:opacity-40"
            >
              <Icon id="i-chat" className="size-4" />
              {t('clanWar.chat')}
            </button>
            <button
              type="button"
              disabled={sendRefusal !== null || worlds.length === 0}
              onClick={() => { setWaveOpen(true); }}
              className="min-h-10 rounded-control bg-v2-self px-3 text-caption font-semibold text-v2-self-ink disabled:opacity-40"
            >
              {t('clanWar.composer')} ›
            </button>
          </div>
        </div>
      )}

      {role === 'LEADER' && assembling && (
        <Plate className="flex flex-col gap-2 p-3">
          <h3 className="text-caption font-semibold text-v2-ink">{t('clanWar.leaderTitle')}</h3>
          {strikeMinutes !== null && (
            <>
              <p data-clan-strike-eta className="text-caption text-v2-ink-2">{t('clanWar.strikeEta', {
                time: duration(strikeMinutes / strikePace) })}</p>
              <PaceRow data-clan-pace paces={strikePaces} pace={strikePace} onChange={(pace) => {
                setWantedPace(pace); setAcknowledgeRadiation(false);
              }}
                hint={t('clanWar.paceHint')} />
            </>
          )}
          {radiation?.own.map((forecast, index) => <RadiationPreview key={index} combat radiation={{ kind: 'HP',
            doseHp: forecast.doseHp, destroyed: forecast.destroyed, lostFleet: forecast.lostFleet,
            lots: forecast.health, docks: forecast.health.some((lot) => lot.needsDock) }} />)}
          {ownRadiationLoss && <Toggle tone="hostile" checked={acknowledgeRadiation} onChange={setAcknowledgeRadiation}>
            {t('monument.radiation')}
          </Toggle>}
          {radiation?.missingConsents.map((member) => <p key={member.playerId} className="text-caption text-v2-hostile">
            {t('clanWar.radiationMember', { name: member.username, count: member.count })}
          </p>)}
          {operation.startShieldWouldDrop && (
            <div className="flex flex-col gap-1 rounded-control border border-v2-hostile/40 bg-v2-hostile/5 px-2.5 py-2">
              <p className="text-caption text-v2-hostile">{t('clanWar.launchShield', { kind: operation.startShieldWouldDrop.kind })}</p>
              <Toggle tone="hostile" checked={acknowledgeStartShield} onChange={setAcknowledgeStartShield}>
                {t('clanWar.acknowledgeShield')}
              </Toggle>
            </div>
          )}
          {/* Irreversible — every wave flies into battle — so it is held (K4), its reason on its face. */}
          <div data-strike-commit="">
            <HoldButton
              label={t('clanWar.launch')}
              disabledReason={strikeRefusal}
              onCommit={() => {
                actions.start.mutate({ acknowledgeShieldLoss: acknowledgeStartShield, pace: strikePace,
                  ...(acknowledgeRadiation ? { acknowledgeRadiationLoss: true } : {}) });
              }}
            />
          </div>
          <Button size="sm" variant="ghost" disabled={actions.cancel.isPending}
            onClick={() => { actions.cancel.mutate(); }}>{t('clanWar.cancel')}</Button>
          {actions.start.isError && <p role="alert" className="text-caption text-v2-warn">{describeError(actions.start.error)}</p>}
          {actions.cancel.isError && <p role="alert" className="text-caption text-v2-warn">{describeError(actions.cancel.error)}</p>}
        </Plate>
      )}

      {operation.status === 'RETURNING' && (
        <Plate className="p-3">
          <h3 className="text-caption font-semibold text-v2-ink">{t('clanWar.returning')}</h3>
          <p className="mt-1 text-caption text-v2-ink-2">{t('clanWar.returningHint')}</p>
        </Plate>
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
const anchor = (at: number): string => (at < 14 ? 'translate-x-0' : at > 86 ? '-translate-x-full' : '-translate-x-1/2');

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
    <Plate className="flex flex-col gap-3 p-3">
      <div data-war-target="" className="flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          {operation.target.kind === 'MONUMENT'
            ? <span className="flex size-11 shrink-0 items-center justify-center rounded-control border border-v2-line text-v2-self"><Icon id="i-attack" className="size-6" /></span>
            : <img src={planetArt(operation.target.planetId)} alt="" className="size-11 shrink-0 rounded-full object-cover" />}
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <span className="text-micro text-v2-ink-3">{t('clanWar.target')}</span>
              {operation.target.kind !== 'MONUMENT' && operation.target.username && <span className="rounded-chip border border-v2-rival/60 px-1 font-v2-mono text-micro font-semibold leading-4 text-v2-rival">
                {operation.target.username}
              </span>}
              <span className="break-words text-caption font-semibold text-v2-ink">{operation.target.kind === 'MONUMENT'
                ? monumentName(operation.target.monumentOrdinal ?? undefined)
                : operation.target.planetName}</span>
            </p>
            {operation.status === 'ASSEMBLING' && (
              <p className="text-micro text-v2-ink-2">{t('clanWar.expires', { time: countdown(operation.expiresAt.getTime() - now) })}</p>
            )}
          </div>
          <span aria-live="polite" className="shrink-0 text-micro font-semibold text-v2-self">
            {t(`clanWar.operationStatus.${operation.status}`)}
          </span>
        </div>

        <div data-war-line="" className="relative h-[4.5rem] font-v2-ui">
          {/* Waves in flight, named above the line on two alternating rows so neighbours never collide. */}
          {flying.map(({ wave, at }, index) => (
            <span
              key={`label-${wave.id}`}
              data-wave-label=""
              className={`absolute flex items-center gap-1 whitespace-nowrap text-micro leading-none text-v2-ink-2 ${anchor(at)} ${index % 2 === 0 ? 'top-0' : 'top-3.5'}`}
              style={{ left: `${String(at)}%` }}
            >
              <span className="font-semibold text-v2-ink">{wave.username} · {fleetCount(wave.fleet)}</span>
              {wave.arrivesAt && (
                <span className="font-v2-mono text-v2-ink-3">{duration(Math.max(1, (wave.arrivesAt.getTime() - now) / 60_000))}</span>
              )}
            </span>
          ))}
          {staged > 0 && (
            <span className={`absolute top-0 whitespace-nowrap text-micro font-semibold leading-none text-v2-ally ${anchor(GATHER)}`} style={{ left: `${String(GATHER)}%` }}>
              {t('clanWar.readyCount', { count: staged })}
            </span>
          )}

          <span aria-hidden="true" className="absolute inset-x-1 top-8 h-0.5 -translate-y-1/2 rounded-full bg-v2-ally/30" />
          <span aria-hidden="true" className="absolute left-1 top-8 h-0.5 -translate-y-1/2 rounded-full bg-v2-ally/70" style={{ width: `${String(GATHER)}%` }} />
          <span aria-hidden="true" className="absolute top-8 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-v2-ally bg-v2-panel" style={{ left: `${String(GATHER)}%` }} />
          <span aria-hidden="true" className="absolute right-0 top-8 size-3.5 -translate-y-1/2 rounded-full border-2 border-v2-rival bg-v2-panel" />
          {operation.contributions.map((wave) => {
            const at = placeOf(wave, now);
            return at === null ? null : (
              <span
                key={wave.id}
                data-wave-marker=""
                title={wave.username}
                className="absolute top-8 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-v2-ally ring-2 ring-v2-panel"
                style={{ left: `${String(at)}%` }}
              />
            );
          })}

          <span className={`absolute top-12 whitespace-nowrap text-micro text-v2-ink-2 ${anchor(GATHER)}`} style={{ left: `${String(GATHER)}%` }}>
            {t('clanWar.gatherAt', { world: operation.staging.name })}
          </span>
          <span className="absolute right-0 top-12 whitespace-nowrap text-micro text-v2-ink-2">{t('clanWar.target')}</span>
        </div>
      </div>
    </Plate>
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
    <Plate className="flex flex-col gap-3 p-3">
      <div role="group" aria-label={t('clanWar.seats')} className="grid grid-cols-5 gap-1.5">
        {Array.from({ length: CLAN.maxMembers }, (_, index) => {
          const member = seats[index];
          if (!member) {
            return (
              <button key={`open-${String(index)}`} type="button" disabled
                className="flex min-w-0 flex-col items-center gap-1 text-v2-ink-3">
                <span className="grid size-10 place-items-center rounded-control border border-dashed border-v2-line-hi text-body">+</span>
                <span className="max-w-full truncate text-micro">{t('clanWar.seatEmpty')}</span>
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
              aria-pressed={on}
              aria-label={`${member.username} · ${String(share)}%`}
              {...(self ? { 'data-self': '' } : {})}
              onClick={() => { setChosen(member.playerId); }}
              className="flex min-w-0 flex-col items-center gap-1"
            >
              <span className={`grid size-10 place-items-center rounded-control border font-v2-mono text-caption font-semibold ${
                self ? 'border-v2-self/70 text-v2-self' : 'border-v2-line-hi text-v2-ink'
              } ${on ? 'bg-v2-raise ring-2 ring-v2-ink/30' : 'bg-v2-panel'}`}>
                {initials(member.username)}
              </span>
              <span aria-hidden="true" className="h-1 w-8 overflow-hidden rounded-full bg-v2-ally/15">
                <span data-seat-share="" className={`block h-full rounded-full ${self ? 'bg-v2-self' : 'bg-v2-ally'}`} style={{ width: `${String(share)}%` }} />
              </span>
              <span className={`max-w-full truncate text-micro ${self ? 'text-v2-self' : 'text-v2-ink-2'}`}>
                {self ? t('clanWar.seatYou') : member.username}
              </span>
            </button>
          );
        })}
      </div>

      {selected && (
        <div data-seat-waves="" className="flex flex-col gap-2 border-t border-v2-line/70 pt-2.5">
          {theirs.length === 0 ? (
            <p className="text-caption text-v2-ink-2">{t('clanWar.seatNoWave', { name: selected.username })}</p>
          ) : theirs.map((wave) => (
            <div key={wave.id} className="flex flex-col gap-1">
              <p className="flex flex-wrap items-baseline justify-between gap-x-2">
                <span className="break-words text-caption font-semibold text-v2-ink">{t('clanWar.wave', { name: wave.username, world: wave.originPlanetName })}</span>
                <span className="text-micro text-v2-self">{t(`clanWar.status.${wave.status}`)}</span>
              </p>
              <p className="flex flex-wrap gap-x-2 gap-y-0.5 text-micro text-v2-ink-2">
                {MOBILE_HULLS.filter((hull) => (wave.fleet[hull] ?? 0) > 0).map((hull) => (
                  <span key={hull} className="flex items-center gap-1">
                    <ClassEmblem cls={HULLS[hull].cls} className="size-2.5 text-v2-ink-3" />
                    {hullName(hull)} ×{wave.fleet[hull] ?? 0}
                  </span>
                ))}
              </p>
              <p className="font-v2-mono text-micro text-v2-ink-3">
                {t('clanWar.waveMeta', { ships: fleetCount(wave.fleet), bulk: full(wave.bulk) })}
                {wave.arrivesAt && <> · {t('clanWar.eta', { time: countdown(wave.arrivesAt.getTime() - now) })}</>}
              </p>
              {wave.canRecall && (
                <Button size="sm" variant="ghost" disabled={actions.recall.isPending}
                  onClick={() => { actions.recall.mutate(wave.id); }}>{t('clanWar.recall')}</Button>
              )}
            </div>
          ))}
        </div>
      )}
    </Plate>
  );
}

/**
 * THE SHARED TREASURY, AS PROGRESS. What the treasury holds against what the next level
 * costs, resource by resource in their own colours — the gap is the reason to give — with
 * the gift on its own page and, for the leader, the upgrade once it is paid for.
 */
function Treasury({ war, role, canGive, onDonate }: {
  war: ClanWar;
  role: 'LEADER' | 'MEMBER';
  canGive: boolean;
  onDonate: () => void;
}) {
  const { t } = useTranslation();
  const actions = useClanWarActions();
  return (
    <Plate className="flex flex-col gap-2.5 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-caption font-semibold text-v2-ink">{t('clanWar.treasury')}</h3>
        <span className="text-micro text-v2-ink-3">{war.maxLevel ? t('clanWar.maxLevel') : t('clanWar.nextCost')}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {RESOURCE_KEYS.map((key) => {
          const have = war.treasury[key];
          const need = war.nextCost?.[key] ?? 0;
          const share = need > 0 ? Math.min(100, Math.round((have / need) * 100)) : 100;
          return (
            <div key={key} data-treasury={key} className="grid grid-cols-[0.875rem_minmax(0,1fr)_auto] items-center gap-2">
              <img src={RESOURCE_ART[key]} alt="" aria-hidden className="size-3.5 object-contain" />
              <span aria-hidden="true" className={`h-1.5 overflow-hidden rounded-full ${EMPTY[key]}`}>
                <span className={`block h-full rounded-full ${FILL[key]}`} style={{ width: `${String(share)}%` }} />
              </span>
              <span className="font-v2-mono text-micro text-v2-ink">
                {full(have)}{need > 0 && <span className="text-v2-ink-3"> / {full(need)}</span>}
              </span>
            </div>
          );
        })}
      </div>
      {!war.maxLevel && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={!canGive} onClick={onDonate}>{t('clanWar.donate')}</Button>
          {role === 'LEADER' && (
            <Button size="sm" variant="primary"
              disabled={!war.canUpgrade || war.level === null || actions.upgrade.isPending}
              onClick={() => { if (war.level !== null) actions.upgrade.mutate(war.level); }}>
              {t('clanWar.upgrade')}
            </Button>
          )}
        </div>
      )}
      {actions.upgrade.isError && <p role="alert" className="text-caption text-v2-warn">{describeError(actions.upgrade.error)}</p>}
    </Plate>
  );
}

/** The clan hangar in the allies' colour: what stands in it, then what is on its way. */
function ClanHangar({ war }: { war: ClanWar }) {
  const { t } = useTranslation();
  const total = Math.max(1, war.hangar.total);
  const share = (value: number): string => `${String(Math.round((Math.max(0, value) / total) * 100))}%`;
  return (
    <Plate className="p-3">
      <div data-clan-hangar="" className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-caption font-semibold text-v2-ink">{t('clanWar.hangar')}</h3>
          <strong className="font-v2-mono tabular-nums text-micro text-v2-ink">
            {full(war.hangar.used)} / {full(war.hangar.total)}
            <span className="ml-2 font-v2-ui font-normal text-v2-self">{t('clanWar.level', { level: war.level ?? 1 })}</span>
          </strong>
        </div>
        <span aria-hidden="true" className="flex h-1.5 overflow-hidden rounded-full bg-v2-ally/15">
          <span data-part="used" className="h-full bg-v2-ally" style={{ width: share(war.hangar.used) }} />
          <span data-part="reserved" className="h-full" style={{ width: share(war.hangar.reserved), backgroundColor: 'color-mix(in srgb, var(--color-v2-ally) 42%, transparent)' }} />
        </span>
        <p className="text-micro text-v2-ink-2">{t('clanWar.capacity', {
          used: full(war.hangar.used), reserved: full(war.hangar.reserved), total: full(war.hangar.total),
        })}</p>
        <p className="text-micro leading-snug text-v2-ink-3">{t('clanWar.hangarHint')}</p>
      </div>
    </Plate>
  );
}
