import { useTranslation } from 'react-i18next';
import type { CollectState } from '../../lib/collect.js';
import { compact, full } from '../../lib/format.js';
import { Icon } from '../icons.js';

export interface CollectBubbleProps {
  /** `collectState(...)` of the active world, projected. */
  state: CollectState;
  /** A collect is in flight: the bubble holds so a second tap sends nothing. */
  pending: boolean;
  onCollect: () => void;
  /** Where a player goes when the store cannot take it: the base, to raise a store. */
  onOpenBase: () => void;
  /**
   * `world` (the default) rises at the threshold, over the planet. `base` is there
   * from the first unit and names the works beside it: the base is where a player
   * goes looking for them, and below the threshold it was the only place to look.
   */
  place?: 'world' | 'base';
}

/**
 * THE COLLECT BUBBLE OVER YOUR WORLD. Spec B13 (docs/ui-v2/gozlemevi.md).
 *
 * Production lands in the works and waits there (D16), so collecting is the one
 * chore the planet asks for — and it is asked on the planet itself, not in a
 * header panel: "+3.2k" in your colour once the works hold a tenth of what they
 * can, pulsing once a vessel is full and production has stopped.
 *
 * A FULL STORE IS SAID BEFORE THE TAP. Collecting into it would move nothing, so
 * the bubble turns warn, names the problem, and opens the base where a store is
 * raised.
 */
export function CollectBubble({ state, pending, onCollect, onOpenBase, place = 'world' }: CollectBubbleProps) {
  const { t } = useTranslation();
  const onBase = place === 'base';
  if (onBase ? state.waiting < 1 : !state.ripe) return null;

  /*
    THE BASE NAMES WHAT IT IS COLLECTING (owner, 2026-09-24: "Havuz nerede?"). Over
    the planet the bubble explains itself by where it sits; on the base it sits by
    the store, and a bare "+1.2k" beside three store figures says nothing about where
    that 1.2k is. "Works full" is the reason to tap now: production has stopped.
  */
  const bubble = state.blocked ? (
    <button
        type="button"
        onClick={onOpenBase}
        className="pointer-events-auto flex h-7 items-center gap-1 rounded-full border border-v2-warn/60 bg-v2-deep/90 px-2.5 font-v2-ui text-caption font-semibold text-v2-warn"
      >
        <Icon id="i-warn" className="size-3.5" />
        {t('statusBar.works.storeFull')}
      </button>
  ) : (
    <button
      type="button"
      disabled={pending}
      aria-label={state.full ? t('statusBar.works.hintFull') : t('statusBar.works.hintCollect', { amount: full(state.waiting) })}
      {...(state.full ? { 'data-full': '' } : {})}
      onClick={onCollect}
      className={`pointer-events-auto flex h-7 items-center gap-1 rounded-full border border-v2-self/60 bg-v2-self/20 px-2.5 font-v2-mono text-caption font-medium text-v2-ink disabled:opacity-60 ${
        state.full ? 'animate-pulse' : ''
      }`}
    >
      <Icon id="i-collect" className="size-3.5 text-v2-self" />+{compact(state.waiting)}
    </button>
  );
  if (!onBase) return bubble;
  return (
    <span className="flex items-center gap-1.5">
      <span className={`max-w-[5.5rem] text-right font-v2-ui text-micro leading-tight ${state.full ? 'text-v2-warn' : 'text-v2-ink-3'}`}>
        {t(state.full ? 'statusBar.works.labelFull' : 'statusBar.works.label')}
      </span>
      {bubble}
    </span>
  );
}
