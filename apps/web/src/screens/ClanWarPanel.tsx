import {
  MOBILE_HULLS, fleetCount, pacesForMinutes, type Fleet, type HullId, type MissionPace, type Resources,
} from '@astera/rules';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useClanWarActions } from '../api/queries.js';
import { ApiError } from '../api/client.js';
import type { ClanWar, PlanetView } from '../api/schemas.js';
import { describeError } from '../i18n/errors.js';
import { hullName } from '../i18n/names.js';
import { full } from '../lib/format.js';
import { countdown, duration, useNow } from '../lib/time.js';
import { Button, Plate } from '../v2/kit/Surface.js';
import { HULL_ART, planetArt } from '../ui/assets.js';
import { HullMark } from '../ui/icons/hulls.js';
import { PaceRow } from '../ui/PaceRow.js';
import { QuantityStepper } from '../ui/QuantityStepper.js';
import { HoldButton } from '../v2/kit/HoldButton.js';

/** How long the picked fleet has to sit still before its quote is asked for. */
const QUOTE_SETTLE_MS = 350;

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

  /*
    THE QUOTE ASKS ITSELF (B14). The route, the fuel, the bays and the refusals follow the
    ships as they are picked, once the picking settles; a button between the fleet and its
    price was one press that only ever said "show me". A reply for a fleet since changed
    is never shown: it is filed under the key it was asked with.
  */
  const requestQuote = actions.quote.mutate;
  const originPlanetId = origin?.planet.id ?? null;
  useEffect(() => {
    if (originPlanetId === null || fleetCount(fleet) === 0) return;
    const asked = `${originPlanetId}:${JSON.stringify(fleet)}`;
    const timer = setTimeout(() => {
      requestQuote({ originPlanetId, fleet }, { onSuccess: () => { setQuotedKey(asked); } });
    }, QUOTE_SETTLE_MS);
    return () => { clearTimeout(timer); };
  }, [requestQuote, originPlanetId, fleet]);

  /** Why the wave cannot go yet, on the held button's face — or null when it can. */
  const waveRefusal = !origin ? t('clanWar.noOrigin')
    : fleetCount(fleet) === 0 ? t('clanWar.noFleet')
      : actions.contribute.isPending ? t('clanWar.sending')
        : quote === undefined ? (actions.quote.isError ? describeError(actions.quote.error) : t('clanWar.quoting'))
          : blockingRefusals[0] ? describeError(new ApiError(blockingRefusals[0].code, blockingRefusals[0].message, 409))
            : quote.shieldWouldDrop !== null && !acknowledgeShield ? t('clanWar.acknowledgeFirst')
              : quoteCanSend ? null : t('clanWar.quoting');

  /** The strike's whole weight, so each wave's share of it can be drawn. */
  const totalBulk = currentWaves.reduce((sum, wave) => sum + wave.bulk, 0);

  if (!war.available) return <p className="px-2 py-4 text-body text-v2-ink-2">{t('clanWar.unavailable')}</p>;

  const hangar = <ClanHangar war={war} />;
  const purposeCard = (
    <Plate className="p-3">
      <h3 className="text-caption font-semibold text-v2-ink">{t('clanWar.purpose')}</h3>
      <p className="mt-1 text-micro leading-snug text-v2-ink-2">{t('clanWar.purposeHint')}</p>
    </Plate>
  );
  const treasuryCard = (
    <Plate className="p-3">
      <h3 className="text-body font-semibold text-v2-ink">{t('clanWar.treasury')}</h3>
      <p className="mt-1 text-caption text-v2-ink-2">{war.maxLevel ? t('clanWar.maxLevel') : t('clanWar.nextCost')}</p>
      <div className="mt-2 grid grid-cols-3 gap-1 text-center">
        {RESOURCE_KEYS.map((key) => <div key={key} className="min-w-0 rounded-control bg-v2-void/70 p-2">
          <span className="block truncate text-caption text-v2-ink-2">{t(`clan.resources.${key}`)}</span>
          <strong className="font-v2-mono tabular-nums block text-body text-v2-ink">{full(war.treasury[key])}</strong>
          {war.nextCost ? <span className="font-v2-mono tabular-nums block text-caption text-v2-ink-2">/ {full(war.nextCost[key])}</span> : null}
        </div>)}
      </div>
      {!war.maxLevel && <>
        <label className="mt-3 block text-caption text-v2-ink-2" htmlFor="clan-war-donor">{t('clanWar.selectWorld')}</label>
        <select id="clan-war-donor" className="mt-1 w-full rounded-control bg-v2-void p-2 text-body text-v2-ink"
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
            return <label key={key} className="min-w-0 text-caption text-v2-ink-2">
            <span className="block truncate">{t(`clan.resources.${key}`)}</span>
            <span className="font-v2-mono tabular-nums block text-v2-ink-3">{t('clanWar.available', { amount: full(available) })}</span>
            <input type="number" min={0} max={limit} value={donation[key]}
              className="mt-1 w-full rounded-control bg-v2-void p-2 text-body text-v2-ink"
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
      {actions.donate.isError && <p role="alert" className="mt-2 text-caption text-v2-hostile">{describeError(actions.donate.error)}</p>}
      {actions.upgrade.isError && <p role="alert" className="mt-2 text-caption text-v2-hostile">{describeError(actions.upgrade.error)}</p>}
    </Plate>
  );

  return <div className="flex min-w-0 flex-col gap-3 pb-5">
    {!operation ? <>
      {purposeCard}
    <Plate className="p-3">
      <h3 className="text-body font-semibold text-v2-ink">{t('clanWar.target')}</h3>
      <p className="mt-2 text-body leading-relaxed text-v2-ink-2">{t('clanWar.noTarget')}</p>
    </Plate>
      {hangar}
      {treasuryCard}
    </> : <>
      <WarTarget operation={operation} now={now} />

      <Plate className="p-3">
        <h3 className="text-caption font-semibold text-v2-ink">{t('clanWar.waves')}</h3>
        <p className="mt-0.5 text-micro text-v2-ink-2">{t('clanWar.techHint')}</p>
        {currentWaves.length === 0 ? <p className="mt-2 text-caption text-v2-ink-2">{t('clanWar.noWaves')}</p>
          : <ul className="mt-2 flex flex-col gap-2">
            {currentWaves.map((wave) => <li key={wave.id} className="min-w-0 rounded-control border border-v2-line p-2">
              <div className="flex flex-wrap items-baseline justify-between gap-1">
                <strong className="break-words text-caption text-v2-ink">{t('clanWar.wave', {
                  name: wave.username, world: wave.originPlanetName })}</strong>
                <span className="text-micro text-v2-self">{t(`clanWar.status.${wave.status}`)}</span>
              </div>
              {/* Each commander's share of the strike, in the allies' colour. */}
              <span aria-hidden="true" className="mt-1.5 block h-1 overflow-hidden rounded-full bg-v2-line">
                <span data-wave-share="" className="block h-full rounded-full bg-v2-ally"
                  style={{ width: `${String(Math.round((wave.bulk / Math.max(1, totalBulk)) * 100))}%` }} />
              </span>
              <p className="mt-1 text-micro text-v2-ink-2">{t('clanWar.waveMeta', {
                ships: fleetCount(wave.fleet), bulk: full(wave.bulk) })}</p>
              <p className="break-words text-micro text-v2-ink-3">{MOBILE_HULLS.filter((hull) => (wave.fleet[hull] ?? 0) > 0)
                .map((hull) => `${hullName(hull)} ×${wave.fleet[hull] ?? 0}`).join(' · ')}</p>
              {wave.arrivesAt && <p className="text-micro text-v2-ink-2">{t('clanWar.eta', {
                time: countdown(wave.arrivesAt.getTime() - now) })}</p>}
              {wave.canRecall && <Button size="sm" variant="ghost" disabled={actions.recall.isPending}
                onClick={() => { actions.recall.mutate(wave.id); }}>{t('clanWar.recall')}</Button>}
            </li>)}
          </ul>}
      </Plate>

      {operation.status === 'ASSEMBLING' && <Plate className="p-3">
        <h3 className="text-body font-semibold text-v2-ink">{t('clanWar.composer')}</h3>
        {!mature ? <p className="mt-2 text-body text-v2-ink-2">{t('clanWar.immature')}</p> : <>
          <label className="mt-2 block text-caption text-v2-ink-2" htmlFor="clan-war-origin">{t('clanWar.origin')}</label>
          <select id="clan-war-origin" className="mt-1 w-full rounded-control bg-v2-void p-2 text-body text-v2-ink"
            value={selectedOriginId} onChange={(event) => {
              setOriginId(event.target.value);
              setFleet({});
              setQuotedKey(null);
              setAcknowledgeShield(false);
            }}>
            {worlds.map((world) => <option key={world.planet.id} value={world.planet.id}>{world.planet.name}</option>)}
          </select>
          {/* The launch's own row (B14): the ship, how many stand home, the stepper at its right. */}
          <div className="mt-2">
            {MOBILE_HULLS.filter((hull) => (origin?.fleet[hull] ?? 0) > 0).map((hull) => {
              const held = origin?.fleet[hull] ?? 0;
              const art = HULL_ART[hull];
              return <div key={hull} data-hull-row={hull}
                className={`flex items-center gap-2 border-b border-v2-line/70 px-1 py-2 last:border-b-0 ${
                  (fleet[hull] ?? 0) > 0 ? 'bg-v2-self/5' : ''}`}>
                <span data-art className="grid size-8 shrink-0 place-items-center">
                  {art ? <img src={art} alt="" aria-hidden className="size-8 object-contain" loading="lazy" />
                    : <HullMark hull={hull} className="size-6 text-v2-ink-3" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-caption font-semibold text-v2-ink">{hullName(hull)}</span>
                  <span className="block font-v2-mono text-micro text-v2-ink-3">{t('launch.atHome', { count: held })}</span>
                </span>
                <QuantityStepper
                  look="v2"
                  value={fleet[hull] ?? 0}
                  min={0}
                  max={held}
                  onChange={(value) => { setCount(hull, value); }}
                  decreaseLabel={t('launch.fewer', { name: hullName(hull) })}
                  increaseLabel={t('launch.more', { name: hullName(hull) })}
                  valueLabel={t('launch.quantity', { name: hullName(hull) })}
                  editable
                  maxLabel={t('launch.max', { name: hullName(hull) })}
                  maxText={t('launch.maxShort')}
                />
              </div>;
            })}
          </div>
          {quote && <div className="mt-3 rounded-control border border-v2-line p-2 text-caption">
            <p className="text-v2-ink">{t('clanWar.fuel')}: {full(quote.fuel.total)} / {full(quote.fuel.available)}</p>
            {quote.fuel.legs.map((leg) => <p key={leg.leg} className="break-words text-v2-ink-2">
              {t('clanWar.fuelLeg', { leg: t(`clanWar.fuelLegName.${leg.leg}`),
                distance: full(leg.distance), fuel: full(leg.fuel) })}
            </p>)}
            <p className="mt-1 text-v2-ink-2">{t('clanWar.bay', quote.bays)}</p>
            <p className="text-v2-ink-2">{t('clanWar.personal', {
              used: full(quote.personalHangar.used), total: full(quote.personalHangar.total),
              after: full(quote.personalHangar.afterSend) })}</p>
            <p className="text-v2-ink-2">{t('clanWar.pool', {
              after: full(quote.clanHangar.afterSend), total: full(quote.clanHangar.total) })}</p>
            {quote.travel.earliestHome && <p className="text-v2-ink-2">{t('clanWar.earliestHome', {
              time: countdown(quote.travel.earliestHome.getTime() - now) })}</p>}
            {quote.latestStartAt && <p className="text-v2-ink-2">{t('clanWar.latestStart', {
              time: countdown(quote.latestStartAt.getTime() - now) })}</p>}
            {blockingRefusals.map((refusal) => <p key={refusal.code} role="alert" className="text-v2-hostile">
              {describeError(new ApiError(refusal.code, refusal.message, 409))}</p>)}
            {quote.shieldWouldDrop && <>
              <p className="mt-2 text-v2-hostile">{t('clanWar.shield', { kind: quote.shieldWouldDrop.kind })}</p>
              <label className="mt-1 flex items-start gap-2 text-v2-ink">
                <input type="checkbox" checked={acknowledgeShield}
                  onChange={(event) => { setAcknowledgeShield(event.target.checked); }} />
                {t('clanWar.acknowledgeShield')}
              </label>
            </>}
          </div>}
          {/*
            THE PRICE, BEFORE THE BUTTON (K4, K8): a wave turns until the strike starts. The
            button is held and says on its face why it cannot go yet.
          */}
          <div data-wave-commit className="mt-3 grid gap-1.5">
            {quote && <p className="text-micro leading-snug text-v2-ink-3">{t('clanWar.recallRule')}</p>}
            <HoldButton
              label={t('clanWar.send')}
              disabledReason={waveRefusal}
              onCommit={() => {
                if (!origin) return;
                actions.contribute.mutate({ originPlanetId: origin.planet.id, fleet, acknowledgeShieldLoss: acknowledgeShield },
                  { onSuccess: () => { setFleet({}); setQuotedKey(null); setAcknowledgeShield(false); } });
              }}
            />
          </div>
          {actions.contribute.isError && <p role="alert" className="mt-2 text-caption text-v2-hostile">
            {describeError(actions.contribute.error)}</p>}
        </>}
      </Plate>}

      {role === 'LEADER' && operation.status === 'ASSEMBLING' && <Plate className="p-3">
        {startReason && <p className="mb-2 text-caption text-v2-ink-2">{startReason}</p>}
        {operation.startShieldWouldDrop && <>
          <p className="mb-2 text-caption text-v2-hostile">{t('clanWar.launchShield', {
            kind: operation.startShieldWouldDrop.kind,
          })}</p>
          <label className="mb-2 flex items-start gap-2 text-caption text-v2-ink">
            <input type="checkbox" checked={acknowledgeStartShield}
              onChange={(event) => { setAcknowledgeStartShield(event.target.checked); }} />
            {t('clanWar.acknowledgeShield')}
          </label>
        </>}
        {strikeMinutes !== null && <>
          <p data-clan-strike-eta className="text-caption text-v2-ink-2">{t('clanWar.strikeEta', {
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
        {actions.start.isError && <p role="alert" className="mt-2 text-caption text-v2-hostile">{describeError(actions.start.error)}</p>}
        {actions.cancel.isError && <p role="alert" className="mt-2 text-caption text-v2-hostile">{describeError(actions.cancel.error)}</p>}
      </Plate>}

      {operation.status === 'RETURNING' && <Plate className="p-3">
        <h3 className="text-body font-semibold text-v2-ink">{t('clanWar.returning')}</h3>
        <p className="mt-2 text-body text-v2-ink-2">{t('clanWar.returningHint')}</p>
      </Plate>}

      {hangar}
      {treasuryCard}
      {purposeCard}
    </>}
  </div>;
}

/** Where the gathering point sits on the line; the target is the far end. */
const GATHER = 72;

/**
 * THE TARGET AND THE GATHERING, AS ONE PICTURE. E9: who is struck, where the clan gathers,
 * how long the target holds, and every wave as a mark on its way — flying to the gathering
 * point, waiting there, or in the battle at the far end.
 */
function WarTarget({ operation, now }: { operation: NonNullable<ClanWar['operation']>; now: number }) {
  const { t } = useTranslation();
  const place = (wave: NonNullable<ClanWar['operation']>['contributions'][number]): number | null => {
    if (wave.status === 'STAGED') return GATHER;
    if (wave.status === 'IN_BATTLE') return 100;
    if (wave.status !== 'OUTBOUND') return null;
    if (!wave.arrivesAt) return GATHER / 2;
    const span = wave.arrivesAt.getTime() - wave.sentAt.getTime();
    const done = span > 0 ? (now - wave.sentAt.getTime()) / span : 1;
    return Math.max(4, Math.min(1, done) * GATHER);
  };
  return (
    <Plate className="flex flex-col gap-2 p-3">
      <div data-war-target="" className="flex flex-col gap-2">
        <div className="flex items-center gap-2.5">
          <img src={planetArt(operation.target.planetId)} alt="" className="size-11 shrink-0 rounded-full object-cover" />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-baseline gap-x-1.5">
              <span className="text-micro text-v2-ink-3">{t('clanWar.target')}</span>
              <span className="break-words text-caption font-semibold text-v2-ink">{operation.target.username} · {operation.target.planetName}</span>
            </p>
            <p className="text-micro text-v2-ink-2">
              {t('clanWar.staging', { world: operation.staging.name })}
              {operation.status === 'ASSEMBLING' && <> · {t('clanWar.expires', { time: countdown(operation.expiresAt.getTime() - now) })}</>}
            </p>
          </div>
          <span aria-live="polite" className="shrink-0 text-micro font-semibold text-v2-self">
            {t(`clanWar.operationStatus.${operation.status}`)}
          </span>
        </div>
        <div aria-hidden="true" className="relative h-6">
          <span className="absolute inset-x-1 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-v2-line-hi" />
          <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-v2-ally bg-v2-panel" style={{ left: `${String(GATHER)}%` }} />
          <span className="absolute right-0 top-1/2 size-3 -translate-y-1/2 rotate-45 border-2 border-v2-ink-2 bg-v2-panel" />
          {operation.contributions.map((wave) => {
            const at = place(wave);
            return at === null ? null : (
              <span
                key={wave.id}
                data-wave-marker=""
                title={wave.username}
                className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-v2-ally"
                style={{ left: `${String(at)}%` }}
              />
            );
          })}
        </div>
      </div>
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
          <strong className="font-v2-mono tabular-nums text-micro text-v2-self">{t('clanWar.level', { level: war.level ?? 1 })}</strong>
        </div>
        <span aria-hidden="true" className="flex h-1.5 overflow-hidden rounded-full bg-v2-line">
          <span data-part="used" className="h-full bg-v2-ally" style={{ width: share(war.hangar.used) }} />
          <span data-part="reserved" className="h-full" style={{ width: share(war.hangar.reserved), backgroundColor: 'color-mix(in srgb, var(--color-v2-ally) 42%, transparent)' }} />
        </span>
        <p className="text-caption text-v2-ink">{t('clanWar.capacity', {
          used: full(war.hangar.used), reserved: full(war.hangar.reserved), total: full(war.hangar.total),
        })}</p>
        <p className="text-micro leading-snug text-v2-ink-2">{t('clanWar.hangarHint')}</p>
      </div>
    </Plate>
  );
}
