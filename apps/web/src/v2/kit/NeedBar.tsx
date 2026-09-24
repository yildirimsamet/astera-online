import { useTranslation } from 'react-i18next';
import { compact, full } from '../../lib/format.js';
import { RESOURCE_ART } from '../../ui/assets.js';

type Resource = keyof typeof RESOURCE_ART;

const LABEL = {
  alloy: 'statusBar.alloyLabel',
  crystal: 'statusBar.crystalLabel',
  deuterium: 'statusBar.deuteriumLabel',
} as const satisfies Record<Resource, string>;

const FILL: Record<Resource, string> = {
  alloy: 'bg-v2-alloy',
  crystal: 'bg-v2-crystal',
  deuterium: 'bg-v2-deut',
};

/** The missing part: hatched, so it reads as "not there yet" rather than as a second colour. */
const GAP = {
  backgroundImage:
    'repeating-linear-gradient(135deg, color-mix(in srgb, var(--color-v2-warn) 55%, transparent) 0 3px, transparent 3px 6px)',
};

/**
 * HOW CLOSE A PRICE IS, against what you hold. D1.
 *
 * Eight hundred of a thousand and forty of a thousand are the same "short" and
 * completely different situations — one is worth waiting for, the other is not. So
 * the bar draws the price as its whole length: the part you hold in the resource's
 * own colour (beside its icon, K2), the part you are missing hatched in warn. A
 * shortfall is a gap you close by waiting, never a threat, so nothing here is red.
 *
 * Owner, round 2: no white or grey bars — every segment says what it is.
 */
export function NeedBar({ resource, have, need }: { resource: Resource; have: number; need: number }) {
  const { t } = useTranslation();
  const missing = Math.max(0, need - have);
  const held = need > 0 ? Math.min(100, Math.round((Math.max(0, have) / need) * 100)) : 100;
  const name = t('meter.need', {
    resource: t(LABEL[resource]),
    have: full(Math.max(0, have)),
    need: full(need),
    short: full(missing),
  });

  return (
    <div data-need-bar={resource} role="img" aria-label={name} className="flex flex-col gap-1">
      <span aria-hidden="true" className="flex items-center justify-between gap-2 font-v2-mono text-micro tabular-nums">
        <span className="flex items-center gap-1 text-v2-ink">
          <img src={RESOURCE_ART[resource]} alt="" className="size-3.5 shrink-0 object-contain" />
          {compact(Math.max(0, have))}
          <span className="text-v2-ink-3">/ {compact(need)}</span>
        </span>
        {missing > 0 && <span className="text-v2-warn">{t('meter.short', { amount: compact(missing) })}</span>}
      </span>
      <span aria-hidden="true" className="flex h-1.5 w-full overflow-hidden rounded-full">
        <span data-have="" className={`h-full ${FILL[resource]}`} style={{ width: `${String(held)}%` }} />
        {held < 100 && <span data-gap="" className="h-full" style={{ ...GAP, width: `${String(100 - held)}%` }} />}
      </span>
    </div>
  );
}
