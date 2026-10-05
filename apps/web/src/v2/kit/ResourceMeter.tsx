import { useTranslation } from 'react-i18next';
import { full, stock } from '../../lib/format.js';
import { RESOURCE_ART } from '../../ui/assets.js';
import { StoreBar } from './StoreBar.js';

type Resource = keyof typeof RESOURCE_ART;

const LABEL = {
  alloy: 'statusBar.alloyLabel',
  crystal: 'statusBar.crystalLabel',
  deuterium: 'statusBar.deuteriumLabel',
} as const satisfies Record<Resource, string>;

/** A resource wears its own hue, and only beside its icon. */

export interface ResourceMeterProps {
  resource: Resource;
  value: number;
  /** The store on this world. Zero draws an empty line. */
  cap: number;
  /** Opens the economy detail. Without it the meter is a reading, not a button. */
  onOpen?: () => void;
  /** Production is boosted (the recovery boost): a rising mark beside the figure. */
  boosted?: boolean;
  /** How much of the store a raid cannot take (the Vault's floor), bracketed as the Base does. */
  safe?: number;
  transfer?: { id: number; from: number; to: number } | null;
}

/**
 * A STORE FILLING FASTER THAN ITS LEVELS SAY. The recovery boost exists because of
 * the shield and ends with it, so it wears the same colour as the shield on the
 * commander chip. Owner instruction, 2026-09-16.
 */
function BoostMark() {
  const { t } = useTranslation();
  return (
    <span role="img" aria-label={t('statusBar.recoveryBoost.mark')} className="shrink-0 text-v2-self">
      <svg viewBox="0 0 10 12" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-2.5 w-2">
        <path d="M5 10.5V2" />
        <path d="M1.5 5.2 5 1.7l3.5 3.5" />
      </svg>
    </span>
  );
}

/**
 * WHAT YOU HOLD AND HOW MUCH ROOM IS LEFT. Spec B1 · resource meter (docs/ui-v2/gozlemevi.md).
 *
 * The icon, the figure (`stock`: whole to 99,999), and a two-pixel line of value
 * over capacity. A FULL STORE IS A GAP TO CLOSE, NOT A DANGER: the line ends in a
 * warn notch and nothing on the meter turns hostile red (H2) — red is reserved for
 * something happening to you.
 */
export function ResourceMeter({ resource, value, cap, onOpen, boosted = false, safe = 0, transfer = null }: ResourceMeterProps) {
  const { t } = useTranslation();
  const isFull = cap > 0 && value >= cap - 0.5;
  const name = t(isFull ? 'meter.full' : 'meter.reading', {
    resource: t(LABEL[resource]),
    value: full(value),
    cap: full(cap),
  });

  const body = (
    <>
      <span className="flex items-center gap-1">
        <img src={RESOURCE_ART[resource]} alt="" draggable={false} className="size-4 shrink-0 object-contain" />
        <span className="font-v2-mono text-body tabular-nums text-v2-ink">{stock(value)}</span>
        {boosted && <BoostMark />}
      </span>
      {/* The Base's own store bar, compact (owner, 2026-09-25: the two did not match). */}
      {/* Full by the meter's own reading, so the name and the cap never disagree over a fraction. */}
      <StoreBar compact value={isFull ? cap : value} cap={cap} safe={safe} tone={resource} />
      {transfer && transfer.to > transfer.from && [0, 1, 2].map((index) => (
        <img key={`${String(transfer.id)}:${String(index)}`} data-collect-particle="" src={RESOURCE_ART[resource]} alt="" aria-hidden="true"
          className="pointer-events-none absolute bottom-[-18px] size-2.5 animate-[v2-collect-flight_700ms_ease-out_both] object-contain"
          style={{ left: `${String(20 + index * 14)}%`, animationDelay: `${String(index * 75)}ms` }} />
      ))}
    </>
  );

  const frame = 'relative flex min-w-0 flex-col text-left';
  return onOpen
    ? <button type="button" onClick={onOpen} aria-label={name} className={frame}>{body}</button>
    : <span role="img" aria-label={name} className={frame}>{body}</span>;
}
