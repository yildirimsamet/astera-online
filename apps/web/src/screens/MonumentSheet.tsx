import { MOBILE_HULLS, PROBE, combatValue, fleetCount, fleetEntries, hangarLoad, type Fleet, type HullId } from '@astera/rules';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createIdempotencyKey, type MonumentSendInput } from '../api/client.js';
import { useApi } from '../api/context.js';
import { keys, useMonumentActions, useMonuments, useNotifications } from '../api/queries.js';
import type { MonumentWave, PlanetView } from '../api/schemas.js';
import { describeError } from '../i18n/errors.js';
import { hullName, monumentHonoree, monumentName } from '../i18n/names.js';
import { activeMonumentInbound } from '../lib/notifications.js';
import { useDebouncedValue } from '../lib/useDebouncedValue.js';
import { decimal, full } from '../lib/format.js';
import { countdown, duration, useNow } from '../lib/time.js';
import { HULL_ART } from '../ui/assets.js';
import { QuantityStepper } from '../ui/QuantityStepper.js';
import { HoldButton } from '../v2/kit/HoldButton.js';
import { Sheet } from '../v2/kit/Sheet.js';
import { Button, Plate } from '../v2/kit/Surface.js';
import { Toggle } from '../v2/kit/Toggle.js';
import { GameActions, useSeasonLocked } from '../session/seasonLock.js';

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
  const [shield, setShield] = useState(false);
  const [radiation, setRadiation] = useState(false);
  const [probeConfirmation, setProbeConfirmation] = useState(0);
  const target = view.data?.monuments.find((row) => row.id === monumentId);
  const friendly = target?.controller.kind === 'PLAYER' ? target.controller.playerId === playerId
    : target?.controller.kind === 'CLAN' && target.controller.clanId === clanId;
  const purpose = friendly ? 'REINFORCE' : 'ATTACK';
  const picked = fleetCount(fleet);
  const pickedBulk = hangarLoad(fleet);
  const input: MonumentSendInput = { originPlanetId: origin.planet.id, purpose, fleet, acknowledgeShieldLoss: shield, acknowledgeRadiationLoss: radiation };
  const quotedFleet = useDebouncedValue(fleet);
  const quoteReady = JSON.stringify(quotedFleet) === JSON.stringify(fleet);
  const quote = useQuery({ queryKey: [...keys.monuments, 'quote', monumentId, origin.planet.id, purpose, quotedFleet],
    queryFn: () => api.quoteMonument(monumentId, { originPlanetId: origin.planet.id, purpose, fleet: quotedFleet }),
    enabled: !locked && target !== undefined && picked > 0 && quoteReady, retry: false, staleTime: 0 });
  const sendKey = useConfirmationKey(JSON.stringify({ monumentId, ...input }));
  const probeKey = useConfirmationKey(`${monumentId}:${origin.planet.id}:${String(probeConfirmation)}`);
  const consentMissing = (quote.data?.shieldWouldDrop === true && !shield)
    || ((quote.data?.outboundForecast.destroyed ?? 0) > 0 && !radiation);
  const refusal = !target ? t('monument.missing') : picked === 0 ? t('monument.choose')
    : actions.send.isPending ? t('monument.sending') : !quoteReady || quote.isFetching ? t('monument.quoting')
      : quote.error ? describeError(quote.error) : !quote.data ? t('monument.quoting')
        : consentMissing ? t('monument.consent') : quote.data.fuel > origin.planet.deuterium ? t('monument.insufficientFuel')
          : quote.data.bays.used >= quote.data.bays.total ? t('monument.fullBays') : null;
  const waves = view.data?.waves.filter((row) => row.monumentId === monumentId) ?? [];
  const incoming = (notifications.data?.notifications ?? []).some((notice) => activeMonumentInbound(notice, monumentId, now));
  const probes = view.data?.probes.filter((row) => row.monumentId === monumentId) ?? [];
  const report = view.data?.probeReports.find((row) => row.monumentId === monumentId);
  const probeRefusal = !target ? t('monument.missing') : actions.probe.isPending ? t('monument.probing')
    : origin.planet.alloy < PROBE.alloy || origin.planet.crystal < PROBE.crystal ? t('itemSheet.short') : null;
  const controller = target?.controller.kind === 'PLAYER' ? target.controller.name
    : target?.controller.kind === 'CLAN' ? `[${target.controller.tag}] ${target.controller.name}` : t(target?.emptySince ? 'monument.empty' : 'monument.neutral');
  const change = (hull: HullId, count: number): void => { setFleet((previous) => ({ ...previous, [hull]: count })); setShield(false); setRadiation(false); };

  return <Sheet title={monumentName(target?.ordinal)} eyebrow={controller}
    placement="page" detents={['fit']} onClose={onClose} footer={<GameActions><div data-testid="monument-send">
      <HoldButton label={t('monument.send', { count: picked })} disabledReason={refusal}
        onCommit={() => { actions.send.mutate({ monumentId, input, key: sendKey }, { onSuccess: () => { setFleet({}); setShield(false); setRadiation(false); } }); }} />
      {actions.send.error && <p role="alert" className="mt-1 text-caption text-v2-warn">{describeError(actions.send.error)}</p>}
    </div></GameActions>}>
    <GameActions><div className="flex min-w-0 flex-col gap-3">
      {view.isPending && <p className="text-caption text-v2-ink-2">{t('monument.loading')}</p>}
      {view.error && <p role="alert" className="text-caption text-v2-warn">{describeError(view.error)}</p>}
      {target && <Plate className="p-3">
        <p className="font-v2-mono text-caption text-v2-ink">{t('monument.capacity', { used: full(target.used), reserved: full(target.reserved), total: full(target.capacity) })}</p>
        <p className="mt-1 text-caption font-semibold text-v2-deut">{t('monument.production', { rate: decimal(target.productionPerMinute) })}</p>
        <p className="mt-1 text-micro text-v2-warn">{t('monument.radiationRate', { rate: decimal(target.radiationHpPerMinute) })}</p>
        {target.emptySince && target.controller.kind === 'NEUTRAL' && <p className="mt-1 text-micro text-v2-ink-2">{t('monument.emptySince', { time: duration(Math.max(0, (now - target.emptySince.getTime()) / 60_000)) })}</p>}
        {target.respawnAt && target.controller.kind === 'NEUTRAL' && <p className="mt-1 text-micro text-v2-ink-2">{target.respawnAt.getTime() > now
          ? t('monument.respawnAt', { time: countdown(target.respawnAt.getTime() - now) }) : t('monument.respawnDue')}</p>}
        <p className="mt-2 text-micro leading-snug text-v2-ink-2">{t('monument.purpose')}</p>
        {monumentHonoree(target.ordinal) !== null && <p className="mt-1 text-micro text-v2-ink-3">
          {t('monument.honouredNote', { name: monumentHonoree(target.ordinal), rank: target.ordinal })}</p>}
        {onClanTarget && !friendly && <Button size="sm" className="mt-2" onClick={() => { onClanTarget(monumentId); }}>{t('monument.clanTarget')}</Button>}
      </Plate>}
      {incoming && <p role="alert" className="text-caption text-v2-hostile">{t('monument.incoming')}</p>}
      <p className="text-micro text-v2-ink-2">{t('monument.fog')}</p>
      {waves.length > 0 && <section className="flex flex-col gap-2">
        <h3 className="text-caption font-semibold text-v2-ink">{t('monument.yourWaves')}</h3>
        {waves.map((wave) => <MonumentWaveCard key={wave.id} wave={wave} />)}
      </section>}
      <section className="flex flex-col gap-2">
        <h3 className="text-caption font-semibold text-v2-ink">{t('monument.launch', { world: origin.planet.name })} · {t(friendly ? 'monument.reinforce' : 'monument.attack')}</h3>
        {MOBILE_HULLS.filter((hull) => (origin.fleet[hull] ?? 0) > 0).map((hull) => <div key={hull} className="flex min-w-0 items-center gap-2 border-b border-v2-line py-2">
          <img src={HULL_ART[hull] ?? undefined} alt="" className="size-8 shrink-0 object-contain" />
          <div className="min-w-0 flex-1"><p className="truncate text-caption font-semibold text-v2-ink">{hullName(hull)}</p>
            <p className="text-micro text-v2-ink-3">{t('launch.atHome', { count: origin.fleet[hull] ?? 0 })}</p></div>
          <QuantityStepper look="v2" min={0} max={origin.fleet[hull] ?? 0} value={fleet[hull] ?? 0} onChange={(count) => { change(hull, count); }}
            valueLabel={`${hullName(hull)} · ${t('launch.quantity', { name: hullName(hull) })}`}
            decreaseLabel={t('launch.fewer', { name: hullName(hull) })} increaseLabel={t('launch.more', { name: hullName(hull) })}
            maxLabel={t('launch.max', { name: hullName(hull) })} maxText={t('launch.maxShort')} />
        </div>)}
        {picked > 0 && quoteReady && !quote.isFetching && quote.data && <Plate className="flex flex-col gap-1 p-3">
          <p className="text-micro text-v2-ink-2">{t('monument.selectedBulk', { bulk: full(pickedBulk) })}</p>
          <p className="text-caption text-v2-ink">{t('monument.fuel', { amount: full(quote.data.fuel) })}</p>
          <p className="text-caption text-v2-ink">{t('monument.arrival', { time: countdown(quote.data.arriveAt.getTime() - now) })}</p>
          <p className="text-micro text-v2-ink-2">{t('monument.bays', { used: quote.data.bays.used, total: quote.data.bays.total })}</p>
          {friendly && <p className="text-micro text-v2-ink-2">{t('monument.room', { after: full(quote.data.room.after), total: full(quote.data.room.total) })}</p>}
          {friendly && quote.data.holdForecast && <p className="text-micro text-v2-deut">{t('monument.holdForecast', {
            rate: decimal(quote.data.holdForecast.productionPerMinute),
            time: quote.data.holdForecast.nextLossAt ? countdown(quote.data.holdForecast.nextLossAt.getTime() - now) : t('monument.noLoss'),
          })}</p>}
          {!friendly && <p className="text-micro leading-snug text-v2-ink-2">{t('monument.attackOutcome')}</p>}
          <p className="text-caption text-v2-warn">{t('monument.dose', { dose: decimal(quote.data.outboundForecast.doseHp) })}</p>
          {quote.data.outboundForecast.health.map((health) => <p key={health.hull} className="text-micro text-v2-ink-2">{t('monument.health', { name: hullName(health.hull), remaining: decimal(health.remainingHp), max: decimal(health.maxHp) })}</p>)}
          {quote.data.outboundForecast.destroyed > 0 && <><p className="text-caption text-v2-hostile">{t('monument.losses', { count: quote.data.outboundForecast.destroyed })}</p>
            <Toggle tone="hostile" checked={radiation} onChange={setRadiation}>{t('monument.radiation')}</Toggle></>}
          {quote.data.shieldWouldDrop && <Toggle tone="hostile" checked={shield} onChange={setShield}>{t('monument.shield')}</Toggle>}
        </Plate>}
      </section>
      <section className="flex flex-col gap-2 rounded-control border border-v2-line bg-v2-panel p-3" data-testid="monument-probe">
        <p className="text-micro text-v2-warn">{t('monument.probeRisk')}</p>
        <p className="text-caption text-v2-ink">{t('monument.probePrice', { alloy: full(PROBE.alloy), crystal: full(PROBE.crystal) })}</p>
        <HoldButton label={t('monument.probe')} disabledReason={probeRefusal} onCommit={() => { actions.probe.mutate({ monumentId, originPlanetId: origin.planet.id, key: probeKey },
          { onSuccess: () => { setProbeConfirmation((value) => value + 1); } }); }} />
        {actions.probe.error && <p role="alert" className="text-caption text-v2-warn">{describeError(actions.probe.error)}</p>}
        {probes.map((probe) => <p key={probe.id} className="text-micro text-v2-ink-2">{t('monument.probeArrival', { status: t(`monument.status.${probe.status === 'OUTBOUND' ? 'OUTBOUND' : 'RETURNING'}`), time: countdown((probe.homeAt ?? probe.arriveAt).getTime() - now) })}</p>)}
      </section>
      {report && <Plate className="p-3"><h3 className="text-caption font-semibold text-v2-ink">{t('monument.snapshot')}</h3>
        <p className="text-micro text-v2-ink-3">{t('monument.observed', { time: report.observedAt.toLocaleString() })}</p>
        <p className="text-micro text-v2-ink-3">{t('monument.delivered', { time: report.deliveredAt.toLocaleString() })}</p>
        {fleetEntries(report.fleet).map(([hull, count]) => <p key={hull} className="text-caption text-v2-ink">{hullName(hull)} × {full(count)}</p>)}
      </Plate>}
    </div></GameActions>
  </Sheet>;
}

/** Counts select exact physical cohorts, including their proportional load and carried wounds. */
export function MonumentWaveCard({ wave }: { wave: MonumentWave }) {
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
    queryFn: () => api.quoteMonumentRecall(wave.id, quotedSelections), enabled: !locked && canRecall && selections.length > 0 && quoteReady, retry: false });
  const key = useConfirmationKey(JSON.stringify({ waveId: wave.id, selections }));
  const refusal = selections.length === 0 ? t('monument.recallChoose') : actions.recall.isPending ? t('monument.recalling')
    : !quoteReady || quote.isFetching || !quote.data ? (quoteReady && quote.error ? describeError(quote.error) : t('monument.quoting')) : null;
  return <section className="flex flex-col gap-2 rounded-control border border-v2-line bg-v2-panel p-3" data-testid={`monument-wave-${wave.id}`}>
    <div className="flex items-center justify-between gap-2"><span className="text-caption font-semibold text-v2-self">{t(`monument.status.${wave.status}`)}</span>
      {wave.arriveAt && <span className="font-v2-mono text-micro text-v2-ink-2">{countdown(wave.arriveAt.getTime() - now)}</span>}</div>
    <p className="text-caption text-v2-deut">{t('monument.cargo', { amount: decimal(wave.deuterium), capacity: decimal(wave.lots.reduce((sum, lot) => sum + lot.cargoCapacity, 0)) })}</p>
    <p className="text-micro text-v2-ink-2">{t('monument.firepower', { power: full(combatValue(wave.fleet)) })}</p>
    {wave.status === 'RETURNING' && wave.returnReason && <p className="text-micro text-v2-warn">{t(`monument.returnReason.${wave.returnReason}`)}</p>}
    {wave.status === 'HOLD' && <><p className="text-micro text-v2-deut">{t('monument.ownRate', { rate: decimal(wave.productionPerMinute) })}</p>
      {wave.fillsAt && <p className="text-micro text-v2-ink-2">{t('monument.fills', { time: countdown(wave.fillsAt.getTime() - now) })}</p>}
      {wave.nextLossAt && <p className="text-micro text-v2-hostile">{t('monument.lossAt', { time: countdown(wave.nextLossAt.getTime() - now) })}</p>}</>}
    {wave.lots.map((lot) => <div key={lot.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-t border-v2-line pt-2">
      <div className="min-w-0"><p className="text-caption text-v2-ink">{hullName(lot.hull)} × {full(lot.count)}</p>
        <p className="text-micro text-v2-ink-2">{t('monument.hp', { percent: decimal(lot.remainingHp / lot.maxHp * 100), remaining: decimal(lot.remainingHp), max: decimal(lot.maxHp) })}</p></div>
      {canRecall && <QuantityStepper look="v2" min={0} max={lot.count} value={counts[lot.id] ?? 0} onChange={(count) => { setCounts((previous) => ({ ...previous, [lot.id]: count })); }}
        valueLabel={t('monument.recallQuantity', { name: hullName(lot.hull) })} decreaseLabel={t('monument.recallLess', { name: hullName(lot.hull) })}
        increaseLabel={t('monument.recallMore', { name: hullName(lot.hull) })} maxLabel={t('monument.recallMax', { name: hullName(lot.hull) })} maxText={t('launch.maxShort')} />}
    </div>)}
    <p className="text-micro text-v2-ink-2">{t('monument.returnSummary', { time: duration(wave.returnForecast.minutes), cargo: decimal(wave.returnForecast.deuterium), loss: wave.returnForecast.destroyed })}</p>
    <p className="text-micro text-v2-ink-3">{t('monument.currentFleet')}</p>
    {canRecall && <>
      {selections.length > 0 && quoteReady && !quote.isFetching && quote.data && <div data-testid="monument-recall-forecast" className="text-micro text-v2-ink-2">
        <p>{t('monument.recallCargo', { cargo: decimal(quote.data.deuterium), arrives: decimal(quote.data.arrivalDeuterium) })}</p>
        <p>{t('monument.returnSummary', { time: duration(quote.data.minutes), cargo: decimal(quote.data.arrivalDeuterium), loss: quote.data.destroyed })}</p>
      </div>}
      <HoldButton label={t('monument.recall')} disabledReason={refusal} onCommit={() => { actions.recall.mutate({ waveId: wave.id, selections, key }, { onSuccess: () => { setCounts({}); } }); }} />
      {actions.recall.error && <p role="alert" className="text-caption text-v2-warn">{describeError(actions.recall.error)}</p>}
    </>}
  </section>;
}
