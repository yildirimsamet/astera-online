import { useTranslation } from 'react-i18next';
import { duration } from '../../lib/time.js';
import { Icon } from '../icons.js';
import { ResourceMeter } from '../kit/ResourceMeter.js';

type Resource = 'alloy' | 'crystal' | 'deuterium';

export interface TopBarProps {
  commander: string;
  /** The attack shield, while one is set (`season.shieldUntil`, `shieldKind`). */
  shield: { until: number; kind: 'NEWCOMER' | 'RECOVERY' } | null;
  /** Server time. */
  now: number;
  /** The active world — only once the commander holds a second one. */
  world: { capital: boolean; name: string } | null;
  /** The active world's stock against its stores (projected). */
  stock: Record<Resource, { value: number; cap: number }>;
  /** `bellState(...)`. */
  bell: { unseen: number; urgent: boolean };
  /** Rewards waiting to be claimed behind the commander chip (`useRewards().claimable`). */
  rewards: number;
  /** The recovery boost is running on the active world. */
  boosted: boolean;
  onCommander: () => void;
  onWorld: () => void;
  /** A meter opens the economy detail. */
  onResource: (resource: Resource) => void;
  onBell: () => void;
}

const RESOURCES: readonly Resource[] = ['alloy', 'crystal', 'deuterium'];

/**
 * THE TOP BAR. Spec B1 (docs/ui-v2/gozlemevi.md).
 *
 * One row of 48 px: the commander chip (the Commander page; the attack shield and
 * its time ride it while it holds), the active world's mark once there are two,
 * the three resource meters of that world, and the bell.
 *
 * THE BELL COUNTS NEWS, NOT STATES. A full store is not news — it has its warn
 * notch on the meter — and a bell that always moves is a bell nobody reads, so
 * it pulses only for something urgent.
 */
export function TopBar({
  commander,
  shield,
  now,
  world,
  stock,
  bell,
  rewards,
  boosted,
  onCommander,
  onWorld,
  onResource,
  onBell,
}: TopBarProps) {
  const { t } = useTranslation();
  const shieldLeft = shield ? shield.until - now : 0;
  const shielded = shield !== null && shieldLeft > 0;
  const shieldTime = shielded ? duration(shieldLeft / 60_000) : '';
  // The chip carries whole hours, rounded down so it never promises time it does
  // not have; the exact figure is in its name and, in the last hour, on the Now line.
  const shieldMinutes = Math.floor(shieldLeft / 60_000);
  const shieldShort = shieldMinutes >= 60
    ? t('topBar.hours', { h: Math.floor(shieldMinutes / 60) })
    : t('units.minutes', { m: Math.max(1, shieldMinutes) });
  // A badge may only promise what the surface behind it can show: the commander
  // page holds the rewards, so they are the chip's one dot.
  const chipName = [
    t('statusBar.menuHint', { name: commander }),
    ...(shielded
      ? [t(shield.kind === 'RECOVERY' ? 'statusBar.recoveryShield.hint' : 'statusBar.newcomerShield.hint', { duration: shieldTime })]
      : []),
    ...(boosted ? [t('statusBar.recoveryBoost.note')] : []),
    ...(rewards > 0 ? [t('statusBar.menuWaiting', { count: rewards })] : []),
  ].join(' · ');

  return (
    // The notch is added to the row, not taken from it: `viewport-fit=cover` makes the
    // inset real on a notched phone, and inside a fixed h-12 it left the row ~1 px.
    <header className="flex h-[calc(3rem+env(safe-area-inset-top))] items-center gap-1.5 border-b border-v2-line bg-v2-deep/90 px-3 pt-[env(safe-area-inset-top)] font-v2-ui">
      <button
        type="button"
        aria-label={chipName}
        {...(shielded ? { 'data-shielded': '' } : {})}
        {...(rewards > 0 ? { 'data-attention': '' } : {})}
        onClick={onCommander}
        className="flex shrink-0 flex-col items-center"
      >
        <span className="relative grid size-7 place-items-center rounded-full border border-v2-line-hi bg-v2-raise text-caption font-bold uppercase text-v2-ink">
          {commander.slice(0, 1)}
          {rewards > 0 && (
            <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-v2-self ring-2 ring-v2-deep" />
          )}
        </span>
        {shielded && (
          <span aria-hidden="true" className="mt-0.5 flex items-center gap-0.5 text-v2-self">
            <Icon id="i-shield" className="size-2.5" />
            <span className="font-v2-mono text-micro leading-none">{shieldShort}</span>
          </span>
        )}
      </button>

      {world && (
        <button
          type="button"
          aria-label={t(world.capital ? 'statusBar.capitalWorld' : 'statusBar.colonyWorld', { name: world.name })}
          onClick={onWorld}
          className="grid size-6 shrink-0 place-items-center text-v2-self"
        >
          <Icon id={world.capital ? 'm-capital' : 'm-colony'} className="size-4" />
        </button>
      )}

      <div className="grid min-w-0 flex-1 grid-cols-3 gap-2">
        {RESOURCES.map((resource) => (
          <ResourceMeter
            key={resource}
            resource={resource}
            value={stock[resource].value}
            cap={stock[resource].cap}
            boosted={boosted}
            onOpen={() => { onResource(resource); }}
          />
        ))}
      </div>

      <button
        type="button"
        aria-label={bell.unseen > 0 ? t('signals.beaconUnread', { count: bell.unseen }) : t('signals.beacon')}
        {...(bell.urgent ? { 'data-urgent': '' } : {})}
        onClick={onBell}
        className="relative grid size-8 shrink-0 place-items-center rounded-control border border-v2-line-hi bg-v2-panel/70 text-v2-ink"
      >
        <Icon id="i-bell" className={`size-4 ${bell.urgent ? 'animate-pulse' : ''}`} />
        {/* Red, as the mock and the owner have it: the count is the one thing on the bar that asks to be read. */}
        {bell.unseen > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-1.5 -top-1.5 min-w-4 rounded-full bg-v2-hostile px-1 text-center font-v2-mono text-micro font-semibold leading-4 text-v2-ink ring-2 ring-v2-deep"
          >
            {bell.unseen > 9 ? '9+' : bell.unseen}
          </span>
        )}
      </button>
    </header>
  );
}
