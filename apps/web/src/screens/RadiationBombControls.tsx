import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RADIATION_BOMB, RADIATION_LEVEL_HP_PER_MINUTE, radiationBombBuildSeconds,
  distance, interceptMotion, travelExact, type RadiationBombLevel, type Vec3, type Resources } from '@astera/rules';
import { createIdempotencyKey, ApiError } from '../api/client.js';
import { useBuildRadiationBomb, useLaunchRadiationBomb } from '../api/queries.js';
import type { PlanetView, PublicMonument } from '../api/schemas.js';
import { describeError } from '../i18n/errors.js';
import { countdown, useNow } from '../lib/time.js';
import { decimal } from '../lib/format.js';
import { HoldButton } from '../v2/kit/HoldButton.js';
import { useToast } from '../ui/Toast.js';
import { useSeasonLocked } from '../session/seasonLock.js';
import { Toggle } from '../v2/kit/Toggle.js';
import { ArmCard, ArmSpecs, ArmStatus, Cells, type Cell } from '../ui/ArmCard.js';
import { CostLine, GameHold, Glyph, InfoPeek, Lever } from '../game-ui/index.js';
import { HonorIcon } from '../ui/icons/index.js';

const LEVELS = [1, 2, 3] as const;
type Asset = PlanetView['radiationBombs'][number];

/** One slot per level, read as the stock cells read it. */
const cellOf = (asset: Asset | undefined): Cell =>
  asset?.status === 'READY' ? 'ready'
  : asset?.status === 'LAUNCHED' ? 'flight'
  : asset?.status === 'PAUSED' ? 'paused'
  : asset ? 'loading' : 'empty';

/** The forge opens on the first level with an empty slot (the one that can be built), else the first ready one. */
const opening = (bombs: readonly Asset[]): RadiationBombLevel =>
  LEVELS.find((level) => !bombs.some((bomb) => bomb.level === level))
  ?? LEVELS.find((level) => bombs.some((bomb) => bomb.level === level && bomb.status === 'READY'))
  ?? 1;

/**
 * THE RADIATION-BOMB FORGE (G2-g, 2026-11-14): ONE BAY, A LEVER FOR THE LEVEL. Three levels build
 * in parallel, one slot each, so the three slots read together in one row of cells beside the
 * lever, and the bay shows the chosen level whole: its picture, its state, what it does and its
 * hold. Three full bays stacked were three screens of scrolling for one decision.
 */
export function RadiationBombForge({ planet, held, now, pending, onBuild, disabledReason = null }: {
  planet: PlanetView; held: Resources; now: number; pending: boolean;
  onBuild: (level: RadiationBombLevel) => void; disabledReason?: string | null;
}) {
  const { t } = useTranslation();
  const [level, setLevel] = useState<RadiationBombLevel>(() => opening(planet.radiationBombs));
  if (!planet.radiationBombsAvailable) return null;
  const gates = (planet.buildings.CORE ?? 0) >= RADIATION_BOMB.requiredCore
    && (planet.buildings.SHIPYARD ?? 0) >= RADIATION_BOMB.requiredShipyard;
  const slotOf = (value: RadiationBombLevel) => planet.radiationBombs.find((item) => item.level === value);
  const product = RADIATION_BOMB.levels[level];
  const asset = slotOf(level);
  const cell = cellOf(asset);
  const total = radiationBombBuildSeconds(level);
  const seconds = asset?.readyAt ? Math.max(0, (asset.readyAt.getTime() - now) / 1000) : asset?.remainingSeconds ?? 0;
  const statusOf = (slot: Asset | undefined): string => {
    const left = slot?.readyAt ? Math.max(0, (slot.readyAt.getTime() - now) / 1000) : slot?.remainingSeconds ?? 0;
    return slot?.status === 'READY' ? t('planet.radiationBomb.ready')
      : slot?.status === 'LAUNCHED' ? t('planet.radiationBomb.flying')
      : slot?.status === 'PAUSED' ? t('planet.radiationBomb.paused')
      : slot ? t('planet.radiationBomb.building', { time: countdown(left * 1000) }) : t('planet.radiationBomb.empty');
  };
  const status = statusOf(asset);
  const canAfford = held.alloy >= product.cost.alloy && held.crystal >= product.cost.crystal && held.deuterium >= product.cost.deuterium;
  const refusal = disabledReason ?? (!gates ? t('planet.radiationBomb.need') : pending
    ? t('planet.radiationBomb.building', { time: '…' }) : !canAfford ? t('errors.INSUFFICIENT_RESOURCES') : null);
  const slots = LEVELS.map((value) => `${t('planet.radiationBomb.level', { level: value })}: ${statusOf(slotOf(value))}`);
  return <section className="gk gk-armory" aria-label={t('planet.radiationBomb.title')}>
    <Lever
      label={t('planet.radiationBomb.title')}
      options={LEVELS.map((value) => ({ id: String(value), label: t('planet.radiationBomb.level', { level: value }) }))}
      value={String(level)}
      onChange={(id) => { setLevel(LEVELS.find((value) => String(value) === id) ?? 1); }}
      note={<span data-testid="radiation-levels"><Cells cells={LEVELS.map((value) => cellOf(slotOf(value)))} label={slots.join(' · ')} /></span>}
    />
    <InfoPeek
      fact={t('planet.radiationBomb.stock')}
      about={t('itemSheet.howItWorks')}
      rule={<ul className="gk-arm__rules">
        <li>{t('planet.radiationBomb.effect')}</li>
        <li>{t('planet.radiationBomb.colonyRules')}</li>
        <li>{t('planet.radiationBomb.workshop')}</li>
        <li data-honor-weapon-rule>{t(planet.honorTacticalCredit ? 'planet.radiationBomb.honor' : 'leaderboard.honorWeaponsInactive')}</li>
      </ul>}
    />
    <ArmCard
      key={level}
      art={{ src: `/assets/images/tactical/radiation-bomb-forge-l${String(level)}.webp`, position: '50% 50%' }}
      locked={!gates && !asset}
      working={asset?.status === 'BUILDING'}
      glyph="radiation"
      name={<>{t('planet.radiationBomb.title')}
        <span className="gk-arm__level" data-radiation-level={level}>
          {LEVELS.slice(0, level).map((value) => <Glyph key={value} id="radiation" />)}
        </span></>}
      stock={<span className="gk-arm__stock"><span className="gk-arm__count">
        <span data-stock-counter className="gk-num">{t('planet.tacticalStock.stock', { used: cell === 'empty' ? 0 : 1, total: RADIATION_BOMB.stockPerLevel })}</span>
        <Cells cells={[cell]} label={status} />
      </span></span>}
      marks={{ 'data-testid': `radiation-product-${String(level)}`, 'data-level': level, 'data-state': asset?.status ?? 'EMPTY' }}
    >
      {/* An empty slot says nothing here: "Stock 0/1" beside the name already does. */}
      {cell !== 'empty' && <ArmStatus
        tone={cell === 'ready' ? 'good' : cell === 'paused' ? 'warn' : 'self'}
        text={status}
        {...(asset?.status === 'BUILDING' ? { progress: { share: total > 0 ? ((total - seconds) / total) * 100 : 0, mark: 'data-bomb-progress' as const } } : {})}
      />}
      <ArmSpecs items={[
        { glyph: 'radiation', label: t('planet.radiationBomb.strengthLabel'), value: t('planet.radiationBomb.rate', { rate: decimal(RADIATION_LEVEL_HP_PER_MINUTE[level]) }) },
        { glyph: 'clock', label: t('planet.radiationBomb.durationLabel'), value: countdown(RADIATION_BOMB.durationMinutes * 60_000) },
      ]} />
      <p className="gk-arm__note" data-colony-payload><Glyph id="colony" />{t('planet.radiationBomb.colonyEffects', {
        loyalty: product.colonyLoyaltyLoss, faults: product.colonyFaults,
      })}</p>
      {!asset && <>
        <CostLine cost={product.cost} held={held} time={<span className="gk-cost__time"><Glyph id="clock" />{countdown(total * 1000)}</span>} />
        <div data-act><GameHold label={t('planet.radiationBomb.build', { level })} weight="spends" glyph="radiation" commitSound="ignite"
          disabledReason={refusal} onCommit={() => { onBuild(level); }} /></div>
      </>}
    </ArmCard>
  </section>;
}


export function RadiationBombForgeHost({ planet, held, disabledReason }: {
  planet: PlanetView; held: Resources; disabledReason?: string | null;
}) {
  const action = useBuildRadiationBomb(planet.planet.id);
  const say = useToast();
  const { t } = useTranslation();
  const now = useNow();
  return <RadiationBombForge planet={planet} held={held} now={now} pending={action.isPending}
    {...(disabledReason === undefined ? {} : { disabledReason })}
    onBuild={level => { action.mutate(level, { onSuccess: () => { say(t('planet.radiationBomb.started')); },
      onError: error => { say(describeError(error), 'error'); } }); }} />;
}

interface Target { kind: 'PLANET' | 'MONUMENT'; id: string }
export function RadiationBombLaunchPanel({ origin, target, targetName, flightMs, pending, onLaunch,
  disabledReason = null, error, collapsible = false }: {
  origin: PlanetView; target: Target; targetName: string; flightMs: number | null; pending: boolean;
  onLaunch: (level: RadiationBombLevel, key: string, acknowledgeShieldLoss: boolean) => void;
  disabledReason?: string | null; error?: Error | null;
  /**
   * An accordion whose header names the strike, its target and the ready bombs. Owner,
   * 2026-10-16: on the focus panel both strike sections fold; a monument's sheet keeps it open.
   */
  collapsible?: boolean;
}) {
  const { t } = useTranslation();
  const [level, setLevel] = useState<RadiationBombLevel>(() => origin.radiationBombs.find(asset => asset.status === 'READY')?.level ?? 1);
  const [shield, setShield] = useState(false);
  const asset = origin.radiationBombs.find(item => item.level === level && item.status === 'READY');
  const shieldRequired = error instanceof ApiError && error.code === 'SHIELD_WOULD_DROP';
  const signature = JSON.stringify([origin.planet.id, target.kind, target.id, asset?.id, level, shield]);
  const confirmation = useRef({ signature: '', key: '' });
  if (confirmation.current.signature !== signature) confirmation.current = { signature, key: createIdempotencyKey() };
  const refusal = disabledReason ?? (pending ? t('monument.sending') : !asset ? t('planet.radiationBomb.noBomb')
    : flightMs === null ? t('errors.MONUMENT_UNREACHABLE') : shieldRequired && !shield ? t('errors.SHIELD_WOULD_DROP') : null);
  if (!origin.radiationBombsAvailable) return null;
  const title = t('planet.radiationBomb.launchTitle');
  const aimed = t('planet.radiationBomb.target', { target: targetName });
  const body = <>
    <div className="radiation-launch__levels" role="radiogroup" aria-label={t('planet.radiationBomb.title')}>{LEVELS.map(value => {
      const stocked = origin.radiationBombs.find(item => item.level === value && item.status === 'READY');
      return <button key={value} type="button" role="radio" aria-checked={value === level} disabled={!stocked || pending}
        onClick={() => { setLevel(value); }}><b>L{value}</b><span>{t('planet.radiationBomb.rate', { rate: decimal(RADIATION_LEVEL_HP_PER_MINUTE[value]) })}</span></button>;
    })}</div>
    <p>{t('planet.radiationBomb.effect')}</p>
    {target.kind === 'PLANET' && <><p data-colony-payload>{t('planet.radiationBomb.colonyEffects', {
      loyalty: RADIATION_BOMB.levels[level].colonyLoyaltyLoss, faults: RADIATION_BOMB.levels[level].colonyFaults,
    })}</p><p>{t('planet.radiationBomb.colonyRules')}</p></>}
    {flightMs !== null && <p className="radiation-launch__flight">{t('planet.radiationBomb.flight', { time: countdown(flightMs) })}</p>}
    <p>{t('planet.radiationBomb.noRecall')}</p>
    {/* The same Honor box the Death Star's section carries (owner, 2026-10-16), on the season's policy. */}
    <section data-honor-weapon-rule className="honor-note grid gap-1.5 rounded-control border border-v2-self/25 bg-v2-self/5 px-3 py-2.5">
      <p className="honor-note__title flex items-center gap-1.5"><HonorIcon className="size-3.5 text-v2-self" />{t('leaderboard.honorTitle')}</p>
      <p className="honor-note__body">{t(origin.honorTacticalCredit ? 'planet.radiationBomb.honor' : 'leaderboard.honorWeaponsInactive')}</p>
    </section>
    {shieldRequired && <Toggle checked={shield} onChange={setShield}>{t('monument.shield')}</Toggle>}
    {error && <p role="alert" className="text-v2-warn">{describeError(error)}</p>}
    <HoldButton label={t('planet.radiationBomb.launch', { level })} disabledReason={refusal} tone="hostile"
      onCommit={() => { onLaunch(level, confirmation.current.key, shield); }} />
  </>;
  if (collapsible) {
    const ready = origin.radiationBombs.filter(item => item.status === 'READY').length;
    return <details className="radiation-launch strike-launch" data-testid="radiation-launch">
      <summary className="strike-launch__summary">
        <span className="strike-launch__heading"><span className="strike-launch__title">{title}</span>
          <span className="strike-launch__target">{aimed}</span></span>
        <span className="strike-launch__ready">{t('focus.planet.strikeReady', { ready })}</span>
      </summary>
      <div className="strike-launch__body">{body}</div>
    </details>;
  }
  return <section className="radiation-launch" data-testid="radiation-launch">
    <h3>{title}</h3><p className="radiation-launch__target">{aimed}</p>
    {body}
  </section>;
}

export function RadiationBombControl({ origin, target, targetName, position, motion, disabledReason, onLaunched, collapsible }: {
  origin: PlanetView; target: Target; targetName: string; position: Vec3; motion?: PublicMonument['motion'];
  disabledReason?: string | null; onLaunched?: () => void;
  /** Folded behind its header, as on the focus panel beside the Death Star's section. */
  collapsible?: boolean;
}) {
  const action = useLaunchRadiationBomb(origin.planet.id);
  const locked = useSeasonLocked();
  const now = useNow(1000);
  const say = useToast();
  const { t } = useTranslation();
  const meeting = motion ? interceptMotion(origin.planet.position, RADIATION_BOMB.speed, motion, now,
    motion.stopAtMs ?? now + 86400000) : null;
  const flightMs = motion ? meeting ? meeting.arriveAt - now : null
    : travelExact(distance(origin.planet.position, position), RADIATION_BOMB.speed) * 60000;
  return <RadiationBombLaunchPanel key={`${origin.planet.id}:${target.kind}:${target.id}`} origin={origin} target={target}
    targetName={targetName} flightMs={flightMs} pending={action.isPending} error={action.error}
    {...(collapsible === undefined ? {} : { collapsible })}
    disabledReason={locked ? t('errors.SEASON_FROZEN') : disabledReason ?? null}
    onLaunch={(level, key, acknowledgeShieldLoss) => {
      action.mutate({ level, target, key, acknowledgeShieldLoss }, { onSuccess: () => {
        say(t('planet.radiationBomb.launched')); onLaunched?.();
      } });
    }} />;
}
