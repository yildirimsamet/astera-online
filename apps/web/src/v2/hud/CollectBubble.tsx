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
export function CollectBubble({ state, pending, onCollect, onOpenBase }: CollectBubbleProps) {
  const { t } = useTranslation();
  if (!state.ripe) return null;

  if (state.blocked) {
    return (
      <button
        type="button"
        onClick={onOpenBase}
        className="pointer-events-auto flex h-7 items-center gap-1 rounded-full border border-v2-warn/60 bg-v2-deep/90 px-2.5 font-v2-ui text-caption font-semibold text-v2-warn"
      >
        <Icon id="i-warn" className="size-3.5" />
        {t('statusBar.works.storeFull')}
      </button>
    );
  }

  return (
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
}
