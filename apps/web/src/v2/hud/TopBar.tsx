import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { duration } from '../../lib/time.js';
import { Icon } from '../icons.js';
import { ResourceMeter } from '../kit/ResourceMeter.js';
import { WorksLine, type WorksLineProps } from './WorksLine.js';

type Resource = 'alloy' | 'crystal' | 'deuterium';
export interface CollectionTransfer { id: number; each: Record<Resource, { from: number; to: number }> }

export interface TopBarProps {
  commander: string;
  /** The attack shield, while one is set (`season.shieldUntil`, `shieldKind`). */
  shield: { until: number; kind: 'NEWCOMER' | 'RECOVERY' } | null;
  /** Server time. */
  now: number;
  /** The active world — only once the commander holds a second one. */
  world: { capital: boolean; name: string } | null;
  /** The active world's stock against its stores (projected). */
  /** Each store, and the part of it the Vault keeps from a raid (`safe`). */
  stock: Record<Resource, { value: number; cap: number; safe?: number }>;
  /** The works under the stores (owner, 2026-09-25); absent until the world is read. */
  works?: WorksLineProps;
  transfer?: CollectionTransfer | null;
  /** `bellState(...)`. */
  bell: { unseen: number; urgent: boolean };
  /** Rewards ready to claim (`useRewards().claimable`). */
  rewards: number;
  /** The recovery boost is running on the active world. */
  boosted: boolean;
  onCommander: () => void;
  onRewards: () => void;
  onWorld: () => void;
  /** A meter opens the economy detail. */
  onResource: (resource: Resource) => void;
  onBell: () => void;
  /** E11 · K10: on a desk the five tabs sit here, between the meters and the bell. */
  tabs?: ReactNode;
}

const RESOURCES: readonly Resource[] = ['alloy', 'crystal', 'deuterium'];

/**
 * THE TOP BAR. Spec B1 (docs/ui-v2/gozlemevi.md).
 *
 * A compact row: the commander menu (the Commander page; the attack shield and
 * its time ride it while it holds), the active world's mark once there are two,
 * the three resource meters of that world, a claimable gift, and the bell.
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
  works,
  transfer,
  onCommander,
  onRewards,
  onWorld,
  onResource,
  onBell,
  tabs,
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
  const chipName = [
    t('statusBar.menuHint', { name: commander }),
    ...(shielded
      ? [t(shield.kind === 'RECOVERY' ? 'statusBar.recoveryShield.hint' : 'statusBar.newcomerShield.hint', { duration: shieldTime })]
      : []),
    ...(boosted ? [t('statusBar.recoveryBoost.note')] : []),
  ].join(' · ');

  return (
    // The notch is added to the row, not taken from it: `viewport-fit=cover` makes the
    // inset real on a notched phone, and inside a fixed h-12 it left the row ~1 px.
    <header className="flex h-[calc(3.25rem+env(safe-area-inset-top))] items-center gap-1.5 border-b border-v2-line bg-v2-deep/90 px-2 pt-[env(safe-area-inset-top)] font-v2-ui">

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

      {/* On a desk the meters keep a phone's reach; a 600 px bar would read no better than 160. */}
      {/*
        THREE COLUMNS, THREE LINES (owner, 2026-09-25): each store's figure, its
        cells as the Base draws them, and what its vessel in the works holds — the third line is
        the one press that collects.
      */}
      <div className={`grid min-w-0 flex-1 grid-cols-3 gap-x-2 gap-y-1.5 ${tabs === undefined ? '' : 'max-w-[34rem]'}`}>
        {RESOURCES.map((resource) => (
          <ResourceMeter
            key={resource}
            resource={resource}
            value={stock[resource].value}
            cap={stock[resource].cap}
            safe={stock[resource].safe ?? 0}
            boosted={boosted}
            transfer={transfer ? { id: transfer.id, ...transfer.each[resource] } : null}
            onOpen={() => { onResource(resource); }}
          />
        ))}
        {works && <WorksLine {...works} />}
      </div>

      {tabs !== undefined && <div className="ml-auto flex h-full shrink-0">{tabs}</div>}

      {rewards > 0 && (
        <button
          type="button"
          data-testid="claimable-rewards"
          aria-label={`${t('rewards.title')} · ${t('rewards.waiting', { count: rewards })}`}
          onClick={onRewards}
          className="relative grid size-8 shrink-0 place-items-center rounded-control border border-v2-self/70 bg-v2-self/10 text-v2-self"
        >
          <span className="claimable-gift-swing inline-flex origin-top" aria-hidden="true">
            <Icon id="i-gift" className="size-4" />
          </span>
          <span aria-hidden="true" className="absolute -right-1 -top-1 min-w-4 rounded-full bg-v2-self px-0.5 text-center font-v2-mono text-micro font-semibold leading-4 text-v2-deep ring-2 ring-v2-deep">
            {rewards > 9 ? '9+' : rewards}
          </span>
        </button>
      )}

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
            // The count beats with the bell (owner, 2026-09-24) — only when the bell does, for the same reason.
            className={`absolute -right-1.5 -top-1.5 min-w-4 rounded-full bg-v2-hostile px-1 text-center font-v2-mono text-micro font-semibold leading-4 text-v2-ink ring-2 ring-v2-deep ${
              bell.urgent ? 'animate-pulse' : ''
            }`}
          >
            {bell.unseen > 9 ? '9+' : bell.unseen}
          </span>
        )}
      </button>
      <button
        type="button"
        aria-label={chipName}
        data-menu-button=""
        {...(shielded ? { 'data-shielded': '' } : {})}
        onClick={onCommander}
        className="relative grid size-8 shrink-0 place-items-center rounded-control border border-v2-line-hi bg-v2-panel/70 text-v2-ink"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        {shielded && <span aria-hidden="true" className="absolute -bottom-2 right-0 rounded-full bg-v2-deep px-0.5 font-v2-mono text-micro leading-none text-v2-self"><Icon id="i-shield" className="inline size-2" />{shieldShort}</span>}
      </button>
    </header>
  );
}
