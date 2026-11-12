import { useTranslation } from 'react-i18next';
import { compact, full } from '../../lib/format.js';
import { RESOURCE_ART } from '../../ui/assets.js';

type Resource = keyof typeof RESOURCE_ART;

const LABEL = {
  alloy: 'statusBar.alloyLabel',
  crystal: 'statusBar.crystalLabel',
  deuterium: 'statusBar.deuteriumLabel',
} as const satisfies Record<Resource, string>;

/** The kit's fill for each resource; the missing part is hatched in warn (`.gk-need__gap`). */
const FILL: Record<Resource, string> = {
  alloy: 'gk-fill-alloy',
  crystal: 'gk-fill-crystal',
  deuterium: 'gk-fill-deut',
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
    <div data-need-bar={resource} role="img" aria-label={name} className="gk-need">
      <span aria-hidden="true" className="gk-need__row">
        <span className="gk-need__have gk-num">
          <img src={RESOURCE_ART[resource]} alt="" />
          {compact(Math.max(0, have))}
          <span className="gk-need__of">/ {compact(need)}</span>
        </span>
        {missing > 0 && <span className="gk-need__short gk-num">{t('meter.short', { amount: compact(missing) })}</span>}
      </span>
      <span aria-hidden="true" className={`gk-need__bar ${FILL[resource]}`}>
        <span data-have="" className="gk-need__fill" style={{ width: `${String(held)}%` }} />
        {held < 100 && <span data-gap="" className="gk-need__gap" style={{ width: `${String(100 - held)}%` }} />}
      </span>
    </div>
  );
}
