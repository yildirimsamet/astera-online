import { useReadReportSignals } from '../session/useReadReportSignals.js';
import { MonumentBattleRules } from './MonumentBattleRules.js';
import { MonumentRoutePreview } from './MonumentRoutePreview.js';
import { HonorSoloNotice } from '../ui/HonorSoloNotice.js';
import { RadiationBombControl } from './RadiationBombControls.js';
import { TargetRadiationInstrument } from '../ui/TargetRadiationInstrument.js';
import { techOf } from '../lib/navigation.js';
import { MOBILE_HULLS, MONUMENT_BALANCE, MONUMENT_PROBE_LOSS_CHANCE, PROBE, combatValue, fleetCount, fleetEntries, hangarLoad, partitionCombatFleet, type Fleet, type HullId } from '@astera/rules';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createIdempotencyKey, type MonumentSendInput } from '../api/client.js';
import { useApi } from '../api/context.js';
import { keys, useMonumentActions, useMonuments, useNotifications } from '../api/queries.js';
import type { MonumentWave, PlanetView, PublicMonument } from '../api/schemas.js';
import { describeError } from '../i18n/errors.js';
import { hullName, monumentHonoree, monumentName } from '../i18n/names.js';
import { activeMonumentInbound } from '../lib/notifications.js';
import { useDebouncedValue } from '../lib/useDebouncedValue.js';
import { decimal, full, percent } from '../lib/format.js';
import { countdown, duration, useNow } from '../lib/time.js';
import { HULL_ART } from '../ui/assets.js';
import { QuantityStepper } from '../ui/QuantityStepper.js';
import { Sheet } from '../v2/kit/Sheet.js';
import { GameButton, GameHold } from '../game-ui/buttons.js';
import { InfoPeek, Toggle } from '../game-ui/controls.js';
import { Banner, Fold, SectionTag } from '../game-ui/surfaces.js';
import { GameActions, useSeasonLocked } from '../session/seasonLock.js';
import { useCommanderShip } from '../api/commanderShip.js';
import { escortOf } from '../lib/admiralEscort.js';
import { serverNow } from '../lib/clock.js';
import { EscortRow } from '../ui/EscortRow.js';

type ArrivalOutcome = 'JOIN' | 'FIGHT' | 'GARRISON' | 'CAPTURE';

/**
 * What a fleet in flight meets, judged from the public state now. Arrival takes the
 * monument as it is then, whatever the launch purpose was (owner, 2026-10-15).
 */
function arrivalOutcome(target: PublicMonument, friendly: boolean, arriveAt: Date | null): ArrivalOutcome {
  if (friendly) return 'JOIN';
  if (target.controller.kind !== 'NEUTRAL') return 'FIGHT';
  if (target.emptySince === null) return 'GARRISON';
  return target.respawnAt !== null && arriveAt !== null && target.respawnAt <= arriveAt ? 'GARRISON' : 'CAPTURE';
}

/** Keep the same confirmation identity after a lost response; a changed body gets a new one. */
function useConfirmationKey(signature: string): string {
  const current = useRef({ signature: '', key: '' });
  if (current.current.signature !== signature || current.current.key === '') current.current = { signature, key: createIdempotencyKey() };
  return current.current.key;
}

/** Public ownership and room, followed by the owner's physical fleet and priced actions. */
export function MonumentSheet({ monumentId, origin, playerId, clanId, onClose, onClanTarget }: {
  monumentId: string; origin: PlanetView; playerId: string; clanId: string | null;
  onClose: () => void; onClanTarget?: (monumentId: string) => void;
}) {
  const { t } = useTranslation();
  const api = useApi();
  const view = useMonuments();
  const locked = useSeasonLocked();
  const actions = useMonumentActions();
  const notifications = useNotifications();
  const now = useNow();
  const [fleet, setFleet] = useState<Fleet>({});
  const available = origin.fleetCombatReady ?? partitionCombatFleet(origin.fleet, origin.fleetDamage).eligible;
  const [shield, setShield] = useState(false);
  const [radiation, setRadiation] = useState(false);
  const [probeConfirmation, setProbeConfirmation] = useState(0);
  const target = view.data?.monuments.find((row) => row.id === monumentId);
  const friendly = target?.controller.kind === 'PLAYER' ? target.controller.playerId === playerId
    : target?.controller.kind === 'CLAN' && target.controller.clanId === clanId;
  const purpose = friendly ? 'REINFORCE' : 'ATTACK';
  const tierBlocked = target?.sendAccess?.tierAllowed === false;
  const picked = fleetCount(fleet);
  const pickedBulk = hangarLoad(fleet);
  // D212: Silent Space closes every monument wave; the server would refuse the quote too.
  const silentSpace = origin.silentSpace === true;
  // The commander ship may fly the wave out (Y9); the server prices the escorted leg in the quote.
  const escort = escortOf(useCommanderShip(true).data, serverNow());
  const [escortWanted, setEscortWanted] = useState(false);
  const escorted = escortWanted && escort?.kind === 'ready';
  const input: MonumentSendInput = { originPlanetId: origin.planet.id, purpose, fleet, acknowledgeShieldLoss: shield, acknowledgeRadiationLoss: radiation,
    ...(escorted ? { admiral: true } : {}) };
  const quotedFleet = useDebouncedValue(fleet);
  const quoteReady = JSON.stringify(quotedFleet) === JSON.stringify(fleet);
  const quote = useQuery({ queryKey: [...keys.monuments, 'quote', monumentId, origin.planet.id, purpose, quotedFleet, escorted],
    queryFn: () => api.quoteMonument(monumentId, { originPlanetId: origin.planet.id, purpose, fleet: quotedFleet, ...(escorted ? { admiral: true } : {}) }),
    enabled: !locked && !silentSpace && !tierBlocked && target !== undefined && picked > 0 && quoteReady, retry: false, staleTime: 0, refetchInterval: target?.motion ? 5000 : false });
  const sendKey = useConfirmationKey(JSON.stringify({ monumentId, ...input }));
  const probeKey = useConfirmationKey(`${monumentId}:${origin.planet.id}:${String(probeConfirmation)}`);
  const consentMissing = (quote.data?.shieldWouldDrop === true && !shield)
    || ((quote.data?.outboundForecast.destroyed ?? 0) > 0 && !radiation);
  const refusal = silentSpace ? t('faults.launchBlock.SILENT_SPACE')
    : tierBlocked ? t('monument.tierBlocked', { tier: target.sendAccess?.playerTier })
    : !target ? t('monument.missing') : picked === 0 ? t('monument.choose')
    : actions.send.isPending ? t('monument.sending') : !quoteReady ? t('monument.quoting')
      : quote.error ? describeError(quote.error) : !quote.data ? t('monument.quoting')
        : consentMissing ? t('monument.consent') : quote.data.fuel > origin.planet.deuterium ? t('monument.insufficientFuel')
          : quote.data.bays.used >= quote.data.bays.total ? t('monument.fullBays') : null;
  const waves = view.data?.waves.filter((row) => row.monumentId === monumentId) ?? [];
  const incoming = (notifications.data?.notifications ?? []).some((notice) => activeMonumentInbound(notice, monumentId, now));
  const probes = view.data?.probes.filter((row) => row.monumentId === monumentId) ?? [];
  const report = view.data?.probeReports.find((row) => row.monumentId === monumentId);
  useReadReportSignals(!view.isError && target !== undefined && report !== undefined, report ? [report.id] : []);
  const probeRefusal = !target ? t('monument.missing') : actions.probe.isPending ? t('monument.probing')
    : origin.planet.alloy < PROBE.alloy || origin.planet.crystal < PROBE.crystal ? t('itemSheet.short') : null;
  const controller = target?.controller.kind === 'PLAYER' ? target.controller.name
    : target?.controller.kind === 'CLAN' ? `[${target.controller.tag}] ${target.controller.name}` : t(target?.emptySince ? 'monument.empty' : 'monument.neutral');
  const change = (hull: HullId, count: number): void => { setFleet((previous) => ({ ...previous, [hull]: count })); setShield(false); setRadiation(false); };

  const kitFrame = friendly ? { tone: 'self' as const } : target && target.controller.kind !== 'NEUTRAL' ? { tone: 'hostile' as const } : {};

  return <Sheet title={monumentName(target?.ordinal)} eyebrow={controller} kit={kitFrame}
    placement="page" detents={['fit']} onClose={onClose} footer={<GameActions><div data-testid="monument-send" className="gk-mon__send">
      <GameHold weight="spends" glyph={friendly ? 'support' : 'attack'} commitSound="launch"
        label={t('monument.send', { count: picked })} disabledReason={refusal}
        onCommit={() => { actions.send.mutate({ monumentId, input, key: sendKey }, { onSuccess: () => { setFleet({}); setShield(false); setRadiation(false); setEscortWanted(false); } }); }} />
      {actions.send.error && <p role="alert" className="gk-report__copy" data-tone="warn">{describeError(actions.send.error)}</p>}
    </div></GameActions>}>
    <GameActions><div className="gk-mon">
      {view.isPending && <p className="gk-report__label">{t('monument.loading')}</p>}
      {view.error && <p role="alert" className="gk-report__copy" data-tone="warn">{describeError(view.error)}</p>}
      {target && <section data-testid="monument-target" className="gk-well gk-mon__facts">
        {target.difficulty !== 'LEGACY' && <p className="gk-mon__access" data-tone={target.difficulty === 'HARD' ? 'threat' : 'good'}>
          {t(target.difficulty === 'EASY' ? 'monument.easyAccess' : 'monument.hardAccess')}</p>}
        <p className="gk-mon__fact gk-num">{t('monument.capacity', { used: full(target.used), reserved: full(target.reserved), total: full(target.capacity) })}</p>
        {/* The rules of holding (and the turn of a moving one) one press away (owner 2026-11-17, ek-2). */}
        <InfoPeek about={t('monument.rulesAbout')}
          fact={<span className="gk-mon__fact" data-tone="deut">{t('monument.production', { rate: decimal(target.productionPerMinute) })}</span>}
          rule={<>{target.motion && <p className="gk-sub">{t('monument.motionRule')}</p>}<p className="gk-sub">{t('monument.purpose')}</p></>} />
        <p className="gk-mon__fact" data-tone="warn">{target.difficulty === 'LEGACY'
          ? t('monument.radiationRate', { rate: decimal(target.radiationHpPerMinute) })
          : t('monument.radiationLevelRate', { level: MONUMENT_BALANCE[target.difficulty].radiationLevel, rate: decimal(target.radiationHpPerMinute) })}</p>
        {target.emptySince && target.controller.kind === 'NEUTRAL' && <p className="gk-report__label">{t('monument.emptySince', { time: duration(Math.max(0, (now - target.emptySince.getTime()) / 60_000)) })}</p>}
        {target.respawnAt && target.controller.kind === 'NEUTRAL' && <p className="gk-report__label">{target.respawnAt.getTime() > now
          ? t('monument.respawnAt', { time: countdown(target.respawnAt.getTime() - now) }) : t('monument.respawnDue')}</p>}
        {monumentHonoree(target.ordinal) !== null && <p className="gk-report__label">
          {t('monument.honouredNote', { name: monumentHonoree(target.ordinal), rank: target.ordinal })}</p>}
        {onClanTarget && !friendly && <div><GameButton size="sm" glyph="target" onPress={() => { onClanTarget(monumentId); }}>{t('monument.clanTarget')}</GameButton></div>}
      </section>}
      {/* The rate is the facts card's to say; the dial and what guards you against it fold here. */}
      {target && <Fold data-monument-radiation="" glyph="radiation" tone="warn" title={t('planet.radiationBomb.radiation')}>
        <TargetRadiationInstrument target={{ kind: 'MONUMENT', id: target.id }} tech={techOf(origin)} />
      </Fold>}
      {target && !friendly && origin.radiationBombsAvailable && <RadiationBombControl origin={origin}
        target={{ kind: 'MONUMENT', id: target.id }} targetName={monumentName(target.ordinal)}
        position={target.position} motion={target.motion} disabledReason={silentSpace ? t('faults.launchBlock.SILENT_SPACE') : null} />}
      {incoming && <Banner tone="hostile" role="alert" title={t('monument.incoming')} />}
      {waves.length > 0 && <section className="gk-mon__part">
        <SectionTag as="h3">{t('monument.yourWaves')}</SectionTag>
        {waves.map((wave) => <MonumentWaveCard key={wave.id} wave={wave}
          arrival={target && wave.status === 'OUTBOUND' ? arrivalOutcome(target, friendly, wave.arriveAt) : null} />)}
      </section>}
      <section data-monument-dispatch="" className="gk-mon__part">
        <SectionTag as="h3">{t('monument.launch', { world: origin.planet.name })} · {t(friendly ? 'monument.reinforce' : 'monument.attack')}</SectionTag>
        <HonorSoloNotice />
        {target?.difficulty !== undefined && target.difficulty !== 'LEGACY' && <p className="gk-report__copy" {...(tierBlocked ? { 'data-tone': 'warn' } : {})}>
          {tierBlocked ? t('monument.tierBlocked', { tier: target.sendAccess?.playerTier })
            : t('monument.initialFleetRule')}</p>}
        <div className="gk-ledger gk-mon__hulls">
          {MOBILE_HULLS.filter((hull) => (available[hull] ?? 0) > 0).map((hull) => <div key={hull} data-testid={`monument-hull-${hull}`} className="gk-mon__hull">
            <img src={HULL_ART[hull] ?? undefined} alt="" />
            <span className="gk-mon__hullwords"><span className="gk-mon__hullname">{hullName(hull)}</span>
              <span className="gk-report__label">{t('launch.atHome', { count: available[hull] ?? 0 })}</span></span>
            <fieldset disabled={tierBlocked} className="gk-mon__count">
              <QuantityStepper key={hull}
                min={0} max={available[hull] ?? 0} value={fleet[hull] ?? 0} onChange={(count) => { change(hull, count); }}
                valueLabel={`${hullName(hull)} · ${t('launch.quantity', { name: hullName(hull) })}`}
                decreaseLabel={t('launch.fewer', { name: hullName(hull) })} increaseLabel={t('launch.more', { name: hullName(hull) })}
                maxLabel={t('launch.max', { name: hullName(hull) })} maxText={t('launch.maxShort')} />
            </fieldset>
          </div>)}
        </div>
        <EscortRow escort={escort} on={escorted} onChange={setEscortWanted} monument />
        {picked > 0 && quote.data && target?.motion && <MonumentRoutePreview from={origin.planet.position} motion={target.motion} arriveAt={quote.data.arriveAt.getTime()} now={now} />}
        {picked > 0 && quoteReady && quote.data && <div data-testid="monument-quote" className="gk-well gk-mon__quote">
          <p className="gk-report__label">{t('monument.selectedBulk', { bulk: full(pickedBulk) })}</p>
          <p className="gk-mon__fact">{t('monument.fuel', { amount: full(quote.data.fuel) })}</p>
          {quote.data.returnFuelReserve !== undefined && <>
            <p className="gk-report__label">{t('monument.fuelBreakdown', { outbound: full(quote.data.outboundFuel ?? 0), reserve: full(quote.data.returnFuelReserve) })}</p>
            <p className="gk-report__note" data-tone="plain">{t('monument.fuelReserveRule')}</p>
          </>}
          <p className="gk-mon__fact">{t('monument.arrival', { time: countdown(quote.data.arriveAt.getTime() - now) })}</p>
          <p className="gk-report__label">{t('monument.bays', { used: quote.data.bays.used, total: quote.data.bays.total })}</p>
          {friendly && <p className="gk-report__label">{t('monument.room', { after: full(quote.data.room.after), total: full(quote.data.room.total) })}</p>}
          {friendly && <p className="gk-report__note" data-tone="plain">{t('monument.reinforceRule')}</p>}
          {friendly && quote.data.holdForecast && <p className="gk-mon__fact" data-tone="deut">{t('monument.holdForecast', {
            rate: decimal(quote.data.holdForecast.productionPerMinute),
            time: quote.data.holdForecast.nextLossAt ? countdown(quote.data.holdForecast.nextLossAt.getTime() - now) : t('monument.noLoss'),
          })}</p>}
          {!friendly && <><p className="gk-report__copy">{t('monument.attackOutcome')}</p><MonumentBattleRules /></>}
          {quote.data.radiationProtection && <>
            <p className="gk-report__copy" data-tone="warn">{t('monument.dispatchProtection', {
              level: quote.data.radiationProtection.level, rate: decimal(quote.data.radiationProtection.hpPerMinute, 2),
            })}</p>
            <p className="gk-report__label">{t('monument.shieldingSnapshot')}</p>
            {quote.data.radiationProtection.nextLossAt && <p className="gk-report__copy" data-tone="warn">{t('monument.radiationLossForecast', {
              time: countdown(quote.data.radiationProtection.nextLossAt.getTime() - now),
            })}</p>}
            {quote.data.radiationProtection.cargoLossAt && <p className="gk-report__copy" data-tone="warn">{t('monument.radiationCargoForecast', {
              time: countdown(quote.data.radiationProtection.cargoLossAt.getTime() - now),
            })}</p>}
          </>}
          <p className="gk-mon__fact" data-tone="warn">{t('monument.dose', { dose: decimal(quote.data.outboundForecast.doseHp) })}</p>
          {quote.data.outboundForecast.health.map((health) => <p key={health.hull} className="gk-report__label">{t('monument.health', { name: hullName(health.hull), remaining: decimal(health.remainingHp), max: decimal(health.maxHp) })}</p>)}
          {quote.data.outboundForecast.destroyed > 0 && <><p className="gk-mon__fact" data-tone="threat">{t('monument.losses', { count: quote.data.outboundForecast.destroyed })}</p>
            <Toggle checked={radiation} onChange={setRadiation} label={t('monument.radiation')} /></>}
          {quote.data.shieldWouldDrop && <Toggle checked={shield} onChange={setShield} label={t('monument.shield')} />}
        </div>}
      </section>
      {/* What stands there, one press away: the probe and its last report (ek-2). */}
      <Fold data-monument-intel="" glyph="eye" title={t('monument.probe')}
        {...(report ? { sub: t('monument.seenCount', { count: fleetCount(report.fleet) }) } : {})}>
      <p className="gk-sub">{t('monument.fog')}</p>
      <section data-testid="monument-probe" className="gk-mon__probe">
        <p className="gk-report__copy" data-tone="warn">{t('monument.probeRisk', { chance: percent(MONUMENT_PROBE_LOSS_CHANCE) })}</p>
        <p className="gk-mon__fact">{t('monument.probePrice', { alloy: full(PROBE.alloy), crystal: full(PROBE.crystal) })}</p>
        <GameHold weight="spends" size="md" tone="steel" glyph="eye" label={t('monument.probe')} disabledReason={probeRefusal}
          onCommit={() => { actions.probe.mutate({ monumentId, originPlanetId: origin.planet.id, key: probeKey },
            { onSuccess: () => { setProbeConfirmation((value) => value + 1); } }); }} />
        {actions.probe.error && <p role="alert" className="gk-report__copy" data-tone="warn">{describeError(actions.probe.error)}</p>}
        {probes.map((probe) => <p key={probe.id} className="gk-report__label">{t('monument.probeArrival', { status: t(`monument.status.${probe.status === 'OUTBOUND' ? 'OUTBOUND' : 'RETURNING'}`), time: countdown((probe.homeAt ?? probe.arriveAt).getTime() - now) })}</p>)}
      </section>
      {report && <section data-testid="monument-report" className="gk-well gk-mon__report">
        <h3 className="gk-report__subhead">{t('monument.snapshot')}</h3>
        <p className="gk-report__label">{t('monument.observed', { time: report.observedAt.toLocaleString() })}</p>
        <p className="gk-report__label">{t('monument.delivered', { time: report.deliveredAt.toLocaleString() })}</p>
        <ul className="gk-mon__seen">
          {fleetEntries(report.fleet).map(([hull, count]) => <li key={hull}>
            {HULL_ART[hull] === null ? <span /> : <img src={HULL_ART[hull]} alt="" />}
            <span>{hullName(hull)}</span><span className="gk-num">× {full(count)}</span>
          </li>)}
        </ul>
      </section>}
      </Fold>
    </div></GameActions>
  </Sheet>;
}

/** Counts select exact physical cohorts, including their proportional load and carried wounds. */
export function MonumentWaveCard({ wave, arrival = null }: { wave: MonumentWave; arrival?: ArrivalOutcome | null }) {
  const { t } = useTranslation();
  const api = useApi();
  const locked = useSeasonLocked();
  const actions = useMonumentActions();
  const now = useNow();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const selections = useMemo(() => wave.lots.flatMap((lot) => (counts[lot.id] ?? 0) > 0
    ? [{ lotId: lot.id, count: Math.min(lot.count, counts[lot.id] ?? 0) }] : []), [wave.lots, counts]);
  const quotedSelections = useDebouncedValue(selections);
  const quoteReady = JSON.stringify(quotedSelections) === JSON.stringify(selections);
  const canRecall = wave.status !== 'RETURNING';
  const quote = useQuery({ queryKey: [...keys.monuments, 'recall-quote', wave.id, quotedSelections, wave.lots],
    queryFn: () => api.quoteMonumentRecall(wave.id, quotedSelections), enabled: !locked && canRecall && selections.length > 0 && quoteReady,
    retry: false, refetchInterval: canRecall ? 5000 : false });
  const key = useConfirmationKey(JSON.stringify({ waveId: wave.id, selections }));
  const refusal = selections.length === 0 ? t('monument.recallChoose') : actions.recall.isPending ? t('monument.recalling')
    : !quoteReady || !quote.data || quote.isError ? (quoteReady && quote.error ? describeError(quote.error) : t('monument.quoting')) : null;
  return <section className="gk-well gk-mon__wave" data-testid={`monument-wave-${wave.id}`}>
    <div className="gk-mon__wavehead"><span className="gk-mon__status" data-status={wave.status}>{t(`monument.status.${wave.status}`)}</span>
      {wave.arriveAt && <span className="gk-num gk-report__label">{countdown(wave.arriveAt.getTime() - now)}</span>}</div>
    {arrival && <p className="gk-report__copy" {...(arrival === 'CAPTURE' ? {} : { 'data-tone': arrival === 'JOIN' ? 'good' : 'threat' })}>
      {t(`monument.arrivalOutcome.${arrival}`)}</p>}
    <p className="gk-mon__fact" data-tone="deut">{t('monument.cargo', { amount: decimal(wave.deuterium), capacity: decimal(wave.lots.reduce((sum, lot) => sum + lot.cargoCapacity, 0)) })}</p>
    <p className="gk-report__label">{t('monument.firepower', { power: full(combatValue(wave.fleet)) })}</p>
    {wave.status === 'RETURNING' && wave.returnReason && <p className="gk-report__copy" data-tone="warn">{t(`monument.returnReason.${wave.returnReason}`)}</p>}
    {wave.status === 'HOLD' && <><p className="gk-mon__fact" data-tone="deut">{t('monument.ownRate', { rate: decimal(wave.productionPerMinute) })}</p>
      {wave.radiationHpPerMinute !== undefined && <p className="gk-report__copy" data-tone="warn">{t('monument.protectedRate', {
        level: wave.tech.RADIATION_SHIELDING ?? 0, rate: decimal(wave.radiationHpPerMinute, 2),
      })}</p>}
      {wave.fillsAt && <p className="gk-report__label">{t('monument.fills', { time: countdown(wave.fillsAt.getTime() - now) })}</p>}
      {wave.cargoLossAt && <p className="gk-report__copy" data-tone="threat">{t('monument.cargoLossAt', { time: countdown(wave.cargoLossAt.getTime() - now) })}</p>}
      {wave.nextLossAt && <p className="gk-report__copy" data-tone="threat">{t('monument.lossAt', { time: countdown(wave.nextLossAt.getTime() - now) })}</p>}</>}
    {wave.lots.map((lot) => <div key={lot.id} className="gk-mon__lot">
      <span className="gk-mon__hullwords"><span className="gk-mon__hullname">{hullName(lot.hull)} × {full(lot.count)}</span>
        <span className="gk-report__label">{t('monument.hp', { percent: decimal(lot.remainingHp / lot.maxHp * 100), remaining: decimal(lot.remainingHp), max: decimal(lot.maxHp) })}</span></span>
      {canRecall && <QuantityStepper min={0} max={lot.count} value={counts[lot.id] ?? 0} onChange={(count) => { setCounts((previous) => ({ ...previous, [lot.id]: count })); }}
        valueLabel={t('monument.recallQuantity', { name: hullName(lot.hull) })} decreaseLabel={t('monument.recallLess', { name: hullName(lot.hull) })}
        increaseLabel={t('monument.recallMore', { name: hullName(lot.hull) })} maxLabel={t('monument.recallMax', { name: hullName(lot.hull) })} maxText={t('launch.maxShort')} />}
    </div>)}
    <p className="gk-report__subhead">{t('monument.returnAll')}</p>
    <p className="gk-report__label">{t('monument.returnSummary', { time: duration(wave.returnForecast.minutes), cargo: decimal(wave.returnForecast.deuterium), loss: wave.returnForecast.destroyed })}</p>
    {(wave.returnForecast.fuelRefund ?? 0) > 0 && <p className="gk-mon__fact" data-tone="deut">{t('monument.fuelRefund', { amount: decimal(wave.returnForecast.fuelRefund ?? 0, 3) })}</p>}
    <p className="gk-report__label">{t('monument.currentFleet')}</p>
    {canRecall && <>
      {selections.length > 0 && quoteReady && quote.data && <div data-testid="monument-recall-forecast" className="gk-report__summary gk-mon__forecast">
        <p className="gk-report__subhead" data-tone="good">{t('monument.returnSelected', { count: fleetCount(quote.data.fleet) })}</p>
        <p className="gk-report__label">{t('monument.recallCargo', { cargo: decimal(quote.data.deuterium), arrives: decimal(quote.data.arrivalDeuterium) })}</p>
        <p className="gk-report__label">{t('monument.returnSummary', { time: duration(quote.data.minutes), cargo: decimal(quote.data.arrivalDeuterium), loss: quote.data.destroyed })}</p>
        {quote.data.arrivalLots.map(lot => <p key={lot.id} className="gk-report__label">{t('monument.health', { name: `${hullName(lot.hull)} × ${full(lot.count)}`, remaining: decimal(lot.remainingHp), max: decimal(lot.maxHp) })}</p>)}
        {quote.data.returnFuel !== undefined && <p className="gk-report__label">{t('monument.returnFuel', { amount: full(quote.data.returnFuel) })}</p>}
        {(quote.data.fuelRefund ?? 0) > 0 && <p className="gk-mon__fact" data-tone="deut">{t('monument.fuelRefund', { amount: decimal(quote.data.fuelRefund ?? 0, 3) })}</p>}
      </div>}
      <GameHold weight="reversible" size="md" tone="steel" glyph="recall" label={t('monument.recall')} disabledReason={refusal}
        onCommit={() => { actions.recall.mutate({ waveId: wave.id, selections, key }, { onSuccess: () => { setCounts({}); } }); }} />
      {actions.recall.error && <p role="alert" className="gk-report__copy" data-tone="warn">{describeError(actions.recall.error)}</p>}
    </>}
  </section>;
}
