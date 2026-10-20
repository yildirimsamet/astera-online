import { useTranslation } from 'react-i18next';
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
          { id: 'world', label: t('baseSwitch.world') },
          { id: 'research', label: t('baseSwitch.research') },
          ...(arenaAvailable ? [{ id: 'ship' as const, label: t('arena.nav') }] : []),
        ]}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}
