import {
  MOBILE_HULLS, fleetCount, pacesForMinutes, type Fleet, type HullId, type MissionPace, type Resources,
} from '@astera/rules';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useClanWarActions } from '../api/queries.js';
import { ApiError } from '../api/client.js';
import type { ClanWar, PlanetView } from '../api/schemas.js';
import { describeError } from '../i18n/errors.js';
import { hullName } from '../i18n/names.js';
import { full } from '../lib/format.js';
import { countdown, duration, useNow } from '../lib/time.js';
import { Button, Plate } from '../ui/kit/index.js';
import { PaceRow } from '../ui/PaceRow.js';

const ZERO: Resources = { alloy: 0, crystal: 0, deuterium: 0 };
const RESOURCE_KEYS = ['alloy', 'crystal', 'deuterium'] as const;

/** The operation, purse and fleet quote sit together because they decide one commitment. */
export function ClanWarPanel({ war, role, mature, worlds }: {
  war: ClanWar;
  role: 'LEADER' | 'MEMBER';
  mature: boolean;
  worlds: readonly PlanetView[];
}) {
  const { t } = useTranslation();
  const actions = useClanWarActions();
  const now = useNow();
  const [originId, setOriginId] = useState('');
  const [donorId, setDonorId] = useState('');
  const [fleet, setFleet] = useState<Fleet>({});
  const [donation, setDonation] = useState<Resources>({ ...ZERO });
  const [quotedKey, setQuotedKey] = useState<string | null>(null);
  const [acknowledgeShield, setAcknowledgeShield] = useState(false);
  const [acknowledgeStartShield, setAcknowledgeStartShield] = useState(false);
  const [wantedPace, setWantedPace] = useState<MissionPace>(1);
  const selectedOriginId = originId.length > 0 ? originId : (worlds[0]?.planet.id ?? '');
  const selectedDonorId = donorId.length > 0 ? donorId : (worlds[0]?.planet.id ?? '');
  const origin = worlds.find((world) => world.planet.id === selectedOriginId);
  const donor = worlds.find((world) => world.planet.id === selectedDonorId);
  const quoteKey = `${selectedOriginId}:${JSON.stringify(fleet)}`;
  const quote = quotedKey === quoteKey ? actions.quote.data : undefined;
  const blockingRefusals = quote?.refusals.filter((refusal) => refusal.code !== 'SHIELD_WOULD_DROP') ?? [];
  const quoteCanSend = quote !== undefined && (quote.ok
    || (quote.shieldWouldDrop !== null && blockingRefusals.length === 0));
  const operation = war.operation;
  const currentWaves = operation?.contributions ?? [];
  const inbound = currentWaves.some((wave) => wave.status === 'OUTBOUND');
  const startReason = role !== 'LEADER' ? t('clanWar.onlyLeader')
    : operation?.status !== 'ASSEMBLING' ? t('clanWar.notAssembling')
      : inbound ? t('clanWar.inboundReason')
        : operation.pool.waves === 0 ? t('clanWar.noWaveReason')
          : operation.pool.combatHulls === 0 ? t('clanWar.noCombatReason') : null;
  /*
    WHEN THE STRIKE LANDS IS THE LEADER'S CALL. Review 2026-09-22, #2 · plan §15.5a.
    The server times the combined leg at full speed; the rungs divide it, so the arrival on screen
    is the arrival the strike flies. A rung that stops being legal falls back to full speed.
  */
  const strikeMinutes = operation?.pool.strikeMinutes ?? null;
  const strikePaces = strikeMinutes === null ? [] : pacesForMinutes(strikeMinutes);
  const strikePace = strikePaces.includes(wantedPace) ? wantedPace : 1;

  const setCount = (hull: HullId, value: number): void => {
    const next = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
    setFleet((current) => ({ ...current, [hull]: next }));
    setQuotedKey(null);
  };

  if (!war.available) return <p className="px-2 py-4 text-body text-dim">{t('clanWar.unavailable')}</p>;

  return <div className="flex min-w-0 flex-col gap-3 pb-5">
    <Plate className="p-3">
      <h3 className="headline text-title text-bone">{t('clanWar.purpose')}</h3>
      <p className="mt-2 text-body leading-relaxed text-dim">{t('clanWar.purposeHint')}</p>
    </Plate>

    <Plate className="p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-title text-bone">{t('clanWar.hangar')}</h3>
        <strong className="num text-body text-crystal">{t('clanWar.level', { level: war.level ?? 1 })}</strong>
      </div>
      <p className="mt-2 text-body text-bone">{t('clanWar.capacity', {
        used: full(war.hangar.used), reserved: full(war.hangar.reserved), total: full(war.hangar.total),
      })}</p>
      <p className="mt-1 text-caption leading-relaxed text-dim">{t('clanWar.hangarHint')}</p>
    </Plate>

    <Plate className="p-3">
      <h3 className="text-title text-bone">{t('clanWar.treasury')}</h3>
      <p className="mt-1 text-caption text-dim">{war.maxLevel ? t('clanWar.maxLevel') : t('clanWar.nextCost')}</p>
      <div className="mt-2 grid grid-cols-3 gap-1 text-center">
        {RESOURCE_KEYS.map((key) => <div key={key} className="min-w-0 rounded-control bg-void/70 p-2">
          <span className="block truncate text-caption text-dim">{t(`clan.resources.${key}`)}</span>
          <strong className="num block text-body text-bone">{full(war.treasury[key])}</strong>
          {war.nextCost ? <span className="num block text-caption text-dim">/ {full(war.nextCost[key])}</span> : null}
        </div>)}
      </div>
      {!war.maxLevel && <>
        <label className="mt-3 block text-caption text-dim" htmlFor="clan-war-donor">{t('clanWar.selectWorld')}</label>
        <select id="clan-war-donor" className="mt-1 w-full rounded-control bg-void p-2 text-body text-bone"
          value={selectedDonorId} onChange={(event) => {
            setDonorId(event.target.value);
            setDonation({ ...ZERO });
          }}>
          {worlds.map((world) => <option key={world.planet.id} value={world.planet.id}>{world.planet.name}</option>)}
        </select>
        <div className="mt-2 grid grid-cols-3 gap-1">
          {RESOURCE_KEYS.map((key) => {
            const available = Math.max(0, Math.floor(donor?.planet[key] ?? 0));
            const limit = Math.min(war.room?.[key] ?? 0, available);
            return <label key={key} className="min-w-0 text-caption text-dim">
            <span className="block truncate">{t(`clan.resources.${key}`)}</span>
            <span className="num block text-faint">{t('clanWar.available', { amount: full(available) })}</span>
            <input type="number" min={0} max={limit} value={donation[key]}
              className="mt-1 w-full rounded-control bg-void p-2 text-body text-bone"
              onChange={(event) => { setDonation((current) => ({ ...current,
                [key]: Math.min(limit, Math.max(0, Math.floor(Number(event.target.value) || 0))) })); }} />
          </label>;
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" disabled={!donor || actions.donate.isPending
            || RESOURCE_KEYS.every((key) => donation[key] === 0)
            || RESOURCE_KEYS.some((key) => donation[key] > Math.min(
              war.room?.[key] ?? 0,
              Math.max(0, Math.floor(donor.planet[key])),
            ))}
            onClick={() => { if (donor) actions.donate.mutate({ planetId: donor.planet.id,
              resources: donation }, { onSuccess: () => { setDonation({ ...ZERO }); } }); }}>
            {t('clanWar.donate')}
          </Button>
          {role === 'LEADER' && <Button size="sm" variant="primary"
            disabled={!war.canUpgrade || war.level === null || actions.upgrade.isPending}
            onClick={() => { if (war.level !== null) actions.upgrade.mutate(war.level); }}>
            {t('clanWar.upgrade')}
          </Button>}
        </div>
      </>}
      {actions.donate.isError && <p role="alert" className="mt-2 text-caption text-threat">{describeError(actions.donate.error)}</p>}
      {actions.upgrade.isError && <p role="alert" className="mt-2 text-caption text-threat">{describeError(actions.upgrade.error)}</p>}
    </Plate>

    {!operation ? <Plate className="p-3">
      <h3 className="text-title text-bone">{t('clanWar.target')}</h3>
      <p className="mt-2 text-body leading-relaxed text-dim">{t('clanWar.noTarget')}</p>
    </Plate> : <>
      <Plate className="p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-title text-bone">{t('clanWar.target')}</h3>
          <span aria-live="polite" className="text-caption text-crystal">
            {t(`clanWar.operationStatus.${operation.status}`)}
          </span>
        </div>
        <p className="mt-2 break-words text-body text-bone">{operation.target.username} · {operation.target.planetName}</p>
        <p className="num text-caption text-dim">{operation.target.position.x}, {operation.target.position.y}, {operation.target.position.z}</p>
        <p className="mt-2 text-caption text-dim">{t('clanWar.staging', { world: operation.staging.name })}</p>
        {operation.status === 'ASSEMBLING' && <p className="mt-1 text-caption text-bone">
          {t('clanWar.expires', { time: countdown(operation.expiresAt.getTime() - now) })}
        </p>}
      </Plate>

      <Plate className="p-3">
        <h3 className="text-title text-bone">{t('clanWar.waves')}</h3>
        <p className="mt-1 text-caption text-dim">{t('clanWar.techHint')}</p>
        {currentWaves.length === 0 ? <p className="mt-2 text-body text-dim">{t('clanWar.noWaves')}</p>
          : <ul className="mt-2 flex flex-col gap-2">
            {currentWaves.map((wave) => <li key={wave.id} className="min-w-0 rounded-control border border-line-soft p-2">
              <div className="flex flex-wrap items-baseline justify-between gap-1">
                <strong className="break-words text-body text-bone">{t('clanWar.wave', {
                  name: wave.username, world: wave.originPlanetName })}</strong>
                <span className="text-caption text-crystal">{t(`clanWar.status.${wave.status}`)}</span>
              </div>
              <p className="text-caption text-dim">{t('clanWar.waveMeta', {
                ships: fleetCount(wave.fleet), bulk: full(wave.bulk) })}</p>
              <p className="break-words text-caption text-dim">{MOBILE_HULLS.filter((hull) => (wave.fleet[hull] ?? 0) > 0)
                .map((hull) => `${hullName(hull)} ×${wave.fleet[hull] ?? 0}`).join(' · ')}</p>
              {wave.arrivesAt && <p className="text-caption text-dim">{t('clanWar.eta', {
                time: countdown(wave.arrivesAt.getTime() - now) })}</p>}
              {wave.canRecall && <Button size="sm" variant="ghost" disabled={actions.recall.isPending}
                onClick={() => { actions.recall.mutate(wave.id); }}>{t('clanWar.recall')}</Button>}
            </li>)}
          </ul>}
      </Plate>

      {operation.status === 'ASSEMBLING' && <Plate className="p-3">
        <h3 className="text-title text-bone">{t('clanWar.composer')}</h3>
        {!mature ? <p className="mt-2 text-body text-dim">{t('clanWar.immature')}</p> : <>
          <label className="mt-2 block text-caption text-dim" htmlFor="clan-war-origin">{t('clanWar.origin')}</label>
          <select id="clan-war-origin" className="mt-1 w-full rounded-control bg-void p-2 text-body text-bone"
            value={selectedOriginId} onChange={(event) => {
              setOriginId(event.target.value);
              setFleet({});
              setQuotedKey(null);
              setAcknowledgeShield(false);
            }}>
            {worlds.map((world) => <option key={world.planet.id} value={world.planet.id}>{world.planet.name}</option>)}
          </select>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {MOBILE_HULLS.filter((hull) => (origin?.fleet[hull] ?? 0) > 0).map((hull) =>
              <label key={hull} className="min-w-0 text-caption text-dim">{hullName(hull)} · {origin?.fleet[hull] ?? 0}
                <input type="number" min={0} max={origin?.fleet[hull] ?? 0} value={fleet[hull] ?? 0}
                  className="mt-1 w-full rounded-control bg-void p-2 text-body text-bone"
                  onChange={(event) => { setCount(hull, Math.min(
                    Number(event.target.value), origin?.fleet[hull] ?? 0,
                  )); }} />
              </label>)}
          </div>
          <Button size="sm" className="mt-3" disabled={!origin || fleetCount(fleet) === 0 || actions.quote.isPending}
            onClick={() => { if (origin) actions.quote.mutate({ originPlanetId: origin.planet.id, fleet },
              { onSuccess: () => { setQuotedKey(quoteKey); } }); }}>{t('clanWar.quote')}</Button>
          {!origin && <p className="mt-1 text-caption text-dim">{t('clanWar.noOrigin')}</p>}
          {origin && fleetCount(fleet) === 0 && <p className="mt-1 text-caption text-dim">{t('clanWar.noFleet')}</p>}
          {actions.quote.isError && <p role="alert" className="mt-2 text-caption text-threat">{describeError(actions.quote.error)}</p>}
          {quote && <div className="mt-3 rounded-control border border-line-soft p-2 text-caption">
            <p className="text-bone">{t('clanWar.fuel')}: {full(quote.fuel.total)} / {full(quote.fuel.available)}</p>
            {quote.fuel.legs.map((leg) => <p key={leg.leg} className="break-words text-dim">
              {t('clanWar.fuelLeg', { leg: t(`clanWar.fuelLegName.${leg.leg}`),
                distance: full(leg.distance), fuel: full(leg.fuel) })}
            </p>)}
            <p className="mt-1 text-dim">{t('clanWar.bay', quote.bays)}</p>
            <p className="text-dim">{t('clanWar.personal', {
              used: full(quote.personalHangar.used), total: full(quote.personalHangar.total),
              after: full(quote.personalHangar.afterSend) })}</p>
            <p className="text-dim">{t('clanWar.pool', {
              after: full(quote.clanHangar.afterSend), total: full(quote.clanHangar.total) })}</p>
            {quote.travel.earliestHome && <p className="text-dim">{t('clanWar.earliestHome', {
              time: countdown(quote.travel.earliestHome.getTime() - now) })}</p>}
            {quote.latestStartAt && <p className="text-dim">{t('clanWar.latestStart', {
              time: countdown(quote.latestStartAt.getTime() - now) })}</p>}
            {blockingRefusals.map((refusal) => <p key={refusal.code} role="alert" className="text-threat">
              {describeError(new ApiError(refusal.code, refusal.message, 409))}</p>)}
            {quote.shieldWouldDrop && <>
              <p className="mt-2 text-threat">{t('clanWar.shield', { kind: quote.shieldWouldDrop.kind })}</p>
              <label className="mt-1 flex items-start gap-2 text-bone">
                <input type="checkbox" checked={acknowledgeShield}
                  onChange={(event) => { setAcknowledgeShield(event.target.checked); }} />
                {t('clanWar.acknowledgeShield')}
              </label>
            </>}
            <Button variant="commit" size="sm" className="mt-3 w-full" disabled={!quoteCanSend
              || (quote.shieldWouldDrop !== null && !acknowledgeShield) || actions.contribute.isPending}
              onClick={() => { if (origin) actions.contribute.mutate({ originPlanetId: origin.planet.id,
                fleet, acknowledgeShieldLoss: acknowledgeShield }, { onSuccess: () => {
                  setFleet({}); setQuotedKey(null); setAcknowledgeShield(false);
                } }); }}>{t('clanWar.send')}</Button>
          </div>}
          {!quote && fleetCount(fleet) > 0 && <p className="mt-1 text-caption text-dim">{t('clanWar.quoteFirst')}</p>}
          {actions.contribute.isError && <p role="alert" className="mt-2 text-caption text-threat">
            {describeError(actions.contribute.error)}</p>}
        </>}
      </Plate>}

      {role === 'LEADER' && operation.status === 'ASSEMBLING' && <Plate className="p-3">
        {startReason && <p className="mb-2 text-caption text-dim">{startReason}</p>}
        {operation.startShieldWouldDrop && <>
          <p className="mb-2 text-caption text-threat">{t('clanWar.launchShield', {
            kind: operation.startShieldWouldDrop.kind,
          })}</p>
          <label className="mb-2 flex items-start gap-2 text-caption text-bone">
            <input type="checkbox" checked={acknowledgeStartShield}
              onChange={(event) => { setAcknowledgeStartShield(event.target.checked); }} />
            {t('clanWar.acknowledgeShield')}
          </label>
        </>}
        {strikeMinutes !== null && <>
          <p data-clan-strike-eta className="text-caption text-dim">{t('clanWar.strikeEta', {
            time: duration(strikeMinutes / strikePace) })}</p>
          <PaceRow data-clan-pace paces={strikePaces} pace={strikePace} onChange={setWantedPace}
            hint={t('clanWar.paceHint')} />
        </>}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="commit" size="sm" disabled={startReason !== null
            || (operation.startShieldWouldDrop !== null && !acknowledgeStartShield)
            || actions.start.isPending}
            onClick={() => { actions.start.mutate({
              acknowledgeShieldLoss: acknowledgeStartShield, pace: strikePace,
            }); }}>{t('clanWar.launch')}</Button>
          <Button size="sm" variant="ghost" disabled={actions.cancel.isPending}
            onClick={() => { actions.cancel.mutate(); }}>{t('clanWar.cancel')}</Button>
        </div>
        {actions.start.isError && <p role="alert" className="mt-2 text-caption text-threat">{describeError(actions.start.error)}</p>}
        {actions.cancel.isError && <p role="alert" className="mt-2 text-caption text-threat">{describeError(actions.cancel.error)}</p>}
      </Plate>}

      {operation.status === 'RETURNING' && <Plate className="p-3">
        <h3 className="text-title text-bone">{t('clanWar.returning')}</h3>
        <p className="mt-2 text-body text-dim">{t('clanWar.returningHint')}</p>
      </Plate>}
    </>}
  </div>;
}
