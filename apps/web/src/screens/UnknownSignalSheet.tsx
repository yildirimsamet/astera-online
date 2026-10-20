import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HULLS, UNKNOWN_SIGNAL, unknownSignalOdds, type MobileHullId, type UnknownSignalTier, type UnknownSignalWarshipHull } from '@astera/rules';
import type { PlanetView, UnknownSignalView } from '../api/schemas.js';
import { hullName } from '../i18n/names.js';
import { full } from '../lib/format.js';
import { durationPrecise, countdown } from '../lib/time.js';
import { defaultUnknownSignalWarship, unknownSignalQuote } from '../lib/unknownSignal.js';
import { HULL_ART } from '../ui/assets.js';
import { cosmeticCard, cosmeticCopy } from '../ui/cosmeticCopy.js';
import { Sheet } from '../v2/kit/Sheet.js';
import { Cost } from '../v2/kit/Cost.js';
import { Icon } from '../v2/icons.js';

export function UnknownSignalGlyph({ className = '' }: { className?: string }) {
  return <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
    <circle cx="16" cy="16" r="2" fill="currentColor" />
    <circle cx="16" cy="16" r="7" stroke="currentColor" strokeWidth="1.3" opacity=".85" />
    <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth=".8" opacity=".45" />
    <path d="M16 1v6m0 18v6M1 16h6m18 0h6" stroke="currentColor" strokeWidth="1" />
  </svg>;
}

export interface UnknownSignalSheetProps {
  signal: UnknownSignalView;
  planet: PlanetView;
  radar: { level: number; range: number };
  tier: UnknownSignalTier;
  now: number;
  busy?: boolean;
  error?: string | null;
  origins?: readonly { id: string; name: string }[];
  onOrigin?: (id: string) => void;
  onClose: () => void;
  onSend: (hull: UnknownSignalWarshipHull) => void;
  onBuild: (hull: MobileHullId) => void;
  onSkins: () => void;
}

const OUTCOMES = [
  ['RESOURCES', 'resources', 'i-mine'], ['ENERGY', 'energy', 'i-spark'], ['DERELICT', 'derelict', 'i-fleet'], ['PIRATES', 'pirates', 'i-warn'], ['SKIN', 'skin', 'i-gift'],
] as const;
const FIELD = 'min-w-0 rounded-control border border-v2-line bg-v2-deep/70 px-2.5 py-2';

export function UnknownSignalSheet({ signal, planet, radar, tier, now, busy = false, error, origins, onOrigin,
  onClose, onSend, onBuild, onSkins }: UnknownSignalSheetProps) {
  const { t } = useTranslation();
  const [selection, setSelection] = useState<UnknownSignalWarshipHull | null>(null);
  const hull = selection ?? defaultUnknownSignalWarship(planet);
  const quote = unknownSignalQuote(planet, signal, hull, now);
  const result = signal.outcome;
  const cargoLost = result?.kind === 'RESOURCES' && signal.fleet !== null && (signal.fleet.COURIER ?? 0) === 0;
  const derelictLost = result?.kind === 'DERELICT' && signal.deliveredAt !== null && signal.fleet !== null && (signal.fleet[result.hull] ?? 0) === 0;
  const open = signal.status === 'open' || signal.status === 'expired';
  const expired = signal.expiresAt.getTime() <= now;
  const left = Math.max(0, signal.expiresAt.getTime() - now);
  const odds = unknownSignalOdds(!signal.pirateFree);
  const tierOdds = tier === 1 ? 'T1 80% · T2 15% · T3 5%' : tier === 2 ? 'T2 90% · T3 10%' : 'T3 100%';
  const facts = [['oneWay', durationPrecise(quote.minutes)], ['roundTrip', durationPrecise(quote.roundTripMinutes)], ['fuel', full(quote.fuel)]] as const;
  const rewardCopy = result?.kind === 'RESOURCES' ? t('unknownSignal.resources')
    : result?.kind === 'ENERGY' ? t('unknownSignal.energyResult', { hours: result.hours })
    : result?.kind === 'DERELICT' ? derelictLost ? t('unknownSignal.derelictLost') : t('unknownSignal.derelictResult', { ship: hullName(result.hull), tier: HULLS[result.hull].tier,
      health: Math.round((10_000 - result.damageBp) / 100) })
    : result?.kind === 'PIRATES' ? t('unknownSignal.pirateResult')
    : result?.kind === 'SKIN' ? t('unknownSignal.skinResult', { name: t(cosmeticCopy(result.cosmeticId).nameKey) }) : null;

  return <Sheet title={t('unknownSignal.title')} eyebrow={open ? countdown(left) : t(result?.kind === 'PIRATES' ? 'unknownSignal.pirates'
    : signal.status === 'lost' ? 'unknownSignal.lost' : cargoLost || derelictLost ? 'unknownSignal.rewardLost' : signal.status === 'done' ? 'unknownSignal.delivered'
    : signal.status === 'outbound' ? 'unknownSignal.outbound' : 'unknownSignal.returning')} onClose={onClose} detents={['fit']} placement="dialog"
    footer={open ? <div className="space-y-2">
      {(quote.blocked ?? error) && <p role="status" className="text-caption text-v2-warn">{error ?? (quote.blocked ? t(`unknownSignal.${quote.blocked}`, { fuel: full(quote.fuel) }) : '')}</p>}
      <button type="button" className="w-full rounded-control border border-v2-crystal/30 bg-v2-crystal/10 px-3 py-2.5 font-v2-ui text-caption font-semibold text-v2-crystal transition-colors hover:bg-v2-crystal/20 disabled:opacity-40"
        disabled={busy || quote.blocked !== null} onClick={() => { onSend(hull); }}>{t(busy ? 'unknownSignal.sending' : 'unknownSignal.send')}</button>
    </div> : undefined}>
    <div className="space-y-3 font-v2-ui" data-unknown-signal-sheet="">
      {open && <div className="relative flex min-h-20 items-center gap-3 overflow-hidden rounded-control border border-v2-crystal/15 bg-[radial-gradient(ellipse_at_15%_50%,#163541_0%,#09101b_65%)] px-3 py-2.5">
        <UnknownSignalGlyph className="size-12 shrink-0 text-v2-crystal drop-shadow-[0_0_12px_#7de6ff55]" />
        <div className="min-w-0"><p className="text-caption text-v2-crystal">{t('unknownSignal.detected')}</p><p className="mt-1 text-micro leading-relaxed text-v2-ink-2">{t('unknownSignal.description')}</p></div>
      </div>}
      {result ? <div data-testid="unknown-signal-result" className={`space-y-2 rounded-control border p-3 ${result.kind === 'PIRATES' ? 'border-v2-hostile/30 bg-v2-hostile/5' : 'border-v2-crystal/20 bg-v2-crystal/5'}`}>
        {result.kind === 'DERELICT' && <img src={HULL_ART[result.hull] ?? undefined} alt={hullName(result.hull) ?? result.hull} className="mx-auto h-24 w-full object-contain" />}
        {result.kind === 'SKIN' && <img src={cosmeticCard(result.cosmeticId)} alt={t(cosmeticCopy(result.cosmeticId).nameKey)} className="mx-auto h-32 w-full rounded-control object-contain" />}
        <p className="text-caption leading-relaxed text-v2-ink">{rewardCopy}</p>
        {result.kind === 'RESOURCES' && <Cost cost={result.loot} />}
        {result.kind === 'ENERGY' && <p className="text-caption text-v2-crystal">{t('unknownSignal.collector')}</p>}
        {result.kind === 'SKIN' && <button type="button" onClick={onSkins} className="rounded-control border border-v2-crystal/30 px-3 py-2 text-caption text-v2-crystal">{t('unknownSignal.skins')}</button>}
        {(result.kind === 'RESOURCES' || result.kind === 'DERELICT') && !derelictLost && <p className="text-micro text-v2-ink-3">{t(cargoLost
          ? 'unknownSignal.cargoLost' : signal.deliveredAt ? 'unknownSignal.delivered' : 'unknownSignal.inTransit')}</p>}
      </div> : open ? <>
        {origins && origins.length > 1 && onOrigin ? <label className="flex items-center justify-between gap-2 text-caption text-v2-ink-2">{t('unknownSignal.origin')}
          <select className="min-w-0 rounded-control border border-v2-line bg-v2-deep px-2 py-1.5 text-caption text-v2-ink" value={planet.planet.id} onChange={event => { onOrigin(event.target.value); }}>
            {origins.map(origin => <option key={origin.id} value={origin.id}>{origin.name}</option>)}
          </select></label> : <p className="flex justify-between text-micro text-v2-ink-3"><span>{t('unknownSignal.origin')}</span><span>{planet.planet.name}</span></p>}
        <div className="grid grid-cols-3 gap-1.5">{facts.map(([label, value]) => <div key={label} className={FIELD}>
          <span className="block text-micro text-v2-ink-3">{t(`unknownSignal.${label}`)}</span><span className="mt-1 block font-v2-mono text-caption text-v2-ink">{value}</span>
        </div>)}</div>
        <p className="flex justify-between text-micro text-v2-ink-3"><span>{t('unknownSignal.distance')}</span><span className="font-v2-mono">{full(Math.round(quote.distance))}</span></p>
        <div>
          <p className="mb-1.5 text-micro text-v2-ink-3">{t('unknownSignal.warship')} · 1</p>
          <div role="radiogroup" aria-label={t('unknownSignal.warship')} className="grid grid-cols-4 gap-1.5">{UNKNOWN_SIGNAL.warshipHulls.map(id => {
            const count = planet.fleet[id] ?? 0;
            return <button key={id} type="button" role="radio" aria-checked={id === hull} aria-label={`${hullName(id)} · ${String(count)}`} onClick={() => { setSelection(id); }}
              className={`min-w-0 rounded-control border px-1 py-1.5 transition-colors ${id === hull ? 'border-v2-crystal/50 bg-v2-crystal/10' : 'border-v2-line bg-v2-deep/60'}`}>
              <img src={HULL_ART[id] ?? undefined} alt="" className="h-12 w-full object-contain" /><span className="block truncate text-micro text-v2-ink">{hullName(id)}</span>
              <span className={`mt-0.5 block font-v2-mono text-micro ${count ? 'text-v2-crystal' : 'text-v2-warn'}`}>{count ? String(count) : t('unknownSignal.missing')}</span>
            </button>;
          })}</div>
          {(planet.fleet[hull] ?? 0) === 0 && <button type="button" className="mt-1.5 text-caption text-v2-crystal underline decoration-v2-crystal/30 underline-offset-4" onClick={() => { onBuild(hull); }}>{t('unknownSignal.build', { ship: hullName(hull) })}</button>}
        </div>
        <div className={`${FIELD} flex items-center gap-2.5`}>
          <img src={HULL_ART.COURIER ?? undefined} alt="" className="h-11 w-16 shrink-0 object-contain" />
          <div className="min-w-0 flex-1"><p className="text-caption text-v2-ink">{t('unknownSignal.courier')} · 1</p><p className="text-micro text-v2-ink-3">{t('unknownSignal.available', { count: planet.fleet.COURIER ?? 0 })}</p></div>
          {(planet.fleet.COURIER ?? 0) === 0 && <button type="button" onClick={() => { onBuild('COURIER'); }} className="max-w-28 text-right text-caption text-v2-crystal">{t('unknownSignal.build', { ship: hullName('COURIER') })}</button>}
        </div>
        {(planet.fleet.COURIER ?? 0) === 0 && (planet.buildings.SHIPYARD ?? 0) < 1 && <p className="text-micro text-v2-warn">{t('unknownSignal.needsShipyard')}</p>}
        <div className="rounded-control border border-v2-line px-2.5 py-2">
          <div className="mb-2 flex items-center justify-between"><span className="text-micro text-v2-ink-3">{t('unknownSignal.odds')}</span><span aria-hidden="true" className="text-micro text-v2-crystal">⌁</span></div>
          <div className="grid grid-cols-5 gap-1">{OUTCOMES.map(([kind, label, icon]) => <div key={kind} className="min-w-0 text-center">
            <Icon id={icon} className={`mx-auto mb-1 size-4 ${odds[kind] === 0 ? 'text-v2-ink-3' : kind === 'PIRATES' ? 'text-v2-hostile' : 'text-v2-crystal/70'}`} />
            <span className={`block font-v2-mono text-caption ${odds[kind] === 0 ? 'text-v2-ink-3 line-through' : kind === 'PIRATES' ? 'text-v2-hostile' : 'text-v2-crystal'}`}>{odds[kind]}%</span>
            <span className="mt-0.5 block text-micro leading-tight text-v2-ink-2">{t(`unknownSignal.${label}`)}</span>
          </div>)}</div>
          <details className="mt-2 border-t border-v2-line pt-1.5 text-micro leading-relaxed text-v2-ink-3"><summary className="cursor-pointer text-v2-ink-2">{t('unknownSignal.details')}</summary>
            <div className="mt-2 space-y-1.5">{(['resourcesInfo', 'derelictInfo', 'energyInfo', 'skinInfo', ...(signal.pirateFree ? [] : ['piratesInfo'] as const)] as const).map(key => <p key={key}>{t(`unknownSignal.${key}`, { tiers: tierOdds })}</p>)}</div>
          </details>
        </div>
        {signal.pirateFree
          ? <p className="border-l-2 border-v2-crystal/60 pl-2.5 text-micro leading-relaxed text-v2-crystal">{t('unknownSignal.firstSafe')}</p>
          : <div className="space-y-1.5 border-l-2 border-v2-hostile/60 pl-2.5"><p className="text-micro leading-relaxed text-v2-ink-2">{t('unknownSignal.risk', { warship: hullName(hull), courier: hullName('COURIER') })}</p><Cost cost={quote.risk} /></div>}
      </> : <p className="text-caption text-v2-ink-2">{t(signal.status === 'lost' ? 'unknownSignal.lostBeforeArrival' : signal.status === 'done' ? 'unknownSignal.delivered'
        : signal.status === 'outbound' ? 'unknownSignal.outbound' : 'unknownSignal.returning')}</p>}
      <div className="rounded-control border border-v2-crystal/15 bg-v2-crystal/5 px-2.5 py-2 text-micro leading-relaxed text-v2-ink-3">
        <p className="text-v2-crystal">{t('unknownSignal.radarLevel', { level: radar.level, range: full(radar.range) })}</p>
        {radar.level === 0 && <p className="mt-1.5">{t('unknownSignal.zeroRadar')}</p>}
        <p className="mt-1.5">{t('unknownSignal.radarHelp')}</p>
      </div>
      {open && expired && <p className="text-micro text-v2-warn">{t('unknownSignal.expired')}</p>}
    </div>
  </Sheet>;
}
