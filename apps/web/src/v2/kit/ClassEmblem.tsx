import type { HullClass } from '@astera/rules';
import { combatClassLabel } from '../../i18n/names.js';
import { Icon, type IconId } from '../icons.js';

const EMBLEM: Record<HullClass, IconId> = {
  SKIRMISHER: 'c-sk',
  BULWARK: 'c-bw',
  LANCE: 'c-ln',
  SUPPORT: 'c-sp',
};

/** The icon a combat class is drawn with: ▲ Skirmisher, ⬢ Bulwark, ◆ Lance, ● Support. */
export const classEmblemId = (cls: HullClass): IconId => EMBLEM[cls];

/**
 * ONE SHAPE PER CLASS, EVERYWHERE. Spec B8 (docs/ui-v2/gozlemevi.md).
 *
 * The counter cycle decides every battle — Skirmisher beats Bulwark beats Lance
 * beats Skirmisher — so the same four shapes stand wherever a class does: the
 * shipyard card, the launch row, the probe reading, the report. Filled and
 * colourless: the colour comes from whose ships they are.
 *
 * `decorative` when the class name is already written beside it, so a screen
 * reader does not hear it twice.
 */
export function ClassEmblem({
  cls,
  className = 'size-3',
  decorative = false,
}: {
  cls: HullClass;
  className?: string;
  decorative?: boolean;
}) {
  return decorative
    ? <Icon id={EMBLEM[cls]} className={className} />
    : <Icon id={EMBLEM[cls]} className={className} title={combatClassLabel(cls)} />;
}
