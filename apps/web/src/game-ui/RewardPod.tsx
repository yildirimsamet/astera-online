import { useEffect, useRef, useState, type ReactNode } from 'react';
import { haptic } from '../lib/haptics.js';
import { OWN_SOUND, playSound } from '../lib/sound.js';
import { useOwnPress } from '../ui/kit/useOwnPress.js';

/** The two paintings share one 320 px frame (`export-icons.py`), so the lid opens in place. */
export const POD_ART = { closed: '/assets/ui/icons/pod-closed.webp', open: '/assets/ui/icons/pod-open.webp' } as const;

/** The wind-up between the tap and the lid: long enough to feel, short enough not to wait. */
export const POD_OPEN_MS = 520;

type PodState = 'closed' | 'opening' | 'open';

export interface RewardPodProps {
  /** What a tap does, read aloud and printed under the closed pod ("Kapsülü aç"). */
  label: string;
  /** Grants the reward; called once, when the lid opens. */
  onOpen: () => void;
  /** Already opened (a reload, a second visit): drawn open, nothing granted again. */
  opened?: boolean;
  /** What was inside, shown once the lid is off. */
  children?: ReactNode;
}

/**
 * THE SUPPLY POD: a reward is a thing you open. It hovers with its lights breathing;
 * a tap shakes and squashes it (a rattle, a light buzz), then the lid blows open in a
 * flash and a turning burst of light (a release, a firm buzz) and the contents pop out.
 */
export function RewardPod({ label, onOpen, opened = false, children }: RewardPodProps) {
  const [local, setState] = useState<PodState>('closed');
  // word that it was opened can arrive after the pod is drawn; it wins over a closed lid
  const state: PodState = opened && local === 'closed' ? 'open' : local;
  const lid = useRef<number | null>(null);
  useEffect(() => () => { if (lid.current !== null) window.clearTimeout(lid.current); }, []);
  const own = useOwnPress(() => {
    if (state !== 'closed' || lid.current !== null) return;
    playSound('rattle');
    haptic('tap');
    setState('opening');
    lid.current = window.setTimeout(() => {
      playSound('unseal');
      haptic('commit');
      setState('open');
      onOpen();
    }, POD_OPEN_MS);
  });

  return (
    <div className="gk-pod" data-state={state}>
      <span className="gk-rays gk-pod__rays" aria-hidden="true" />
      <span className="gk-pod__glow" aria-hidden="true" />
      <button
        type="button"
        {...OWN_SOUND}
        className="gk-pod__body"
        aria-label={label}
        aria-disabled={state !== 'closed'}
        onPointerDown={own.onPointerDown}
        onClick={own.onClick}
      >
        <img className="gk-pod__art gk-pod__art--closed" src={POD_ART.closed} alt="" draggable={false} />
        <img className="gk-pod__art gk-pod__art--open" src={POD_ART.open} alt="" draggable={false} />
        <span className="gk-pod__flash" aria-hidden="true" />
      </button>
      {state === 'closed' && <span className="gk-pod__hint gk-display gk-outlined" aria-hidden="true">{label}</span>}
      {state === 'open' && children !== undefined && <div className="gk-pod__loot" role="status">{children}</div>}
    </div>
  );
}
