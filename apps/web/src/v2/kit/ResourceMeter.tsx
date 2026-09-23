import { useTranslation } from 'react-i18next';
import { full, stock } from '../../lib/format.js';
import { RESOURCE_ART } from '../../ui/assets.js';

type Resource = keyof typeof RESOURCE_ART;

const LABEL = {
  alloy: 'statusBar.alloyLabel',
  crystal: 'statusBar.crystalLabel',
  deuterium: 'statusBar.deuteriumLabel',
} as const satisfies Record<Resource, string>;

/** A resource wears its own hue, and only beside its icon. */
const FILL: Record<Resource, string> = {
  alloy: 'bg-v2-alloy',
  crystal: 'bg-v2-crystal',
  deuterium: 'bg-v2-deut',
};

export interface ResourceMeterProps {
  resource: Resource;
  value: number;
  /** The store on this world. Zero draws an empty line. */
  cap: number;
  /** Opens the economy detail. Without it the meter is a reading, not a button. */
  onOpen?: () => void;
}

/**
 * WHAT YOU HOLD AND HOW MUCH ROOM IS LEFT. Spec B1 · resource meter (docs/ui-v2/gozlemevi.md).
 *
 * The icon, the figure (`stock`: whole to 99,999), and a two-pixel line of value
 * over capacity. A FULL STORE IS A GAP TO CLOSE, NOT A DANGER: the line ends in a
 * warn notch and nothing on the meter turns hostile red (H2) — red is reserved for
 * something happening to you.
 */
export function ResourceMeter({ resource, value, cap, onOpen }: ResourceMeterProps) {
  const { t } = useTranslation();
  const share = cap > 0 ? Math.max(0, Math.min(1, value / cap)) : 0;
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
      </span>
      <span className="relative mt-0.5 block h-0.5 w-full rounded-full bg-v2-line">
        <span
          data-fill=""
          className={`absolute inset-y-0 left-0 rounded-full ${FILL[resource]}`}
          style={{ width: `${String(Math.round(share * 100))}%` }}
        />
        {isFull && <span data-full="" className="absolute -top-0.5 right-0 h-1.5 w-0.5 rounded-full bg-v2-warn" />}
      </span>
    </>
  );

  const frame = 'flex min-w-0 flex-col text-left';
  return onOpen
    ? <button type="button" onClick={onOpen} aria-label={name} className={frame}>{body}</button>
    : <span role="img" aria-label={name} className={frame}>{body}</span>;
}
