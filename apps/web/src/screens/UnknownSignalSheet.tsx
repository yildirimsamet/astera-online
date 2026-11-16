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
import { RulesRow } from '../ui/RulesRow.js';
import { Sheet } from '../v2/kit/Sheet.js';
import { Choices, CostLine, GameButton, GameHold, Glyph, type GlyphId } from '../game-ui/index.js';
import { OWN_SOUND, playSound } from '../lib/sound.js';
import { haptic } from '../lib/haptics.js';

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

const OUTCOMES: readonly (readonly ['RESOURCES' | 'ENERGY' | 'DERELICT' | 'PIRATES' | 'SKIN', 'resources' | 'energy' | 'derelict' | 'pirates' | 'skin', GlyphId])[] = [
  ['RESOURCES', 'resources', 'crate'], ['ENERGY', 'energy', 'speed'], ['DERELICT', 'derelict', 'hull'], ['PIRATES', 'pirates', 'pirate'], ['SKIN', 'skin', 'star'],
];

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
  const refusal = busy ? t('unknownSignal.sending') : quote.blocked ? t(`unknownSignal.${quote.blocked}`, { fuel: full(quote.fuel) }) : null;
  const courierHome = planet.fleet.COURIER ?? 0;
  const lost = result?.kind === 'PIRATES' || signal.status === 'lost' || cargoLost || derelictLost;

  return <Sheet title={t('unknownSignal.title')} eyebrow={open ? countdown(left) : t(result?.kind === 'PIRATES' ? 'unknownSignal.pirates'
    : signal.status === 'lost' ? 'unknownSignal.lost' : cargoLost || derelictLost ? 'unknownSignal.rewardLost' : signal.status === 'done' ? 'unknownSignal.delivered'
    : signal.status === 'outbound' ? 'unknownSignal.outbound' : 'unknownSignal.returning')} onClose={onClose} detents={open ? ['full'] : ['fit']}
    kit={{ tone: lost ? 'hostile' : 'self' }}
    footer={open ? <div className="gk gk-launch__commit">
      {error && <p role="alert" className="gk-inote" data-tone="warn">{error}</p>}
      {/* Two ships go out at risk and the fuel is spent: the kit's spending weight, one second. */}
      <GameHold weight="spends" glyph="eye" commitSound="launch" label={t('unknownSignal.send')} disabledReason={refusal} onCommit={() => { onSend(hull); }} />
    </div> : undefined}>
    <div className="gk gk-signal" data-unknown-signal-sheet="">
      {open && <div className="gk-signal__scene">
        <span className="gk-signal__beacon" aria-hidden="true"><UnknownSignalGlyph className="gk-signal__glyph" /></span>
        <div className="gk-signal__words"><p className="gk-signal__lead">{t('unknownSignal.detected')}</p><p className="gk-sub">{t('unknownSignal.description')}</p></div>
      </div>}
      {result ? <div data-testid="unknown-signal-result" className="gk-well gk-signal__result" data-tone={result.kind === 'PIRATES' ? 'hostile' : 'self'}>
        {result.kind === 'DERELICT' && <img src={HULL_ART[result.hull] ?? undefined} alt={hullName(result.hull) ?? result.hull} className="gk-signal__find" />}
        {result.kind === 'SKIN' && <img src={cosmeticCard(result.cosmeticId)} alt={t(cosmeticCopy(result.cosmeticId).nameKey)} className="gk-signal__find gk-signal__find--card" />}
        {result.kind === 'PIRATES' && <span className="gk-signal__ambush" aria-hidden="true"><Glyph id="pirate" /></span>}
        <p className="gk-signal__lead">{rewardCopy}</p>
        {result.kind === 'RESOURCES' && <CostLine cost={result.loot} />}
        {result.kind === 'ENERGY' && <p className="gk-inote" data-tone="self"><Glyph id="speed" />{t('unknownSignal.collector')}</p>}
        {result.kind === 'SKIN' && <GameButton size="sm" glyph="star" onPress={onSkins}>{t('unknownSignal.skins')}</GameButton>}
        {(result.kind === 'RESOURCES' || result.kind === 'DERELICT') && !derelictLost && <p className="gk-sub">{t(cargoLost
          ? 'unknownSignal.cargoLost' : signal.deliveredAt ? 'unknownSignal.delivered' : 'unknownSignal.inTransit')}</p>}
      </div> : open ? <>
        {origins && origins.length > 1 && onOrigin
          ? <section className="gk-signal__crew"><p className="gk-label" aria-hidden="true">{t('unknownSignal.origin')}</p>
            <Choices label={t('unknownSignal.origin')} value={planet.planet.id} onChange={onOrigin} columns={origins.length > 2 ? 2 : undefined}
              options={origins.map((origin) => ({ id: origin.id, label: origin.name }))} /></section>
          : <p className="gk-signal__from"><span className="gk-label">{t('unknownSignal.origin')}</span><span>{planet.planet.name}</span></p>}
        <dl className="gk-well gk-figures gk-signal__trip">{facts.map(([label, value]) => <div key={label} className="gk-figure">
          <dt className="gk-label">{t(`unknownSignal.${label}`)}</dt><dd className="gk-num gk-figure__value">{value}</dd>
        </div>)}</dl>
        <p className="gk-signal__from"><span className="gk-label">{t('unknownSignal.distance')}</span><span className="gk-num">{full(Math.round(quote.distance))}</span></p>
        <section className="gk-signal__crew">
          <p className="gk-label">{t('unknownSignal.warship')} · 1</p>
          <div role="radiogroup" aria-label={t('unknownSignal.warship')} className="gk-signal__hulls" {...OWN_SOUND}>{UNKNOWN_SIGNAL.warshipHulls.map(id => {
            const count = planet.fleet[id] ?? 0;
            return <button key={id} type="button" role="radio" aria-checked={id === hull} aria-label={`${hullName(id)} · ${String(count)}`} className="gk-signal__hull"
              {...(count === 0 ? { 'data-missing': '' } : {})}
              onClick={() => { if (id === hull) return; playSound('tab'); haptic('tap'); setSelection(id); }}>
              <img src={HULL_ART[id] ?? undefined} alt="" /><span className="gk-signal__hullname">{hullName(id)}</span>
              <span className="gk-num gk-signal__count">{count ? String(count) : t('unknownSignal.missing')}</span>
            </button>;
          })}</div>
          {(planet.fleet[hull] ?? 0) === 0 && <GameButton size="sm" glyph="plus" onPress={() => { onBuild(hull); }}>{t('unknownSignal.build', { ship: hullName(hull) })}</GameButton>}
          <div className="gk-signal__courier" {...(courierHome === 0 ? { 'data-missing': '' } : {})}>
            <img src={HULL_ART.COURIER ?? undefined} alt="" />
            <div className="gk-signal__words"><p className="gk-signal__lead">{t('unknownSignal.courier')} · 1</p><p className="gk-sub">{t('unknownSignal.available', { count: courierHome })}</p></div>
            {courierHome === 0 && <GameButton size="sm" glyph="plus" onPress={() => { onBuild('COURIER'); }}>{t('unknownSignal.build', { ship: hullName('COURIER') })}</GameButton>}
          </div>
          {courierHome === 0 && (planet.buildings.SHIPYARD ?? 0) < 1 && <p className="gk-inote" data-tone="warn">{t('unknownSignal.needsShipyard')}</p>}
        </section>
        <section data-signal-odds className="gk-well gk-signal__odds">
          <p className="gk-label">{t('unknownSignal.odds')}</p>
          <ul className="gk-signal__outcomes">{OUTCOMES.map(([kind, label, glyph]) => <li key={kind} className="gk-signal__outcome"
            data-tone={odds[kind] === 0 ? 'none' : kind === 'PIRATES' ? 'hostile' : 'self'}>
            <Glyph id={glyph} />
            <span className="gk-num gk-signal__odd">{odds[kind]}%</span>
            <span className="gk-signal__kind">{t(`unknownSignal.${label}`)}</span>
          </li>)}</ul>
          <RulesRow glyph="help" title={t('unknownSignal.details')}>
            {(['resourcesInfo', 'derelictInfo', 'energyInfo', 'skinInfo', ...(signal.pirateFree ? [] : ['piratesInfo'] as const)] as const).map(key => <p key={key} className="gk-sub">{t(`unknownSignal.${key}`, { tiers: tierOdds })}</p>)}
          </RulesRow>
        </section>
        {signal.pirateFree
          ? <p className="gk-inote" data-tone="self">{t('unknownSignal.firstSafe')}</p>
          : <div className="gk-inote gk-signal__risk" data-tone="hostile"><p>{t('unknownSignal.risk', { warship: hullName(hull), courier: hullName('COURIER') })}</p><CostLine cost={quote.risk} /></div>}
      </> : <p className="gk-signal__lead">{t(signal.status === 'lost' ? 'unknownSignal.lostBeforeArrival' : signal.status === 'done' ? 'unknownSignal.delivered'
        : signal.status === 'outbound' ? 'unknownSignal.outbound' : 'unknownSignal.returning')}</p>}
      <div className="gk-signal__radar">
        <p className="gk-signal__radarlevel"><Glyph id="eye" />{t('unknownSignal.radarLevel', { level: radar.level, range: full(radar.range) })}</p>
        {radar.level === 0 && <p className="gk-sub">{t('unknownSignal.zeroRadar')}</p>}
        <p className="gk-sub">{t('unknownSignal.radarHelp')}</p>
      </div>
      {open && expired && <p className="gk-inote" data-tone="warn">{t('unknownSignal.expired')}</p>}
    </div>
  </Sheet>;
}
