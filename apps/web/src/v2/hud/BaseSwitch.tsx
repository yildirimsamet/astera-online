import { useTranslation } from 'react-i18next';
import { Icon } from '../icons.js';
import { Segmented } from '../kit/Segmented.js';

export type BaseView = 'world' | 'research' | 'ship';

/**
 * THIS WORLD | RESEARCH. Decision K6 (docs/ui-v2/gozlemevi.md).
 *
 * Research used to be its own panel behind a corner button; it lives on the Base now,
 * one switch away from the world it is built on. The two pages keep their own routes
 * (`planet`, `research`), so a notification or a refusal that names either still lands
 * on it; this is only the door between them.
 */
export function BaseSwitch({ value, onChange, arenaAvailable = false }: {
  value: BaseView; onChange: (view: BaseView) => void; arenaAvailable?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="px-3 pb-2 pt-1">
      <Segmented
        label={t('baseSwitch.label')}
        options={[
          // Owner 2026-10-27: a coloured glyph beside each word — the world, its research, the ship flown.
          { id: 'world', label: t('baseSwitch.world'), icon: <Icon id="i-base" className="size-4 shrink-0 text-v2-alloy" /> },
          { id: 'research', label: t('baseSwitch.research'), icon: <Icon id="i-spark" className="size-4 shrink-0 text-v2-crystal" /> },
          ...(arenaAvailable ? [{ id: 'ship' as const, label: t('arena.nav'), icon: <Icon id="i-fleet" className="size-4 shrink-0 text-v2-self" /> }] : []),
        ]}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}
