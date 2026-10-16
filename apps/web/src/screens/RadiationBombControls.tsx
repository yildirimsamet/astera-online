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
import { Cost } from '../v2/kit/Cost.js';
import { useToast } from '../ui/Toast.js';
import { useSeasonLocked } from '../session/seasonLock.js';
import { Toggle } from '../v2/kit/Toggle.js';
import { Icon } from '../v2/icons.js';
import { TacticalStock } from '../ui/TacticalStock.js';
import { HonorIcon } from '../ui/icons/index.js';

const LEVELS = [1, 2, 3] as const;
const Art = ({ level }: { level: RadiationBombLevel }) => <div className="tactical-production__scene radiation-product__scene" aria-hidden="true">
  <img className="tactical-production__art radiation-product__art" alt="" loading="lazy" decoding="async"
    src={`/assets/images/tactical/radiation-bomb-forge-l${String(level)}.webp`} />
</div>;

export function RadiationBombForge({ planet, held, now, pending, onBuild, disabledReason = null }: {
  planet: PlanetView; held: Resources; now: number; pending: boolean;
  onBuild: (level: RadiationBombLevel) => void; disabledReason?: string | null;
}) {
  const { t } = useTranslation();
  if (!planet.radiationBombsAvailable) return null;
  const gates = (planet.buildings.CORE ?? 0) >= RADIATION_BOMB.requiredCore
    && (planet.buildings.SHIPYARD ?? 0) >= RADIATION_BOMB.requiredShipyard;
  return <section className="radiation-forge" aria-label={t('planet.radiationBomb.title')}>
    <header><h3>{t('planet.radiationBomb.title')}</h3><p>{t('planet.radiationBomb.stock')}</p></header>
    <div className="radiation-forge__products">{LEVELS.map(level => {
      const product = RADIATION_BOMB.levels[level];
      const asset = planet.radiationBombs.find(item => item.level === level);
      const duration = radiationBombBuildSeconds(level);
      const seconds = asset?.readyAt ? Math.max(0, (asset.readyAt.getTime() - now) / 1000) : asset?.remainingSeconds ?? 0;
      const status = asset?.status === 'READY' ? t('planet.radiationBomb.ready')
        : asset?.status === 'LAUNCHED' ? t('planet.radiationBomb.flying')
        : asset?.status === 'PAUSED' ? t('planet.radiationBomb.paused')
        : asset ? t('planet.radiationBomb.building', { time: countdown(seconds * 1000) }) : t('planet.radiationBomb.empty');
      const canAfford = held.alloy >= product.cost.alloy && held.crystal >= product.cost.crystal && held.deuterium >= product.cost.deuterium;
      const refusal = disabledReason ?? (!gates ? t('planet.radiationBomb.need') : pending
        ? t('planet.radiationBomb.building', { time: '…' }) : !canAfford ? t('errors.INSUFFICIENT_RESOURCES') : null);
      return <article className="tactical-production radiation-product" key={level} data-testid={`radiation-product-${String(level)}`}
        data-level={level} data-state={asset?.status ?? 'EMPTY'} data-locked={!gates && !asset}>
        <Art level={level} /><div className="tactical-production__body radiation-product__body">
          <div className="tactical-production__heading radiation-product__heading">
            <h4>{t('planet.radiationBomb.title')}
              <span className="radiation-product__level" data-radiation-level={level}>
                {t('planet.radiationBomb.level', { level })}
                <span aria-hidden="true">{Array.from({ length: level }, (_, index) => <Icon key={index} id="i-radiation" className="size-3" />)}</span>
              </span></h4>
            <TacticalStock ready={asset?.status === 'READY' ? 1 : 0} loading={asset?.status === 'BUILDING' ? 1 : 0}
              paused={asset?.status === 'PAUSED' ? 1 : 0} inFlight={asset?.status === 'LAUNCHED' ? 1 : 0} total={RADIATION_BOMB.stockPerLevel} />
          </div>
          <p className="tactical-production__status radiation-product__status" data-state={asset?.status ?? 'EMPTY'}><i aria-hidden="true" />{status}</p>
          <dl className="tactical-production__specs radiation-product__specs">
            <div><dt><Icon id="i-radiation" className="size-3" />{t('planet.radiationBomb.strengthLabel')}</dt>
              <dd>{t('planet.radiationBomb.rate', { rate: decimal(RADIATION_LEVEL_HP_PER_MINUTE[level]) })}</dd></div>
            <div><dt><Icon id="i-clock" className="size-3" />{t('planet.radiationBomb.durationLabel')}</dt>
              <dd>{countdown(RADIATION_BOMB.durationMinutes * 60_000)}</dd></div>
          </dl>
          <p className="tactical-production__hint" data-colony-payload>{t('planet.radiationBomb.colonyEffects', {
            loyalty: product.colonyLoyaltyLoss, faults: product.colonyFaults,
          })}</p>
          {asset?.status === 'BUILDING' && <progress aria-label={status} max={duration} value={Math.max(0, duration - seconds)} />}
          {!asset && <><div className="tactical-production__price radiation-product__price"><Cost cost={product.cost} held={held} />
            <span>{countdown(duration * 1000)}</span></div>
            <HoldButton label={t('planet.radiationBomb.build', { level })} disabledReason={refusal}
              onCommit={() => { onBuild(level); }} /></>}
        </div>
      </article>;
    })}</div>
    <details><summary>{t('itemSheet.howItWorks')}</summary><p>{t('planet.radiationBomb.effect')}</p><p>{t('planet.radiationBomb.colonyRules')}</p><p>{t('planet.radiationBomb.workshop')}</p><p data-honor-weapon-rule>{t(planet.honorTacticalCredit ? 'planet.radiationBomb.honor' : 'leaderboard.honorWeaponsInactive')}</p></details>
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
