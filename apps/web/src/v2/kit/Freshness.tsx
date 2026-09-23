import type { ClarityState } from '@astera/rules';
import { useTranslation } from 'react-i18next';
import { ageTier, CLARITY_BARS, CLARITY_WORD, type AgeTier } from '../../lib/clarity.js';
import { staleness } from '../../lib/time.js';

/**
 * CERTAINTY IS DRAWN, NOT WRITTEN. Spec B7, decision K11 (docs/ui-v2/gozlemevi.md).
 *
 * Colour says whose a thing is; brightness and grain say how sure you are of it.
 * The two never mix, so a hostile planet you barely see is still red, only dim.
 *   · CLARITY (telescope): five bars and the band's word; the picture dims with it.
 *   · AGE (probe, report): "4h ago", and the picture grains at 1 h, grains hard at
 *     6 h and fades past a day (`.v2-grain` in `surfaces.css`).
 * BLIND draws no picture at all — a dashed socket and a question mark — because a
 * planet you have never seen must not look like one you have.
 */

/** Lit bars carry the clarity luminance ramp: a weak reading is literally darker. */
const BAR: Record<ClarityState, string> = {
  FULL: 'bg-clarity-full',
  CLEAR: 'bg-clarity-clear',
  INTERMITTENT: 'bg-clarity-int',
  DEGRADED: 'bg-clarity-deg',
  BLIND: 'bg-clarity-blind',
};

const DIM: Record<ClarityState, string> = {
  FULL: '',
  CLEAR: 'brightness-90',
  INTERMITTENT: 'brightness-75',
  DEGRADED: 'brightness-50',
  BLIND: '',
};

/** Grain alone could not tell six hours from twenty on a 56 px thumbnail; colour drains with it. */
const FADE: Record<AgeTier, string> = {
  fresh: '',
  aging: '',
  stale: 'saturate-[.7]',
  old: 'opacity-60 saturate-50',
};

/** A telescope reading's clarity: five signal bars and the band as a word. */
export function ClarityMark({ state }: { state: ClarityState }) {
  const { t } = useTranslation();
  const word = t(CLARITY_WORD[state]);
  const lit = CLARITY_BARS[state];
  return (
    <span role="img" aria-label={t('clarity.barsLabel', { state: word })} className="inline-flex items-center gap-1.5">
      <span className="inline-flex items-end gap-0.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            data-bar=""
            {...(i < lit ? { 'data-lit': '' } : {})}
            className={`w-[3px] rounded-cell ${i < lit ? BAR[state] : 'bg-v2-line'}`}
            style={{ height: `${String(4 + i * 2)}px` }}
          />
        ))}
      </span>
      <span className="font-v2-mono text-label text-v2-ink-2">{word}</span>
    </span>
  );
}

/** How old a probe or report fact is: "live", "18m ago", "4h 00m ago". */
export function AgeStamp({ minutes }: { minutes: number }) {
  // `staleness` reads i18n directly; subscribing here re-words the stamp when the language changes.
  useTranslation();
  const tier = ageTier(minutes);
  const tone = tier === 'fresh' || tier === 'aging' ? 'text-v2-ink-2' : 'text-v2-ink-3';
  return <span data-age={tier} className={`font-v2-mono text-label ${tone}`}>{staleness(minutes)}</span>;
}

export interface AgedThumbProps {
  src: string;
  /** What the picture is of; a blind socket still names it. */
  alt: string;
  /** Minutes since a probe or report saw it. Grain and fade follow. */
  ageMinutes?: number;
  /** A telescope reading's band. Brightness follows; BLIND draws no picture. */
  clarity?: ClarityState;
  /** Size of the round socket. */
  className?: string;
}

/** A planet picture that shows how far to trust it. */
export function AgedThumb({ src, alt, ageMinutes = 0, clarity = 'FULL', className = 'size-10' }: AgedThumbProps) {
  const tier = ageTier(ageMinutes);
  if (clarity === 'BLIND') {
    return (
      <span
        role="img"
        aria-label={alt}
        data-blind=""
        className={`inline-grid shrink-0 place-items-center rounded-full border border-dashed border-v2-line-hi font-v2-mono text-body text-v2-ink-3 ${className}`}
      >
        <span aria-hidden="true">?</span>
      </span>
    );
  }
  const grain = tier === 'fresh' ? '' : 'v2-grain';
  return (
    <span data-age={tier} className={`relative inline-block shrink-0 overflow-hidden rounded-full ${grain} ${className}`}>
      <img src={src} alt={alt} draggable={false} className={`size-full object-cover ${DIM[clarity]} ${FADE[tier]}`} />
    </span>
  );
}
